"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  ClipboardList,
  Clock3,
  Download,
  Eye,
  FileArchive,
  FileCode2,
  FlaskConical,
  GitBranch,
  History,
  Info,
  KeyRound,
  ListChecks,
  MoreHorizontal,
  PackageCheck,
  RefreshCw,
  Rocket,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  Workflow,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  useAI,
  type ArtifactJob,
  type ArtifactStage,
} from "@/components/ai-provider";
import { useArtifactGeneration } from "@/components/use-artifact-generation";
import type { Project } from "@/components/workspace-state";
import { isWorkflowGraph, type WorkflowGraph } from "@/lib/automation/types";
import { n8nValidationIssues } from "@/lib/automation/exporters/n8n";
import { layoutWorkflowGraph } from "@/lib/automation/layout";
import { optimizeWorkflowGraph } from "@/lib/automation/quality";
import {
  downloadArtifact,
  downloadProjectZip,
  workflowPng,
  type DownloadArtifact,
} from "@/lib/automation/downloads";
import { useDialogFocus } from "@/components/use-dialog-focus";
import type { Json } from "@/lib/supabase/types";

type ReportItem = {
  id: ArtifactStage;
  title: string;
  icon: LucideIcon;
  status: string;
  state: ArtifactJob["status"] | "pending";
  description: string;
  generatedAt?: string;
  content: React.ReactNode;
  instructions: React.ReactNode;
  files: DownloadArtifact[];
};
const statusCopy: Record<ArtifactJob["status"] | "pending", string> = {
  queued: "Queued",
  generating: "Generating…",
  validating: "Validating…",
  persisting: "Saving…",
  complete: "Ready",
  error: "Needs attention",
  pending: "Waiting",
};

