alter table public.knowledge_documents
add column version integer not null default 1 check (version > 0),
add column content_hash text,
add column processed_at timestamptz,
add column processing_error text;

alter table public.knowledge_chunks
alter column embedding type extensions.vector(768) using embedding::extensions.vector(768);

create index knowledge_chunks_embedding_hnsw_idx
on public.knowledge_chunks using hnsw (embedding extensions.vector_cosine_ops)
where embedding is not null;

create index knowledge_chunks_content_fts_idx
on public.knowledge_chunks using gin (to_tsvector('english', content));

create or replace function public.match_project_knowledge(
  target_project_id uuid,
  query_embedding extensions.vector(768),
  query_text text,
  match_count integer default 8
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  chunk_index integer,
  metadata jsonb,
  semantic_score double precision,
  keyword_score real
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    chunks.id,
    chunks.document_id,
    chunks.content,
    chunks.chunk_index,
    chunks.metadata,
    1 - (chunks.embedding OPERATOR(extensions.<=>) query_embedding) as semantic_score,
    ts_rank_cd(to_tsvector('english', chunks.content), websearch_to_tsquery('english', query_text)) as keyword_score
  from public.knowledge_chunks as chunks
  where chunks.project_id = target_project_id and chunks.embedding is not null
  order by ((1 - (chunks.embedding OPERATOR(extensions.<=>) query_embedding)) * 0.8)
    + (ts_rank_cd(to_tsvector('english', chunks.content), websearch_to_tsquery('english', query_text)) * 0.2) desc
  limit greatest(1, least(match_count, 20));
$$;

grant execute on function public.match_project_knowledge(uuid, extensions.vector, text, integer) to anon, authenticated;
