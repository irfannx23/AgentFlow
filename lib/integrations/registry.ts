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

export type IntegrationIcon =
  | "ai"
  | "bot"
  | "calendar"
  | "cart"
  | "cloud"
  | "code"
  | "database"
  | "document"
  | "mail"
  | "message"
  | "payments"
  | "sheet"
  | "store"
  | "users"
  | "webhook"
  | "workflow";

export type IntegrationDefinition = {
  id: string;
  name: string;
  description: string;
  category: IntegrationCategory;
  icon: IntegrationIcon;
  featured?: boolean;
  keywords?: string[];
};

export const integrationCatalogLabel = "100+ Integrations";

export const integrationRegistry: IntegrationDefinition[] = [
  { id: "openai", name: "OpenAI", description: "Build intelligent steps with GPT models.", category: "AI Providers", icon: "ai", featured: true, keywords: ["gpt"] },
  { id: "gemini", name: "Google Gemini", description: "Reason across text, images, and documents.", category: "AI Providers", icon: "ai", featured: true, keywords: ["google"] },
  { id: "anthropic", name: "Anthropic", description: "Use Claude for reliable AI workflows.", category: "AI Providers", icon: "bot", keywords: ["claude"] },
  { id: "deepseek", name: "DeepSeek", description: "Add efficient chat and reasoning models.", category: "AI Providers", icon: "bot" },

  { id: "google-workspace", name: "Google Workspace", description: "Connect shared files, calendars, and teams.", category: "Productivity", icon: "cloud", keywords: ["drive", "calendar"] },
  { id: "google-sheets", name: "Google Sheets", description: "Read, update, and route spreadsheet data.", category: "Productivity", icon: "sheet", featured: true },
  { id: "microsoft-365", name: "Microsoft 365", description: "Automate documents, calendars, and workspaces.", category: "Productivity", icon: "document", keywords: ["office", "excel"] },
  { id: "notion", name: "Notion", description: "Keep pages and databases synchronized.", category: "Productivity", icon: "document" },
  { id: "airtable", name: "Airtable", description: "Turn flexible records into automated processes.", category: "Productivity", icon: "sheet" },

  { id: "slack", name: "Slack", description: "Send alerts and coordinate team actions.", category: "Communication", icon: "message", featured: true },
  { id: "teams", name: "Microsoft Teams", description: "Connect messages, channels, and approvals.", category: "Communication", icon: "message" },
  { id: "discord", name: "Discord", description: "Automate community messages and events.", category: "Communication", icon: "message" },
  { id: "gmail", name: "Gmail", description: "Send, receive, and classify business email.", category: "Communication", icon: "mail" },
  { id: "outlook", name: "Outlook", description: "Automate Microsoft email and calendar flows.", category: "Communication", icon: "mail" },

  { id: "hubspot", name: "HubSpot", description: "Automate leads, contacts, and pipeline activity.", category: "CRM", icon: "users", featured: true },
  { id: "salesforce", name: "Salesforce", description: "Coordinate enterprise customer workflows.", category: "CRM", icon: "cloud" },
  { id: "pipedrive", name: "Pipedrive", description: "Keep deals and sales activity moving.", category: "CRM", icon: "users" },
  { id: "zoho-crm", name: "Zoho CRM", description: "Connect leads, accounts, and follow-ups.", category: "CRM", icon: "users" },

  { id: "shopify", name: "Shopify", description: "Automate orders, customers, and fulfillment.", category: "Commerce", icon: "store", featured: true },
  { id: "stripe", name: "Stripe", description: "Orchestrate payments and billing events.", category: "Commerce", icon: "payments" },
  { id: "woocommerce", name: "WooCommerce", description: "Connect store orders and customer data.", category: "Commerce", icon: "cart" },
  { id: "paypal", name: "PayPal", description: "Respond to payments and transaction events.", category: "Commerce", icon: "payments" },

  { id: "supabase", name: "Supabase", description: "Connect Postgres data and realtime events.", category: "Databases", icon: "database", featured: true },
  { id: "postgresql", name: "PostgreSQL", description: "Read and write production relational data.", category: "Databases", icon: "database" },
  { id: "mysql", name: "MySQL", description: "Automate operations across SQL records.", category: "Databases", icon: "database" },
  { id: "mongodb", name: "MongoDB", description: "Connect flexible document-based data.", category: "Databases", icon: "database" },

  { id: "github", name: "GitHub", description: "React to code, issues, and deployment events.", category: "Development", icon: "code", featured: true },
  { id: "gitlab", name: "GitLab", description: "Automate repositories and delivery pipelines.", category: "Development", icon: "code" },
  { id: "vercel", name: "Vercel", description: "Coordinate deployments and project events.", category: "Development", icon: "cloud" },
  { id: "n8n", name: "n8n", description: "Export production-ready automation workflows.", category: "Development", icon: "workflow", featured: true },

  { id: "http-api", name: "HTTP API", description: "Connect any standards-based web service.", category: "Utilities", icon: "webhook", keywords: ["rest", "graphql"] },
  { id: "webhooks", name: "Webhooks", description: "Trigger workflows from real-time events.", category: "Utilities", icon: "webhook" },
  { id: "smtp", name: "SMTP", description: "Send transactional email through your provider.", category: "Utilities", icon: "mail" },
  { id: "scheduler", name: "Schedule", description: "Run workflows at precise times or intervals.", category: "Utilities", icon: "calendar" },
];
