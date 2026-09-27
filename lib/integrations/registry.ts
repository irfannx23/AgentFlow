export const integrationCategories = [
  "AI Providers",
  "Productivity",
  "Communication",
  "CRM",
  "Commerce",
  "Databases",
  "Development",
  "Utilities",
] as const;

export type IntegrationCategory = (typeof integrationCategories)[number];
export type IntegrationStatus = "available" | "beta" | "coming-soon" | "enterprise";
export type IntegrationAuthentication = "OAuth 2.0" | "API key" | "Access token" | "Database credentials" | "Basic authentication" | "Webhook" | "None";
export type IntegrationIcon = "ai" | "bot" | "calendar" | "cart" | "cloud" | "code" | "database" | "document" | "mail" | "message" | "payments" | "sheet" | "store" | "users" | "webhook" | "workflow";

export type IntegrationDefinition = {
  id: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  logoPath: string | null;
  website: string;
  documentationUrl: string;
  status: IntegrationStatus;
  authenticationType: IntegrationAuthentication;
  supportedOperations: string[];
  icon: IntegrationIcon;
  featured?: boolean;
  keywords?: string[];
};

type IntegrationInput = Omit<IntegrationDefinition, "status" | "logoPath"> & { status?: IntegrationStatus; logoPath?: string | null };
const integration = (value: IntegrationInput): IntegrationDefinition => ({ status: "available", logoPath: null, ...value });

export const integrationCatalogLabel = "100+ Integrations";

