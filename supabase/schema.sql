-- Schema do Controle Financeiro.
-- Rode isto uma vez no Supabase: Dashboard > SQL Editor > New query > colar > Run.

create table if not exists public.lancamentos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  ano         smallint not null,
  mes         smallint not null check (mes between 1 and 12),
  tipo        text not null check (tipo in ('entrada', 'saida')),
  descricao   text not null default '',
  valor       numeric(12, 2) not null default 0,
  data        date,
  conta       text not null default 'principal' check (conta in ('principal', 'nubank', 'inter')),
  categoria   text not null default 'outros' check (categoria in ('transporte', 'divida', 'alimentacao', 'outros')),
  created_at  timestamptz not null default now()
);
create index if not exists lancamentos_user_periodo on public.lancamentos (user_id, ano, mes);

-- Bancos cadastrados pelo usuário. O banco de um lançamento é opcional.
create table if not exists public.bancos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  nome        text not null,
  cor         text not null default '#8a8a96',
  ordem       integer not null default 0,
  created_at  timestamptz not null default now()
);
create unique index if not exists bancos_user_nome on public.bancos (user_id, lower(nome));

alter table public.lancamentos add column if not exists banco_id uuid references public.bancos on delete set null;
create index if not exists lancamentos_banco on public.lancamentos (banco_id) where banco_id is not null;

-- Dívidas atravessam os meses. O saldo de cada mês é calculado:
-- último saldo informado (divida_saldos) menos os pagamentos (saídas com divida_id) feitos depois dele.
create table if not exists public.dividas (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users on delete cascade,
  descricao      text not null default '',
  valor_parcela  numeric(12, 2),
  created_at     timestamptz not null default now()
);

create table if not exists public.divida_saldos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  divida_id   uuid not null references public.dividas on delete cascade,
  data        date not null,
  saldo       numeric(12, 2) not null,
  created_at  timestamptz not null default now()
);
create index if not exists divida_saldos_divida on public.divida_saldos (divida_id, data);

alter table public.lancamentos add column if not exists divida_id uuid references public.dividas on delete set null;
create index if not exists lancamentos_divida on public.lancamentos (divida_id) where divida_id is not null;

-- Valores digitados à mão em cada mês: investimentos, US$, meta de US$ e o saldo guardado em cada banco
-- (caixa = { <id do banco>: { cc, caixinha, reserva } }).
create table if not exists public.meses (
  user_id        uuid not null default auth.uid() references auth.users on delete cascade,
  ano            smallint not null,
  mes            smallint not null check (mes between 1 and 12),
  investimentos  numeric(12, 2) not null default 0,
  usd            numeric(12, 2) not null default 0,
  meta_usd       numeric(12, 2) not null default 0,
  caixa          jsonb not null default '{}'::jsonb,
  primary key (user_id, ano, mes)
);

-- Cada usuário só enxerga e altera os próprios dados.
alter table public.lancamentos enable row level security;
alter table public.dividas     enable row level security;
alter table public.meses       enable row level security;
alter table public.divida_saldos enable row level security;
alter table public.bancos enable row level security;

drop policy if exists "dono" on public.lancamentos;
create policy "dono" on public.lancamentos for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "dono" on public.dividas;
create policy "dono" on public.dividas for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "dono" on public.meses;
create policy "dono" on public.meses for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "dono" on public.divida_saldos;
create policy "dono" on public.divida_saldos for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "dono" on public.bancos;
create policy "dono" on public.bancos for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
