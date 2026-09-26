import type { Json } from "@/lib/supabase/types";
import type { WorkflowGraph } from "@/lib/automation/types";

export const expectedAutomationArtifacts = [
  "README.md",
  "requirements.md",
  "workflow.json",
  "workflow.png",
  "deployment-guide.md",
  ".env.example",
  "testing-checklist.md",
  "architecture-review.md",
  "n8n workflow JSON",
  "Project.zip",
];
export type ToolEnvironmentVariable = {
  name: string;
  purpose: string;
  required: boolean;
};
export type AutomationBlueprint = {
  objective: string;
  trigger: string;
  actions: string[];
  complexity: "Low" | "Medium" | "High";
  confidence: number;
  estimatedNodes: number;
  expectedArtifacts: string[];
};
export type AutomationTool = {
  id: string;
  name: string;
  selectedTool: string | null;
  alternatives: string[];
  category: string;
  purpose: string;
  usedFor: string;
  recommendationReason: string;
  confidence: number;
  credential: string;
  environmentVariables: ToolEnvironmentVariable[];
  permissions: string[];
  optionalConfiguration: string[];
  required: boolean;
  configured: boolean;
  skipped: boolean;
  exporterSupported: boolean;
  credentialMappable: boolean;
  conflictsWith: string[];
};
export type ToolPlan = {
  version: 2;
  summary: string;
  blueprint: AutomationBlueprint;
  tools: AutomationTool[];
  finalizedAt?: string;
};
export type BlueprintReadiness = {
  ready: boolean;
  issues: string[];
  checks: Array<{ label: string; ready: boolean; optional?: boolean }>;
};

const stringList = (value: unknown) =>
  Array.isArray(value)
    ? value
        .filter(
          (item): item is string =>
            typeof item === "string" && Boolean(item.trim()),
        )
        .map((item) => item.trim())
    : [];
const confidence = (value: unknown, fallback = 80) =>
  Math.max(
    0,
    Math.min(
      100,
      Number.isFinite(Number(value)) ? Math.round(Number(value)) : fallback,
    ),
  );
const complexity = (value: unknown): AutomationBlueprint["complexity"] =>
  ["Low", "Medium", "High"].includes(String(value))
    ? (String(value) as AutomationBlueprint["complexity"])
    : "Medium";

