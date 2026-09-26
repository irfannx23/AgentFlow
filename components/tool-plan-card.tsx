"use client";

import { useState } from "react";
import {
  BrainCircuit,
  Check,
  ChevronRight,
  Circle,
  FileArchive,
  GitBranch,
  KeyRound,
  Plug,
  ShieldCheck,
  Sparkles,
  Variable,
  X,
} from "lucide-react";
import { useDialogFocus } from "@/components/use-dialog-focus";
import {
  blueprintReadiness,
  type AutomationTool,
  type ToolPlan,
} from "@/lib/automation/tool-plan";

function ToolStatus({ tool }: { tool: AutomationTool }) {
  const status = tool.selectedTool
    ? "Ready"
    : tool.required
      ? "Needs Selection"
      : tool.skipped
        ? "Not Required"
        : "Optional";
  return (
    <span
      className={`tool-plan-status ${status.toLowerCase().replace(" ", "-")}`}
    >
      <i />
      {status}
    </span>
  );
}

function BlueprintOverview({ plan }: { plan: ToolPlan }) {
  const { blueprint } = plan;
  return (
    <div className="blueprint-overview">
      <section className="blueprint-objective">
        <small>Automation objective</small>
        <h3>{blueprint.objective}</h3>
        <p>{plan.summary}</p>
      </section>
      <div className="blueprint-metrics">
        <article>
          <GitBranch size={15} />
          <span>
            <small>Trigger</small>
            <strong>{blueprint.trigger}</strong>
          </span>
        </article>
        <article>
          <Sparkles size={15} />
          <span>
            <small>Complexity</small>
            <strong>{blueprint.complexity}</strong>
          </span>
        </article>
        <article>
          <BrainCircuit size={15} />
          <span>
            <small>AI confidence</small>
            <strong>{blueprint.confidence}%</strong>
          </span>
        </article>
        <article>
          <FileArchive size={15} />
          <span>
            <small>Estimated workflow</small>
            <strong>{blueprint.estimatedNodes} nodes</strong>
          </span>
        </article>
      </div>
      <section className="blueprint-actions">
        <h3>Main workflow</h3>
        {blueprint.actions.map((action, index) => (
          <div key={`${action}-${index}`}>
            <i>{index + 1}</i>
            <span>{action}</span>
          </div>
        ))}
      </section>
      <section className="blueprint-artifacts">
        <h3>Expected downloadable artifacts</h3>
        <div>
          {blueprint.expectedArtifacts.map((artifact) => (
            <span key={artifact}>
              <Check size={11} />
              {artifact}
            </span>
          ))}
        </div>
      </section>
      <p className="blueprint-note">
        <KeyRound size={13} />
        Credentials are planned here and configured later. AgentFlow never
        requests secret values.
      </p>
    </div>
  );
}

