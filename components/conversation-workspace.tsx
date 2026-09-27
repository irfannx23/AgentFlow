"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Check,
  ChevronDown,
  FileText,
  Folder,
  Paperclip,
  Plus,
  Search,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { useAuth } from "@/components/account-state";
import { useAI, type ArtifactStage } from "@/components/ai-provider";
import { useConversations } from "@/components/conversations-provider";
import { useConnections } from "@/components/connections-provider";
import { useKnowledge } from "@/components/knowledge-provider";
import { useArtifactGeneration } from "@/components/use-artifact-generation";
import {
  AutomationCompletionCard,
  ConversationDownloadsModal,
} from "@/components/conversation-action-cards";
import { ToolPlanCard } from "@/components/tool-plan-card";
import { SupportedIntegrationsCta } from "@/components/supported-integrations";
import type { Project } from "@/components/workspace-state";
import { streamAIResponse, type AICitation } from "@/lib/ai/client";
import type { Json } from "@/lib/supabase/types";
import type {
  ConnectionModel,
  ConnectionProvider,
} from "@/lib/connections/types";
import { isWorkflowGraph } from "@/lib/automation/types";
import { n8nValidationIssues } from "@/lib/automation/exporters/n8n";
import {
  newLifecycleRequestId,
  reportClientLifecycle,
} from "@/lib/observability/client";
import {
  answersWithToolPlan,
  parseToolPlan,
  toolPlanFromAnswers,
  toolPlanReady,
  type ToolPlan,
} from "@/lib/automation/tool-plan";
import {
  PROJECT_STAGE,
  projectStageForRequirements,
  shouldAdvanceProjectStage,
  type ProjectStage,
} from "@/lib/projects/lifecycle";

const chatLogo = "/agentflow-logo.svg?v=badge-2";
const geminiLogo =
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/66afd96f19a3a73a2c337823-6WJxqtcx5NM4Rnn2q4dFon61yM7jEt.png";
const openAILogo =
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/63c52af590250dd34bd6a9ab-By9nbolpsKmxnUHdXLvh7h7CJOsLfU.png";
const claudeLogo =
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/66af99839e55f1ee29f117ac-YMPnlsgu0gDyDae0U5FuprCtkAQTUV.png";
const deepSeekLogo =
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/679b6046bf7d84d380b826bb-fDx0BOfNSf9wUebFC1F08dzccQknb4.png";
const interviewMode = "consultant";
const welcomeMessage =
  "Describe the automation you want to build. Include your current process, tools you use, and the outcome you want. The more detail you provide, the fewer follow-up questions I'll ask.";
const scopeRefusal =
  "Sorry, I'm designed specifically to help design, plan and generate AI automation workflows. Please describe the automation you'd like to build or modify.";
const requirementFields = [
  "businessProblem",
  "currentProcess",
  "trigger",
  "inputs",
  "outputs",
  "users",
  "systems",
  "integrations",
  "conditions",
  "workflow",
  "requirements",
] as const;
const providerNames: Record<ConnectionProvider, string> = {
  openai: "OpenAI",
  gemini: "Google Gemini",
  anthropic: "Anthropic",
  deepseek: "DeepSeek",
};
const providerLogos: Record<ConnectionProvider, string> = {
  openai: openAILogo,
  gemini: geminiLogo,
  anthropic: claudeLogo,
  deepseek: deepSeekLogo,
};

type RequirementSnapshot = {
  businessProblem: string;
  answers: Record<string, string>;
  confidence: Record<string, number>;
  assumptions: string[];
  nextQuestion: string;
  offTopic: boolean;
  complete: boolean;
};

function citationsFrom(metadata: Json) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
    return [];
  const value = (metadata as { citations?: unknown }).citations;
  return Array.isArray(value)
    ? value.filter(
        (item): item is AICitation =>
          Boolean(item) &&
          typeof item === "object" &&
          typeof (item as AICitation).fileName === "string",
      )
    : [];
}

function interactionFrom(metadata: Json) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
    return "";
  return typeof metadata.interaction === "string" ? metadata.interaction : "";
}

function jsonObject(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < start)
    throw new Error(
      "The AI could not update the generated requirements snapshot.",
    );
  return JSON.parse(cleaned.slice(start, end + 1)) as unknown;
}

function requirementSnapshot(value: unknown): RequirementSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("The generated requirements snapshot was invalid.");
  const record = value as Record<string, unknown>;
  const rawAnswers = record.answers;
  if (
    typeof record.businessProblem !== "string" ||
    !rawAnswers ||
    typeof rawAnswers !== "object" ||
    Array.isArray(rawAnswers)
  )
    throw new Error("The generated requirements snapshot was incomplete.");
  const rawConfidence =
    record.confidence &&
    typeof record.confidence === "object" &&
    !Array.isArray(record.confidence)
      ? (record.confidence as Record<string, unknown>)
      : {};
  const assumptions = Array.isArray(record.assumptions)
    ? record.assumptions
        .filter(
          (item): item is string =>
            typeof item === "string" && Boolean(item.trim()),
        )
        .map((item) => item.trim())
    : [];
  return {
    businessProblem: record.businessProblem,
    answers: Object.fromEntries(
      Object.entries(rawAnswers).map(([key, answer]) => [
        key,
        String(answer ?? ""),
      ]),
    ),
    confidence: Object.fromEntries(
      requirementFields.map((field) => [
        field,
        Math.max(0, Math.min(100, Number(rawConfidence[field]) || 0)),
      ]),
    ),
    assumptions,
    nextQuestion:
      typeof record.nextQuestion === "string"
        ? record.nextQuestion.trim().replace(/\?+$/, "?")
        : "",
    offTopic: record.offTopic === true,
    complete: record.complete === true,
  };
}

function clarificationCount(
  messages: Array<{ role: string; content: string; metadata?: Json }>,
) {
  return Math.min(
    3,
    messages.filter((item) => {
      if (item.role !== "assistant") return false;
      const metadata =
        item.metadata &&
        typeof item.metadata === "object" &&
        !Array.isArray(item.metadata)
          ? (item.metadata as Record<string, Json | undefined>)
          : {};
      return (
        metadata.interaction === "clarification" ||
        (!metadata.interaction && item.content.includes("?"))
      );
    }).length,
  );
}

function clearlyOffTopic(prompt: string) {
  const value = prompt.toLowerCase();
  const automationSignal =
    /automat|workflow|process|trigger|integrat|approval|notify|sync|onboard|invoice|lead|ticket|request|crm|slack|email|sheet|database|webhook|export|n8n/.test(
      value,
    );
  return (
    !automationSignal &&
    /\b(who is|tell me a joke|write (?:me )?(?:a )?poem|today'?s weather|what(?:'s| is) the weather|what is python|write (?:me )?(?:a )?(?:story|essay|song))\b/.test(
      value,
    )
  );
}

function projectName(prompt: string) {
  const value = prompt.toLowerCase();
  const patterns: Array<[RegExp, string]> = [
    [/employee|onboard/, "Employee Onboarding"],
    [/invoice/, "Invoice Processing"],
    [/lead|crm/, "CRM Lead Routing"],
    [/incident/, "Incident Alerts"],
    [/support|ticket/, "Customer Support Routing"],
    [/purchase/, "Purchase Approval"],
    [/vendor/, "Vendor Management"],
    [/expense/, "Expense Approval"],
    [/contract/, "Contract Review"],
    [/leave|time off|vacation/, "Leave Request"],
    [/classif.*email|email.*classif/, "Email Classification"],
    [/sync|synchroniz/, "Data Synchronization"],
    [/report|dashboard/, "Automated Reporting"],
    [/approval|approve/, "Approval Workflow"],
    [/alert|notify|notification/, "Automated Alerts"],
    [/email/, "Email Automation"],
    [/webhook/, "Webhook Automation"],
    [/data|record/, "Data Processing"],
  ];
  const match = patterns.find(([pattern]) => pattern.test(value));
  if (match) return match[1];
  return "Business Process Automation";
}

