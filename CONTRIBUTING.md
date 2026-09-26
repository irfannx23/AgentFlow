# Contributing to AgentFlow

Thank you for helping improve AgentFlow. Keep changes focused, preserve the established architecture, and avoid mixing unrelated refactors into feature or bug-fix pull requests.

## Local Setup

1. Fork and clone the repository.
2. Install dependencies with `pnpm install`.
3. Copy `.env.example` to `.env.local` and provide development credentials.
4. Apply the migrations in `supabase/migrations` to a development Supabase project.
5. Start the application with `pnpm dev`.

Never commit `.env.local`, API keys, encryption keys, payment salts, or exported customer data.

## Development Guidelines

- Follow the existing TypeScript, React, and service-layer patterns.
- Keep authentication, provider integrations, repositories, workflow generation, validation, and export responsibilities separated.
- Add or update tests for behavior changes.
- Preserve RLS and ownership checks when adding database access.
- Keep generated n8n JSON inside the deterministic exporter path.
- Avoid committing build output, coverage, logs, or temporary files.

## Required Checks

Run these commands before opening a pull request:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
git diff --check
```

## Pull Requests

Use a clear title and describe:

- The problem being solved
- The implementation approach
- Validation performed
- Any migrations or environment changes
- Screenshots for visible UI changes

Keep pull requests small enough to review safely. Do not include secrets, personal data, or unrelated formatting changes.
