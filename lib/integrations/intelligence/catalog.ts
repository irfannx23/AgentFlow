import type { Json } from '@/lib/supabase/types'
import type { IntegrationAuthentication, IntegrationDefinition, IntegrationOperation } from '@/lib/integrations/intelligence/types'

const env = (name: string) => `={{ $env.${name} }}`
const json = (path: string) => `={{ $json.${path} }}`
const identifier = /(?:^|_)(?:id|channel|database|table|sheet|spreadsheet|calendar|folder|project|workspace|board|list|repository|bucket|domain|base_url|url)$/i

function valueFor(integrationId: string, parameter: string): Json {
  const variable = `${integrationId}_${parameter}`.toUpperCase().replace(/[^A-Z0-9]+/g, '_')
  if (identifier.test(parameter) || /(?:Id|URL|Url)$/.test(parameter)) return env(variable)
  if (/^(?:message|text|content|body|payload|data|record|fields|query|prompt|email|subject|name|title|phone|to|from)$/i.test(parameter)) return json(parameter)
  return env(variable)
}

function operation(
  integrationId: string,
  id: string,
  aliases: string[],
  requiredParameters: string[],
  options: Partial<Omit<IntegrationOperation, 'id'|'aliases'|'n8nOperation'|'requiredParameters'|'optionalParameters'|'parameters'>> & {
    n8nOperation?: string
    optionalParameters?: string[]
    parameters?: Record<string, Json>
  } = {},
): IntegrationOperation {
  return {
    id,
    aliases,
    n8nOperation: options.n8nOperation ?? id,
    requiredParameters,
    optionalParameters: options.optionalParameters ?? [],
    parameters: {
      ...Object.fromEntries(requiredParameters.map(parameter => [parameter, valueFor(integrationId, parameter)])),
      ...(options.parameters ?? {}),
    },
    ...(options.resource ? { resource: options.resource } : {}),
    ...(options.method ? { method: options.method } : {}),
    ...(options.endpoint ? { endpoint: options.endpoint } : {}),
    ...(options.headers ? { headers: options.headers } : {}),
    ...(options.query ? { query: options.query } : {}),
    ...(options.body ? { body: options.body } : {}),
    ...(options.outputMapping ? { outputMapping: options.outputMapping } : {}),
  }
}

type DefinitionInput = {
  id: string
  name: string
  aliases?: string[]
  n8nNodeType: string
  authentication: IntegrationAuthentication
  credentialType?: string
  credentialName?: string
  operations: IntegrationOperation[]
  environmentVariables?: string[]
  headers?: Record<string, Json>
  limitations?: string[]
  clarifications?: IntegrationDefinition['clarifications']
  timeoutSeconds?: number
}

function definition(input: DefinitionInput): IntegrationDefinition {
  return {
    id: input.id,
    name: input.name,
    aliases: [...new Set([input.id, input.name, ...(input.aliases ?? [])])],
    supportedNodes: [...new Set([input.n8nNodeType, 'n8n-nodes-base.httpRequest'])],
    n8nNodeType: input.n8nNodeType,
    typeVersion: input.n8nNodeType === 'n8n-nodes-base.httpRequest' ? 4.2 : 2,
    authentication: input.authentication,
    ...(input.credentialType ? { credentialType: input.credentialType } : {}),
    ...(input.credentialName ? { credentialName: input.credentialName } : {}),
    operations: input.operations,
    defaultHeaders: input.headers ?? {},
    endpointTemplates: input.operations.flatMap(item => item.endpoint ? [item.endpoint] : []),
    bodyTemplates: input.operations.flatMap(item => item.body ? [item.body] : []),
    expressionTemplates: { input: '={{ $json }}', field: '={{ $json.field }}', environment: '={{ $env.VARIABLE_NAME }}' },
    environmentVariables: input.environmentVariables ?? [],
    validationRules: ['Use only a supported operation.', 'Provide every required parameter.', 'Reference credentials through the n8n credential store.', 'Never embed secret values.'],
    bestPractices: ['Use least-privilege credentials.', 'Keep business-specific identifiers configurable.', 'Enable retry only for idempotent or safely repeatable requests.'],
    knownLimitations: input.limitations ?? [],
    clarifications: input.clarifications ?? [],
    retry: { attempts: 3, backoffSeconds: 5 },
    timeoutSeconds: input.timeoutSeconds ?? 30,
  }
}