function changesAutomation(prompt: string) {
  return /\b(add|remove|replace|change|switch|use|include|exclude|notify|update|regenerate|generate another|rebuild|modify|connect|disconnect|retry|fix|debug|improve|optimize|secure|migrate)\b/i.test(
    prompt,
  );
}

type ChangePlan = {
  intent: "explain" | "modify" | "regenerate" | "debug";
  summary: string;
  reasoning: string;
  versionBump: "patch" | "major";
  affectedArtifacts: ArtifactStage[];
  added: string[];
  modified: string[];
  removed: string[];
};

function changePlan(value: unknown): ChangePlan {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const allowed: ArtifactStage[] = [
    "requirements",
    "workflow",
    "deployment",
    "environment",
    "testing",
    "review",
    "export",
  ];
  const list = (candidate: unknown) =>
    Array.isArray(candidate)
      ? candidate.filter(
          (item): item is string =>
            typeof item === "string" && Boolean(item.trim()),
        )
      : [];
  return {
    intent: ["explain", "modify", "regenerate", "debug"].includes(
      String(record.intent),
    )
      ? (record.intent as ChangePlan["intent"])
      : "modify",
    summary: String(record.summary ?? "Updated automation"),
    reasoning: String(record.reasoning ?? ""),
    versionBump: record.versionBump === "major" ? "major" : "patch",
    affectedArtifacts: list(record.affectedArtifacts).filter(
      (stage): stage is ArtifactStage =>
        allowed.includes(stage as ArtifactStage),
    ),
    added: list(record.added),
    modified: list(record.modified),
    removed: list(record.removed),
  };
}

