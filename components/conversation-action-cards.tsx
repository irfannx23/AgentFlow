"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Download,
  Eye,
  FileArchive,
  FileCode2,
  FolderOpen,
  KeyRound,
  PackageCheck,
  PartyPopper,
  X,
} from "lucide-react";
import type { ArtifactStage } from "@/components/ai-provider";
import type { Project } from "@/components/workspace-state";
import type { Tables } from "@/lib/supabase/types";
import {
  downloadArtifact,
  downloadProjectZip,
  safeFileName,
  textPdf,
  workflowPng,
  type DownloadArtifact,
} from "@/lib/automation/downloads";
import { isWorkflowGraph } from "@/lib/automation/types";
import { n8nValidationIssues } from "@/lib/automation/exporters/n8n";
import { layoutWorkflowGraph } from "@/lib/automation/layout";
import { optimizeWorkflowGraph } from "@/lib/automation/quality";
import { useDialogFocus } from "@/components/use-dialog-focus";

type AIArtifacts = {
  requirements: Tables<"automation_requirements"> | null;
  workflow: Tables<"automation_workflows"> | null;
  exports: Tables<"automation_exports">[];
};
type PreparedFile = {
  artifact: DownloadArtifact;
  title: string;
  description: string;
  preview: React.ReactNode;
  generatedAt?: string;
  version?: number;
  validation?: string;
};
type AdvancedStage = Extract<
  ArtifactStage,
  "deployment" | "testing" | "review"
>;