const jsonHeaders = { 'Content-Type': 'application/json', Accept: 'application/json' }

export const integrationIntelligenceRegistry: IntegrationDefinition[] = [
  definition({
    id: 'google-sheets', name: 'Google Sheets', aliases: ['sheets', 'googlesheets'], n8nNodeType: 'n8n-nodes-base.googleSheets', authentication: 'oauth2', credentialType: 'googleSheetsOAuth2Api', credentialName: 'Google Sheets OAuth2 (configure in n8n)', environmentVariables: ['GOOGLE_SPREADSHEET_ID', 'GOOGLE_WORKSHEET_NAME'],
    operations: [
      operation('google-sheets', 'read-row', ['read', 'read row', 'get rows', 'lookup'], ['documentId', 'sheetName'], { resource: 'sheet', n8nOperation: 'read', parameters: { documentId: env('GOOGLE_SPREADSHEET_ID'), sheetName: env('GOOGLE_WORKSHEET_NAME'), filtersUI: { values: [] } } }),
      operation('google-sheets', 'append-row', ['append', 'append row', 'add row', 'create'], ['documentId', 'sheetName', 'columns'], { resource: 'sheet', n8nOperation: 'append', parameters: { documentId: env('GOOGLE_SPREADSHEET_ID'), sheetName: env('GOOGLE_WORKSHEET_NAME'), columns: { mappingMode: 'autoMapInputData', value: {} } } }),
      operation('google-sheets', 'update-row', ['update', 'update row'], ['documentId', 'sheetName', 'columns'], { resource: 'sheet', n8nOperation: 'update', parameters: { documentId: env('GOOGLE_SPREADSHEET_ID'), sheetName: env('GOOGLE_WORKSHEET_NAME'), columns: { mappingMode: 'autoMapInputData', value: {} } } }),
      operation('google-sheets', 'lookup-row', ['lookup row', 'find row', 'search'], ['documentId', 'sheetName', 'filtersUI'], { resource: 'sheet', n8nOperation: 'read', parameters: { documentId: env('GOOGLE_SPREADSHEET_ID'), sheetName: env('GOOGLE_WORKSHEET_NAME'), filtersUI: { values: [{ lookupColumn: env('GOOGLE_LOOKUP_COLUMN'), lookupValue: json('lookupValue') }] } } }),
    ],
    clarifications: [{ parameter: 'spreadsheetMode', question: 'Should AgentFlow use an existing Google Spreadsheet or create a new one?', options: ['Existing Spreadsheet', 'Create New Spreadsheet'] }],
  }),
  definition({
    id: 'gmail', name: 'Gmail', aliases: ['google mail'], n8nNodeType: 'n8n-nodes-base.gmail', authentication: 'oauth2', credentialType: 'gmailOAuth2', credentialName: 'Gmail OAuth2 (configure in n8n)', environmentVariables: ['GMAIL_FROM_ADDRESS'],
    operations: [
      operation('gmail', 'send', ['send', 'send email', 'welcome email', 'notify'], ['sendTo', 'subject', 'message'], { resource: 'message', n8nOperation: 'send', parameters: { sendTo: json('email'), subject: json('subject'), message: json('message'), emailType: 'html' } }),
      operation('gmail', 'get', ['read', 'get email'], ['messageId'], { resource: 'message', n8nOperation: 'get' }),
      operation('gmail', 'label', ['label', 'classify'], ['messageId', 'labelIds'], { resource: 'message', n8nOperation: 'addLabel' }),
    ],
  }),
  definition({
    id: 'google-drive', name: 'Google Drive', aliases: ['drive'], n8nNodeType: 'n8n-nodes-base.googleDrive', authentication: 'oauth2', credentialType: 'googleDriveOAuth2Api', credentialName: 'Google Drive OAuth2 (configure in n8n)', environmentVariables: ['GOOGLE_DRIVE_FOLDER_ID'],
    operations: [
      operation('google-drive', 'upload', ['upload', 'create file'], ['name', 'folderId', 'binaryPropertyName'], { resource: 'file', n8nOperation: 'upload', parameters: { name: json('fileName'), folderId: env('GOOGLE_DRIVE_FOLDER_ID'), binaryPropertyName: 'data' } }),
      operation('google-drive', 'download', ['download', 'get file'], ['fileId'], { resource: 'file', n8nOperation: 'download' }),
      operation('google-drive', 'share', ['share', 'permission'], ['fileId', 'email'], { resource: 'permission', n8nOperation: 'create' }),
    ],
  }),
  definition({
    id: 'google-calendar', name: 'Google Calendar', aliases: ['calendar'], n8nNodeType: 'n8n-nodes-base.googleCalendar', authentication: 'oauth2', credentialType: 'googleCalendarOAuth2Api', credentialName: 'Google Calendar OAuth2 (configure in n8n)', environmentVariables: ['GOOGLE_CALENDAR_ID'],
    operations: [
      operation('google-calendar', 'create-event', ['create event', 'schedule', 'add event'], ['calendar', 'start', 'end', 'summary'], { resource: 'event', n8nOperation: 'create', parameters: { calendar: env('GOOGLE_CALENDAR_ID'), start: json('start'), end: json('end'), summary: json('title') } }),
      operation('google-calendar', 'update-event', ['update event', 'reschedule'], ['calendar', 'eventId'], { resource: 'event', n8nOperation: 'update' }),
      operation('google-calendar', 'get-events', ['list events', 'availability'], ['calendar'], { resource: 'event', n8nOperation: 'getAll' }),
    ],
  }),
  definition({
    id: 'google-workspace-admin', name: 'Google Workspace Admin', aliases: ['workspace admin', 'google admin', 'gsuite admin'], n8nNodeType: 'n8n-nodes-base.gSuiteAdmin', authentication: 'oauth2', credentialType: 'gSuiteAdminOAuth2Api', credentialName: 'Google Workspace Admin OAuth2 (configure in n8n)', environmentVariables: ['GOOGLE_WORKSPACE_DOMAIN', 'GOOGLE_ORG_UNIT_PATH'],
    operations: [
      operation('google-workspace-admin', 'create-user', ['create user', 'provision account', 'employee account'], ['primaryEmail', 'givenName', 'familyName'], { resource: 'user', n8nOperation: 'create', parameters: { primaryEmail: json('email'), givenName: json('firstName'), familyName: json('lastName'), orgUnitPath: env('GOOGLE_ORG_UNIT_PATH') } }),
      operation('google-workspace-admin', 'suspend-user', ['suspend user', 'disable account'], ['userId'], { resource: 'user', n8nOperation: 'update', parameters: { userId: json('email'), suspended: true } }),
      operation('google-workspace-admin', 'add-group-member', ['add to group', 'group member'], ['groupId', 'email'], { resource: 'group', n8nOperation: 'addUser', parameters: { groupId: env('GOOGLE_GROUP_ID'), email: json('email') } }),
    ], limitations: ['Administrative operations require domain-wide delegated permissions.'],
  }),
  definition({
    id: 'slack', name: 'Slack', aliases: ['slack api'], n8nNodeType: 'n8n-nodes-base.slack', authentication: 'oauth2', credentialType: 'slackOAuth2Api', credentialName: 'Slack OAuth2 (configure in n8n)', environmentVariables: ['SLACK_CHANNEL_ID'],
    operations: [
      operation('slack', 'send-message', ['send', 'send message', 'notify', 'notification', 'welcome'], ['channelId', 'text'], { resource: 'message', n8nOperation: 'post', parameters: { select: 'channel', channelId: env('SLACK_CHANNEL_ID'), text: json('message'), otherOptions: { unfurl_links: false } } }),
      operation('slack', 'create-channel', ['create channel', 'new channel'], ['channelName'], { resource: 'channel', n8nOperation: 'create', parameters: { channelName: json('channelName') } }),
      operation('slack', 'invite-user', ['invite', 'invite user'], ['channelId', 'userId'], { resource: 'channel', n8nOperation: 'invite', parameters: { channelId: env('SLACK_CHANNEL_ID'), userIds: json('userId') } }),
    ], clarifications: [{ parameter: 'channelId', question: 'Which Slack channel should receive notifications?', options: ['General', 'HR', 'Private', 'Custom'] }],
  }),
  definition({
    id: 'microsoft-teams', name: 'Microsoft Teams', aliases: ['teams', 'ms teams'], n8nNodeType: 'n8n-nodes-base.microsoftTeams', authentication: 'oauth2', credentialType: 'microsoftTeamsOAuth2Api', credentialName: 'Microsoft Teams OAuth2 (configure in n8n)', environmentVariables: ['TEAMS_TEAM_ID', 'TEAMS_CHANNEL_ID'],
    operations: [
      operation('microsoft-teams', 'send-message', ['send message', 'notify', 'post'], ['teamId', 'channelId', 'message'], { resource: 'channelMessage', n8nOperation: 'create', parameters: { teamId: env('TEAMS_TEAM_ID'), channelId: env('TEAMS_CHANNEL_ID'), message: json('message') } }),
      operation('microsoft-teams', 'create-channel', ['create channel'], ['teamId', 'channelName'], { resource: 'channel', n8nOperation: 'create' }),
    ],
  }),
  definition({
    id: 'notion', name: 'Notion', n8nNodeType: 'n8n-nodes-base.notion', authentication: 'apiKey', credentialType: 'notionApi', credentialName: 'Notion API (configure in n8n)', environmentVariables: ['NOTION_DATABASE_ID'],
    operations: [
      operation('notion', 'create-page', ['create page', 'add page', 'create record'], ['databaseId', 'properties'], { resource: 'databasePage', n8nOperation: 'create', parameters: { databaseId: env('NOTION_DATABASE_ID'), propertiesUi: { propertyValues: json('properties') } } }),
      operation('notion', 'update-page', ['update page', 'update record'], ['pageId', 'properties'], { resource: 'databasePage', n8nOperation: 'update' }),
      operation('notion', 'query-database', ['query', 'search', 'list pages'], ['databaseId'], { resource: 'databasePage', n8nOperation: 'getAll' }),
    ],
  }),
  definition({
    id: 'hubspot', name: 'HubSpot', n8nNodeType: 'n8n-nodes-base.hubspot', authentication: 'oauth2', credentialType: 'hubspotOAuth2Api', credentialName: 'HubSpot OAuth2 (configure in n8n)',
    operations: [
      operation('hubspot', 'create-contact', ['create contact', 'add lead'], ['email'], { resource: 'contact', n8nOperation: 'create', parameters: { email: json('email'), additionalFields: json('fields') } }),
      operation('hubspot', 'update-contact', ['update contact', 'sync contact'], ['contactId', 'fields'], { resource: 'contact', n8nOperation: 'update' }),
      operation('hubspot', 'create-deal', ['create deal', 'new deal'], ['dealName', 'pipeline'], { resource: 'deal', n8nOperation: 'create' }),
    ],
  }),
  definition({
    id: 'salesforce', name: 'Salesforce', n8nNodeType: 'n8n-nodes-base.salesforce', authentication: 'oauth2', credentialType: 'salesforceOAuth2Api', credentialName: 'Salesforce OAuth2 (configure in n8n)',
    operations: [
      operation('salesforce', 'create-record', ['create', 'create lead', 'create contact'], ['resource', 'fields'], { n8nOperation: 'create', parameters: { resource: 'lead', fields: json('fields') } }),
      operation('salesforce', 'update-record', ['update', 'sync'], ['resource', 'recordId', 'fields'], { n8nOperation: 'update' }),
      operation('salesforce', 'query', ['query', 'search', 'lookup'], ['query'], { n8nOperation: 'query', parameters: { query: json('query') } }),
    ],
  }),
  definition({
    id: 'airtable', name: 'Airtable', n8nNodeType: 'n8n-nodes-base.airtable', authentication: 'apiKey', credentialType: 'airtableTokenApi', credentialName: 'Airtable Personal Access Token (configure in n8n)', environmentVariables: ['AIRTABLE_BASE_ID', 'AIRTABLE_TABLE_ID'],
    operations: [
      operation('airtable', 'create-record', ['create', 'add record'], ['base', 'table', 'fields'], { n8nOperation: 'create', parameters: { base: env('AIRTABLE_BASE_ID'), table: env('AIRTABLE_TABLE_ID'), fields: json('fields') } }),
      operation('airtable', 'update-record', ['update', 'sync record'], ['base', 'table', 'id', 'fields'], { n8nOperation: 'update' }),
      operation('airtable', 'list-records', ['list', 'read', 'search'], ['base', 'table'], { n8nOperation: 'list' }),
    ],
  }),
  definition({
    id: 'shopify', name: 'Shopify', n8nNodeType: 'n8n-nodes-base.shopify', authentication: 'apiKey', credentialType: 'shopifyApi', credentialName: 'Shopify API (configure in n8n)', environmentVariables: ['SHOPIFY_SHOP_DOMAIN'],
    operations: [
      operation('shopify', 'get-order', ['get order', 'read order'], ['orderId'], { resource: 'order', n8nOperation: 'get' }),
      operation('shopify', 'update-order', ['update order', 'fulfill'], ['orderId', 'fields'], { resource: 'order', n8nOperation: 'update' }),
      operation('shopify', 'create-product', ['create product'], ['title'], { resource: 'product', n8nOperation: 'create' }),
    ],
  }),
  definition({
    id: 'stripe', name: 'Stripe', n8nNodeType: 'n8n-nodes-base.stripe', authentication: 'apiKey', credentialType: 'stripeApi', credentialName: 'Stripe API (configure in n8n)',
    operations: [
      operation('stripe', 'create-payment-link', ['payment link', 'checkout'], ['lineItems'], { resource: 'paymentLink', n8nOperation: 'create' }),
      operation('stripe', 'create-customer', ['create customer'], ['email'], { resource: 'customer', n8nOperation: 'create' }),
      operation('stripe', 'refund', ['refund', 'refund payment'], ['chargeId'], { resource: 'charge', n8nOperation: 'refund' }),
    ],
  }),
  definition({
    id: 'discord', name: 'Discord', n8nNodeType: 'n8n-nodes-base.discord', authentication: 'webhook', credentialType: 'discordWebhookApi', credentialName: 'Discord Webhook (configure in n8n)', environmentVariables: ['DISCORD_CHANNEL_ID'],
    operations: [operation('discord', 'send-message', ['send', 'send message', 'notify'], ['content'], { resource: 'message', n8nOperation: 'send', parameters: { content: json('message') } })],
  }),
  definition({
    id: 'webhook', name: 'Webhook', aliases: ['incoming webhook', 'outgoing webhook'], n8nNodeType: 'n8n-nodes-base.webhook', authentication: 'webhook', environmentVariables: ['WEBHOOK_PATH'],
    operations: [
      operation('webhook', 'receive', ['incoming', 'receive', 'trigger'], ['path'], { n8nOperation: 'receive', method: 'POST', parameters: { httpMethod: 'POST', path: env('WEBHOOK_PATH'), responseMode: 'onReceived' } }),
      operation('webhook', 'send', ['outgoing', 'send', 'call webhook'], ['url', 'body'], { n8nOperation: 'send', method: 'POST', endpoint: env('WEBHOOK_URL'), body: { payload: json('payload') } }),
    ], clarifications: [{ parameter: 'direction', question: 'How should this webhook be used?', options: ['Incoming', 'Outgoing', 'Bidirectional'] }],
  }),
  definition({
    id: 'http-request', name: 'HTTP Request', aliases: ['http', 'rest api', 'api request'], n8nNodeType: 'n8n-nodes-base.httpRequest', authentication: 'bearer', credentialType: 'httpHeaderAuth', credentialName: 'API credential (configure in n8n)', environmentVariables: ['API_BASE_URL'], headers: jsonHeaders,
    operations: [
      operation('http-request', 'create', ['post', 'create', 'send', 'execute'], ['url', 'body'], { n8nOperation: 'request', method: 'POST', endpoint: env('API_ENDPOINT_URL'), headers: jsonHeaders, body: { data: json('payload') }, outputMapping: { data: '={{ $response.body }}', statusCode: '={{ $response.statusCode }}' } }),
      operation('http-request', 'read', ['get', 'read', 'fetch', 'lookup'], ['url'], { n8nOperation: 'request', method: 'GET', endpoint: env('API_ENDPOINT_URL'), headers: { Accept: 'application/json' }, outputMapping: { data: '={{ $response.body }}' } }),
      operation('http-request', 'update', ['put', 'patch', 'update'], ['url', 'body'], { n8nOperation: 'request', method: 'PATCH', endpoint: env('API_ENDPOINT_URL'), headers: jsonHeaders, body: { data: json('payload') } }),
      operation('http-request', 'delete', ['delete', 'remove'], ['url'], { n8nOperation: 'request', method: 'DELETE', endpoint: env('API_ENDPOINT_URL'), headers: { Accept: 'application/json' } }),
    ], clarifications: [{ parameter: 'endpoint', question: 'Which API endpoint should this request call?' }],
  }),
  ...createAiDefinitions(),
  ...createDataDefinitions(),
  ...createWorkManagementDefinitions(),
];