function inlineMarkdown(value: string) {
  return value
    .split(/(`[^`]+`|\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part, index) => {
      if (part.startsWith("`") && part.endsWith("`"))
        return <code key={index}>{part.slice(1, -1)}</code>;
      if (part.startsWith("**") && part.endsWith("**"))
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      return part;
    });
}

function MessageContent({
  content,
  streaming = false,
}: {
  content: string;
  streaming?: boolean;
}) {
  const fenced = content.split(/```/);
  return (
    <div className={`message-content${streaming ? " streaming" : ""}`}>
      {fenced.map((block, blockIndex) => {
        if (blockIndex % 2 === 1) {
          const [language, ...code] = block.replace(/^\n/, "").split("\n");
          const hasLanguage = /^[a-z0-9+#.-]+$/i.test(language.trim());
          return (
            <pre
              key={blockIndex}
              data-language={hasLanguage ? language.trim() : undefined}
            >
              <code>
                {(hasLanguage ? code : [language, ...code]).join("\n")}
              </code>
            </pre>
          );
        }
        const lines = block.split("\n");
        const output: React.ReactNode[] = [];
        for (let index = 0; index < lines.length; index += 1) {
          const line = lines[index].trim();
          if (!line) continue;
          if (
            line.includes("|") &&
            lines[index + 1]?.trim().match(/^\|?\s*:?-+/)
          ) {
            const headers = line
              .split("|")
              .map((cell) => cell.trim())
              .filter(Boolean);
            const rows: string[][] = [];
            index += 2;
            while (index < lines.length && lines[index].includes("|")) {
              rows.push(
                lines[index]
                  .split("|")
                  .map((cell) => cell.trim())
                  .filter(Boolean),
              );
              index += 1;
            }
            index -= 1;
            output.push(
              <div className="message-table-wrap" key={`table-${index}`}>
                <table>
                  <thead>
                    <tr>
                      {headers.map((cell, cellIndex) => (
                        <th key={cellIndex}>{inlineMarkdown(cell)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex}>{inlineMarkdown(cell)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>,
            );
          } else if (/^#{1,3}\s/.test(line)) {
            output.push(
              <h3 key={index}>
                {inlineMarkdown(line.replace(/^#{1,3}\s+/, ""))}
              </h3>,
            );
          } else if (/^>\s?/.test(line)) {
            const callout = line.replace(/^>\s?/, "");
            const tone = /^\[!(WARNING|CAUTION)\]/i.test(callout)
              ? "warning"
              : /^\[!(TIP|NOTE|IMPORTANT)\]/i.test(callout)
                ? "tip"
                : "note";
            output.push(
              <aside className={`message-callout ${tone}`} key={index}>
                {inlineMarkdown(callout.replace(/^\[!\w+\]\s*/i, ""))}
              </aside>,
            );
          } else if (/^[-*]\s/.test(line)) {
            output.push(
              <div className="message-list-item" key={index}>
                <i />
                {inlineMarkdown(line.replace(/^[-*]\s+/, ""))}
              </div>,
            );
          } else if (/^\d+\.\s/.test(line)) {
            const match = line.match(/^(\d+)\.\s+(.*)$/);
            output.push(
              <div className="message-list-item ordered" key={index}>
                <i>{match?.[1]}</i>
                {inlineMarkdown(match?.[2] ?? line)}
              </div>,
            );
          } else {
            output.push(<p key={index}>{inlineMarkdown(line)}</p>);
          }
        }
        return <div key={blockIndex}>{output}</div>;
      })}
    </div>
  );
}

function ProjectSelector({
  projects,
  recentProjects,
  project,
  onSelect,
  onNew,
  disabled,
}: {
  projects: Project[];
  recentProjects: Project[];
  project: Project | null;
  onSelect: (project: Project) => void;
  onNew: () => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node))
        setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  const query = search.trim().toLowerCase();
  const matching = projects.filter((item) =>
    item.name.toLowerCase().includes(query),
  );
  const recentIds = new Set(recentProjects.map((item) => item.id));
  const currentProjects = matching.filter(
    (item) => item.id === project?.id || !recentIds.has(item.id),
  );
  const recent = matching.filter(
    (item) => recentIds.has(item.id) && item.id !== project?.id,
  );
  const select = (item: Project) => {
    onSelect(item);
    setSearch("");
    setOpen(false);
  };
  return (
    <div className="project-picker" ref={ref}>
      <button
        type="button"
        className="tool-chip project-control classic-project-trigger"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Folder size={16} />
        <span>{project?.name ?? "New automation"}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div
          className="compact-menu project-menu restored-project-menu premium-project-menu"
          role="menu"
        >
          {projects.length > 6 && (
            <label className="project-menu-search">
              <Search size={14} />
              <input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search projects…"
                aria-label="Search projects"
              />
            </label>
          )}
          {currentProjects.length > 0 && (
            <>
              <span className="menu-heading">Current Projects</span>
              <div className="project-list-area current-project-area">
                {currentProjects.map((item) => (
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={item.id === project?.id}
                    key={item.id}
                    onClick={() => select(item)}
                  >
                    <Folder size={15} />
                    <span>{item.name}</span>
                    {item.id === project?.id && <Check size={14} />}
                  </button>
                ))}
              </div>
            </>
          )}
          {recent.length > 0 && (
            <>
              <span className="menu-heading">Recent Projects</span>
              <div className="project-list-area">
                {recent.map((item) => (
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked="false"
                    key={item.id}
                    onClick={() => select(item)}
                  >
                    <Folder size={15} />
                    <span>{item.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {!matching.length && (
            <p className="project-menu-empty">No projects found.</p>
          )}
          <div className="menu-divider" />
          <button
            type="button"
            className="menu-new"
            onClick={() => {
              setSearch("");
              setOpen(false);
              onNew();
            }}
          >
            <Plus size={15} />
            New Automation
          </button>
        </div>
      )}
    </div>
  );
}

function ModelSelector({
  models,
  connectedProviders,
  value,
  onChange,
}: {
  models: ConnectionModel[];
  connectedProviders: Set<ConnectionProvider>;
  value: ConnectionModel | null;
  onChange: (model: ConnectionModel) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node))
        setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div className="premium-selector model-selector" ref={ref}>
      <button
        type="button"
        className="premium-selector-trigger"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="selector-logo">
          {value ? (
            <img src={providerLogos[value.provider]} alt="" />
          ) : (
            <Bot size={16} />
          )}
        </span>
        <span className="selector-copy">
          <strong>{value?.displayName ?? "No model connected"}</strong>
          <small>
            {value ? providerNames[value.provider] : "Connect a provider"}
          </small>
        </span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="premium-selector-menu model-command-menu" role="menu">
          <span className="selector-menu-label">Model</span>
          {models.map((model) => {
            const connected = connectedProviders.has(model.provider);
            const selected =
              value?.provider === model.provider && value.id === model.id;
            return (
              <button
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                disabled={!connected}
                key={`${model.provider}:${model.id}`}
                onClick={() => {
                  onChange(model);
                  setOpen(false);
                }}
              >
                <span className="selector-logo">
                  <img src={providerLogos[model.provider]} alt="" />
                </span>
                <span>
                  <strong>{model.displayName}</strong>
                  <small>
                    {providerNames[model.provider]}
                    {connected ? "" : " · Not Connected"}
                  </small>
                </span>
                {selected && <Check className="selector-check" size={15} />}
              </button>
            );
          })}
          {!models.length && <p>No provider models are available.</p>}
        </div>
      )}
    </div>
  );
}

function ProcessingState({ label }: { label: string }) {
  return (
    <div className="processing-state">
      <Sparkles size={15} />
      <span>{label || "Thinking"}</span>
      <i />
      <i />
      <i />
    </div>
  );
}

function NewAutomationShortcut({ open }: { open: () => void }) {
  const [mac, setMac] = useState(false);
  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);
  return (
    <button
      type="button"
      className="new-automation-shortcut"
      onClick={open}
      aria-label={`New Automation, ${mac ? "Command" : "Control"} P`}
    >
      <span>New Automation</span>
      <span className="shortcut-keys">
        <kbd>{mac ? "⌘" : "Ctrl"}</kbd>
        <kbd>P</kbd>
      </span>
    </button>
  );
}

export function ConversationWorkspace({
  project,
  projects,
  recentProjects,
  createProject,
  onProjectReady,
  onSelectProject,
  onNewProject,
  onUpdate,
}: {
  project: Project | null;
  projects: Project[];
  recentProjects: Project[];
  createProject: (input: {
    name: string;
    description: string;
    phase?: string;
  }) => Promise<Project>;
  onProjectReady: (project: Project) => void;
  onSelectProject: (project: Project) => void;
  onNewProject: () => void;
  onUpdate: (
    projectId: string,
    values: { description?: string; phase?: string },
  ) => Promise<void>;
}) {
  const { user, account } = useAuth();
  const ai = useAI();
  const conversations = useConversations();
  const connectionState = useConnections();
  const knowledge = useKnowledge();
  const artifactGeneration = useArtifactGeneration();
  const uploadRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLElement>(null);
  const restoredScrollProjectRef = useRef<string | null>(null);
  const followOutputRef = useRef(false);
  const streamTargetRef = useRef("");
  const revealIndexRef = useRef(0);
  const revealTimerRef = useRef<number | null>(null);
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [streamed, setStreamed] = useState("");
  const [streamCitations, setStreamCitations] = useState<AICitation[]>([]);
  const [optimisticMessage, setOptimisticMessage] = useState("");
  const [localAssistantMessage, setLocalAssistantMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [downloadsMode, setDownloadsMode] = useState<"open" | "download" | null>(null);
  const connectedProviders = useMemo(
    () =>
      new Set(
        connectionState.connections
          .filter((connection) => connection.status === "connected")
          .map((connection) => connection.provider),
      ),
    [connectionState.connections],
  );
  const selectableModels = useMemo(
    () =>
      connectionState.models.filter((model) =>
        connectedProviders.has(model.provider),
      ),
    [connectedProviders, connectionState.models],
  );
  const [selectedModelKey, setSelectedModelKey] = useState("");
  const selectedModel =
    connectionState.models.find(
      (model) =>
        `${model.provider}:${model.id}` === selectedModelKey &&
        connectedProviders.has(model.provider),
    ) ?? null;
  const appliedDefaultRef = useRef<string | undefined>(undefined);
  const modelProjectRef = useRef<string | null>(null);
  const orderedModels = useMemo(
    () =>
      [...connectionState.models].sort(
        (left, right) =>
          Number(right.provider === connectionState.defaultProvider) -
          Number(left.provider === connectionState.defaultProvider),
      ),
    [connectionState.defaultProvider, connectionState.models],
  );
  const projectId = project?.id ?? null;
  const aiProjectId = ai.projectId;
  const loadProjectIntelligence = ai.loadProjectIntelligence;
  const knowledgeProjectId = knowledge.projectId;
  const loadProjectKnowledge = knowledge.loadProjectKnowledge;
  const conversationProjectId = conversations.projectId;
  const conversationLoading = conversations.loading;
  const activeConversation = conversations.activeConversation;
  const projectConversations = conversations.conversations;
  const conversationMessages = conversations.messages;
  const loadProjectConversations = conversations.loadProjectConversations;
  const selectConversation = conversations.selectConversation;

  useEffect(() => {
    if (!connectionState.preferenceReady) return;
    const defaultKey = connectionState.defaultModel
      ? `${connectionState.defaultModel.provider}:${connectionState.defaultModel.id}`
      : "";
    const modelScope = projectId ?? "new";
    if (modelProjectRef.current !== modelScope) {
      const saved =
        window.sessionStorage.getItem(`agentflow:model:${modelScope}`) ?? "";
      const savedModel = connectionState.models.find(
        (model) =>
          `${model.provider}:${model.id}` === saved &&
          connectedProviders.has(model.provider),
      );
      const fallback =
        savedModel ??
        connectionState.defaultModel ??
        selectableModels.find((model) => model.provider === "gemini") ??
        selectableModels[0];
      setSelectedModelKey(
        fallback ? `${fallback.provider}:${fallback.id}` : "",
      );
      modelProjectRef.current = modelScope;
      appliedDefaultRef.current = defaultKey;
      return;
    }
    if (appliedDefaultRef.current !== defaultKey) {
      const fallback =
        connectionState.defaultModel ??
        selectableModels.find((model) => model.provider === "gemini") ??
        selectableModels[0];
      setSelectedModelKey(
        fallback ? `${fallback.provider}:${fallback.id}` : "",
      );
      appliedDefaultRef.current = defaultKey;
      return;
    }
    if (!selectedModel) {
      const fallback =
        connectionState.defaultModel ??
        selectableModels.find((model) => model.provider === "gemini") ??
        selectableModels[0];
      setSelectedModelKey(
        fallback ? `${fallback.provider}:${fallback.id}` : "",
      );
    }
  }, [
    connectionState.defaultModel,
    connectionState.models,
    connectionState.preferenceReady,
    connectedProviders,
    projectId,
    selectableModels,
    selectedModel,
  ]);

  useEffect(() => {
    if (!projectId) return;
    const loaders: Promise<void>[] = [];
    if (aiProjectId !== projectId)
      loaders.push(loadProjectIntelligence(projectId));
    if (knowledgeProjectId !== projectId)
      loaders.push(loadProjectKnowledge(projectId));
    if (conversationProjectId !== projectId)
      loaders.push(loadProjectConversations(projectId));
    if (loaders.length) void Promise.allSettled(loaders);
  }, [
    projectId,
    aiProjectId,
    loadProjectIntelligence,
    knowledgeProjectId,
    loadProjectKnowledge,
    conversationProjectId,
    loadProjectConversations,
  ]);

  useEffect(() => {
    setDownloadsMode(null);
  }, [projectId]);

  useEffect(() => {
    if (
      !projectId ||
      conversationProjectId !== projectId ||
      conversationLoading ||
      activeConversation ||
      !projectConversations[0]
    )
      return;
    void selectConversation(projectConversations[0]);
  }, [
    projectId,
    conversationProjectId,
    conversationLoading,
    activeConversation,
    projectConversations,
    selectConversation,
  ]);

  useEffect(() => {
    if (
      !projectId ||
      conversationProjectId !== projectId ||
      conversationLoading ||
      !activeConversation
    )
      return;
    const key = `agentflow:continued:${projectId}`;
    if (window.sessionStorage.getItem(key) !== "1") return;
    window.sessionStorage.removeItem(key);
    setLocalAssistantMessage(
      "Automation restored successfully.\n\nSuggested improvements:\n\n• Replace Slack with Teams\n• Add Salesforce\n• Add approval\n• Reduce complexity\n• Improve security",
    );
  }, [
    activeConversation,
    conversationLoading,
    conversationProjectId,
    projectId,
  ]);

  useEffect(() => {
    restoredScrollProjectRef.current = null;
  }, [projectId]);

  useEffect(() => {
    if (
      !projectId ||
      conversationProjectId !== projectId ||
      conversationLoading ||
      !chatScrollRef.current ||
      restoredScrollProjectRef.current === projectId
    )
      return;
    const frame = window.requestAnimationFrame(() => {
      const container = chatScrollRef.current;
      if (!container) return;
      const saved = Number(
        window.sessionStorage.getItem(
          `agentflow:conversation-scroll:${projectId}`,
        ),
      );
      container.scrollTop =
        Number.isFinite(saved) && saved >= 0
          ? Math.min(saved, container.scrollHeight - container.clientHeight)
          : container.scrollHeight;
      restoredScrollProjectRef.current = projectId;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    projectId,
    conversationProjectId,
    conversationLoading,
    conversationMessages.length,
  ]);

  useEffect(() => {
    if (followOutputRef.current)
      endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [conversations.messages, streamed, status]);

  useEffect(
    () => () => {
      if (revealTimerRef.current !== null)
        window.clearInterval(revealTimerRef.current);
    },
    [],
  );

  const startReveal = () => {
    if (revealTimerRef.current !== null) return;
    revealTimerRef.current = window.setInterval(() => {
      const remaining = streamTargetRef.current.length - revealIndexRef.current;
      if (remaining <= 0) {
        if (revealTimerRef.current !== null)
          window.clearInterval(revealTimerRef.current);
        revealTimerRef.current = null;
        return;
      }
      const step = remaining > 500 ? 8 : remaining > 160 ? 4 : 2;
      revealIndexRef.current = Math.min(
        streamTargetRef.current.length,
        revealIndexRef.current + step,
      );
      setStreamed(streamTargetRef.current.slice(0, revealIndexRef.current));
    }, 14);
  };

  const finishReveal = async () =>
    new Promise<void>((resolve) => {
      const started = Date.now();
      const check = () => {
        if (
          revealIndexRef.current >= streamTargetRef.current.length ||
          Date.now() - started > 8000
        ) {
          revealIndexRef.current = streamTargetRef.current.length;
          setStreamed(streamTargetRef.current);
          resolve();
          return;
        }
        window.setTimeout(check, 20);
      };
      check();
    });

  const generate = async (
    target: Project,
    body: Record<string, unknown>,
    lifecycleRequestId?: string,
    lifecycleToken?: string,
  ) => {
    if (!user) throw new Error("Sign in to continue.");
    if (!selectedModel)
      throw new Error(
        "Connect an AI provider in Settings → Connections first.",
      );
    const response = await fetch("/api/intelligence/generate", {
      method: "POST",
      headers: {
        authorization: `Bearer ${lifecycleToken ?? (await user.getIdToken())}`,
        "content-type": "application/json",
        ...(lifecycleRequestId ? { "x-request-id": lifecycleRequestId } : {}),
      },
      body: JSON.stringify({
        projectId: target.id,
        provider: selectedModel.provider,
        model: selectedModel.id,
        ...body,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      if (payload.error && typeof payload.error === "object") {
        const detail = Array.isArray(payload.error.issues)
          ? ` ${payload.error.issues.join(" ")}`
          : "";
        throw new Error(
          `${String(payload.error.message ?? "AI generation failed.")}${detail}`,
        );
      }
      throw new Error(
        typeof payload.error === "string"
          ? payload.error
          : "AI generation failed.",
      );
    }
    return payload;
  };

  const extractRequirements = async (
    target: Project,
    history: typeof conversations.messages,
    userAnswer: string,
    lifecycleRequestId: string,
    lifecycleToken: string,
  ) => {
    const questionsAsked = clarificationCount(history);
    const questionsRemaining = Math.max(0, 3 - questionsAsked);
    const transcript = [
      ...history.map((item) => `${item.role.toUpperCase()}: ${item.content}`),
      `USER: ${userAnswer}`,
    ]
      .slice(-24)
      .join("\n\n");
    const extracted = await generate(target, {
      agentId: "consultant",
      task: "requirements",
      regenerate: true,
      prompt: `Extract and update the automation requirements from the conversation below.

Return only JSON shaped exactly as:
{"businessProblem":"","answers":{"currentProcess":"","trigger":"","inputs":"","outputs":"","users":"","systems":"","integrations":"","conditions":"","workflow":"","requirements":""},"confidence":{"businessProblem":0,"currentProcess":0,"trigger":0,"inputs":0,"outputs":0,"users":0,"systems":0,"integrations":0,"conditions":0,"workflow":0,"requirements":0},"assumptions":[""],"nextQuestion":"","complete":false,"offTopic":false}

Rules:
- Extract maximum information from the user's words and project documents.
- Interpret short commands such as "add Slack", "remove Gmail", or "replace Gmail with Outlook" as edits to the current requirements.
- Treat uploaded workflow exports, Project.zip files, screenshots, execution logs, console logs, stack traces, and node exports as evidence for repairing the existing automation, never as a request to recreate the project.
- For repair requests, preserve unaffected requirements and identify only the broken integration, operation, parameter, expression, credential mapping, endpoint, or workflow branch.
- Preserve previously confirmed details unless the user changes them.
- Infer safe, conventional defaults and list every inference in assumptions.
- Confidence is an integer from 0 to 100 for each field.
- Only provide nextQuestion when one low-confidence, decision-changing fact is still required.
- Never ask for company name, department, definitions of named tools, or other facts that do not materially change the workflow.
- At most one question may be returned. ${questionsRemaining} clarification question${questionsRemaining === 1 ? "" : "s"} remain.
- If no questions remain, or only minor details are missing, make explicit assumptions and set complete true.
- Set offTopic true only when the latest user message is unrelated to creating or modifying an automation. In that case nextQuestion must be empty.
- Set complete true as soon as the trigger, intended outcome, principal systems, and important decision rules are sufficiently clear to generate a safe draft.

Current derived requirements: ${JSON.stringify(ai.projectId === target.id ? ai.requirements : null)}

${transcript}`,
    }, lifecycleRequestId, lifecycleToken);
    const snapshot = requirementSnapshot(
      jsonObject(String(extracted.text ?? "")),
    );
    const hasLowConfidence = requirementFields.some(
      (field) => snapshot.confidence[field] < 60,
    );
    if (
      !snapshot.offTopic &&
      (!hasLowConfidence || questionsRemaining === 0 || !snapshot.nextQuestion)
    ) {
      snapshot.complete = true;
      snapshot.nextQuestion = "";
    }
    return snapshot;
  };

  const updateProjectLifecycle = async (
    projectId: string,
    values: { description?: string; phase?: ProjectStage },
  ) => {
    let lastError: unknown;
    for (const delay of [0, 100, 250]) {
      if (delay)
        await new Promise((resolve) => window.setTimeout(resolve, delay));
      try {
        await onUpdate(projectId, values);
        return;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error("Unable to synchronize the automation project lifecycle.", {
          cause: lastError,
        });
  };

  const saveRequirementSnapshot = async (
    target: Project,
    snapshot: RequirementSnapshot,
    userAnswer: string,
    lifecycleRequestId: string,
    lifecycleToken: string,
  ) => {
    const answers = {
      ...snapshot.answers,
      assumptions: snapshot.assumptions.join("\n"),
    };
    void reportClientLifecycle(lifecycleToken, {
      requestId: lifecycleRequestId,
      stage: "requirements-persistence",
      event: "requirements.persistence_started",
      projectId: target.id,
      status: "started",
      context: { requirementStatus: snapshot.complete ? "planning" : "gathering" },
    });
    let requirements;
    try {
      requirements = await ai.saveRequirements({
        id: ai.projectId === target.id ? ai.requirements?.id : undefined,
        project_id: target.id,
        business_problem:
          snapshot.businessProblem || target.description || userAnswer,
        answers,
        status: snapshot.complete ? "planning" : "gathering",
      });
    } catch (error) {
      await reportClientLifecycle(lifecycleToken, {
        requestId: lifecycleRequestId,
        stage: "requirements-persistence",
        event: "requirements.persistence_failed",
        projectId: target.id,
        status: "failed",
        error,
        context: {
          requirementStatus: snapshot.complete ? "planning" : "gathering",
          failingFile: "lib/supabase/intelligence.ts",
          failingLine: ai.projectId === target.id && ai.requirements?.id ? 162 : 163,
        },
      });
      throw error;
    }
    void reportClientLifecycle(lifecycleToken, {
      requestId: lifecycleRequestId,
      stage: "requirements-persistence",
      event: "requirements.persistence_completed",
      projectId: target.id,
      status: "completed",
      context: { requirementStatus: requirements.status },
    });
    try {
      await updateProjectLifecycle(target.id, {
        description: requirements.business_problem,
        phase: snapshot.complete
          ? PROJECT_STAGE.workflowPlanning
          : PROJECT_STAGE.requirements,
      });
    } catch (error) {
      await reportClientLifecycle(lifecycleToken, {
        requestId: lifecycleRequestId,
        stage: "project-persistence",
        event: "project.requirements_stage_update_failed",
        projectId: target.id,
        status: "failed",
        error,
        context: { failingFile: "components/workspace-state.tsx", failingLine: 205 },
      });
      throw error;
    }
    return requirements;
  };

  const send = async () => {
    if (!message.trim() || !user || busy) return;
    if (!selectedModel) {
      setError("Connect an AI provider in Settings → Connections first.");
      return;
    }
    const prompt = message.trim();
    if (!project && clearlyOffTopic(prompt)) {
      setMessage("");
      setError("");
      setLocalAssistantMessage(scopeRefusal);
      return;
    }
    followOutputRef.current = true;
    setBusy(true);
    setError("");
    setLocalAssistantMessage("");
    setStatus(files.length ? "Reading uploaded documents..." : "Thinking...");
    setMessage("");
    setOptimisticMessage(prompt);
    setStreamed("");
    streamTargetRef.current = "";
    revealIndexRef.current = 0;
    if (revealTimerRef.current !== null) {
      window.clearInterval(revealTimerRef.current);
      revealTimerRef.current = null;
    }
    setStreamCitations([]);
    const lifecycleRequestId = newLifecycleRequestId();
    let lifecycleToken = "";
    let lifecycleProjectId = project?.id;
    try {
      lifecycleToken = await user.getIdToken();
      void reportClientLifecycle(lifecycleToken, {
        requestId: lifecycleRequestId,
        stage: "authentication",
        event: "interview.authentication_completed",
        status: "completed",
      });
      const attachedDocuments = files.length > 0;
      let target = project;
      if (!target) {
        void reportClientLifecycle(lifecycleToken, {
          requestId: lifecycleRequestId,
          stage: "project-creation",
          event: "project.creation_started",
          status: "started",
        });
        try {
          target = await createProject({
            name: projectName(prompt),
            description: prompt,
            phase: PROJECT_STAGE.businessProblem,
          });
        } catch (error) {
          await reportClientLifecycle(lifecycleToken, {
            requestId: lifecycleRequestId,
            stage: "project-creation",
            event: "project.creation_failed",
            status: "failed",
            error,
            context: { failingFile: "components/workspace-state.tsx", failingLine: 180 },
          });
          throw error;
        }
        void reportClientLifecycle(lifecycleToken, {
          requestId: lifecycleRequestId,
          stage: "project-creation",
          event: "project.creation_completed",
          projectId: target.id,
          status: "completed",
        });
        lifecycleProjectId = target.id;
      }
      const history =
        project?.id === target.id && conversations.projectId === target.id
          ? conversations.messages
          : [];
      const requirementsCaptured =
        ai.projectId === target.id &&
        ["planning", "ready"].includes(ai.requirements?.status ?? "");
      const interviewWasComplete =
        ai.projectId === target.id && ai.requirements?.status === "ready";
      const stackPlanning =
        ai.projectId === target.id && ai.requirements?.status === "planning";
      const persistedStage = projectStageForRequirements(
        ai.projectId === target.id ? ai.requirements?.status : null,
      );
      if (
        persistedStage &&
        shouldAdvanceProjectStage(target.phase, persistedStage)
      ) {
        await updateProjectLifecycle(target.id, { phase: persistedStage });
      }
      const updatesAutomation = attachedDocuments || changesAutomation(prompt);
      if (!project) onProjectReady(target);
      for (const file of files) await knowledge.uploadDocument(target.id, file);
      setFiles([]);
      setStatus("Understanding your business...");
      const conversation =
        project && conversations.activeConversation
          ? conversations.activeConversation
          : await conversations.startConversation(target.id, {
              title: prompt.slice(0, 80),
              metadata: { source: "home" },
            });
      let plannedChange: ChangePlan | null = null;
      let plannedTools: ToolPlan | null = null;
      let plannedToolsPersisted = false;
      let updatedPlanNeedsReview = false;
      if (interviewWasComplete && updatesAutomation) {
        setStatus("Planning targeted updates...");
        const planned = await generate(target, {
          agentId: "consultant",
          task: "change-plan",
          prompt: `Plan the smallest safe project update for this request: ${prompt}`,
        }, lifecycleRequestId, lifecycleToken);
        plannedChange = changePlan(planned.changePlan);
        if (
          plannedChange.intent !== "explain" &&
          plannedChange.affectedArtifacts.length
        ) {
          await ai.addTimelineEvent({
            project_id: target.id,
            event_type: "change_requested",
            title: plannedChange.summary,
            description: prompt,
            metadata: { ...plannedChange, request: prompt } as Json,
          });
        }
        const changesToolStack =
          /\b(add|remove|replace|switch|use|migrate|connect|disconnect)\b/i.test(
            prompt,
          ) &&
          plannedChange.affectedArtifacts.some((stage) =>
            ["workflow", "environment", "export"].includes(stage),
          );
        if (
          plannedChange.intent !== "explain" &&
          changesToolStack &&
          ai.requirements
        ) {
          setStatus("Updating automation blueprint...");
          const generated = await generate(target, {
            agentId: "consultant",
            task: "tool-plan",
            prompt: `Update the existing automation blueprint for this request while preserving unaffected capability selections: ${prompt}`,
          }, lifecycleRequestId, lifecycleToken);
          plannedTools = parseToolPlan(generated.toolPlan);
          const ready = toolPlanReady(plannedTools);
          await ai.saveRequirements({
            id: ai.requirements.id,
            project_id: target.id,
            business_problem: ai.requirements.business_problem,
            answers: answersWithToolPlan(ai.requirements.answers, plannedTools),
            status: ready ? "ready" : "planning",
          });
          void reportClientLifecycle(lifecycleToken, {
            requestId: lifecycleRequestId,
            stage: "tool-planning",
            event: "tool_planning.persistence_completed",
            projectId: target.id,
            status: "completed",
            context: { requirementStatus: ready ? "ready" : "planning" },
          });
          plannedToolsPersisted = true;
          updatedPlanNeedsReview = !ready;
        }
      }
      setStatus(
        interviewWasComplete && !updatesAutomation
          ? "Analyzing..."
          : "Understanding requirements...",
      );
      const shouldUpdateRequirements =
        !requirementsCaptured ||
        Boolean(plannedChange?.affectedArtifacts.includes("requirements"));
      const snapshot = shouldUpdateRequirements
        ? await extractRequirements(
            target,
            history,
            prompt,
            lifecycleRequestId,
            lifecycleToken,
          )
        : null;
      const savedRequirements =
        snapshot && !snapshot.offTopic
          ? await saveRequirementSnapshot(
              target,
              snapshot,
              prompt,
              lifecycleRequestId,
              lifecycleToken,
            )
          : null;
      const initialCompletion = Boolean(
        snapshot?.complete && !interviewWasComplete,
      );
      const needsToolPlan =
        initialCompletion ||
        stackPlanning ||
        updatedPlanNeedsReview ||
        Boolean(
          snapshot?.complete &&
            interviewWasComplete &&
            plannedChange?.affectedArtifacts.includes("requirements"),
        );
      if (needsToolPlan && !snapshot?.offTopic) {
        setStatus("Planning required tools...");
        if (!plannedTools) {
          const generated = await generate(target, {
            agentId: "consultant",
            task: "tool-plan",
            prompt: stackPlanning
              ? `Update the production automation blueprint using this tool-related request: ${prompt}`
              : "Analyze the confirmed requirements and create the complete production automation blueprint.",
          }, lifecycleRequestId, lifecycleToken);
          plannedTools = parseToolPlan(generated.toolPlan);
        }
        const source = savedRequirements ?? ai.requirements;
        if (source && !plannedToolsPersisted)
          await ai.saveRequirements({
            id: source.id,
            project_id: target.id,
            business_problem: source.business_problem,
            answers: answersWithToolPlan(source.answers, plannedTools),
            status: "planning",
          });
          void reportClientLifecycle(lifecycleToken, {
            requestId: lifecycleRequestId,
            stage: "tool-planning",
            event: "tool_planning.persistence_completed",
            projectId: target.id,
            status: "completed",
            context: { requirementStatus: "planning" },
          });
      }
      const guidance = snapshot?.offTopic
        ? "OFF_TOPIC"
        : needsToolPlan
          ? "TOOL_PLAN_READY"
          : snapshot?.complete || plannedChange
            ? plannedChange?.intent === "debug"
              ? "Briefly identify the root cause from the supplied workflow, logs, screenshots, execution history, and project memory. Compare affected nodes with the supported integration configuration, explain the safe corrective action, and state which artifacts will update. Ask one focused question only when the evidence cannot distinguish between materially different fixes. Never tell the user to recreate the workflow. Do not show raw JSON, raw diffs, deployment documentation, or progress lists."
              : "The automation requirements were updated. Respond naturally and concisely to the user. Confirm the requested change without showing workflow descriptions, JSON, deployment guidance, progress lists, or generated artifacts. Mention that the Project page will update in the background."
            : snapshot
              ? `The requirements are not yet sufficient. Say that you understand most of the automation, then ask exactly this one question and no other question: ${snapshot.nextQuestion}`
              : "Answer the automation question naturally and concisely. Do not include generated artifacts, workflow JSON, deployment guides, or background-generation progress.";
      setStatus("Writing response...");
      await streamAIResponse({
        token: lifecycleToken,
        requestId: lifecycleRequestId,
        body: {
          projectId: target.id,
          conversationId: conversation.id,
          prompt,
          agentId: interviewMode,
          task: "chat",
          guidance,
          interaction: snapshot?.offTopic
            ? "scope-refusal"
            : needsToolPlan
              ? "tool-plan"
              : snapshot?.complete
                ? "change"
                : snapshot
                  ? "clarification"
                  : "conversation",
          provider: selectedModel.provider,
          model: selectedModel.id,
        },
        onEvent: (event) => {
          if (event.type === "text" && typeof event.text === "string") {
            streamTargetRef.current += event.text;
            startReveal();
          }
          if (event.type === "citations" && Array.isArray(event.citations))
            setStreamCitations(event.citations as AICitation[]);
        },
      });
      await finishReveal();
      await conversations.selectConversation(conversation);
      setOptimisticMessage("");
      setStreamed("");
      setStreamCitations([]);
      if (initialCompletion && snapshot && !snapshot.offTopic) {
        ai.setArtifactJob(target.id, "requirements", "complete");
        await ai.addTimelineEvent({
          project_id: target.id,
          event_type: "requirements_confirmed",
          title: "Requirements confirmed",
          description:
            "The automation interview reached sufficient confidence and tool planning started.",
        });
        window.dispatchEvent(
          new CustomEvent("agentflow:artifact-complete", {
            detail: {
              id: `${target.id}:requirements:${Date.now()}`,
              projectId: target.id,
              stage: "requirements",
              icon: "✓",
              title: "Requirements Saved",
              body: `${target.name} requirements are ready to review.`,
              action: "View Requirements",
            },
          }),
        );
      } else if (
        !needsToolPlan &&
        plannedChange &&
        plannedChange.intent !== "explain" &&
        plannedChange.affectedArtifacts.length
      ) {
        const requestedAdvanced = {
          deployment: /\bdeploy(?:ment)?(?: guide)?\b/i.test(prompt),
          testing: /\btest(?:ing)?(?: checklist)?\b/i.test(prompt),
          review: /\b(?:architecture )?review\b/i.test(prompt),
        };
        const targetedStages = plannedChange.affectedArtifacts.filter(
          (stage) =>
            (stage !== "deployment" &&
              stage !== "testing" &&
              stage !== "review") ||
            requestedAdvanced[stage],
        );
        if (targetedStages.length)
          void reportClientLifecycle(lifecycleToken, {
            requestId: lifecycleRequestId,
            stage: "artifact-scheduling",
            event: "artifacts.scheduled",
            projectId: target.id,
            status: "scheduled",
            context: { stages: targetedStages },
          });
        if (targetedStages.length)
          void artifactGeneration.start(
            target,
            onUpdate,
            targetedStages,
            selectedModel,
            {
              summary: plannedChange.summary,
              reasoning: plannedChange.reasoning,
              added: plannedChange.added,
              modified: plannedChange.modified,
              removed: plannedChange.removed,
              versionBump: plannedChange.versionBump,
              author: "user",
            },
          );
      }
    } catch (value) {
      if (lifecycleToken)
        void reportClientLifecycle(lifecycleToken, {
          requestId: lifecycleRequestId,
          stage: "interview",
          event: "interview.failed",
          projectId: lifecycleProjectId,
          status: "failed",
          error: value,
        });
      setError(
        value instanceof Error
          ? value.message
          : "Unable to continue the automation interview.",
      );
    } finally {
      setBusy(false);
      setStatus("");
      window.setTimeout(() => {
        followOutputRef.current = false;
      }, 400);
    }
  };

  const displayedMessages =
    project && conversations.projectId === project.id
      ? conversations.messages
      : [];
  const latestToolPlanMessageId = [...displayedMessages]
    .reverse()
    .find((item) => interactionFrom(item.metadata) === "tool-plan")?.id;
  const hasToolPlanMessage = Boolean(latestToolPlanMessageId);
  const latestGenerationMessageId = [...displayedMessages]
    .reverse()
    .find((item) => interactionFrom(item.metadata) === "generation")?.id;
  const currentWorkflow =
    project && ai.projectId === project.id ? ai.workflow : null;
  const currentGraph =
    currentWorkflow && isWorkflowGraph(currentWorkflow.graph)
      ? currentWorkflow.graph
      : null;
  const validatedExport = currentWorkflow
    ? ai.exports.find(
        (item) =>
          item.workflow_version === currentWorkflow.version &&
          n8nValidationIssues(item.payload).length === 0,
      )
    : undefined;
  const packageReady = Boolean(
    ai.requirements?.status === "ready" &&
      currentGraph &&
      currentWorkflow?.deployment_guide?.trim() &&
      Array.isArray(currentWorkflow.testing_checklist) &&
      currentWorkflow.testing_checklist.length > 0 &&
      currentWorkflow.explanation?.trim() &&
      validatedExport,
  );
  const currentJobs = project ? (ai.artifactJobs[project.id] ?? {}) : {};
  const currentToolPlan =
    project && ai.projectId === project.id
      ? toolPlanFromAnswers(ai.requirements?.answers ?? null)
      : null;
  const saveToolPlan = async (plan: ToolPlan) => {
    if (!project || !ai.requirements) return;
    const lifecycleRequestId = newLifecycleRequestId();
    const lifecycleToken = user ? await user.getIdToken() : "";
    try {
      await ai.saveRequirements({
        id: ai.requirements.id,
        project_id: project.id,
        business_problem: ai.requirements.business_problem,
        answers: answersWithToolPlan(ai.requirements.answers, plan),
        status: "planning",
      });
      if (lifecycleToken)
        void reportClientLifecycle(lifecycleToken, {
          requestId: lifecycleRequestId,
          stage: "tool-planning",
          event: "tool_planning.persistence_completed",
          projectId: project.id,
          status: "completed",
          context: { requirementStatus: "planning" },
        });
    } catch (error) {
      if (lifecycleToken)
        await reportClientLifecycle(lifecycleToken, {
          requestId: lifecycleRequestId,
          stage: "tool-planning",
          event: "tool_planning.persistence_failed",
          projectId: project.id,
          status: "failed",
          error,
        });
      throw error;
    }
  };
  const finalizeToolPlan = async (plan: ToolPlan) => {
    if (
      !project ||
      !ai.requirements ||
      !selectedModel ||
      !conversations.activeConversation
    )
      return;
    setBusy(true);
    setError("");
    const lifecycleRequestId = newLifecycleRequestId();
    let lifecycleToken = "";
    try {
      lifecycleToken = user ? await user.getIdToken() : "";
      const finalized = { ...plan, finalizedAt: new Date().toISOString() };
      await ai.saveRequirements({
        id: ai.requirements.id,
        project_id: project.id,
        business_problem: ai.requirements.business_problem,
        answers: answersWithToolPlan(ai.requirements.answers, finalized),
        status: "ready",
      });
      await updateProjectLifecycle(project.id, {
        phase: PROJECT_STAGE.workflowDesign,
      });
      await ai.addTimelineEvent({
        project_id: project.id,
        event_type: "tool_stack_finalized",
        title: "Automation stack finalized",
        description: `${plan.tools.length} production tool${plan.tools.length === 1 ? "" : "s"} confirmed.`,
        metadata: { tools: plan.tools.map((tool) => tool.name) } as Json,
      });
      await conversations.addMessage({
        conversation_id: conversations.activeConversation.id,
        project_id: project.id,
        role: "assistant",
        content:
          "Automation Blueprint Approved\n\nYour automation stack has been finalized.\n\nAgentFlow is now generating your validated production package.\n\nProgress is available on the Project page.",
        model: selectedModel.id,
        metadata: {
          interaction: "generation",
          provider: selectedModel.provider,
        },
      });
      ai.setArtifactJob(project.id, "requirements", "complete");
      const stages = currentGraph
        ? ([
            "deployment",
            "environment",
            "testing",
            "review",
            "export",
          ] as ArtifactStage[])
        : undefined;
      if (lifecycleToken)
        void reportClientLifecycle(lifecycleToken, {
          requestId: lifecycleRequestId,
          stage: "artifact-scheduling",
          event: "artifacts.scheduled",
          projectId: project.id,
          status: "scheduled",
          context: {
            stages: stages ?? ["workflow", "deployment", "environment", "testing", "review", "export"],
          },
        });
      void artifactGeneration.start(project, onUpdate, stages, selectedModel, {
        summary: currentGraph
          ? "Finalized imported workflow stack"
          : "Initial generation",
        reasoning:
          "Generated from confirmed requirements and the finalized production tool stack.",
        author: "ai",
      });
    } catch (value) {
      if (lifecycleToken)
        void reportClientLifecycle(lifecycleToken, {
          requestId: lifecycleRequestId,
          stage: "tool-planning",
          event: "tool_planning.finalization_failed",
          projectId: project.id,
          status: "failed",
          error: value,
        });
      setError(
        value instanceof Error
          ? value.message
          : "Unable to finalize the automation stack.",
      );
    } finally {
      setBusy(false);
    }
  };
  const openCurrentProject = () => {
    if (project)
      window.dispatchEvent(
        new CustomEvent("agentflow:open-project", {
          detail: { projectId: project.id },
        }),
      );
  };
  const generateAdvanced = (stage: "deployment" | "testing" | "review") => {
    if (project)
      void artifactGeneration.start(project, onUpdate, stage, selectedModel, {
        summary: `Generated ${stage}`,
        reasoning: "Generated as optional documentation on user request.",
        modified: [stage],
        author: "user",
      });
  };
  const hasConversation =
    displayedMessages.length > 0 ||
    Boolean(currentToolPlan) ||
    Boolean(localAssistantMessage) ||
    Boolean(optimisticMessage) ||
    Boolean(streamed) ||
    busy;
  const promptBox = (
    <div className="composer conversation-prompt">
      <textarea
        ref={composerRef}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void send();
          }
        }}
        placeholder={
          project
            ? "Answer the next question or describe a change…"
            : "Describe the automation you want to build…"
        }
        disabled={busy}
      />
      {files.length > 0 && (
        <div className="composer-files">
          {files.map((file, index) => (
            <span className="file-chip" key={`${file.name}-${index}`}>
              <FileText size={14} />
              {file.name}
              <button
                onClick={() =>
                  setFiles((current) =>
                    current.filter((_, itemIndex) => itemIndex !== index),
                  )
                }
              >
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="composer-footer">
        <div className="composer-tools">
          <button
            className="tool-icon"
            onClick={() => uploadRef.current?.click()}
            disabled={busy}
            aria-label="Upload documents"
            title="Upload documents"
          >
            <Paperclip size={18} />
          </button>
          <ProjectSelector
            projects={projects}
            recentProjects={recentProjects}
            project={project}
            onSelect={onSelectProject}
            onNew={onNewProject}
            disabled={busy}
          />
        </div>
        <div className="composer-actions">
          <ModelSelector
            models={orderedModels}
            connectedProviders={connectedProviders}
            value={selectedModel}
            onChange={(model) => {
              const key = `${model.provider}:${model.id}`;
              setSelectedModelKey(key);
              window.sessionStorage.setItem(
                `agentflow:model:${project?.id ?? "new"}`,
                key,
              );
            }}
          />
          <button
            className="send-button"
            disabled={!message.trim() || busy || !selectedModel}
            onClick={() => void send()}
            aria-label="Send"
          >
            <Send size={19} />
          </button>
        </div>
      </div>
    </div>
  );
  const shortcutHint = <NewAutomationShortcut open={onNewProject} />;

  return (
    <>
      <input
        ref={uploadRef}
        hidden
        multiple
        type="file"
        accept=".md,.markdown,.pdf,.docx,image/png,image/jpeg,.txt,.log,.json,.yaml,.yml,.zip,application/zip"
        onChange={(event) => setFiles([...(event.target.files ?? [])])}
      />
      {!hasConversation ? (
        <section className="home-view restored-home">
          <div className="hero-orbit" />
          <div className="home-content">
            <img className="hero-mark" src={chatLogo} alt="AgentFlow" />
            <h1>
              What do you want to <em>automate?</em>
            </h1>
            <p>{welcomeMessage}</p>
            {promptBox}
            <SupportedIntegrationsCta />
            {status && <p className="home-chat-status">{status}</p>}
            {error && (
              <p className="ide-error" role="alert">
                {error}
              </p>
            )}
            {shortcutHint}
          </div>
          <div className="quote">
            <span />
            <p>
              Design. Generate. Review. Optimize. Export.
              <br />
              <b>AgentFlow AI</b>
            </p>
            <span />
          </div>
        </section>
      ) : (
        <section
          ref={chatScrollRef}
          onScroll={(event) => {
            if (project)
              window.sessionStorage.setItem(
                `agentflow:conversation-scroll:${project.id}`,
                String(event.currentTarget.scrollTop),
              );
          }}
          className="home-chat-workspace restored-home-chat conversation-ready"
        >
          <div className="home-chat-thread">
            {displayedMessages.map((item) => {
              const citations = citationsFrom(item.metadata);
              const interaction = interactionFrom(item.metadata);
              const generation = interaction === "generation";
              if (generation && item.id !== latestGenerationMessageId) return null;
              const completed = generation;
              const planned =
                interaction === "tool-plan" &&
                item.id === latestToolPlanMessageId;
              return (
                <article className={`ide-message ${item.role}`} key={item.id}>
                  <small>
                    {item.role === "user" ? account.name : "AgentFlow AI"}
                  </small>
                  {!completed && (
                    <MessageContent
                      content={
                        planned
                          ? "I've understood your automation.\n\nReview the automation blueprint before generation begins."
                          : item.content
                      }
                    />
                  )}
                  {planned &&
                    currentToolPlan &&
                    project &&
                    ai.requirements?.status === "planning" && (
                      <ToolPlanCard
                        automationName={project.name}
                        plan={currentToolPlan}
                        update={saveToolPlan}
                        finalize={finalizeToolPlan}
                        continueChat={() => composerRef.current?.focus()}
                        busy={busy}
                      />
                    )}{" "}
                  {completed && project && (
                    <AutomationCompletionCard
                      project={project}
                      ready={packageReady}
                      jobs={currentJobs}
                      workflowVersion={currentWorkflow?.version}
                      startedAt={item.created_at}
                      completedAt={currentWorkflow?.updated_at}
                      openDownloads={() => setDownloadsMode("open")}
                      downloadPackage={() => setDownloadsMode("download")}
                    />
                  )}{" "}
                  {citations.length > 0 && (
                    <div className="citation-list">
                      {citations.map((citation) => (
                        <span
                          key={`${citation.documentId}-${citation.chunkIndex}`}
                        >
                          [{citation.id}] {citation.fileName} · v
                          {citation.version}
                        </span>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
            {currentToolPlan &&
              project &&
              !hasToolPlanMessage &&
              ai.requirements?.status === "planning" && (
                <article className="ide-message assistant">
                  <small>AgentFlow AI</small>
                  <MessageContent content="I've understood your automation.\n\nReview the automation blueprint before generation begins." />
                  <ToolPlanCard
                    automationName={project.name}
                    plan={currentToolPlan}
                    update={saveToolPlan}
                    finalize={finalizeToolPlan}
                    continueChat={() => composerRef.current?.focus()}
                    busy={busy}
                  />
                </article>
              )}
            {localAssistantMessage && (
              <article className="ide-message assistant">
                <small>AgentFlow AI</small>
                <MessageContent content={localAssistantMessage} />
              </article>
            )}
            {optimisticMessage && (
              <article className="ide-message user optimistic">
                <small>{account.name}</small>
                <MessageContent content={optimisticMessage} />
              </article>
            )}
            {streamed ? (
              <article className="ide-message assistant">
                <small>AgentFlow AI</small>
                <MessageContent content={streamed} streaming />
                {streamCitations.length > 0 && (
                  <div className="citation-list">
                    {streamCitations.map((citation) => (
                      <span
                        key={`${citation.documentId}-${citation.chunkIndex}`}
                      >
                        [{citation.id}] {citation.fileName} · v
                        {citation.version}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            ) : (
              busy && (
                <article className="ide-message assistant pending">
                  <small>AgentFlow AI</small>
                  <ProcessingState label={status} />
                </article>
              )
            )}
            <div ref={endRef} />
          </div>
          <div className="home-chat-dock">
            {busy && status && (
              <div className="home-chat-status">
                <ProcessingState label={status} />
              </div>
            )}
            {error && (
              <p className="ide-error" role="alert">
                {error}
              </p>
            )}
            {promptBox}
            {shortcutHint}
          </div>
        </section>
      )}
      {downloadsMode && project && (
        <ConversationDownloadsModal
          project={project}
          requirements={ai.projectId === project.id ? ai.requirements : null}
          workflow={currentWorkflow}
          exports={ai.projectId === project.id ? ai.exports : []}
          close={() => setDownloadsMode(null)}
          openProject={openCurrentProject}
          downloadOnOpen={downloadsMode === "download"}
          generateAdvanced={generateAdvanced}
          advancedStatus={{
            deployment: currentJobs.deployment?.status,
            testing: currentJobs.testing?.status,
            review: currentJobs.review?.status,
          }}
        />
      )}
    </>
  );
}
