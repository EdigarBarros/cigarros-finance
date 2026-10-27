-- Migração 2: dívidas que atravessam os meses (só para bancos criados com o schema antigo).
-- Supabase > SQL Editor > New query > colar > Run.
-- Atenção: apaga a tabela de dívidas antiga (que guardava uma cópia por mês).

drop table if exists public.dividas;

create table public.dividas (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users on delete cascade,
  descricao      text not null default '',
  valor_parcela  numeric(12, 2),
  created_at     timestamptz not null default now()
);

create table public.divida_saldos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  divida_id   uuid not null references public.dividas on delete cascade,
  data        date not null,
  saldo       numeric(12, 2) not null,
  created_at  timestamptz not null default now()
);
create index divida_saldos_divida on public.divida_saldos (divida_id, data);

alter table public.lancamentos add column divida_id uuid references public.dividas on delete set null;
create index lancamentos_divida on public.lancamentos (divida_id) where divida_id is not null;

alter table public.dividas enable row level security;
alter table public.divida_saldos enable row level security;

create policy "dono" on public.dividas for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "dono" on public.divida_saldos for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