function createAiDefinitions(): IntegrationDefinition[] {
  const providers: Array<{ id: string; name: string; aliases: string[]; endpoint: string; model: string; credentialType: string; headers: Record<string, Json>; body: Record<string, Json> }> = [
    { id: 'openai', name: 'OpenAI', aliases: ['gpt'], endpoint: 'https://api.openai.com/v1/responses', model: 'OPENAI_MODEL', credentialType: 'openAiApi', headers: jsonHeaders, body: { model: env('OPENAI_MODEL'), input: json('prompt') } },
    { id: 'anthropic', name: 'Anthropic', aliases: ['claude'], endpoint: 'https://api.anthropic.com/v1/messages', model: 'ANTHROPIC_MODEL', credentialType: 'anthropicApi', headers: { ...jsonHeaders, 'anthropic-version': '2023-06-01' }, body: { model: env('ANTHROPIC_MODEL'), max_tokens: 1024, messages: [{ role: 'user', content: json('prompt') }] } },
    { id: 'gemini', name: 'Gemini', aliases: ['google gemini'], endpoint: '={{ "https://generativelanguage.googleapis.com/v1beta/models/" + $env.GEMINI_MODEL + ":generateContent" }}', model: 'GEMINI_MODEL', credentialType: 'googlePalmApi', headers: jsonHeaders, body: { contents: [{ parts: [{ text: json('prompt') }] }] } },
    { id: 'deepseek', name: 'DeepSeek', aliases: [] as string[], endpoint: 'https://api.deepseek.com/chat/completions', model: 'DEEPSEEK_MODEL', credentialType: 'httpHeaderAuth', headers: jsonHeaders, body: { model: env('DEEPSEEK_MODEL'), messages: [{ role: 'user', content: json('prompt') }] } },
  ];
  return providers.map(provider => definition({
    id: provider.id, name: provider.name, aliases: provider.aliases, n8nNodeType: 'n8n-nodes-base.httpRequest', authentication: 'apiKey', credentialType: provider.credentialType, credentialName: `${provider.name} credential (configure in n8n)`, environmentVariables: [provider.model], headers: provider.headers,
    operations: [operation(provider.id, 'generate', ['generate', 'chat', 'classify', 'summarize', 'analyze'], ['model', 'prompt'], { n8nOperation: 'request', method: 'POST', endpoint: provider.endpoint, headers: provider.headers, body: provider.body, outputMapping: { text: '={{ $response.body }}' } })],
    limitations: ['Model availability and rate limits depend on the connected provider account.'], timeoutSeconds: 60,
  }));
}