export const integrationRegistry: IntegrationDefinition[] = [
  integration({ id: "openai", name: "OpenAI", description: "Build intelligent steps with GPT models.", category: "AI Providers", icon: "ai", featured: true, keywords: ["gpt"], website: "https://openai.com", documentationUrl: "https://platform.openai.com/docs", authenticationType: "API key", supportedOperations: ["Generate text", "Classify", "Extract", "Summarize"] }),
  integration({ id: "gemini", name: "Google Gemini", description: "Reason across text, images, and documents.", category: "AI Providers", icon: "ai", logoPath: "/integrations/google-gemini.svg", featured: true, keywords: ["google"], website: "https://gemini.google.com", documentationUrl: "https://ai.google.dev/gemini-api/docs", authenticationType: "API key", supportedOperations: ["Generate content", "Analyze documents", "Classify", "Extract"] }),
  integration({ id: "anthropic", name: "Anthropic", description: "Use Claude for reliable AI workflows.", category: "AI Providers", icon: "bot", keywords: ["claude"], website: "https://anthropic.com", documentationUrl: "https://docs.anthropic.com", authenticationType: "API key", supportedOperations: ["Generate text", "Analyze", "Classify", "Extract"] }),
  integration({ id: "deepseek", name: "DeepSeek", description: "Add efficient chat and reasoning models.", category: "AI Providers", icon: "bot", website: "https://deepseek.com", documentationUrl: "https://api-docs.deepseek.com", authenticationType: "API key", supportedOperations: ["Chat completion", "Reasoning", "Classify"] }),

  integration({ id: "google-workspace", name: "Google Workspace", description: "Connect shared files, calendars, and teams.", category: "Productivity", icon: "cloud", keywords: ["drive", "calendar", "admin"], website: "https://workspace.google.com", documentationUrl: "https://developers.google.com/workspace", authenticationType: "OAuth 2.0", supportedOperations: ["Provision users", "Manage groups", "Read directories"] }),
  integration({ id: "google-sheets", name: "Google Sheets", description: "Read, update, and route spreadsheet data.", category: "Productivity", icon: "sheet", logoPath: "/integrations/google-sheets.svg", featured: true, website: "https://workspace.google.com/products/sheets", documentationUrl: "https://developers.google.com/workspace/sheets/api", authenticationType: "OAuth 2.0", supportedOperations: ["Read rows", "Append rows", "Update rows", "Lookup rows"] }),
  integration({ id: "microsoft-365", name: "Microsoft 365", description: "Automate documents, calendars, and workspaces.", category: "Productivity", icon: "document", keywords: ["office", "excel", "onedrive"], website: "https://microsoft.com/microsoft-365", documentationUrl: "https://learn.microsoft.com/graph", authenticationType: "OAuth 2.0", supportedOperations: ["Manage files", "Read spreadsheets", "Create calendar events"] }),
  integration({ id: "notion", name: "Notion", description: "Keep pages and databases synchronized.", category: "Productivity", icon: "document", logoPath: "/integrations/notion.svg", website: "https://notion.so", documentationUrl: "https://developers.notion.com", authenticationType: "Access token", supportedOperations: ["Create pages", "Update pages", "Query databases"] }),
  integration({ id: "airtable", name: "Airtable", description: "Turn flexible records into automated processes.", category: "Productivity", icon: "sheet", website: "https://airtable.com", documentationUrl: "https://airtable.com/developers/web/api/introduction", authenticationType: "Access token", supportedOperations: ["Create records", "Update records", "List records"] }),

  integration({ id: "slack", name: "Slack", description: "Send alerts and coordinate team actions.", category: "Communication", icon: "message", featured: true, website: "https://slack.com", documentationUrl: "https://api.slack.com/docs", authenticationType: "OAuth 2.0", supportedOperations: ["Send messages", "Create channels", "Invite users"] }),
  integration({ id: "teams", name: "Microsoft Teams", description: "Connect messages, channels, and approvals.", category: "Communication", icon: "message", keywords: ["ms teams"], website: "https://microsoft.com/microsoft-teams", documentationUrl: "https://learn.microsoft.com/graph/teams-concept-overview", authenticationType: "OAuth 2.0", supportedOperations: ["Send messages", "Create channels", "Manage members"] }),
  integration({ id: "discord", name: "Discord", description: "Automate community messages and events.", category: "Communication", icon: "message", website: "https://discord.com", documentationUrl: "https://discord.com/developers/docs", authenticationType: "Webhook", supportedOperations: ["Send messages", "Post embeds", "Manage webhooks"] }),
  integration({ id: "gmail", name: "Gmail", description: "Send, receive, and classify business email.", category: "Communication", icon: "mail", website: "https://gmail.com", documentationUrl: "https://developers.google.com/gmail/api/guides", authenticationType: "OAuth 2.0", supportedOperations: ["Send email", "Read messages", "Apply labels"] }),
  integration({ id: "outlook", name: "Outlook", description: "Automate Microsoft email and calendar flows.", category: "Communication", icon: "mail", website: "https://microsoft.com/microsoft-365/outlook/outlook-for-business", documentationUrl: "https://learn.microsoft.com/graph/api/resources/mail-api-overview", authenticationType: "OAuth 2.0", supportedOperations: ["Send email", "Read messages", "Create events"] }),

  integration({ id: "hubspot", name: "HubSpot", description: "Automate leads, contacts, and pipeline activity.", category: "CRM", icon: "users", logoPath: "/integrations/hubspot.svg", featured: true, website: "https://hubspot.com", documentationUrl: "https://developers.hubspot.com/docs/api/overview", authenticationType: "OAuth 2.0", supportedOperations: ["Create contacts", "Update contacts", "Create deals"] }),
  integration({ id: "salesforce", name: "Salesforce", description: "Coordinate enterprise customer workflows.", category: "CRM", icon: "cloud", website: "https://salesforce.com", documentationUrl: "https://developer.salesforce.com/docs/apis", authenticationType: "OAuth 2.0", supportedOperations: ["Create records", "Update records", "Run queries"] }),
  integration({ id: "pipedrive", name: "Pipedrive", description: "Keep deals and sales activity moving.", category: "CRM", icon: "users", website: "https://pipedrive.com", documentationUrl: "https://developers.pipedrive.com/docs/api/v1", authenticationType: "OAuth 2.0", supportedOperations: ["Create deals", "Update deals", "Manage activities"] }),
  integration({ id: "zoho-crm", name: "Zoho CRM", description: "Connect leads, accounts, and follow-ups.", category: "CRM", icon: "users", website: "https://zoho.com/crm", documentationUrl: "https://www.zoho.com/crm/developer/docs/api/v7", authenticationType: "OAuth 2.0", supportedOperations: ["Create records", "Update records", "Search records"] }),

  integration({ id: "shopify", name: "Shopify", description: "Automate orders, customers, and fulfillment.", category: "Commerce", icon: "store", logoPath: "/integrations/shopify.svg", featured: true, website: "https://shopify.com", documentationUrl: "https://shopify.dev/docs/api", authenticationType: "Access token", supportedOperations: ["Read orders", "Update orders", "Create products"] }),
  integration({ id: "stripe", name: "Stripe", description: "Orchestrate payments and billing events.", category: "Commerce", icon: "payments", logoPath: "/integrations/stripe.svg", website: "https://stripe.com", documentationUrl: "https://docs.stripe.com/api", authenticationType: "API key", supportedOperations: ["Create customers", "Create payment links", "Issue refunds"] }),
  integration({ id: "woocommerce", name: "WooCommerce", description: "Connect store orders and customer data.", category: "Commerce", icon: "cart", website: "https://woocommerce.com", documentationUrl: "https://developer.woocommerce.com/docs/apis/rest-api", authenticationType: "Basic authentication", supportedOperations: ["Read orders", "Update orders", "Manage products"] }),
  integration({ id: "paypal", name: "PayPal", description: "Respond to payments and transaction events.", category: "Commerce", icon: "payments", website: "https://paypal.com", documentationUrl: "https://developer.paypal.com/api/rest", authenticationType: "OAuth 2.0", supportedOperations: ["Create orders", "Capture payments", "Issue refunds"] }),

  integration({ id: "supabase", name: "Supabase", description: "Connect Postgres data and realtime events.", category: "Databases", icon: "database", logoPath: "/integrations/supabase.svg", featured: true, website: "https://supabase.com", documentationUrl: "https://supabase.com/docs", authenticationType: "API key", supportedOperations: ["Insert rows", "Select rows", "Update rows", "Delete rows"] }),
  integration({ id: "postgresql", name: "PostgreSQL", description: "Read and write production relational data.", category: "Databases", icon: "database", website: "https://postgresql.org", documentationUrl: "https://postgresql.org/docs", authenticationType: "Database credentials", supportedOperations: ["Execute queries", "Select", "Insert", "Update"] }),
  integration({ id: "mysql", name: "MySQL", description: "Automate operations across SQL records.", category: "Databases", icon: "database", website: "https://mysql.com", documentationUrl: "https://dev.mysql.com/doc", authenticationType: "Database credentials", supportedOperations: ["Execute queries", "Select", "Insert", "Update"] }),
  integration({ id: "mongodb", name: "MongoDB", description: "Connect flexible document-based data.", category: "Databases", icon: "database", website: "https://mongodb.com", documentationUrl: "https://mongodb.com/docs", authenticationType: "Database credentials", supportedOperations: ["Find documents", "Insert documents", "Update documents", "Aggregate"] }),

  integration({ id: "github", name: "GitHub", description: "React to code, issues, and deployment events.", category: "Development", icon: "code", logoPath: "/integrations/github.svg", featured: true, website: "https://github.com", documentationUrl: "https://docs.github.com/rest", authenticationType: "Access token", supportedOperations: ["Create issues", "Create pull requests", "Read repositories"] }),
  integration({ id: "gitlab", name: "GitLab", description: "Automate repositories and delivery pipelines.", category: "Development", icon: "code", website: "https://gitlab.com", documentationUrl: "https://docs.gitlab.com/api", authenticationType: "Access token", supportedOperations: ["Create issues", "Create merge requests", "Read projects"] }),
  integration({ id: "vercel", name: "Vercel", description: "Coordinate deployments and project events.", category: "Development", icon: "cloud", website: "https://vercel.com", documentationUrl: "https://vercel.com/docs/rest-api", authenticationType: "Access token", supportedOperations: ["Create deployments", "Read projects", "Inspect deployments"] }),
  integration({ id: "n8n", name: "n8n", description: "Export production-ready automation workflows.", category: "Development", icon: "workflow", logoPath: "/integrations/n8n.svg", featured: true, website: "https://n8n.io", documentationUrl: "https://docs.n8n.io", authenticationType: "API key", supportedOperations: ["Export workflows", "Import workflows", "Validate connections"] }),

  integration({ id: "http-api", name: "HTTP API", description: "Connect any standards-based web service.", category: "Utilities", icon: "webhook", keywords: ["rest", "graphql"], website: "https://developer.mozilla.org/docs/Web/HTTP", documentationUrl: "https://developer.mozilla.org/docs/Web/HTTP/Methods", authenticationType: "API key", supportedOperations: ["GET", "POST", "PUT", "PATCH", "DELETE"] }),
  integration({ id: "webhooks", name: "Webhooks", description: "Trigger workflows from real-time events.", category: "Utilities", icon: "webhook", website: "https://webhooks.fyi", documentationUrl: "https://webhooks.fyi", authenticationType: "Webhook", supportedOperations: ["Receive events", "Send events", "Return responses"] }),
  integration({ id: "smtp", name: "SMTP", description: "Send transactional email through your provider.", category: "Utilities", icon: "mail", website: "https://datatracker.ietf.org/doc/html/rfc5321", documentationUrl: "https://datatracker.ietf.org/doc/html/rfc5321", authenticationType: "Basic authentication", supportedOperations: ["Send email", "Send HTML email", "Attach files"] }),
  integration({ id: "scheduler", name: "Schedule", description: "Run workflows at precise times or intervals.", category: "Utilities", icon: "calendar", website: "https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.scheduletrigger", documentationUrl: "https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.scheduletrigger", authenticationType: "None", supportedOperations: ["Run on interval", "Run with cron", "Run once"] }),
];
