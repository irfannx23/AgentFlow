"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  BrainCircuit,
  Check,
  ChevronDown,
  GitBranch,
  KeyRound,
  Layers3,
  MessageCircle,
  Plug,
  ShieldCheck,
  Sparkles,
  Workflow,
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
      ? "Needs selection"
      : tool.skipped
        ? "Not required"
        : "Optional";
  return (
    <span className={`tool-plan-status ${status.toLowerCase().replaceAll(" ", "-")}`}>
      <i />
      {status}
    </span>
  );
}

function BlueprintOverview({ plan }: { plan: ToolPlan }) {
  const { blueprint } = plan;
  const workflowSteps = [
    blueprint.trigger,
    ...blueprint.actions.slice(0, 3),
    "Automation complete",
  ];

  return (
    <div className="blueprint-overview blueprint-overview-v2">
      <section className="blueprint-section blueprint-summary-section">
        <div className="blueprint-section-heading">
          <span><Sparkles size={16} /></span>
          <div><h3>Automation summary</h3><p>A concise view of what AgentFlow understood.</p></div>
        </div>
        <div className="blueprint-summary-list">
          <div><Check size={14} /><span><b>Trigger</b>{blueprint.trigger}</span></div>
          {blueprint.actions.map((action, index) => (
            <div key={`${action}-${index}`}>
              <Check size={14} />
              <span><b>{index === 0 ? "Main workflow" : `Action ${index + 1}`}</b>{action}</span>
            </div>
          ))}
          <div><Check size={14} /><span><b>Expected outcome</b>{blueprint.objective}</span></div>
        </div>
      </section>

      <section className="blueprint-section">
        <div className="blueprint-section-heading">
          <span><Layers3 size={16} /></span>
          <div><h3>Blueprint at a glance</h3><p>Production scope estimated from the confirmed requirements.</p></div>
        </div>
        <div className="blueprint-stats-grid">
          <article><small>Estimated nodes</small><strong>{blueprint.estimatedNodes}</strong></article>
          <article><small>Complexity</small><strong>{blueprint.complexity}</strong></article>
          <article><small>AI confidence</small><strong>{blueprint.confidence}%</strong></article>
          <article><small>Integrations</small><strong>{plan.tools.length}</strong></article>
          <article><small>Capabilities</small><strong>{new Set(plan.tools.map((tool) => tool.category)).size}</strong></article>
        </div>
      </section>

      <section className="blueprint-section">
        <div className="blueprint-section-heading">
          <span><GitBranch size={16} /></span>
          <div><h3>Workflow overview</h3><p>The primary execution path, from trigger to completion.</p></div>
        </div>
        <div className="blueprint-timeline">
          {workflowSteps.map((step, index) => (
            <div key={`${step}-${index}`}>
              <i>{index + 1}</i><span>{step}</span>
              {index < workflowSteps.length - 1 && <ArrowRight size={14} />}
            </div>
          ))}
        </div>
      </section>

      <section className="blueprint-section">
        <div className="blueprint-section-heading">
          <span><Plug size={16} /></span>
          <div><h3>Detected integrations</h3><p>Recommended from the tools and outcomes in your requirements.</p></div>
        </div>
        <div className="blueprint-integrations-grid">
          {plan.tools.map((tool) => (
            <article key={tool.id}>
              <span className="blueprint-integration-icon"><Plug size={16} /></span>
              <div><small>{tool.category}</small><strong>{tool.selectedTool ?? tool.name}</strong><p>{tool.purpose || tool.usedFor}</p></div>
              <b>{tool.confidence}%</b>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function ToolPlanning({ plan, update, busy }: { plan: ToolPlan; update: (plan: ToolPlan) => Promise<void>; busy: boolean }) {
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
              credential: selectedTool && selectedTool !== item.name ? `${selectedTool} connection` : item.credential,
            }
          : item,
      ),
    });
  };

  return (
    <div className="blueprint-tool-planning blueprint-tool-planning-v2">
      <div className="tool-planning-intro">
        <span><Plug size={17} /></span>
        <div><h3>Choose your automation stack</h3><p>Review the recommended tools. Credentials are connected later—never entered here.</p></div>
      </div>
      <div className="tool-plan-list">
        {plan.tools.map((tool) => (
          <article className="tool-plan-detail tool-plan-detail-v2" key={tool.id}>
            <div className="tool-plan-detail-head">
              <span className="tool-plan-icon"><Plug size={17} /></span>
              <div><small>{tool.category}</small><h3>{tool.selectedTool ?? tool.name}</h3></div>
              <ToolStatus tool={tool} />
            </div>
            <div className="tool-plan-purpose"><small>Purpose</small><p>{tool.usedFor || tool.purpose}</p></div>
            <label className="tool-choice tool-choice-v2">
              <span>Recommended tool<small>{tool.confidence}% confidence</small></span>
              <span className="tool-choice-control">
                <select
                  disabled={busy}
                  value={tool.selectedTool ?? (tool.skipped ? "__skip__" : "")}
                  onChange={(event) => void select(tool, event.target.value)}
                  aria-label={`Select ${tool.category} tool`}
                >
                  <option value="" disabled>Select a provider</option>
                  <option value={tool.name}>{tool.name} · Recommended</option>
                  {tool.alternatives.map((option) => <option value={option} key={option}>{option}</option>)}
                  {!tool.required && <option value="__skip__">Skip · Not required</option>}
                </select>
                <ChevronDown size={14} aria-hidden="true" />
              </span>
            </label>
            <div className="tool-plan-meta">
              <span><KeyRound size={13} /><small>Credential</small><b>{tool.credential || "None required"}</b></span>
              <span><ShieldCheck size={13} /><small>Setup</small><b>Configured later</b></span>
            </div>
            <p className="tool-plan-reason">{tool.recommendationReason}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function BlueprintModal({
  automationName,
  plan,
  close,
  update,
  finalize,
  busy,
}: {
  automationName: string;
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
    <div className="report-modal-backdrop tool-plan-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="report-modal tool-plan-modal blueprint-modal blueprint-modal-v2" role="dialog" aria-modal="true" aria-labelledby="tool-plan-title">
        <header className="blueprint-modal-header">
          <div className="artifact-modal-title">
            <span className="artifact-modal-icon complete"><BrainCircuit size={20} /></span>
            <div><h2 id="tool-plan-title">Automation Blueprint</h2><p>{automationName} · Review the plan before generation.</p></div>
          </div>
          <button className="artifact-close" onClick={close} aria-label="Close automation blueprint"><X size={18} /></button>
        </header>
        <nav className="blueprint-tabs blueprint-tabs-v2" aria-label="Automation blueprint steps" role="tablist">
          <button role="tab" aria-selected={tab === "blueprint"} className={tab === "blueprint" ? "active" : ""} onClick={() => setTab("blueprint")}><i>1</i><span>Blueprint</span></button>
          <span className="blueprint-tab-line" />
          <button role="tab" aria-selected={tab === "tools"} className={tab === "tools" ? "active" : ""} onClick={() => setTab("tools")}><i>2</i><span>Tool Planning</span></button>
        </nav>
        <div className="report-modal-content blueprint-modal-body">
          {tab === "blueprint" ? <BlueprintOverview plan={plan} /> : <ToolPlanning plan={plan} update={update} busy={busy} />}
        </div>
        <footer className="tool-plan-footer tool-plan-footer-v2">
          <div>
            <strong>{tab === "blueprint" ? "Blueprint ready" : readiness.ready ? "Automation stack ready" : "Stack needs attention"}</strong>
            <span>{tab === "blueprint" ? `${plan.tools.length} integration${plan.tools.length === 1 ? "" : "s"} detected` : readiness.ready ? "All required tools are selected and compatible." : readiness.issues[0]}</span>
          </div>
          {tab === "blueprint" ? (
            <button className="lime-button" onClick={() => setTab("tools")}>Continue to Tool Planning <ArrowRight size={15} /></button>
          ) : (
            <button className="lime-button" disabled={!readiness.ready || busy} onClick={() => void finalize(plan)}>{busy ? "Finalizing…" : "Finalize Stack"} <ArrowRight size={15} /></button>
          )}
        </footer>
      </section>
    </div>
  );
}

export function ToolPlanCard({
  automationName,
  plan,
  update,
  finalize,
  continueChat,
  busy = false,
}: {
  automationName: string;
  plan: ToolPlan;
  update: (plan: ToolPlan) => Promise<void>;
  finalize: (plan: ToolPlan) => Promise<void>;
  continueChat: () => void;
  busy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const integrations = useMemo(() => plan.tools.map((tool) => tool.selectedTool ?? tool.name), [plan.tools]);

  return (
    <>
      <aside className="tool-plan-card blueprint-card blueprint-card-v2" aria-label="AI Automation Blueprint">
        <div className="blueprint-card-topline">
          <span className="tool-plan-card-icon"><Workflow size={21} /></span>
          <span className="blueprint-phase"><i /> Blueprint ready</span>
        </div>
        <div className="blueprint-card-copy"><small>AI Automation Blueprint</small><h3>{automationName}</h3><p>{plan.blueprint.objective}</p></div>
        <div className="blueprint-card-progress" aria-label="Requirements and blueprint complete; tool planning is next">
          <span><i /><b>Requirements</b></span><span><i /><b>Blueprint</b></span><span className="current"><i /><b>Tool planning</b></span>
        </div>
        <div className="blueprint-card-metrics blueprint-card-metrics-v2">
          <span><b>{plan.blueprint.estimatedNodes}</b> nodes</span><span><b>{plan.blueprint.complexity}</b> complexity</span><span><b>{plan.blueprint.confidence}%</b> confidence</span><span><b>{plan.tools.length}</b> integrations</span>
        </div>
        <div className="blueprint-card-integrations" aria-label="Detected integrations">
          <span>Detected</span>{integrations.slice(0, 4).map((tool) => <b key={tool}>{tool}</b>)}{integrations.length > 4 && <b>+{integrations.length - 4}</b>}
        </div>
        <div className="blueprint-card-actions">
          <button className="blueprint-review-button" onClick={() => setOpen(true)}>Review Blueprint <ArrowRight size={15} /></button>
          <button className="blueprint-chat-button" onClick={continueChat}><MessageCircle size={14} /> Continue Chat</button>
        </div>
      </aside>
      {open && (
        <BlueprintModal
          automationName={automationName}
          plan={plan}
          close={() => setOpen(false)}
          update={update}
          finalize={async (value) => { await finalize(value); setOpen(false); }}
          busy={busy}
        />
      )}
    </>
  );
}
