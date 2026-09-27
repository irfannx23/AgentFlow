import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  artifactValidationIssues,
  safeFileName,
  zipArtifacts,
  type DownloadArtifact,
} from "@/lib/automation/downloads";
import {
  exportN8n,
  n8nValidationIssues,
  productionExportIssues,
} from "@/lib/automation/exporters/n8n";
import { importWorkflow } from "@/lib/automation/importers";
import { layoutWorkflowGraph } from "@/lib/automation/layout";
import { optimizeWorkflowGraph } from "@/lib/automation/quality";
import {
  workflowValidationIssues,
  type WorkflowGraph,
  type WorkflowNode,
} from "@/lib/automation/types";
import { productionGraphValidationIssues } from "@/lib/automation/validation";
import { extractZipText } from "@/lib/knowledge/archive";
import {
  answersWithToolPlan,
  parseToolPlan,
  toolPlanFromAnswers,
  toolPlanFromGraph,
  toolPlanReady,
} from "@/lib/automation/tool-plan";

const scenarios = [
  ["Employee Onboarding", "HR form", "Create Employee", "Slack Welcome"],
  ["Lead Qualification", "Lead webhook", "Score Lead", "Route Lead"],
  ["CRM Synchronization", "CRM update", "Normalize Contact", "Sync CRM"],
  ["Slack Notifications", "Alert webhook", "Format Alert", "Notify Slack"],
  ["Email Automation", "Email request", "Prepare Email", "Send Email"],
  [
    "Invoice Approvals",
    "Invoice received",
    "Validate Invoice",
    "Request Approval",
  ],
  ["Customer Support", "Support ticket", "Classify Ticket", "Route Ticket"],
  ["Shopify Orders", "Shopify order", "Validate Order", "Create Fulfillment"],
  [
    "Marketing Campaign",
    "Campaign schedule",
    "Build Audience",
    "Launch Campaign",
  ],
  [
    "Webhook Processing",
    "Inbound webhook",
    "Validate Payload",
    "Process Payload",
  ],
] as const;

function node(
  id: string,
  type: WorkflowNode["type"],
  name: string,
  service: string,
): WorkflowNode {
  return {
    id,
    type,
    name,
    description: `${name} for the automation.`,
    service,
    operation: "execute",
    inputs: {},
    outputs: {},
    retry: { attempts: type === "trigger" ? 0 : 3, backoffSeconds: 5 },
    timeoutSeconds: 30,
    position: { x: 0, y: 0 },
  };
}

function fixture([
  name,
  triggerName,
  processName,
  actionName,
]: (typeof scenarios)[number]): WorkflowGraph {
  const nodes = [
    node("trigger", "trigger", triggerName, "webhook"),
    node("validate", "condition", "Validate Request", "AgentFlow"),
    node("process", "action", processName, "internal"),
    node(
      "action",
      "action",
      actionName,
      /Slack/.test(actionName) ? "slack" : "http",
    ),
    node("notify", "action", "Notify Owner", "email"),
    node("error", "error-handler", "Log Failure", "logging"),
  ];
  return {
    schemaVersion: 1,
    name,
    description: `Production ${name.toLowerCase()} workflow.`,
    nodes,
    edges: [
      { id: "e1", source: "trigger", target: "validate" },
      {
        id: "e2",
        source: "validate",
        target: "process",
        condition: "true",
        label: "Valid",
      },
      {
        id: "e3",
        source: "validate",
        target: "error",
        condition: "false",
        label: "Invalid",
        errorPath: true,
      },
      { id: "e4", source: "process", target: "action" },
      { id: "e5", source: "action", target: "notify" },
      {
        id: "e6",
        source: "action",
        target: "error",
        errorPath: true,
        label: "Failure",
      },
    ],
    variables: [
      {
        name: "WORKFLOW_ENV",
        description: "Deployment environment.",
        type: "string",
        required: true,
      },
    ],
    credentials: [
      {
        name: "automation_credentials",
        service: "http",
        description: "Managed integration credentials.",
        required: true,
      },
    ],
    assumptions: ["Credentials are configured in n8n."],
    risks: [],
  };
}

