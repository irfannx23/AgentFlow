create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null default private.current_user_id(),
  plan text not null default 'free' check (plan in ('free', 'pro', 'team')),
  status text not null default 'active' check (status in ('active', 'pending', 'past_due', 'cancelled')),
  provider text check (provider is null or provider = 'payu'),
  provider_subscription_id text,
  provider_customer_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  scheduled_plan text check (scheduled_plan is null or scheduled_plan in ('free', 'pro', 'team')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id)
);

create table if not exists public.billing_transactions (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  provider text not null default 'payu' check (provider = 'payu'),
  transaction_id text not null unique,
  provider_payment_id text,
  plan text not null check (plan in ('pro', 'team')),
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'INR',
  status text not null default 'pending' check (status in ('pending', 'success', 'failed', 'cancelled', 'refunded')),
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_owner_status_idx on public.subscriptions(owner_id, status);
create index if not exists subscriptions_period_end_idx on public.subscriptions(current_period_end) where status = 'active';
create index if not exists billing_transactions_owner_created_idx on public.billing_transactions(owner_id, created_at desc);
create index if not exists billing_transactions_provider_payment_idx on public.billing_transactions(provider_payment_id) where provider_payment_id is not null;

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at before update on public.subscriptions
for each row execute function private.set_updated_at();

drop trigger if exists billing_transactions_set_updated_at on public.billing_transactions;
create trigger billing_transactions_set_updated_at before update on public.billing_transactions
for each row execute function private.set_updated_at();

alter table public.subscriptions enable row level security;
alter table public.billing_transactions enable row level security;

drop policy if exists "subscriptions_read_own" on public.subscriptions;
create policy "subscriptions_read_own" on public.subscriptions for select to anon, authenticated
using (owner_id = private.current_user_id());

drop policy if exists "billing_transactions_read_own" on public.billing_transactions;
create policy "billing_transactions_read_own" on public.billing_transactions for select to anon, authenticated
using (owner_id = private.current_user_id());

grant select on public.subscriptions to anon, authenticated;
grant select on public.billing_transactions to anon, authenticated;

create or replace function private.enforce_project_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  active_plan text;
  owned_projects integer;
begin
  if new.owner_id <> private.current_user_id() then
    raise exception 'Project owner must match the authenticated user' using errcode = '42501';
  end if;

  select plan into active_plan
  from public.subscriptions
  where owner_id = new.owner_id
    and status = 'active'
    and (current_period_end is null or current_period_end > now())
  limit 1;

  if coalesce(active_plan, 'free') = 'free' then
    select count(*) into owned_projects from public.projects where owner_id = new.owner_id;
    if owned_projects >= 3 then
      raise exception 'FREE_PROJECT_LIMIT_REACHED' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_project_plan_limit on public.projects;
create trigger enforce_project_plan_limit before insert on public.projects
for each row execute function private.enforce_project_plan_limit();

comment on table public.subscriptions is 'Current AgentFlow plan state. Payment instrument details are never stored.';
comment on table public.billing_transactions is 'PayU transaction references and billing history without card or secret data.';