export function parseToolPlan(value: unknown): ToolPlan {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("The generated automation blueprint was invalid.");
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.tools) || !record.tools.length)
    throw new Error(
      "The generated automation blueprint did not contain any relevant capabilities.",
    );
  const rawBlueprint =
    record.blueprint &&
    typeof record.blueprint === "object" &&
    !Array.isArray(record.blueprint)
      ? (record.blueprint as Record<string, unknown>)
      : {};
  const seen = new Set<string>();
  const tools = record.tools.map((candidate, index): AutomationTool => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate))
      throw new Error(`Capability ${index + 1} was invalid.`);
    const item = candidate as Record<string, unknown>;
    const name = String(item.name ?? item.recommendedTool ?? "").trim();
    const category =
      String(item.category ?? item.capability ?? "Integration").trim() ||
      "Integration";
    const id = String(item.id ?? category)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    if (!name || !id || seen.has(id))
      throw new Error(
        `Capability ${index + 1} must have a unique identifier and recommendation.`,
      );
    seen.add(id);
    const environmentVariables = (
      Array.isArray(item.environmentVariables) ? item.environmentVariables : []
    ).map((variable, variableIndex): ToolEnvironmentVariable => {
      if (!variable || typeof variable !== "object" || Array.isArray(variable))
        throw new Error(
          `${category} environment variable ${variableIndex + 1} was invalid.`,
        );
      const entry = variable as Record<string, unknown>;
      const variableName = String(entry.name ?? "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9_]/g, "_");
      if (!/^[A-Z][A-Z0-9_]*$/.test(variableName))
        throw new Error(
          `${category} contains an invalid environment variable name.`,
        );
      return {
        name: variableName,
        purpose: String(entry.purpose ?? "").trim(),
        required: entry.required !== false,
      };
    });
    const required = item.required !== false;
    const skipped = item.skipped === true;
    const explicitSelection = Object.hasOwn(item, "selectedTool")
      ? item.selectedTool
      : name;
    const selectedTool =
      skipped ||
      explicitSelection === null ||
      String(explicitSelection).trim() === ""
        ? null
        : String(explicitSelection).trim();
    return {
      id,
      name,
      selectedTool,
      alternatives: [
        ...new Set(
          stringList(item.alternatives).filter((option) => option !== name),
        ),
      ],
      category,
      purpose: String(item.purpose ?? "").trim(),
      usedFor: String(item.usedFor ?? "").trim(),
      recommendationReason: String(
        item.recommendationReason ??
          `Recommended for ${String(item.usedFor ?? item.purpose ?? category).trim()}.`,
      ).trim(),
      confidence: confidence(item.confidence),
      credential: String(item.credential ?? "").trim(),
      environmentVariables,
      permissions: stringList(item.permissions),
      optionalConfiguration: stringList(item.optionalConfiguration),
      required,
      configured: item.configured === true || Boolean(selectedTool),
      skipped,
      exporterSupported: item.exporterSupported !== false,
      credentialMappable: item.credentialMappable !== false,
      conflictsWith: stringList(item.conflictsWith),
    };
  });
  const actions = stringList(rawBlueprint.actions);
  const estimatedNodes = Math.max(
    tools.length + 1,
    Math.min(
      500,
      Math.round(
        Number(rawBlueprint.estimatedNodes) || Math.max(4, tools.length * 4),
      ),
    ),
  );
  return {
    version: 2,
    summary: String(record.summary ?? rawBlueprint.objective ?? "").trim(),
    blueprint: {
      objective: String(
        rawBlueprint.objective ?? record.summary ?? "Production automation",
      ).trim(),
      trigger: String(
        rawBlueprint.trigger ??
          tools.find((tool) => /trigger/i.test(tool.category))?.usedFor ??
          "Configured event",
      ).trim(),
      actions: actions.length
        ? actions
        : tools.map((tool) => tool.usedFor).filter(Boolean),
      complexity: complexity(rawBlueprint.complexity),
      confidence: confidence(rawBlueprint.confidence),
      estimatedNodes,
      expectedArtifacts: stringList(rawBlueprint.expectedArtifacts).length
        ? stringList(rawBlueprint.expectedArtifacts)
        : expectedAutomationArtifacts,
    },
    tools,
    ...(typeof record.finalizedAt === "string"
      ? { finalizedAt: record.finalizedAt }
      : {}),
  };
}

export function toolPlanFromAnswers(answers: Json): ToolPlan | null {
  if (!answers || typeof answers !== "object" || Array.isArray(answers))
    return null;
  const stored = answers._toolPlan;
  if (!stored) return null;
  try {
    return parseToolPlan(
      typeof stored === "string" ? JSON.parse(stored) : stored,
    );
  } catch {
    return null;
  }
}
export function answersWithToolPlan(answers: Json, plan: ToolPlan): Json {
  const record =
    answers && typeof answers === "object" && !Array.isArray(answers)
      ? answers
      : {};
  return { ...record, _toolPlan: plan as unknown as Json };
}