function n8nEdgeCount(payload: ReturnType<typeof exportN8n>) {
  const value = payload as Record<string, unknown>;
  const connections = value.connections as Record<
    string,
    { main?: unknown[][] }
  >;
  return Object.values(connections).reduce(
    (total, connection) =>
      total +
      (connection.main ?? []).reduce(
        (count, branch) => count + branch.length,
        0,
      ),
    0,
  );
}

describe("production workflow pipeline", () => {
  for (const scenario of scenarios)
    test(`${scenario[0]} validates, lays out, exports and round-trips`, () => {
      const graph = fixture(scenario);
      assert.deepEqual(workflowValidationIssues(graph), []);
      const optimized = optimizeWorkflowGraph({
        ...graph,
        edges: [...graph.edges, { ...graph.edges[0], id: "duplicate" }],
      });
      assert.equal(optimized.edges.length, graph.edges.length);
      const positioned = layoutWorkflowGraph(optimized);
      assert.deepEqual(productionGraphValidationIssues(positioned), []);
      assert.equal(
        new Set(
          positioned.nodes.map(
            (item) => `${item.position.x}:${item.position.y}`,
          ),
        ).size,
        positioned.nodes.length,
      );
      positioned.nodes.forEach((item) => {
        assert.equal(item.position.x % 40, 0);
        assert.equal(item.position.y % 40, 0);
      });
      const positionedById = new Map(
        positioned.nodes.map((item) => [item.id, item]),
      );
      positioned.edges
        .filter(
          (edge) =>
            !edge.errorPath &&
            positionedById.get(edge.target)?.type !== "error-handler",
        )
        .forEach((edge) => {
          assert.ok(
            positionedById.get(edge.target)!.position.x >=
              positionedById.get(edge.source)!.position.x,
            "normal execution should flow left to right",
          );
        });
      const exported = exportN8n(graph);
      assert.deepEqual(n8nValidationIssues(exported), []);
      assert.deepEqual(productionExportIssues(graph, exported), []);
      assert.deepEqual(
        exportN8n(graph),
        exported,
        "export must be deterministic",
      );
      const imported = importWorkflow(exported, "n8n").graph;
      assert.deepEqual(workflowValidationIssues(imported), []);
      assert.equal(imported.nodes.length, positioned.nodes.length);
      assert.equal(imported.edges.length, n8nEdgeCount(exported));
      assert.deepEqual(n8nValidationIssues(exportN8n(imported)), []);
    });
});

test("Make.com blueprint imports and exports through the same validated graph", () => {
  const blueprint = {
    name: "Make Lead Routing",
    flow: [
      {
        id: 1,
        module: "webhooks:customWebhook",
        metadata: { designer: { x: 0, y: 0, name: "Lead Webhook" } },
      },
      {
        id: 2,
        module: "hubspot:createContact",
        metadata: { designer: { x: 300, y: 0, name: "Create Contact" } },
        mapper: { email: "{{1.email}}" },
      },
      {
        id: 3,
        module: "slack:createMessage",
        metadata: { designer: { x: 600, y: 0, name: "Notify Sales" } },
        mapper: { text: "New lead" },
      },
    ],
  };
  const imported = importWorkflow(blueprint, "make").graph;
  assert.deepEqual(workflowValidationIssues(imported), []);
  const exported = exportN8n(imported);
  assert.deepEqual(productionExportIssues(imported, exported), []);
  assert.equal(importWorkflow(exported, "n8n").graph.nodes.length, 3);
});

test("unintentional cycles and literal secrets are rejected", () => {
  const graph = fixture(scenarios[0]);
  graph.edges.push({ id: "cycle", source: "notify", target: "process" });
  graph.nodes.find((item) => item.id === "action")!.inputs.apiKey =
    "live-secret-value";
  const issues = productionGraphValidationIssues(layoutWorkflowGraph(graph));
  assert.ok(issues.some((issue) => issue.includes("cycle")));
  assert.ok(issues.some((issue) => issue.includes("literal secret")));
});

