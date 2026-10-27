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

create table if not exists public.dividas (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  ano           smallint not null,
  mes           smallint not null check (mes between 1 and 12),
  descricao     text not null default '',
  valor_mensal  numeric(12, 2) not null default 0,
  parcelas      integer not null default 1,
  pagas         integer not null default 0,
  ordem         integer not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists dividas_user_periodo on public.dividas (user_id, ano, mes);

-- Valores digitados à mão em cada mês: investimentos, US$, meta de US$ e o quadro de caixa.
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

drop policy if exists "dono" on public.lancamentos;
create policy "dono" on public.lancamentos for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "dono" on public.dividas;
create policy "dono" on public.dividas for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "dono" on public.meses;
create policy "dono" on public.meses for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