export function blueprintReadiness(plan: ToolPlan): BlueprintReadiness {
  const issues: string[] = [];
  const selected = plan.tools.filter((tool) => Boolean(tool.selectedTool));
  for (const tool of plan.tools) {
    if (tool.required && !tool.selectedTool)
      issues.push(`${tool.category} needs a selected tool.`);
    if (tool.selectedTool && !tool.exporterSupported)
      issues.push(
        `${tool.selectedTool} is not supported by the production exporter.`,
      );
    if (tool.selectedTool && !tool.credentialMappable)
      issues.push(
        `${tool.selectedTool} does not have a valid credential mapping.`,
      );
    if (!tool.purpose || !tool.usedFor)
      issues.push(`${tool.category} is missing planning context.`);
    const conflict = selected.find(
      (candidate) =>
        candidate.id !== tool.id &&
        tool.conflictsWith.includes(candidate.selectedTool ?? ""),
    );
    if (conflict)
      issues.push(
        `${tool.selectedTool} conflicts with ${conflict.selectedTool}.`,
      );
  }
  const environmentReady = plan.tools.every((tool) =>
    tool.environmentVariables.every((variable) =>
      /^[A-Z][A-Z0-9_]*$/.test(variable.name),
    ),
  );
  const checks: BlueprintReadiness["checks"] = plan.tools.map((tool) => ({
    label: tool.category,
    ready: Boolean(tool.selectedTool) || (!tool.required && tool.skipped),
    optional: !tool.required,
  }));
  checks.push(
    {
      label: "Export Compatibility",
      ready: selected.every((tool) => tool.exporterSupported),
    },
    {
      label: "Credentials Ready",
      ready: selected.every((tool) => tool.credentialMappable),
    },
    { label: "Environment Ready", ready: environmentReady },
  );
  return { ready: issues.length === 0, issues: [...new Set(issues)], checks };
}
export function toolPlanIssues(plan: ToolPlan) {
  return blueprintReadiness(plan).issues;
}
export function toolPlanReady(plan: ToolPlan) {
  return blueprintReadiness(plan).ready;
}

export function toolPlanFromGraph(graph: WorkflowGraph): ToolPlan {
  const services = [
    ...new Set(
      [
        ...graph.nodes.map((node) => node.service?.trim() ?? ""),
        ...graph.credentials.map((credential) => credential.service.trim()),
      ].filter(
        (service) => service && !/^(internal|agentflow)$/i.test(service),
      ),
    ),
  ];
  const tools = services.map((service, index): AutomationTool => {
    const nodes = graph.nodes.filter((node) => node.service === service);
    const credentials = graph.credentials.filter(
      (credential) =>
        credential.service.toLowerCase() === service.toLowerCase(),
    );
    return {
      id:
        service
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || `tool-${index + 1}`,
      name: service,
      selectedTool: service,
      alternatives: [],
      category: nodes.some((node) => node.type === "trigger")
        ? "Trigger"
        : "Integration",
      purpose:
        nodes
          .map((node) => node.description)
          .filter(Boolean)
          .join(" ") || `Support ${service} operations.`,
      usedFor:
        nodes.map((node) => node.name).join(", ") || `${service} integration`,
      recommendationReason: "Detected directly in the imported workflow.",
      confidence: 100,
      credential: credentials.map((credential) => credential.name).join(", "),
      environmentVariables:
        index === 0
          ? graph.variables.map((variable) => ({
              name: variable.name,
              purpose: variable.description,
              required: variable.required,
            }))
          : [],
      permissions: [],
      optionalConfiguration: [],
      required: true,
      configured: true,
      skipped: false,
      exporterSupported: true,
      credentialMappable: true,
      conflictsWith: [],
    };
  });
  if (!tools.length)
    tools.push({
      id: "workflow-runtime",
      name: "Workflow Runtime",
      selectedTool: "Workflow Runtime",
      alternatives: [],
      category: "Runtime",
      purpose: "Execute the imported automation.",
      usedFor: "Workflow execution",
      recommendationReason: "Required to run the imported workflow.",
      confidence: 100,
      credential: "",
      environmentVariables: graph.variables.map((variable) => ({
        name: variable.name,
        purpose: variable.description,
        required: variable.required,
      })),
      permissions: [],
      optionalConfiguration: [],
      required: true,
      configured: true,
      skipped: false,
      exporterSupported: true,
      credentialMappable: true,
      conflictsWith: [],
    });
  return parseToolPlan({
    version: 2,
    summary: `Production blueprint extracted from ${graph.name}.`,
    blueprint: {
      objective: graph.description,
      trigger:
        graph.nodes.find((node) => node.type === "trigger")?.name ??
        "Imported trigger",
      actions: graph.nodes
        .filter(
          (node) => node.type !== "trigger" && node.type !== "error-handler",
        )
        .map((node) => node.name),
      complexity:
        graph.nodes.length > 25
          ? "High"
          : graph.nodes.length > 10
            ? "Medium"
            : "Low",
      confidence: 100,
      estimatedNodes: graph.nodes.length,
      expectedArtifacts: expectedAutomationArtifacts,
    },
    tools,
  });
}