test("download artifacts have safe names, MIME types, data and a valid ZIP envelope", () => {
  const artifacts: DownloadArtifact[] = [
    { name: "README.md", data: "# Project", mimeType: "text/markdown" },
    { name: ".env.example", data: "WORKFLOW_ENV=", mimeType: "text/plain" },
    { name: "workflow.json", data: "{}", mimeType: "application/json" },
    {
      name: "workflow.png",
      data: new Uint8Array([137, 80, 78, 71]),
      mimeType: "image/png",
    },
    { name: "deployment-guide.md", data: "# Deploy", mimeType: "text/markdown" },
  ];
  assert.deepEqual(artifactValidationIssues(artifacts), []);
  assert.equal(safeFileName("Employee Onboarding!"), "employee-onboarding");
  const zip = zipArtifacts(artifacts);
  assert.deepEqual([...zip.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
  assert.deepEqual([...zip.slice(-22, -18)], [0x50, 0x4b, 0x05, 0x06]);
});

test("project packages expose one importable workflow JSON", () => {
  const graph = fixture(scenarios[0]);
  const exported = exportN8n(graph);
  const artifacts: DownloadArtifact[] = [
    { name: "workflow.json", data: JSON.stringify(exported), mimeType: "application/json" },
    { name: "README.md", data: "Import workflow.json into n8n.", mimeType: "text/markdown" },
    { name: "deployment-guide.md", data: "# Deploy", mimeType: "text/markdown" },
    { name: ".env.example", data: "WORKFLOW_ENV=", mimeType: "text/plain" },
    { name: "requirements.md", data: "# Requirements", mimeType: "text/markdown" },
    { name: "architecture-review.md", data: "# Review", mimeType: "text/markdown" },
    { name: "testing-checklist.md", data: "- [ ] Test", mimeType: "text/markdown" },
    { name: "workflow.png", data: new Uint8Array([137, 80, 78, 71]), mimeType: "image/png" },
  ];
  assert.equal(artifacts.filter((artifact) => artifact.name.endsWith(".json")).length, 1);
  assert.deepEqual(n8nValidationIssues(JSON.parse(String(artifacts[0].data))), []);
  assert.deepEqual(artifactValidationIssues(artifacts), []);
  const zip = zipArtifacts(artifacts);
  const extracted = extractZipText(zip);
  assert.match(extracted, /workflow\.json/);
  assert.match(extracted, /Import workflow\.json into n8n/);
  assert.doesNotMatch(extracted, /PNG/);
});

test("automation blueprints persist safely and gate generation on required capability selections", () => {
  const graph = fixture(scenarios[0]);
  const plan = toolPlanFromGraph(graph);
  assert.ok(plan.tools.length > 0);
  assert.equal(toolPlanReady(plan), true);
  assert.equal(plan.blueprint.estimatedNodes, graph.nodes.length);
  assert.equal(plan.blueprint.confidence, 100);
  assert.ok(
    plan.tools.every(
      (tool) =>
        !tool.environmentVariables.some((variable) =>
          variable.name.includes("="),
        ),
    ),
  );
  const incomplete = {
    ...plan,
    tools: plan.tools.map((tool, index) =>
      index === 0 ? { ...tool, selectedTool: null, configured: false } : tool,
    ),
  };
  assert.equal(toolPlanReady(incomplete), false);
  const configured = {
    ...incomplete,
    tools: incomplete.tools.map((tool) => ({
      ...tool,
      selectedTool: tool.selectedTool ?? tool.name,
      configured: true,
    })),
  };
  assert.equal(toolPlanReady(configured), true);
  const answers = answersWithToolPlan({ trigger: "HR form" }, configured);
  assert.deepEqual(toolPlanFromAnswers(answers), parseToolPlan(configured));
  assert.equal(JSON.stringify(answers).includes("live-secret-value"), false);
});
