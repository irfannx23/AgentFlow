"use client";

import { useMemo, useState, type ComponentType } from "react";
import {
  Bot,
  BrainCircuit,
  CalendarClock,
  CheckCircle2,
  Cloud,
  Code2,
  CreditCard,
  Database,
  FileText,
  Mail,
  MessageCircle,
  Search,
  ShoppingCart,
  Sparkles,
  Store,
  Users,
  Webhook,
  Workflow,
  X,
  type LucideProps,
} from "lucide-react";
import { useDialogFocus } from "@/components/use-dialog-focus";
import {
  integrationCatalogLabel,
  integrationCategories,
  integrationRegistry,
  type IntegrationDefinition,
  type IntegrationIcon,
} from "@/lib/integrations/registry";

const iconMap: Record<IntegrationIcon, ComponentType<LucideProps>> = {
  ai: BrainCircuit,
  bot: Bot,
  calendar: CalendarClock,
  cart: ShoppingCart,
  cloud: Cloud,
  code: Code2,
  database: Database,
  document: FileText,
  mail: Mail,
  message: MessageCircle,
  payments: CreditCard,
  sheet: FileText,
  store: Store,
  users: Users,
  webhook: Webhook,
  workflow: Workflow,
};

export function IntegrationCard({ integration }: { integration: IntegrationDefinition }) {
  const Icon = iconMap[integration.icon];

  return (
    <article className="integration-explorer-card">
      <div className="integration-explorer-icon" aria-hidden="true">
        <Icon size={20} strokeWidth={1.8} />
      </div>
      <div className="integration-explorer-card-copy">
        <div className="integration-explorer-card-title">
          <h4>{integration.name}</h4>
          <span><CheckCircle2 size={12} aria-hidden="true" /> Supported</span>
        </div>
        <p>{integration.description}</p>
      </div>
    </article>
  );
}

type SupportedIntegrationsModalProps = {
  open: boolean;
  onClose: () => void;
};

export function SupportedIntegrationsModal({ open, onClose }: SupportedIntegrationsModalProps) {
  if (!open) return null;
  return <SupportedIntegrationsDialog onClose={onClose} />;
}

function SupportedIntegrationsDialog({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const dialogRef = useDialogFocus<HTMLDivElement>(onClose);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredIntegrations = useMemo(() => {
    if (!normalizedQuery) return integrationRegistry;
    return integrationRegistry.filter((integration) =>
      [
        integration.name,
        integration.description,
        integration.category,
        ...(integration.keywords ?? []),
      ].some((value) => value.toLowerCase().includes(normalizedQuery)),
    );
  }, [normalizedQuery]);
  const featuredIntegrations = integrationRegistry.filter((integration) => integration.featured);

  return (
    <div className="integration-explorer-backdrop" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        className="integration-explorer-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="supported-integrations-title"
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="integration-explorer-header">
          <div className="integration-explorer-heading">
            <div className="integration-explorer-heading-icon" aria-hidden="true">
              <Sparkles size={22} />
            </div>
            <div>
              <h2 id="supported-integrations-title">Supported Integrations</h2>
              <p>AgentFlow works across AI providers, SaaS apps, databases, APIs, and developer tools.</p>
            </div>
          </div>
          <button className="integration-explorer-close" type="button" onClick={onClose} aria-label="Close supported integrations">
            <X size={19} />
          </button>
        </header>

        <div className="integration-explorer-toolbar">
          <label className="integration-explorer-search">
            <Search size={18} aria-hidden="true" />
            <span className="sr-only">Search supported integrations</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search integrations"
              autoComplete="off"
            />
          </label>
          <span className="integration-explorer-count">{integrationCatalogLabel}</span>
        </div>

        <div className="integration-explorer-body">
          {!normalizedQuery && (
            <section className="integration-explorer-section" aria-labelledby="featured-integrations-title">
              <div className="integration-explorer-section-heading">
                <div>
                  <span>Popular connections</span>
                  <h3 id="featured-integrations-title">Featured integrations</h3>
                </div>
                <span>{featuredIntegrations.length} featured</span>
              </div>
              <div className="integration-explorer-featured-grid">
                {featuredIntegrations.map((integration) => (
                  <IntegrationCard key={integration.id} integration={integration} />
                ))}
              </div>
            </section>
          )}

          {filteredIntegrations.length > 0 ? (
            integrationCategories.map((category) => {
              const integrations = filteredIntegrations.filter((integration) => integration.category === category);
              if (!integrations.length) return null;
              const categoryId = `integration-category-${category.toLowerCase().replaceAll(" ", "-")}`;
              return (
                <section className="integration-explorer-section" aria-labelledby={categoryId} key={category}>
                  <div className="integration-explorer-section-heading compact">
                    <h3 id={categoryId}>{category}</h3>
                    <span>{integrations.length}</span>
                  </div>
                  <div className="integration-explorer-grid">
                    {integrations.map((integration) => (
                      <IntegrationCard key={integration.id} integration={integration} />
                    ))}
                  </div>
                </section>
              );
            })
          ) : (
            <div className="integration-explorer-empty">
              <Search size={24} aria-hidden="true" />
              <h3>No integrations found</h3>
              <p>Try searching by app, category, or capability.</p>
              <button type="button" onClick={() => setQuery("")}>Clear search</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function SupportedIntegrationsCta() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="supported-integrations-cta">
        <span aria-hidden="true">🚀</span>
        <span>Supports 100+ integrations and growing</span>
        <span className="supported-integrations-cta-divider" aria-hidden="true">•</span>
        <button type="button" onClick={() => setOpen(true)}>View supported tools</button>
      </div>
      <SupportedIntegrationsModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