function createDataDefinitions(): IntegrationDefinition[] {
  const native: Array<[string,string,string,string,IntegrationAuthentication,string[],string[]]> = [
    ['supabase','Supabase','n8n-nodes-base.supabase','supabaseApi','apiKey',['create row','insert','select','update','delete'],['SUPABASE_TABLE']],
    ['postgresql','PostgreSQL','n8n-nodes-base.postgres','postgres','database',['execute query','select','insert','update'],['POSTGRES_TABLE']],
    ['mysql','MySQL','n8n-nodes-base.mySql','mySql','database',['execute query','select','insert','update'],['MYSQL_TABLE']],
    ['mongodb','MongoDB','n8n-nodes-base.mongoDb','mongoDb','database',['find','insert','update','aggregate'],['MONGODB_COLLECTION']],
    ['redis','Redis','n8n-nodes-base.redis','redis','database',['get','set','delete','publish'],['REDIS_KEY']],
    ['s3','Amazon S3','n8n-nodes-base.awsS3','aws','apiKey',['upload','download','list','delete'],['S3_BUCKET']],
    ['ftp','FTP','n8n-nodes-base.ftp','ftp','basicAuth',['upload','download','list','delete'],['FTP_REMOTE_PATH']],
    ['email','Email','n8n-nodes-base.emailSend','smtp','basicAuth',['send email','send','notify'],['EMAIL_FROM_ADDRESS']],
    ['twilio','Twilio','n8n-nodes-base.twilio','twilioApi','basicAuth',['send sms','send message','call'],['TWILIO_FROM_NUMBER']],
  ];
  return native.map(([id,name,n8nNodeType,credentialType,authentication,operationNames,environmentVariables]) => definition({
    id, name, aliases: id === 'email' ? ['smtp', 'mail'] : [], n8nNodeType, authentication, credentialType, credentialName: `${name} credential (configure in n8n)`, environmentVariables,
    operations: operationNames.map((label, index) => {
      const operationId = label.replace(/\s+/g, '-');
      const n8nOperation = label === 'execute query' ? 'executeQuery' : label.split(' ')[0];
      const write = /insert|create|update|set|upload|send|publish|call/i.test(label);
      const required = id === 'email' ? ['fromEmail','toEmail','subject','text'] : id === 'twilio' ? ['from','to','message'] : write ? ['resource','data'] : ['resource'];
      return operation(id, operationId, [label], required, { n8nOperation, parameters: id === 'email' ? { fromEmail: env('EMAIL_FROM_ADDRESS'), toEmail: json('email'), subject: json('subject'), text: json('message'), options: {} } : id === 'twilio' ? { from: env('TWILIO_FROM_NUMBER'), to: json('phone'), message: json('message') } : { operation: n8nOperation, ...(index === 0 ? {} : { options: {} }) } });
    }),
  }));
}

