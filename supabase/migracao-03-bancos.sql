-- Migração 3: bancos cadastrados pelo usuário (para bancos de dados criados antes desta versão).
-- Supabase > SQL Editor > New query > colar > Run.

create table public.bancos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  nome        text not null,
  cor         text not null default '#8a8a96',
  ordem       integer not null default 0,
  created_at  timestamptz not null default now()
);
create unique index bancos_user_nome on public.bancos (user_id, lower(nome));

alter table public.lancamentos add column banco_id uuid references public.bancos on delete set null;
create index lancamentos_banco on public.lancamentos (banco_id) where banco_id is not null;

alter table public.bancos enable row level security;
create policy "dono" on public.bancos for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
