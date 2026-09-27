# Changelog

All notable changes to AgentFlow are documented in this file.

## [1.1.0] - 2026-09-27

### Added

- Conversational workflow repair guidance grounded in project memory, uploaded workflows, screenshots, and execution logs
- Project ZIP and `.log` knowledge ingestion with safe archive extraction limits
- Download completion guidance with practical n8n import, configuration, testing, deployment, and repair next steps

### Changed

- Reduced the primary download surface to Project ZIP, `workflow.json`, README, deployment guide, and `.env.example`
- Moved requirements, architecture review, testing checklist, and workflow diagram behind Advanced Files
- Consolidated the public workflow download into one exporter-generated, n8n-importable `workflow.json`
- Made document processing complete before the corresponding AI request retrieves project knowledge

### Fixed

- Removed duplicate workflow JSON entries that could invalidate project ZIP creation
- Preserved historical workflow versions while generating targeted repair versions for affected artifacts only

## [1.0.0] - 2026-09-26

### Added

- AI-led requirements interview with confidence-aware clarification and off-topic guardrails
- Automation Blueprint, capability-based tool planning, dependency validation, and environment preview
- Gemini, OpenAI, Anthropic, and DeepSeek BYOK connections
- Project memory, Continue Conversation, conversational updates, and partial artifact regeneration
- Validated internal workflow graph generation and automatic node layout
- Deterministic n8n exporter with schema and connection validation
- n8n and Make.com workflow import foundation with round-trip lifecycle support
- Independent background generation for deployment, environment, testing, review, and export artifacts
- Download center with README, environment template, workflow JSON, workflow PNG, production export, and project ZIP
- Project versions, change summaries, timeline events, and artifact status tracking
- Knowledge upload, document processing, retrieval, citations, and project-scoped context
- Usage analytics, help, notifications, and responsive accessibility improvements
- Firebase Authentication, Supabase persistence, and Row Level Security policies
- PayU Test Mode hosted checkout demonstration and billing entitlement foundation

### Changed

- Consolidated the user-facing experience into one AgentFlow AI conversation
- Moved generated deliverables from chat into the read-only project lifecycle workspace
- Added a light-first glassmorphism design system and consistent modal interactions
- Restricted production n8n JSON creation to the deterministic exporter

### Security

- Encrypted stored provider credentials with a server-only encryption key
- Kept secrets out of client bundles, generated downloads, and workflow exports
- Added authenticated ownership checks and RLS policies for project lifecycle records
- Generated PayU request hashes only on the server
