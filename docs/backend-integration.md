# Backend Intelligence Integration

AgentFlow emits canonical product events through `/api/events`. The route validates the existing Firebase identity through the current Supabase client, signs the event, and forwards it to the independent local `agentflow-backend-engine` service.

Configure server-only `AGENTFLOW_BACKEND_URL` and `AGENTFLOW_INTEGRATION_SECRET`. The secret must never use a `NEXT_PUBLIC_` prefix. Existing UI, authentication, billing, conversation, generation, import, and download behavior is unchanged; providers emit events only after successful actions or explicit failures.

The backend owns persistence, signal evaluation, lifecycle intelligence, and n8n dispatch. See its `docs/agentflow-integration.md` for the contract, workflow mapping, local startup, observability, and end-to-end tests.