function ToolPlanning({
  plan,
  update,
  busy,
}: {
  plan: ToolPlan;
  update: (plan: ToolPlan) => Promise<void>;
  busy: boolean;
}) {
  const select = async (tool: AutomationTool, value: string) => {
    const skipped = value === "__skip__";
    const selectedTool = skipped ? null : value;
    await update({
      ...plan,
      tools: plan.tools.map((item) =>
        item.id === tool.id
          ? {
              ...item,
              selectedTool,
              skipped,
              configured: Boolean(selectedTool),
              credential:
                selectedTool && selectedTool !== item.name
                  ? `${selectedTool} connection`
                  : item.credential,
            }
          : item,
      ),
    });
  };
  const readiness = blueprintReadiness(plan);
  const variables = [
    ...new Map(
      plan.tools
        .flatMap((tool) => tool.environmentVariables)
        .map((variable) => [variable.name, variable]),
    ).values(),
  ];
  return (
    <div className="blueprint-tool-planning">
      <div className="tool-plan-list">
        {plan.tools.map((tool) => (
          <article className="tool-plan-detail" key={tool.id}>
            <div className="tool-plan-detail-head">
              <span className="tool-plan-icon">
                <Plug size={17} />
              </span>
              <div>
                <small>{tool.category}</small>
                <h3>
                  {tool.selectedTool ?? `${tool.category} provider required`}
                </h3>
                <p>{tool.purpose}</p>
              </div>
              <ToolStatus tool={tool} />
            </div>
            <label className="tool-choice">
              Selected tool
              <select
                disabled={busy}
                value={tool.selectedTool ?? (tool.skipped ? "__skip__" : "")}
                onChange={(event) => void select(tool, event.target.value)}
              >
                <option value="" disabled>
                  Select a provider
                </option>
                <option value={tool.name}>{tool.name} · Recommended</option>
                {tool.alternatives.map((option) => (
                  <option value={option} key={option}>
                    {option}
                  </option>
                ))}
                {!tool.required && (
                  <option value="__skip__">Skip · Not required</option>
                )}
              </select>
            </label>
            <p className="tool-recommendation">
              <BrainCircuit size={13} />
              <span>
                <b>{tool.confidence}% confidence.</b>{" "}
                {tool.recommendationReason}
              </span>
            </p>
            <dl>
              <div>
                <dt>Used for</dt>
                <dd>{tool.usedFor}</dd>
              </div>
              <div>
                <dt>
                  <KeyRound size={12} />
                  Credential plan
                </dt>
                <dd>
                  {tool.credential || "No credential required"} · Configured
                  later in Connections or n8n
                </dd>
              </div>
              {tool.permissions.length > 0 && (
                <div>
                  <dt>
                    <ShieldCheck size={12} />
                    Permissions
                  </dt>
                  <dd>{tool.permissions.join(" · ")}</dd>
                </div>
              )}
              {tool.environmentVariables.length > 0 && (
                <div>
                  <dt>
                    <Variable size={12} />
                    Environment
                  </dt>
                  <dd>
                    {tool.environmentVariables
                      .map((variable) => variable.name)
                      .join(" · ")}
                  </dd>
                </div>
              )}
            </dl>
          </article>
        ))}
      </div>
      <section className="environment-preview">
        <h3>Estimated Environment Variables</h3>
        {variables.length ? (
          <div>
            {variables.map((variable) => (
              <span key={variable.name}>
                <code>{variable.name}</code>
                <small>
                  {variable.purpose || "Configured during deployment"}
                </small>
              </span>
            ))}
          </div>
        ) : (
          <p>No environment variables are expected.</p>
        )}
      </section>
      <section
        className={`blueprint-readiness${readiness.ready ? " ready" : ""}`}
      >
        <header>
          <span>
            <ShieldCheck size={17} />
            <strong>
              {readiness.ready
                ? "Automation Ready"
                : "Blueprint Needs Attention"}
            </strong>
          </span>
          <small>
            {readiness.ready
              ? "All production checks passed."
              : `${readiness.issues.length} item${readiness.issues.length === 1 ? "" : "s"} remaining.`}
          </small>
        </header>
        <div>
          {readiness.checks.map((check) => (
            <span
              key={check.label}
              className={
                check.ready ? "ready" : check.optional ? "optional" : "missing"
              }
            >
              {check.ready ? <Check size={12} /> : <Circle size={10} />}{" "}
              {check.label}
              {check.optional && !check.ready ? " · Optional" : ""}
            </span>
          ))}
        </div>
        {readiness.issues.length > 0 && (
          <ul>
            {readiness.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function BlueprintModal({
  plan,
  close,
  update,
  finalize,
  busy,
}: {
  plan: ToolPlan;
  close: () => void;
  update: (plan: ToolPlan) => Promise<void>;
  finalize: (plan: ToolPlan) => Promise<void>;
  busy: boolean;
}) {
  useDialogFocus<HTMLElement>(close);
  const [tab, setTab] = useState<"blueprint" | "tools">("blueprint");
  const readiness = blueprintReadiness(plan);
  return (
    <div
      className="report-modal-backdrop tool-plan-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <section
        className="report-modal tool-plan-modal blueprint-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tool-plan-title"
      >
        <header>
          <div className="artifact-modal-title">
            <span className="artifact-modal-icon complete">
              <BrainCircuit size={20} />
            </span>
            <div>
              <span className="report-modal-badge complete">
                AI Automation Blueprint
              </span>
              <h2 id="tool-plan-title">{plan.blueprint.objective}</h2>
              <time>Understand → Recommend → Confirm → Generate</time>
            </div>
          </div>
          <button
            className="artifact-close"
            onClick={close}
            aria-label="Close automation blueprint"
          >
            <X size={18} />
          </button>
        </header>
        <nav className="blueprint-tabs" aria-label="Automation blueprint steps">
          <button
            className={tab === "blueprint" ? "active" : ""}
            onClick={() => setTab("blueprint")}
          >
            <i>1</i>Automation Blueprint
          </button>
          <button
            className={tab === "tools" ? "active" : ""}
            onClick={() => setTab("tools")}
          >
            <i>2</i>Tool Planning
          </button>
        </nav>
        <div className="report-modal-content">
          {tab === "blueprint" ? (
            <BlueprintOverview plan={plan} />
          ) : (
            <ToolPlanning plan={plan} update={update} busy={busy} />
          )}
        </div>
        <footer className="tool-plan-footer">
          <div>
            <strong>
              {tab === "blueprint"
                ? `${plan.tools.length} relevant integration${plan.tools.length === 1 ? "" : "s"} detected`
                : readiness.ready
                  ? "Automation stack ready"
                  : "Selections required"}
            </strong>
            <span>
              {tab === "blueprint"
                ? "Review the recommended technology stack next."
                : readiness.ready
                  ? "The blueprint is compatible with production generation."
                  : readiness.issues[0]}
            </span>
          </div>
          {tab === "blueprint" ? (
            <button className="lime-button" onClick={() => setTab("tools")}>
              Continue to Tool Planning
              <ChevronRight size={15} />
            </button>
          ) : (
            <button
              className="lime-button"
              disabled={!readiness.ready || busy}
              onClick={() => void finalize(plan)}
            >
              {busy ? "Finalizing…" : "Finalize Stack"}
              <ChevronRight size={15} />
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}

export function ToolPlanCard({
  plan,
  update,
  finalize,
  busy = false,
}: {
  plan: ToolPlan;
  update: (plan: ToolPlan) => Promise<void>;
  finalize: (plan: ToolPlan) => Promise<void>;
  busy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <aside
        className="tool-plan-card blueprint-card"
        aria-label="AI Automation Blueprint"
      >
        <span className="tool-plan-card-icon">
          <BrainCircuit size={21} />
        </span>
        <div>
          <small>AI Automation Blueprint</small>
          <h3>{plan.blueprint.objective}</h3>
          <p>{plan.summary}</p>
          <div className="blueprint-card-metrics">
            <span>
              <b>{plan.blueprint.estimatedNodes}</b> estimated nodes
            </span>
            <span>
              <b>{plan.tools.length}</b> integrations
            </span>
            <span>
              <b>{plan.blueprint.confidence}%</b> confidence
            </span>
            <span>
              <b>{plan.blueprint.complexity}</b> complexity
            </span>
          </div>
          <div className="chat-generation-actions">
            <button className="download" onClick={() => setOpen(true)}>
              <BrainCircuit size={15} />
              Review Blueprint
            </button>
          </div>
        </div>
      </aside>
      {open && (
        <BlueprintModal
          plan={plan}
          close={() => setOpen(false)}
          update={update}
          finalize={async (value) => {
            await finalize(value);
            setOpen(false);
          }}
          busy={busy}
        />
      )}
    </>
  );
}