function RichText({ value }: { value: string }) {
  return (
    <div className="chat-download-rich-text">
      {value
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, index) => {
          if (/^#{1,3}\s/.test(line))
            return <h4 key={index}>{line.replace(/^#{1,3}\s+/, "")}</h4>;
          if (/^[-*]\s/.test(line))
            return (
              <div className="chat-download-list" key={index}>
                <Check size={12} />
                <span>{line.replace(/^[-*]\s+/, "")}</span>
              </div>
            );
          if (/^\d+\.\s/.test(line))
            return (
              <div className="chat-download-list numbered" key={index}>
                <i>{line.match(/^\d+/)?.[0]}</i>
                <span>{line.replace(/^\d+\.\s+/, "")}</span>
              </div>
            );
          return <p key={index}>{line}</p>;
        })}
    </div>
  );
}

export function AutomationCompletionCard({
  project,
  ready,
  openDownloads,
}: {
  project: Project;
  ready: boolean;
  openDownloads: () => void;
}) {
  const openProject = () =>
    window.dispatchEvent(
      new CustomEvent("agentflow:open-project", {
        detail: { projectId: project.id },
      }),
    );
  const continueChat = () =>
    document
      .querySelector<HTMLTextAreaElement>(".conversation-prompt textarea")
      ?.focus();
  return (
    <aside
      className={`chat-generation-card${ready ? " ready" : ""}`}
      aria-live="polite"
      aria-label={
        ready ? "Automation package ready" : "Automation blueprint approved"
      }
    >
      <span className="chat-generation-success">
        {ready ? <PartyPopper size={24} /> : <Check size={24} />}
        <i />
      </span>
      <div className="chat-generation-copy">
        <h3>
          {ready ? "Automation Package Ready" : "Automation Blueprint Approved"}
        </h3>
        {ready ? (
          <>
            <p>Everything has been generated successfully.</p>
            <small>
              View your validated package, download production files, or
              continue improving the project.
            </small>
          </>
        ) : (
          <>
            <p>Your automation stack has been finalized.</p>
            <p>
              AgentFlow is now generating your validated production package.
            </p>
            <small>Progress is available on the Project page.</small>
          </>
        )}
        <div className="chat-generation-actions">
          {ready ? (
            <button className="download" onClick={openDownloads}>
              <Download size={17} />
              Open Downloads
            </button>
          ) : (
            <button className="download" onClick={openProject}>
              <FolderOpen size={17} />
              Open Project
            </button>
          )}
          {ready ? (
            <button onClick={openProject}>
              <FolderOpen size={17} />
              Open Project
            </button>
          ) : (
            <button onClick={continueChat}>Continue Chat</button>
          )}
        </div>
      </div>
    </aside>
  );
}

export function ConversationDownloadsModal({
  project,
  requirements,
  workflow,
  exports,
  close,
  openProject,
  generateAdvanced,
  advancedStatus,
}: {
  project: Project;
  close: () => void;
  openProject: () => void;
  generateAdvanced: (stage: AdvancedStage) => void;
  advancedStatus: Partial<Record<AdvancedStage, string>>;
} & AIArtifacts) {
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"downloads" | "guide">("downloads");
  const [includeRequirementsPdf, setIncludeRequirementsPdf] = useState(false);
  useDialogFocus<HTMLElement>(close);
  const packageData = useMemo(() => {
    if (!requirements || !workflow || !isWorkflowGraph(workflow.graph))
      return {
        files: [] as PreparedFile[],
        advanced: [] as PreparedFile[],
        credentials: [] as Array<{
          name: string;
          service: string;
          description: string;
        }>,
      };
    const graph = workflow.graph;
    const positionedGraph = layoutWorkflowGraph(optimizeWorkflowGraph(graph));
    const answers =
      requirements.answers &&
      typeof requirements.answers === "object" &&
      !Array.isArray(requirements.answers)
        ? Object.entries(requirements.answers).filter(
            ([key, value]) =>
              !key.startsWith("_") && String(value ?? "").trim(),
          )
        : [];
    const environment = Array.isArray(workflow.environment_variables)
      ? (workflow.environment_variables.filter(
          (item) => item && typeof item === "object" && !Array.isArray(item),
        ) as Array<Record<string, unknown>>)
      : [];
    const tests = Array.isArray(workflow.testing_checklist)
      ? workflow.testing_checklist.filter(
          (item): item is string => typeof item === "string",
        )
      : [];
    const latestExport = exports.find(
      (item) =>
        item.workflow_version === workflow.version &&
        n8nValidationIssues(item.payload).length === 0,
    );
    const requirementsOverview = answers
      .map(
        ([key, value]) =>
          `- ${key.replace(/([A-Z])/g, " $1")}: ${String(value)}`,
      )
      .join("\n");
    const requirementsText = `# Requirements\n\n## Business problem\n\n${requirements.business_problem}\n\n${requirementsOverview}\n`;
    const envText = environment.length
      ? environment
          .map(
            (item) =>
              `# ${String(item.description ?? "")}${item.required === true ? " (required)" : ""}\n${String(item.name ?? "VARIABLE")}=`,
          )
          .join("\n\n")
      : "# This workflow does not require environment variables.\n";
    const readme = `# ${project.name}\n\n## Overview\n\n${graph.description}\n\n## Requirements\n\nBusiness problem: ${requirements.business_problem}\n\n${requirementsOverview}\n\n## Setup\n\n1. Import production-workflow.json into n8n.\n2. Configure the required credentials and environment variables.\n3. Test every workflow branch before activation.\n\n## APIs\n\n${graph.credentials.length ? graph.credentials.map((item) => `- ${item.service}: ${item.description}`).join("\n") : "- No external API credentials are declared."}\n\n## Environment Variables\n\n${environment.length ? environment.map((item) => `- ${String(item.name)}: ${String(item.description ?? "")}`).join("\n") : "- No environment variables are required."}\n\n## Deployment\n\nImport the production workflow, map credentials, validate configuration, execute a test run, and activate only after successful verification.\n\n## Testing\n\nVerify the trigger, every decision branch, external integration, retry behavior, and failure handling before production use.\n\n## Future Updates\n\nContinue the project conversation in AgentFlow to make targeted improvements and create a new validated version.\n`;
    const requirementsPreview = (
      <div className="chat-download-preview">
        <h3>Business problem</h3>
        <p>{requirements.business_problem}</p>
        <h3>Requirements</h3>
        <dl>
          {answers.map(([key, value]) => (
            <div key={key}>
              <dt>{key.replace(/([A-Z])/g, " $1")}</dt>
              <dd>{String(value)}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
    const workflowPreview = (
      <div className="chat-download-preview">
        <h3>{graph.name}</h3>
        <p>{graph.description}</p>
        <div className="chat-download-node-list">
          {graph.nodes.map((node, index) => (
            <div key={node.id}>
              <i>{index + 1}</i>
              <span>
                <b>{node.name}</b>
                <small>
                  {node.type} · {node.service || "Internal"}
                </small>
              </span>
            </div>
          ))}
        </div>
      </div>
    );
    const files: PreparedFile[] = [
      {
        artifact: {
          name: "README.md",
          data: readme,
          mimeType: "text/markdown",
        },
        title: "Project README",
        description:
          "Overview, setup, APIs, environment, deployment, testing, and future updates.",
        preview: <RichText value={readme} />,
      },
      {
        artifact: {
          name: "requirements.md",
          data: requirementsText,
          mimeType: "text/markdown",
        },
        title: "Requirements",
        description: "Confirmed business requirements and assumptions.",
        preview: requirementsPreview,
      },
      {
        artifact: {
          name: ".env.example",
          data: envText,
          mimeType: "text/plain",
        },
        title: "Environment Variables",
        description: `${environment.length} placeholder configuration value${environment.length === 1 ? "" : "s"}.`,
        preview: (
          <div className="chat-download-preview">
            <h3>Environment variables</h3>
            {environment.length ? (
              environment.map((item) => (
                <div className="chat-download-key" key={String(item.name)}>
                  <KeyRound size={13} />
                  <span>
                    <b>{String(item.name)}</b>
                    <small>{String(item.description ?? "")}</small>
                  </span>
                </div>
              ))
            ) : (
              <p>No environment variables are required.</p>
            )}
          </div>
        ),
      },
      {
        artifact: {
          name: "workflow.json",
          data: JSON.stringify(positionedGraph, null, 2),
          mimeType: "application/json",
        },
        title: "Internal Workflow",
        description: `${graph.nodes.length} validated nodes and ${graph.edges.length} connections.`,
        preview: workflowPreview,
      },
      {
        artifact: {
          name: "workflow.png",
          data: () => workflowPng(graph),
          mimeType: "image/png",
        },
        title: "Workflow Diagram",
        description:
          "High-resolution diagram generated from the validated graph.",
        preview: workflowPreview,
      },
    ];
    if (workflow.deployment_guide?.trim())
      files.push({
        artifact: {
          name: "deployment-guide.md",
          data: workflow.deployment_guide,
          mimeType: "text/markdown",
        },
        title: "Deployment Guide",
        description: "Production deployment instructions.",
        preview: <RichText value={workflow.deployment_guide} />,
      });
    if (tests.length)
      files.push({
        artifact: {
          name: "testing-checklist.md",
          data: `# Testing checklist\n\n${tests.map((item) => `- [ ] ${item}`).join("\n")}\n`,
          mimeType: "text/markdown",
        },
        title: "Testing Checklist",
        description: `${tests.length} validation checks.`,
        preview: (
          <div className="chat-download-preview">
            {tests.map((item, index) => (
              <div className="chat-download-list" key={index}>
                <span>□</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        ),
      });
    if (workflow.explanation?.trim())
      files.push({
        artifact: {
          name: "architecture-review.md",
          data: workflow.explanation,
          mimeType: "text/markdown",
        },
        title: "Architecture Review",
        description: "Risks and production recommendations.",
        preview: <RichText value={workflow.explanation} />,
      });
    if (latestExport)
      files.push({
        artifact: {
          name: `${safeFileName(project.name)}.json`,
          data: JSON.stringify(latestExport.payload, null, 2),
          mimeType: "application/json",
        },
        title: "Production n8n Workflow",
        description: "Exporter-generated and schema-validated n8n workflow.",
        preview: (
          <div className="chat-download-preview export">
            <PackageCheck size={28} />
            <h3>n8n export validated</h3>
            <p>
              The node identifiers, trigger count, connections, and required
              schema fields passed validation.
            </p>
          </div>
        ),
        generatedAt: latestExport.created_at,
        version: latestExport.workflow_version,
        validation: "Passed",
      });
    files.forEach((file) => {
      file.generatedAt ??= workflow.updated_at;
      file.version ??= workflow.version;
      file.validation ??= "Passed";
    });
    const advanced: PreparedFile[] = [];
    advanced.push(
      ...files.filter((file) =>
        [
          "deployment-guide.md",
          "testing-checklist.md",
          "architecture-review.md",
        ].includes(file.artifact.name),
      ),
    );
    if (includeRequirementsPdf)
      advanced.push({
        artifact: {
          name: "requirements.pdf",
          data: textPdf(
            `${project.name} Requirements`,
            `${requirements.business_problem}\n\n${requirementsOverview}`,
          ),
          mimeType: "application/pdf",
        },
        title: "Requirements PDF",
        description: "Shareable requirements document.",
        preview: requirementsPreview,
      });
    return { files, advanced, credentials: graph.credentials };
  }, [exports, includeRequirementsPdf, project.name, requirements, workflow]);
  const allFiles = [...packageData.files, ...packageData.advanced];
  const selectedFile = allFiles.find((file) => file.artifact.name === selected);
  const viewingZip = selected === "Project.zip";
  const downloadZip = () =>
    void downloadProjectZip(
      `${project.name}-project`,
      allFiles.map((file) => file.artifact),
    );
  const advancedRows: Array<{
    stage: AdvancedStage | "requirements-pdf";
    title: string;
    file: string;
  }> = [
    {
      stage: "deployment",
      title: "Deployment Guide",
      file: "deployment-guide.md",
    },
    {
      stage: "testing",
      title: "Testing Checklist",
      file: "testing-checklist.md",
    },
    {
      stage: "review",
      title: "Architecture Review",
      file: "architecture-review.md",
    },
    {
      stage: "requirements-pdf",
      title: "Requirements PDF",
      file: "requirements.pdf",
    },
  ];
  return (
    <div
      className="report-modal-backdrop chat-download-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <section
        className="report-modal chat-download-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-download-title"
      >
        <header>
          <div className="artifact-modal-title">
            <span className="artifact-modal-icon complete">
              <Download size={20} />
            </span>
            <div>
              <span className="report-modal-badge complete">
                <Check size={11} />
                Package Ready
              </span>
              <h2 id="chat-download-title">{project.name}</h2>
              <time>Your validated production automation package.</time>
            </div>
          </div>
          <button
            className="artifact-close"
            onClick={close}
            aria-label="Close downloads"
          >
            <X size={18} />
          </button>
        </header>
        <nav className="chat-download-tabs" aria-label="Package information">
          <button
            className={tab === "downloads" ? "active" : ""}
            onClick={() => {
              setTab("downloads");
              setSelected(null);
            }}
          >
            Downloads
          </button>
          <button
            className={tab === "guide" ? "active" : ""}
            onClick={() => {
              setTab("guide");
              setSelected(null);
            }}
          >
            How To Use
          </button>
        </nav>
        <div className="report-modal-content chat-download-content">
          {tab === "guide" ? (
            <section className="chat-download-guide">
              <details open>
                <summary>Project Overview</summary>
                <p>
                  {workflow?.graph && isWorkflowGraph(workflow.graph)
                    ? workflow.graph.description
                    : "Validated AgentFlow automation package."}
                </p>
              </details>
              <details>
                <summary>Required Software</summary>
                <p>
                  Use a supported n8n installation. Docker is optional.
                  Configure the external services listed below before
                  activation.
                </p>
                {packageData.credentials.map((item) => (
                  <div className="chat-download-key" key={item.name}>
                    <KeyRound size={13} />
                    <span>
                      <b>{item.service}</b>
                      <small>{item.description}</small>
                    </span>
                  </div>
                ))}
              </details>
              <details>
                <summary>Import Workflow</summary>
                <ol>
                  <li>Download {safeFileName(project.name)}.json.</li>
                  <li>Open n8n and choose Import from File.</li>
                  <li>Map each referenced credential.</li>
                  <li>Save and run a manual test before activation.</li>
                </ol>
              </details>
              <details>
                <summary>Configure Credentials</summary>
                <p>
                  Create credentials inside n8n. Never paste secret values into
                  workflow fields or exported files. Grant only the permissions
                  documented by each service.
                </p>
              </details>
              <details>
                <summary>Environment Variables</summary>
                <p>
                  Copy .env.example into your deployment environment and replace
                  placeholders through the host&apos;s secret manager. The
                  example file intentionally contains no secret values.
                </p>
              </details>
              <details>
                <summary>Deployment</summary>
                <p>
                  Import, configure credentials, verify environment
                  placeholders, exercise every branch, then activate and monitor
                  the first production runs.
                </p>
              </details>
              <details>
                <summary>Troubleshooting</summary>
                <p>
                  Test credentials first, confirm required variables, inspect
                  the failed n8n node, and retry only the affected AgentFlow
                  artifact when validation fails.
                </p>
              </details>
              <details>
                <summary>Security</summary>
                <p>
                  Keep credentials in n8n, use least-privilege scopes, rotate
                  exposed secrets immediately, and never store tokens in
                  workflow JSON or downloads.
                </p>
              </details>
              <details>
                <summary>Updates and Support</summary>
                <p>
                  Continue the project conversation to request a change.
                  AgentFlow loads project memory, versions only meaningful
                  updates, and regenerates affected artifacts.
                </p>
              </details>
            </section>
          ) : selectedFile || viewingZip ? (
            <section className="chat-file-preview">
              <button onClick={() => setSelected(null)}>
                ← All generated files
              </button>
              <div className="chat-file-preview-heading">
                <div>
                  <h3>{viewingZip ? "Project.zip" : selectedFile!.title}</h3>
                  <p>
                    {viewingZip
                      ? "All successfully validated generated artifacts."
                      : selectedFile!.description}
                  </p>
                </div>
                <button
                  onClick={
                    viewingZip
                      ? downloadZip
                      : () => void downloadArtifact(selectedFile!.artifact)
                  }
                >
                  <Download size={14} />
                  Download
                </button>
              </div>
              {viewingZip ? (
                <div className="chat-download-preview">
                  <h3>Included files</h3>
                  {allFiles.map((file) => (
                    <div
                      className="chat-download-list"
                      key={file.artifact.name}
                    >
                      <Check size={12} />
                      <span>{file.artifact.name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                selectedFile!.preview
              )}
            </section>
          ) : (
            <>
              <section className="chat-download-primary">
                <h3>Primary Actions</h3>
                <div>
                  <button className="lime-button" onClick={downloadZip}>
                    <FileArchive size={16} />
                    Download Project (.zip)
                  </button>
                  <button className="secondary-action" onClick={openProject}>
                    <FolderOpen size={16} />
                    Open Project
                  </button>
                </div>
              </section>
              <section>
                <h3>
                  <FileCode2 size={15} />
                  Generated Files
                </h3>
                <div className="chat-generated-files">
                  {packageData.files.map((file) => (
                    <article key={file.artifact.name}>
                      <span>
                        <FileCode2 size={15} />
                        <span>
                          <b>{file.artifact.name}</b>
                          <small>{file.description}</small>
                          <small className="chat-file-meta">
                            Ready · Validation {file.validation} · v
                            {file.version} ·{" "}
                            {file.generatedAt
                              ? new Date(file.generatedAt).toLocaleString()
                              : "Generated"}
                          </small>
                        </span>
                      </span>
                      <div>
                        <button onClick={() => setSelected(file.artifact.name)}>
                          <Eye size={13} />
                          View
                        </button>
                        <button
                          onClick={() => void downloadArtifact(file.artifact)}
                        >
                          <Download size={13} />
                          Download
                        </button>
                      </div>
                    </article>
                  ))}
                  <article>
                    <span>
                      <FileArchive size={15} />
                      <span>
                        <b>Project.zip</b>
                        <small>
                          All successfully validated generated artifacts.
                        </small>
                      </span>
                    </span>
                    <div>
                      <button onClick={() => setSelected("Project.zip")}>
                        <Eye size={13} />
                        View
                      </button>
                      <button onClick={downloadZip}>
                        <Download size={13} />
                        Download
                      </button>
                    </div>
                  </article>
                </div>
              </section>
              <details className="advanced-documentation">
                <summary>Advanced Documentation</summary>
                <p>Generate detailed documents only when you need them.</p>
                {advancedRows.map((row) => {
                  const available = packageData.advanced.find(
                    (file) => file.artifact.name === row.file,
                  );
                  const status =
                    row.stage === "requirements-pdf"
                      ? includeRequirementsPdf
                        ? "complete"
                        : "pending"
                      : advancedStatus[row.stage];
                  const busy = [
                    "queued",
                    "generating",
                    "validating",
                    "persisting",
                  ].includes(status ?? "");
                  return (
                    <article key={row.stage}>
                      <span>
                        <b>{row.title}</b>
                        <small>
                          {available
                            ? "Ready"
                            : busy
                              ? "Generating…"
                              : "Optional"}
                        </small>
                      </span>
                      {available ? (
                        <div>
                          <button
                            onClick={() => setSelected(available.artifact.name)}
                          >
                            <Eye size={13} />
                            View
                          </button>
                          <button
                            onClick={() =>
                              void downloadArtifact(available.artifact)
                            }
                          >
                            <Download size={13} />
                            Download
                          </button>
                        </div>
                      ) : (
                        <button
                          disabled={busy}
                          onClick={() =>
                            row.stage === "requirements-pdf"
                              ? setIncludeRequirementsPdf(true)
                              : generateAdvanced(row.stage)
                          }
                        >
                          Generate
                        </button>
                      )}
                    </article>
                  );
                })}
              </details>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