function WorkflowDiagram({ graph }: { graph: WorkflowGraph }) {
  const names = new Map(graph.nodes.map((node) => [node.id, node.name]));
  return (
    <div className="report-flow">
      {graph.edges.map((edge) => (
        <div key={edge.id}>
          <span>{names.get(edge.source) ?? edge.source}</span>
          <ArrowRight size={12} />
          <span>{names.get(edge.target) ?? edge.target}</span>
          {edge.condition && <small>{edge.condition}</small>}
        </div>
      ))}
    </div>
  );
}
function DocumentationText({ text }: { text: string }) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return (
    <div className="report-doc-text">
      {lines.map((line, index) => {
        if (/^#{1,3}\s/.test(line))
          return <h4 key={index}>{line.replace(/^#{1,3}\s+/, "")}</h4>;
        if (/^[-*]\s/.test(line))
          return (
            <div className="report-doc-list" key={index}>
              <Check size={12} />
              <span>{line.replace(/^[-*]\s+/, "")}</span>
            </div>
          );
        if (/^\d+\.\s/.test(line))
          return (
            <div className="report-doc-list numbered" key={index}>
              <i>{line.match(/^\d+/)?.[0]}</i>
              <span>{line.replace(/^\d+\.\s+/, "")}</span>
            </div>
          );
        return (
          <div className="report-doc-paragraph" key={index}>
            {line}
          </div>
        );
      })}
    </div>
  );
}
function DocHeading({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h3 className="report-doc-heading">
      {icon}
      {title}
    </h3>
  );
}
function FileViewer({ file }: { file: DownloadArtifact }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (file.mimeType !== "image/png" && file.mimeType !== "application/pdf") {
      setUrl("");
      return;
    }
    let active = true;
    let objectUrl = "";
    void Promise.resolve(
      typeof file.data === "function" ? file.data() : file.data,
    ).then((data) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(
        new Blob([data as BlobPart], { type: file.mimeType }),
      );
      setUrl(objectUrl);
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file]);
  if (file.mimeType === "image/png")
    return url ? (
      <img
        className="artifact-image-preview"
        src={url}
        alt="Generated workflow diagram"
      />
    ) : (
      <div className="artifact-file-summary">
        <FileCode2 size={24} />
        <strong>Rendering {file.name}…</strong>
      </div>
    );
  if (file.mimeType === "application/pdf")
    return url ? (
      <iframe className="artifact-pdf-preview" src={url} title={file.name} />
    ) : (
      <div className="artifact-file-summary">
        <FileCode2 size={24} />
        <strong>Preparing {file.name}…</strong>
      </div>
    );
  if (file.mimeType === "application/json")
    return (
      <div className="artifact-file-summary">
        <FileCode2 size={24} />
        <strong>{file.name}</strong>
        <p>
          This validated machine-readable artifact is represented by the visual
          stage details above. Download it for import or integration.
        </p>
      </div>
    );
  return typeof file.data === "string" ? (
    <DocumentationText text={file.data} />
  ) : (
    <div className="artifact-file-summary">
      <FileCode2 size={24} />
      <strong>{file.name}</strong>
      <p>This generated file is ready to download.</p>
    </div>
  );
}
function stageState(job: ArtifactJob | undefined, ready: boolean) {
  return job?.status ?? (ready ? "complete" : "pending");
}

function ReportModal({
  item,
  close,
  regenerate,
  downloadProject,
  projectReady,
}: {
  item: ReportItem;
  close: () => void;
  regenerate: (stage: ArtifactStage) => void;
  downloadProject: () => void;
  projectReady: boolean;
}) {
  useDialogFocus<HTMLElement>(close);
  const [mode, setMode] = useState<"view" | "instructions">("view");
  const [file, setFile] = useState<DownloadArtifact | null>(null);
  const Icon = item.icon;
  useEffect(() => {
    setMode("view");
    setFile(null);
  }, [item.id]);
  return (
    <div
      className="report-modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <section
        className="report-modal artifact-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-modal-title"
      >
        <header>
          <div className="artifact-modal-title">
            <span className={`artifact-modal-icon ${item.state}`}>
              <Icon size={20} />
            </span>
            <div>
              <span className={`report-modal-badge ${item.state}`}>
                {item.state === "complete" && <Check size={11} />} {item.status}
              </span>
              <h2 id="report-modal-title">{item.title}</h2>
              {item.generatedAt && (
                <time>
                  Generated {new Date(item.generatedAt).toLocaleString()}
                </time>
              )}
            </div>
          </div>
          <button className="artifact-close" onClick={close} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="artifact-modal-tabs">
          <button
            className={mode === "view" ? "active" : ""}
            onClick={() => {
              setMode("view");
              setFile(null);
            }}
          >
            <Eye size={14} />
            View
          </button>
          <button
            className={mode === "instructions" ? "active" : ""}
            onClick={() => {
              setMode("instructions");
              setFile(null);
            }}
          >
            <Info size={14} />
            How to use
          </button>
        </div>
        <div className="report-modal-content">
          {file ? (
            <>
              <button className="artifact-back" onClick={() => setFile(null)}>
                ← Back to {item.title}
              </button>
              <FileViewer file={file} />
            </>
          ) : mode === "view" ? (
            item.content
          ) : (
            item.instructions
          )}
        </div>
        <footer className="artifact-modal-footer">
          <div className="artifact-files">
            <strong>Generated files</strong>
            {item.files.length ? (
              item.files.map((value) => (
                <div className="artifact-file" key={value.name}>
                  <span>
                    <FileCode2 size={15} />
                    <b>{value.name}</b>
                  </span>
                  <div>
                    <button onClick={() => setFile(value)}>
                      <Eye size={13} />
                      View
                    </button>
                    <button onClick={() => void downloadArtifact(value)}>
                      <Download size={13} />
                      Download
                    </button>
                    <button onClick={() => regenerate(item.id)}>
                      <RefreshCw size={13} />
                      Regenerate
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p>Files appear here when this stage completes.</p>
            )}
          </div>
          {item.id === "export" && (
            <button
              className="lime-button artifact-project-download"
              disabled={!projectReady}
              onClick={downloadProject}
            >
              <FileArchive size={16} />
              Download Project.zip
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}

function stringList(value: Json) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
function jsonRecord(value: Json) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Json | undefined>)
    : null;
}

function LifecycleModal({
  mode,
  close,
  versions,
  timeline,
  onRestore,
  onDownload,
}: {
  mode: "versions" | "timeline";
  close: () => void;
  versions: ReturnType<typeof useAI>["versions"];
  timeline: ReturnType<typeof useAI>["timeline"];
  onRestore: (id: string) => void;
  onDownload: (id: string) => void;
}) {
  useDialogFocus<HTMLElement>(close);
  const [compareId, setCompareId] = useState<string | null>(null);
  return (
    <div
      className="report-modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <section
        className="report-modal lifecycle-modal"
        role="dialog"
        aria-modal="true"
      >
        <header>
          <div className="artifact-modal-title">
            <span className="artifact-modal-icon complete">
              {mode === "versions" ? (
                <History size={20} />
              ) : (
                <Clock3 size={20} />
              )}
            </span>
            <div>
              <span className="report-modal-badge complete">
                Project memory
              </span>
              <h2>
                {mode === "versions" ? "Version history" : "Project timeline"}
              </h2>
            </div>
          </div>
          <button className="artifact-close" onClick={close} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="report-modal-content lifecycle-list">
          {mode === "versions" ? (
            versions.length ? (
              versions.map((version, index) => {
                const details = jsonRecord(version.change_details);
                const previous = versions[index + 1];
                return (
                  <article key={version.id}>
                    <div>
                      <strong>{version.label}</strong>
                      <time>
                        {new Date(version.created_at).toLocaleString()}
                      </time>
                    </div>
                    <h3>{version.change_summary}</h3>
                    {stringList(version.modified_artifacts).length > 0 && (
                      <p>
                        <b>Affected:</b>{" "}
                        {stringList(version.modified_artifacts).join(", ")}
                      </p>
                    )}
                    {(["added", "modified", "removed"] as const).map((key) => {
                      const values = details
                        ? stringList(details[key] ?? [])
                        : [];
                      return values.length ? (
                        <p key={key}>
                          <b>{key[0].toUpperCase() + key.slice(1)}:</b>{" "}
                          {values.join(", ")}
                        </p>
                      ) : null;
                    })}
                    {compareId === version.id && previous && (
                      <div className="version-comparison">
                        <b>
                          {previous.label} → {version.label}
                        </b>
                        <span>{version.change_summary}</span>
                        <small>
                          No raw diff ·{" "}
                          {stringList(version.modified_artifacts).length}{" "}
                          affected artifact(s)
                        </small>
                      </div>
                    )}
                    <footer>
                      <span>
                        {version.author === "user"
                          ? "Requested by user"
                          : "Generated by AgentFlow AI"}
                      </span>
                      {previous && (
                        <button
                          onClick={() =>
                            setCompareId((current) =>
                              current === version.id ? null : version.id,
                            )
                          }
                        >
                          <History size={13} />
                          Compare previous
                        </button>
                      )}
                      <button onClick={() => onDownload(version.id)}>
                        <Download size={13} />
                        Download
                      </button>
                      <button onClick={() => onRestore(version.id)}>
                        <RotateCcw size={13} />
                        Restore
                      </button>
                    </footer>
                  </article>
                );
              })
            ) : (
              <div className="artifact-empty">
                <History size={27} />
                <strong>No versions yet</strong>
                <p>
                  A version is created after a validated generation or update.
                </p>
              </div>
            )
          ) : timeline.length ? (
            timeline.map((event) => (
              <article key={event.id}>
                <div>
                  <strong>{event.title}</strong>
                  <time>{new Date(event.created_at).toLocaleString()}</time>
                </div>
                {event.description && <p>{event.description}</p>}
                <footer>
                  <span>{event.event_type.replaceAll("_", " ")}</span>
                </footer>
              </article>
            ))
          ) : (
            <div className="artifact-empty">
              <Clock3 size={27} />
              <strong>No project activity yet</strong>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export function ProjectWorkspace({
  project,
  workspaceName,
  onContinue,
  onManage,
  onUpdate,
}: {
  project: Project;
  workspaceName: string;
  onContinue: () => void;
  onManage: () => void;
  onUpdate: (
    projectId: string,
    values: { description?: string; phase?: string },
  ) => Promise<void>;
}) {
  const ai = useAI();
  const generation = useArtifactGeneration();
  const [activeId, setActiveId] = useState<ArtifactStage | null>(null);
  const [lifecycle, setLifecycle] = useState<"versions" | "timeline" | null>(
    null,
  );
  const graph =
    ai.projectId === project.id &&
    ai.workflow &&
    isWorkflowGraph(ai.workflow.graph)
      ? ai.workflow.graph
      : null;
  const jobs = ai.artifactJobs[project.id] ?? {};
  const answers =
    ai.projectId === project.id &&
    ai.requirements?.answers &&
    typeof ai.requirements.answers === "object" &&
    !Array.isArray(ai.requirements.answers)
      ? Object.entries(ai.requirements.answers).filter(
          ([key, value]) => !key.startsWith("_") && String(value ?? "").trim(),
        )
      : [];
  const branches =
    graph?.edges.filter((edge) => Boolean(edge.condition)).length ?? 0;
  const environmentVariables =
    Array.isArray(ai.workflow?.environment_variables) &&
    ai.workflow.environment_variables.every(
      (item) =>
        item &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        typeof item.name === "string" &&
        typeof item.description === "string" &&
        typeof item.required === "boolean",
    )
      ? (ai.workflow.environment_variables as Array<{
          name: string;
          description: string;
          required: boolean;
        }>)
      : [];
  const testingChecklist =
    Array.isArray(ai.workflow?.testing_checklist) &&
    ai.workflow.testing_checklist.every(
      (item) => typeof item === "string" && item.trim(),
    )
      ? (ai.workflow.testing_checklist as string[])
      : [];
  const workflowReady =
    Boolean(graph) && (!jobs.workflow || jobs.workflow.status === "complete");
  const requirementsReady =
    ["planning", "ready"].includes(ai.requirements?.status ?? "") &&
    Boolean(ai.requirements?.business_problem.trim());
  const deploymentReady =
    Boolean(ai.workflow?.deployment_guide?.trim()) &&
    (!jobs.deployment || jobs.deployment.status === "complete");
  const environmentReady =
    jobs.environment?.status === "complete" ||
    (!jobs.environment &&
      Boolean(ai.workflow) &&
      (environmentVariables.length > 0 || ai.workflow?.status === "reviewed"));
  const testingReady =
    testingChecklist.length > 0 &&
    (!jobs.testing || jobs.testing.status === "complete");
  const reviewReady =
    Boolean(ai.workflow?.explanation?.trim()) &&
    (!jobs.review || jobs.review.status === "complete");
  const latestExport =
    !jobs.export || jobs.export.status === "complete"
      ? ai.exports.find(
          (item) =>
            item.workflow_version === ai.workflow?.version &&
            n8nValidationIssues(item.payload).length === 0,
        )
      : undefined;
  const loadProjectIntelligence = ai.loadProjectIntelligence;
  useEffect(() => {
    void loadProjectIntelligence(project.id);
  }, [project.id, loadProjectIntelligence]);
  useEffect(() => {
    try {
      const saved = JSON.parse(
        window.sessionStorage.getItem("agentflow:open-stage") ?? "null",
      ) as { projectId?: string; stage?: ArtifactStage } | null;
      if (saved?.projectId === project.id && saved.stage) {
        setActiveId(saved.stage);
        window.sessionStorage.removeItem("agentflow:open-stage");
      }
    } catch {
      window.sessionStorage.removeItem("agentflow:open-stage");
    }
  }, [project.id]);

  const requirementsText = `# Requirements\n\n## Business problem\n\n${ai.requirements?.business_problem ?? project.description}\n\n${answers.map(([key, value]) => `## ${key.replace(/([A-Z])/g, " $1")}\n\n${String(value)}`).join("\n\n")}\n`;
  const requirementsFiles: DownloadArtifact[] = requirementsReady
    ? [
        {
          name: "requirements.md",
          data: requirementsText,
          mimeType: "text/markdown",
        },
      ]
    : [];
  const positionedGraph = graph
    ? layoutWorkflowGraph(optimizeWorkflowGraph(graph))
    : null;
  const workflowFiles: DownloadArtifact[] =
    positionedGraph && workflowReady
      ? [
          {
            name: "workflow.png",
            data: () => workflowPng(positionedGraph),
            mimeType: "image/png",
          },
        ]
      : [];
  const deploymentFiles: DownloadArtifact[] = deploymentReady
    ? [
        {
          name: "deployment-guide.md",
          data: ai.workflow!.deployment_guide!,
          mimeType: "text/markdown",
        },
      ]
    : [];
  const environmentFiles: DownloadArtifact[] = environmentReady
    ? [
        {
          name: ".env.example",
          data: environmentVariables.length
            ? environmentVariables
                .map(
                  (item) =>
                    `# ${item.description}${item.required ? " (required)" : ""}\n${item.name}=`,
                )
                .join("\n\n") + "\n"
            : "# No environment variables are required for this workflow.\n",
          mimeType: "text/plain",
        },
      ]
    : [];
  const testingFiles: DownloadArtifact[] = testingReady
    ? [
        {
          name: "testing-checklist.md",
          data: `# Testing checklist\n\n${testingChecklist.map((item) => `- [ ] ${item}`).join("\n")}\n`,
          mimeType: "text/markdown",
        },
      ]
    : [];
  const reviewFiles: DownloadArtifact[] = reviewReady
    ? [
        {
          name: "architecture-review.md",
          data: ai.workflow!.explanation!,
          mimeType: "text/markdown",
        },
      ]
    : [];
  const productionExportFile: DownloadArtifact | null = latestExport
    ? {
        name: "workflow.json",
        data: JSON.stringify(latestExport.payload, null, 2),
        mimeType: "application/json",
      }
    : null;
  const packageFiles = [
    ...requirementsFiles,
    ...workflowFiles,
    ...deploymentFiles,
    ...environmentFiles,
    ...testingFiles,
    ...reviewFiles,
    ...(productionExportFile ? [productionExportFile] : []),
  ];
  const readme = `# ${project.name}\n\n## Overview\n\n${graph?.description ?? project.description}\n\n## Requirements\n\n${ai.requirements?.business_problem ?? project.description}\n\n${answers.map(([key, value]) => `- ${key.replace(/([A-Z])/g, " $1")}: ${String(value)}`).join("\n")}\n\n## Setup\n\n1. Import workflow.json into n8n.\n2. Configure the required credentials and environment variables.\n3. Test every workflow branch before activation.\n\n## APIs\n\n${graph?.credentials.length ? graph.credentials.map((item) => `- ${item.service}: ${item.description}`).join("\n") : "- No external API credentials are declared."}\n\n## Environment Variables\n\n${environmentVariables.length ? environmentVariables.map((item) => `- ${item.name}: ${item.description}`).join("\n") : "- No environment variables are required."}\n\n## Deployment\n\nImport, configure, test, and activate the validated workflow.\n\n## Testing\n\nVerify triggers, branches, integrations, retries, and failure handling.\n\n## Future Updates\n\nContinue the AgentFlow conversation to diagnose failures, request targeted repairs, and create a new validated version without overwriting this one.\n`;
  const readmeFile: DownloadArtifact = {
    name: "README.md",
    data: readme,
    mimeType: "text/markdown",
  };
  const exportFiles: DownloadArtifact[] = latestExport
    ? [readmeFile, productionExportFile!]
    : [];
  const validatedFiles = [readmeFile, ...packageFiles];
  const allReady =
    requirementsReady &&
    workflowReady &&
    deploymentReady &&
    environmentReady &&
    testingReady &&
    reviewReady &&
    Boolean(latestExport);
  const exportProject = async () => {
    void ai.addTimelineEvent({
      project_id: project.id,
      event_type: "project_downloaded",
      title: "Project package downloaded",
      description: "Downloaded the latest validated project artifacts.",
    });
    await downloadProjectZip(project.name, validatedFiles);
  };
  const regenerate = (stage: ArtifactStage) => {
    void generation.start(project, onUpdate, stage, undefined, {
      summary: `Regenerated ${stage}`,
      reasoning: "User requested independent artifact regeneration.",
      modified: [stage],
      author: "user",
    });
  };
  const downloadVersion = (id: string) => {
    const version = ai.versions.find((item) => item.id === id);
    if (!version) return;
    const snapshot = jsonRecord(version.snapshot);
    const requirement = jsonRecord(snapshot?.requirements ?? null);
    const storedWorkflow = jsonRecord(snapshot?.workflow ?? null);
    const storedExport = jsonRecord(snapshot?.export ?? null);
    const storedAnswers = jsonRecord(requirement?.answers ?? null);
    const requirementsText = `# Requirements\n\n## Business problem\n\n${String(requirement?.business_problem ?? "")}\n\n${Object.entries(
      storedAnswers ?? {},
    )
      .map(
        ([key, value]) =>
          `## ${key.replace(/([A-Z])/g, " $1")}\n\n${String(value ?? "")}`,
      )
      .join("\n\n")}\n`;
    const workflowJson = storedWorkflow?.graph ?? {};
    const environment = Array.isArray(storedWorkflow?.environment_variables)
      ? storedWorkflow.environment_variables
      : [];
    const tests = stringList(storedWorkflow?.testing_checklist ?? []);
    const changelog = `# ${project.name} ${version.label}\n\n${version.change_summary}\n\nAffected artifacts: ${stringList(version.modified_artifacts).join(", ")}\n`;
    const files: DownloadArtifact[] = [
      { name: "README.md", data: changelog, mimeType: "text/markdown" },
      {
        name: "requirements.md",
        data: requirementsText,
        mimeType: "text/markdown",
      },
      {
        name: "deployment-guide.md",
        data: String(storedWorkflow?.deployment_guide ?? ""),
        mimeType: "text/markdown",
      },
      {
        name: "architecture-review.md",
        data: String(storedWorkflow?.explanation ?? ""),
        mimeType: "text/markdown",
      },
      {
        name: "testing-checklist.md",
        data: `# Testing checklist\n\n${tests.map((item) => `- [ ] ${item}`).join("\n")}\n`,
        mimeType: "text/markdown",
      },
      {
        name: ".env.example",
        data: environment
          .map((item) => {
            const value = jsonRecord(item);
            return `# ${String(value?.description ?? "")}${value?.required === true ? " (required)" : ""}\n${String(value?.name ?? "VARIABLE")}=`;
          })
          .join("\n\n"),
        mimeType: "text/plain",
      },
    ];
    if (storedExport?.payload)
      files.push({
        name: "workflow.json",
        data: JSON.stringify(storedExport.payload, null, 2),
        mimeType: "application/json",
      });
    if (isWorkflowGraph(workflowJson))
      files.push({
        name: "workflow.png",
        data: () => workflowPng(workflowJson),
        mimeType: "image/png",
      });
    void downloadProjectZip(`${project.name}-${version.label}`, files);
    void ai.addTimelineEvent({
      project_id: project.id,
      event_type: "version_downloaded",
      title: `${version.label} downloaded`,
      description: version.change_summary,
    });
  };
  const restoreVersion = async (id: string) => {
    const version = ai.versions.find((item) => item.id === id);
    const snapshot = version ? jsonRecord(version.snapshot) : null;
    const requirement = snapshot
      ? jsonRecord(snapshot.requirements ?? null)
      : null;
    const storedWorkflow = snapshot
      ? jsonRecord(snapshot.workflow ?? null)
      : null;
    const storedExport = snapshot ? jsonRecord(snapshot.export ?? null) : null;
    if (
      !version ||
      !storedWorkflow ||
      !window.confirm(
        `Restore ${version.label}? A new version will preserve the current state.`,
      )
    )
      return;
    if (requirement)
      await ai.saveRequirements({
        id: ai.requirements?.id,
        project_id: project.id,
        business_problem: String(requirement.business_problem ?? ""),
        answers: (requirement.answers ?? {}) as Json,
        status: String(requirement.status ?? "ready"),
      });
    const restored = await ai.saveWorkflow({
      id: ai.workflow?.id,
      project_id: project.id,
      name: String(storedWorkflow.name ?? project.name),
      status: String(storedWorkflow.status ?? "generated"),
      graph: (storedWorkflow.graph ?? {}) as Json,
      deployment_guide:
        typeof storedWorkflow.deployment_guide === "string"
          ? storedWorkflow.deployment_guide
          : null,
      environment_variables: (storedWorkflow.environment_variables ??
        []) as Json,
      testing_checklist: (storedWorkflow.testing_checklist ?? []) as Json,
      explanation:
        typeof storedWorkflow.explanation === "string"
          ? storedWorkflow.explanation
          : null,
      version: (ai.workflow?.version ?? 0) + 1,
    });
    if (storedExport?.payload)
      await ai.saveExport({
        project_id: project.id,
        workflow_id: restored.id,
        workflow_version: restored.version,
        platform: "n8n",
        payload: storedExport.payload as Json,
      });
    await ai.createVersion({
      project_id: project.id,
      label: `v${Number(ai.versions[0]?.label.match(/^v(\d+)/)?.[1] ?? 1) + 1}.0`,
      change_summary: `Restored ${version.label}`,
      modified_artifacts: [
        "requirements",
        "workflow",
        "deployment",
        "environment",
        "testing",
        "review",
        "export",
      ],
      change_details: {
        added: [],
        modified: ["Restored validated snapshot"],
        removed: [],
      },
      ai_reasoning: `Restored project from ${version.label}.`,
      workflow_hash: version.workflow_hash,
      author: "user",
      snapshot: version.snapshot,
    });
    await ai.addTimelineEvent({
      project_id: project.id,
      event_type: "version_restored",
      title: `${version.label} restored`,
      description:
        "A new version was created from the selected validated snapshot.",
    });
    setLifecycle(null);
  };

  const requirementsContent = (
    <div className="report-doc">
      <DocHeading icon={<Info size={14} />} title="Business problem" />
      <div className="report-doc-callout">
        {ai.requirements?.business_problem ||
          "Requirements are generated from the AI conversation."}
      </div>
      <DocHeading
        icon={<ListChecks size={14} />}
        title="Captured requirements"
      />
      {answers.length ? (
        <dl className="report-requirements">
          {answers.map(([key, value]) => (
            <div key={key}>
              <dt>{key.replace(/([A-Z])/g, " $1")}</dt>
              <dd>{String(value)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="report-doc-empty">
          Requirements are still being gathered.
        </div>
      )}
    </div>
  );
  const workflowContent = graph ? (
    <div className="report-doc">
      <div className="report-doc-callout">{graph.description}</div>
      <DocHeading icon={<Workflow size={14} />} title="Workflow nodes" />
      <div className="report-nodes">
        {graph.nodes.map((node, index) => (
          <div key={node.id}>
            <i>{index + 1}</i>
            <span>
              <strong>{node.name}</strong>
              <small>
                {node.type} · {node.service || "Internal"}
              </small>
            </span>
          </div>
        ))}
      </div>
      <DocHeading icon={<GitBranch size={14} />} title="Workflow diagram" />
      <WorkflowDiagram graph={graph} />
    </div>
  ) : (
    <div className="artifact-empty">
      <Workflow size={27} />
      <strong>Workflow not ready</strong>
      <p>This card updates automatically after validation.</p>
    </div>
  );
  const deploymentContent = (
    <div className="report-doc">
      <DocumentationText
        text={
          ai.workflow?.deployment_guide ||
          "The deployment guide is waiting for a validated workflow."
        }
      />
    </div>
  );
  const environmentContent = (
    <div className="report-doc">
      {environmentVariables.length ? (
        <div className="report-doc-table">
          {environmentVariables.map((item) => (
            <div className="report-row" key={item.name}>
              <strong>{item.name}</strong>
              <span>{item.description}</span>
              <b>{item.required ? "Required" : "Optional"}</b>
            </div>
          ))}
        </div>
      ) : (
        <div className="artifact-empty">
          <KeyRound size={27} />
          <strong>
            {environmentReady
              ? "No environment variables required"
              : "Environment manifest pending"}
          </strong>
        </div>
      )}
    </div>
  );
  const testingContent = (
    <div className="report-doc">
      {testingChecklist.length ? (
        <div className="report-checklist">
          {testingChecklist.map((item, index) => (
            <div key={index}>
              <span>□</span>
              <strong>{item}</strong>
            </div>
          ))}
        </div>
      ) : (
        <div className="artifact-empty">
          <FlaskConical size={27} />
          <strong>Testing checklist pending</strong>
        </div>
      )}
    </div>
  );
  const reviewContent = (
    <div className="report-doc">
      <DocumentationText
        text={
          ai.workflow?.explanation ||
          "The architecture review is waiting for the workflow artifacts."
        }
      />
      {graph?.risks.length ? (
        <>
          <DocHeading
            icon={<ShieldAlert size={14} />}
            title="Identified risks"
          />
          <div className="report-risk-list">
            {graph.risks.map((item, index) => (
              <div key={index}>
                <ShieldAlert size={13} />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
  const exportContent = latestExport ? (
    <div className="report-doc">
      <div className="report-export">
        <PackageCheck size={20} />
        <div>
          <strong>n8n workflow validated</strong>
          <span>
            Version {latestExport.workflow_version} · {graph?.nodes.length ?? 0}{" "}
            nodes
          </span>
          <small>{new Date(latestExport.created_at).toLocaleString()}</small>
        </div>
      </div>
      <DocHeading icon={<Check size={14} />} title="Compatibility" />
      <div className="report-doc-callout">
        The exporter output passed AgentFlow’s node, trigger, connection, and
        schema validation.
      </div>
    </div>
  ) : (
    <div className="artifact-empty">
      <PackageCheck size={27} />
      <strong>Production export pending</strong>
    </div>
  );

  const items: ReportItem[] = [
    {
      id: "requirements",
      title: "Requirements",
      icon: ClipboardList,
      state: stageState(jobs.requirements, requirementsReady),
      status: statusCopy[stageState(jobs.requirements, requirementsReady)],
      description: requirementsReady
        ? `${answers.length} captured requirements`
        : "Gathering business requirements",
      generatedAt: jobs.requirements?.updatedAt ?? ai.requirements?.updated_at,
      content: requirementsContent,
      instructions: (
        <div className="report-doc">
          <DocHeading
            icon={<Info size={14} />}
            title="How to use these requirements"
          />
          <p>
            Review the {answers.length} captured decisions against the business
            problem. Continue the conversation to change any item; the project
            artifacts will regenerate from the updated source of truth.
          </p>
        </div>
      ),
      files: requirementsFiles,
    },
    {
      id: "workflow",
      title: "Workflow",
      icon: Workflow,
      state: stageState(jobs.workflow, Boolean(graph)),
      status: statusCopy[stageState(jobs.workflow, Boolean(graph))],
      description: graph
        ? `${graph.nodes.length} nodes · ${branches} branches`
        : "Waiting for confirmed requirements",
      generatedAt: jobs.workflow?.updatedAt ?? ai.workflow?.updated_at,
      content: workflowContent,
      instructions: (
        <div className="report-doc">
          <DocHeading
            icon={<KeyRound size={14} />}
            title="Required credentials"
          />
          {graph?.credentials.length ? (
            graph.credentials.map((item) => (
              <div className="report-doc-list" key={item.name}>
                <Check size={12} />
                <span>
                  <b>{item.name}</b> · {item.service} — {item.description}
                </span>
              </div>
            ))
          ) : (
            <p>No external credentials are declared.</p>
          )}
          <DocHeading icon={<Info size={14} />} title="Next step" />
          <p>
            Review each node and branch, then configure the services referenced
            by this {graph?.nodes.length ?? 0}-node workflow.
          </p>
        </div>
      ),
      files: workflowFiles,
    },
    {
      id: "deployment",
      title: "Deployment",
      icon: Rocket,
      state: stageState(jobs.deployment, deploymentReady),
      status: statusCopy[stageState(jobs.deployment, deploymentReady)],
      description: deploymentReady
        ? "Deployment guide ready"
        : "Waiting for workflow validation",
      generatedAt:
        jobs.deployment?.updatedAt ??
        (deploymentReady ? ai.workflow?.updated_at : undefined),
      content: deploymentContent,
      instructions: (
        <div className="report-doc">
          <DocHeading icon={<Rocket size={14} />} title="Deployment sequence" />
          <DocumentationText
            text={
              ai.workflow?.deployment_guide ||
              "Deployment instructions will be derived from the validated workflow."
            }
          />
        </div>
      ),
      files: deploymentFiles,
    },
    {
      id: "environment",
      title: "Environment",
      icon: KeyRound,
      state: stageState(jobs.environment, environmentReady),
      status: statusCopy[stageState(jobs.environment, environmentReady)],
      description: environmentVariables.length
        ? `${environmentVariables.length} variables documented`
        : environmentReady
          ? "No environment variables required"
          : "Waiting for deployment analysis",
      generatedAt:
        jobs.environment?.updatedAt ??
        (environmentReady ? ai.workflow?.updated_at : undefined),
      content: environmentContent,
      instructions: (
        <div className="report-doc">
          <DocHeading
            icon={<KeyRound size={14} />}
            title="API and credential setup"
          />
          {environmentVariables.map((item) => (
            <div className="report-doc-list" key={item.name}>
              <Check size={12} />
              <span>
                <b>{item.name}</b> — {item.description}
              </span>
            </div>
          ))}
          {environmentReady && !environmentVariables.length && (
            <p>
              This workflow does not declare external environment variables.
            </p>
          )}
          {!environmentReady && (
            <p>Configuration instructions appear after environment analysis.</p>
          )}
        </div>
      ),
      files: environmentFiles,
    },
    {
      id: "testing",
      title: "Testing",
      icon: FlaskConical,
      state: stageState(jobs.testing, testingChecklist.length > 0),
      status: statusCopy[stageState(jobs.testing, testingChecklist.length > 0)],
      description: testingChecklist.length
        ? `${testingChecklist.length} validation checks`
        : "Waiting for environment definition",
      generatedAt:
        jobs.testing?.updatedAt ??
        (testingChecklist.length ? ai.workflow?.updated_at : undefined),
      content: testingContent,
      instructions: (
        <div className="report-doc">
          <DocHeading
            icon={<FlaskConical size={14} />}
            title="Recommended test order"
          />
          {testingChecklist.map((item, index) => (
            <div className="report-doc-list numbered" key={index}>
              <i>{index + 1}</i>
              <span>{item}</span>
            </div>
          ))}
        </div>
      ),
      files: testingFiles,
    },
    {
      id: "review",
      title: "Review",
      icon: ShieldCheck,
      state: stageState(jobs.review, reviewReady),
      status: statusCopy[stageState(jobs.review, reviewReady)],
      description: reviewReady
        ? `${graph?.risks.length ?? 0} workflow risks recorded`
        : "Waiting for generated artifacts",
      generatedAt:
        jobs.review?.updatedAt ??
        (reviewReady ? ai.workflow?.updated_at : undefined),
      content: reviewContent,
      instructions: (
        <div className="report-doc">
          <DocHeading
            icon={<ShieldAlert size={14} />}
            title="Common mistakes and next steps"
          />
          {graph?.risks.length ? (
            graph.risks.map((risk, index) => (
              <div className="report-doc-list" key={index}>
                <ShieldAlert size={12} />
                <span>{risk}</span>
              </div>
            ))
          ) : (
            <p>No unresolved workflow risks are recorded.</p>
          )}
        </div>
      ),
      files: reviewFiles,
    },
    {
      id: "export",
      title: "Export",
      icon: PackageCheck,
      state: stageState(jobs.export, Boolean(latestExport)),
      status: statusCopy[stageState(jobs.export, Boolean(latestExport))],
      description: latestExport
        ? "n8n compatible · validation passed"
        : "Waiting for architecture review",
      generatedAt: jobs.export?.updatedAt ?? latestExport?.created_at,
      content: exportContent,
      instructions: (
        <div className="report-doc">
          <DocHeading icon={<PackageCheck size={14} />} title="How to import" />
          <p>
            Import <b>workflow.json</b> into n8n, configure the{" "}
            {graph?.credentials.length ?? 0} declared credential
            {graph?.credentials.length === 1 ? "" : "s"}, verify environment
            values, and execute the testing checklist before activation.
          </p>
          <DocHeading icon={<Info size={14} />} title="Validation status" />
          <p>
            {latestExport
              ? "All exported node identifiers, trigger counts, and connections passed validation."
              : "Import instructions will be finalized after export validation."}
          </p>
        </div>
      ),
      files: exportFiles,
    },
  ];
  const active = activeId
    ? (items.find((item) => item.id === activeId) ?? null)
    : null;

  return (
    <section className="project-report artifact-workspace">
      <header className="report-header">
        <div>
          <span>Automation project</span>
          <h1>{project.name}</h1>
          <p>
            {workspaceName} <i /> {project.phase}
          </p>
        </div>
        <div className="project-memory-actions">
          <button onClick={() => setLifecycle("versions")}>
            <History size={15} />
            Versions
          </button>
          <button onClick={() => setLifecycle("timeline")}>
            <Clock3 size={15} />
            Timeline
          </button>
          <button
            className="report-menu"
            onClick={onManage}
            aria-label="Project settings"
          >
            <MoreHorizontal size={18} />
          </button>
        </div>
      </header>
      <div className="report-sections artifact-stage-grid">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              className={`report-section report-card artifact-stage-card ${item.state}`}
              key={item.id}
              onClick={() => setActiveId(item.id)}
            >
              <span className="artifact-card-icon">
                <Icon size={18} />
              </span>
              <span className="report-card-head">
                <strong>{item.title}</strong>
                <small>
                  View <ArrowRight size={12} />
                </small>
              </span>
              <p>{item.description}</p>
              <span className={`artifact-card-status ${item.state}`}>
                {["queued", "generating", "validating", "persisting"].includes(
                  item.state,
                ) && <i />}
                {item.status}
              </span>
            </button>
          );
        })}
      </div>
      <footer className="report-footer">
        <div>
          <strong>
            {allReady
              ? "Production package ready"
              : "Production package is being prepared"}
          </strong>
          <span>
            {allReady
              ? "Every core production artifact passed validation and is ready to download."
              : "Open any stage to monitor its independent generation status."}
          </span>
        </div>
        <div className="report-footer-actions">
          <button
            className="secondary-action"
            onClick={() => void exportProject()}
            disabled={!allReady}
          >
            <FileArchive size={16} />
            Download Project.zip
          </button>
          <button className="lime-button" onClick={onContinue}>
            Continue conversation
            <ArrowRight size={16} />
          </button>
        </div>
      </footer>
      {active && (
        <ReportModal
          item={active}
          close={() => setActiveId(null)}
          regenerate={regenerate}
          downloadProject={() => void exportProject()}
          projectReady={allReady}
        />
      )}{" "}
      {lifecycle && (
        <LifecycleModal
          mode={lifecycle}
          close={() => setLifecycle(null)}
          versions={ai.versions}
          timeline={ai.timeline}
          onRestore={(id) => void restoreVersion(id)}
          onDownload={downloadVersion}
        />
      )}
    </section>
  );
}
