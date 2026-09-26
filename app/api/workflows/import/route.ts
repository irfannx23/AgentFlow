import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { authenticatedUserId } from "@/lib/connections/repository";
import {
  detectWorkflowPlatform,
  importWorkflow,
} from "@/lib/automation/importers";
import {
  exportN8n,
  productionExportIssues,
} from "@/lib/automation/exporters/n8n";
import type { Json } from "@/lib/supabase/types";
import { createHash } from "node:crypto";
import {
  answersWithToolPlan,
  toolPlanFromGraph,
} from "@/lib/automation/tool-plan";
import { serverEntitlements } from "@/lib/billing/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function token(request: Request) {
  const value = request.headers.get("authorization");
  return value?.startsWith("Bearer ") ? value.slice(7).trim() : "";
}
function importError(value: unknown) {
  const message = value instanceof Error ? value.message : "";
  return /^(Unsupported workflow file|The n8n workflow|The Make\.com blueprint|Imported workflow validation failed|Production export validation failed|n8n connection)/.test(
    message,
  )
    ? message
    : "Workflow import could not be completed. Verify the file and try again.";
}

export async function POST(request: Request) {
  const bearer = token(request);
  if (!bearer)
    return NextResponse.json(
      { error: "Authentication is required." },
      { status: 401 },
    );
  try {
    const body = (await request.json()) as {
      projectId?: unknown;
      fileName?: unknown;
      payload?: unknown;
      platform?: unknown;
    };
    const projectId = typeof body.projectId === "string" ? body.projectId : "";
    if (!projectId || !body.payload)
      return NextResponse.json(
        { error: "projectId and workflow payload are required." },
        { status: 400 },
      );
    const supabase = createServerSupabaseClient(bearer);
    const ownerId = await authenticatedUserId(supabase);
    const entitlements = await serverEntitlements(supabase);
    if (!entitlements.canImportWorkflow)
      return NextResponse.json(
        { error: "Workflow import is available on AgentFlow Pro." },
        { status: 403 },
      );
    const project = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .maybeSingle();
    if (project.error || !project.data)
      return NextResponse.json(
        { error: "Project not found or access denied." },
        { status: 404 },
      );
    const platform =
      body.platform === "n8n" || body.platform === "make"
        ? body.platform
        : detectWorkflowPlatform(body.payload);
    const { graph, analysis } = importWorkflow(body.payload, platform);
    const requirements = {
      currentProcess: "Imported workflow",
      trigger:
        graph.nodes.find((node) => node.type === "trigger")?.description ?? "",
      inputs: "Imported node parameters",
      outputs: graph.nodes.at(-1)?.description ?? "",
      users: "Existing workflow operators",
      systems: analysis.integrationMap.join(", "),
      integrations: analysis.integrationMap.join(", "),
      conditions: graph.nodes
        .filter((node) => node.type === "condition")
        .map((node) => node.name)
        .join(", "),
      workflow: analysis.workflowSummary,
      requirements:
        "Preserve imported behavior and produce validated maintainable artifacts.",
      assumptions: graph.assumptions.join("\n"),
    };
    const requirementsResult = await supabase
      .from("automation_requirements")
      .upsert(
        {
          project_id: projectId,
          owner_id: ownerId,
          business_problem: analysis.businessPurpose,
          answers: answersWithToolPlan(requirements, toolPlanFromGraph(graph)),
          status: "planning",
        },
        { onConflict: "project_id" },
      )
      .select("*")
      .single();
    if (requirementsResult.error) throw requirementsResult.error;
    const workflowResult = await supabase
      .from("automation_workflows")
      .upsert(
        {
          project_id: projectId,
          owner_id: ownerId,
          name: graph.name,
          status: "generated",
          graph,
          version: 1,
        },
        { onConflict: "project_id" },
      )
      .select("*")
      .single();
    if (workflowResult.error) throw workflowResult.error;
    const savedImport = await supabase
      .from("workflow_imports")
      .insert({
        project_id: projectId,
        owner_id: ownerId,
        platform,
        source_file_name:
          typeof body.fileName === "string" ? body.fileName : "workflow.json",
        source_payload: body.payload as Json,
        analysis,
      })
      .select("*")
      .single();
    if (savedImport.error) throw savedImport.error;
    const exported = exportN8n(graph);
    const exportIssues = productionExportIssues(graph, exported);
    if (exportIssues.length)
      throw new Error(
        `Production export validation failed: ${exportIssues.join(" ")}`,
      );
    const exportResult = await supabase
      .from("automation_exports")
      .insert({
        project_id: projectId,
        owner_id: ownerId,
        workflow_id: workflowResult.data.id,
        workflow_version: 1,
        platform: "n8n",
        payload: exported,
      })
      .select("*")
      .single();
    if (exportResult.error) throw exportResult.error;
    const versionResult = await supabase
      .from("automation_versions")
      .insert({
        project_id: projectId,
        owner_id: ownerId,
        sequence: 1,
        label: "v1.0",
        change_summary: `Imported ${platform === "n8n" ? "n8n" : "Make.com"} workflow`,
        modified_artifacts: ["requirements", "workflow", "export"],
        change_details: {
          added: ["Imported workflow", "Structural analysis"],
          modified: [],
          removed: [],
        },
        ai_reasoning:
          "Normalized the source workflow into the AgentFlow internal schema and validated its production export.",
        workflow_hash: createHash("sha256")
          .update(JSON.stringify(graph))
          .digest("hex"),
        author: "user",
        snapshot: {
          requirements: requirementsResult.data,
          workflow: workflowResult.data,
          export: exportResult.data,
        },
      })
      .select("*")
      .single();
    if (versionResult.error) throw versionResult.error;
    const timeline = await supabase
      .from("project_timeline")
      .insert({
        project_id: projectId,
        owner_id: ownerId,
        event_type: "workflow_imported",
        title: `${platform === "n8n" ? "n8n" : "Make.com"} workflow imported`,
        description: `Analyzed ${graph.nodes.length} nodes and ${graph.edges.length} connections.`,
        metadata: {
          fileName:
            typeof body.fileName === "string" ? body.fileName : "workflow.json",
          complexityScore: analysis.complexityScore,
        },
      });
    if (timeline.error) throw timeline.error;
    return NextResponse.json({
      platform,
      graph,
      analysis,
      requirements: requirementsResult.data,
      workflow: workflowResult.data,
      export: exportResult.data,
      version: versionResult.data,
    });
  } catch (value) {
    return NextResponse.json({ error: importError(value) }, { status: 422 });
  }
}