function createWorkManagementDefinitions(): IntegrationDefinition[] {
  const tools: Array<[string,string,string,string,string[]]> = [
    ['clickup','ClickUp','n8n-nodes-base.clickUp','clickUpApi',['create task','update task','get task']],
    ['asana','Asana','n8n-nodes-base.asana','asanaApi',['create task','update task','get task']],
    ['jira','Jira','n8n-nodes-base.jira','jiraSoftwareCloudApi',['create issue','update issue','get issue']],
    ['github','GitHub','n8n-nodes-base.github','githubApi',['create issue','create pull request','get repository']],
    ['gitlab','GitLab','n8n-nodes-base.gitlab','gitlabApi',['create issue','create merge request','get project']],
    ['linear','Linear','n8n-nodes-base.linear','linearApi',['create issue','update issue','get issue']],
    ['trello','Trello','n8n-nodes-base.trello','trelloApi',['create card','update card','get card']],
  ];
  return tools.map(([id,name,n8nNodeType,credentialType,operations]) => definition({
    id, name, n8nNodeType, authentication: id === 'github' || id === 'gitlab' ? 'apiKey' : 'oauth2', credentialType, credentialName: `${name} credential (configure in n8n)`, environmentVariables: [`${id.toUpperCase()}_PROJECT_ID`],
    operations: operations.map(label => {
      const operationId = label.replace(/\s+/g, '-');
      const create = label.startsWith('create');
      const [n8nOperation, resource = id === 'trello' ? 'card' : 'task'] = label.split(' ');
      return operation(id, operationId, [label, create ? 'create' : label], create ? ['projectId','title','description'] : ['resourceId'], { n8nOperation, resource, parameters: create ? { projectId: env(`${id.toUpperCase()}_PROJECT_ID`), title: json('title'), description: json('description') } : {} });
    }),
  }));
}

export function integrationById(id: string) {
  return integrationIntelligenceRegistry.find(integration => integration.id === id);
}

export function resolveIntegration(value: string | undefined) {
  const normalized = String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (!normalized) return undefined;
  return integrationIntelligenceRegistry.find(integration => integration.aliases.some(alias => {
    const candidate = alias.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    return normalized === candidate || normalized.includes(candidate) || candidate.includes(normalized);
  }));
}
