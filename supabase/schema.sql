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

-- Categorias de cada pessoa (as padrão vêm da função criar_categorias_padrao, mais abaixo).
-- papel 'divida': as saídas nela podem abater uma dívida.
create table if not exists public.categorias (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  tipo        text not null check (tipo in ('entrada', 'saida')),
  nome        text not null,
  icone       text not null default '🏷️',
  cor         text not null default '#8a8a96',
  papel       text check (papel in ('divida')),
  ordem       integer not null default 0,
  created_at  timestamptz not null default now()
);
create unique index if not exists categorias_user_nome on public.categorias (user_id, tipo, lower(nome));

-- "categoria" é a coluna antiga (4 categorias fixas), mantida para bancos de antes da migração 5.
alter table public.lancamentos add column if not exists categoria_id uuid references public.categorias on delete set null;
create index if not exists lancamentos_categoria on public.lancamentos (categoria_id) where categoria_id is not null;

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

-- Lançamento feito em outra moeda: o valor original fica guardado; "valor" segue na moeda principal.
alter table public.lancamentos add column if not exists valor_original numeric(14, 2);
alter table public.lancamentos add column if not exists moeda_original text;

-- Valores digitados à mão em cada mês: investimentos, saldo em outras moedas (moedas = { USD: 1200 }),
-- meta de US$ e o saldo guardado em cada banco (caixa = { <id do banco>: { cc, caixinha, reserva } }).
-- usd é a coluna antiga de dólar, mantida igual a moedas.USD.
create table if not exists public.meses (
  user_id        uuid not null default auth.uid() references auth.users on delete cascade,
  ano            smallint not null,
  mes            smallint not null check (mes between 1 and 12),
  investimentos  numeric(12, 2) not null default 0,
  usd            numeric(12, 2) not null default 0,
  meta_usd       numeric(12, 2) not null default 0,
  caixa          jsonb not null default '{}'::jsonb,
  moedas         jsonb not null default '{}'::jsonb,
  primary key (user_id, ano, mes)
);

-- Como o painel se adapta a cada pessoa: respostas das perguntas iniciais e ajustes feitos depois.
create table if not exists public.perfis (
  user_id        uuid primary key default auth.uid() references auth.users on delete cascade,
  nome           text not null default '',
  moeda          text not null default 'BRL',
  moedas         text[] not null default '{}',
  detalhe        text not null default 'equilibrado' check (detalhe in ('simples', 'equilibrado', 'detalhado')),
  modulos        jsonb not null default '{}'::jsonb,
  dispensadas    text[] not null default '{}',
  onboarding_em  timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Cada usuário só enxerga e altera os próprios dados.
alter table public.lancamentos enable row level security;
alter table public.dividas     enable row level security;
alter table public.meses       enable row level security;
alter table public.divida_saldos enable row level security;
alter table public.bancos enable row level security;
alter table public.perfis enable row level security;
alter table public.categorias enable row level security;

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

drop policy if exists "dono" on public.perfis;
create policy "dono" on public.perfis for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "dono" on public.categorias;
create policy "dono" on public.categorias for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Categorias com que toda conta começa. O app chama na primeira vez (sem categorias ainda).
-- Roda com as permissões de quem chama: as regras acima impedem criar categorias para outra pessoa.
create or replace function public.criar_categorias_padrao(dono uuid default auth.uid())
returns void language sql security invoker set search_path = public as $$
  insert into public.categorias (user_id, tipo, nome, icone, cor, papel, ordem)
  select dono, c.tipo, c.nome, c.icone, c.cor, c.papel, c.ordem
  from (values
    ('saida', 'Alimentação', '🍽️', '#ff9f0a', null, 1),
    ('saida', 'Moradia', '🏠', '#64d2ff', null, 2),
    ('saida', 'Transporte', '🚗', '#0a84ff', null, 3),
    ('saida', 'Saúde', '💊', '#ff6b6b', null, 4),
    ('saida', 'Educação', '📚', '#5e5ce6', null, 5),
    ('saida', 'Lazer', '🎉', '#ff375f', null, 6),
    ('saida', 'Assinaturas', '📺', '#bf5af2', null, 7),
    ('saida', 'Compras', '🛍️', '#ff79c6', null, 8),
    ('saida', 'Cuidados pessoais', '💇', '#e040e0', null, 9),
    ('saida', 'Pets', '🐾', '#a2845e', null, 10),
    ('saida', 'Impostos e taxas', '🧾', '#8e8e93', null, 11),
    ('saida', 'Dívidas e parcelas', '💳', '#ffd60a', 'divida', 12),
    ('saida', 'Outros', '📦', '#636366', null, 13),
    ('entrada', 'Salário', '💼', '#30d158', null, 1),
    ('entrada', 'Renda extra', '🧑‍💻', '#63e6e2', null, 2),
    ('entrada', 'Vendas', '🏷️', '#2dd4bf', null, 3),
    ('entrada', 'Rendimentos', '📈', '#bf5af2', null, 4),
    ('entrada', 'Presentes e ajuda', '🎁', '#ff79c6', null, 5),
    ('entrada', 'Outros', '📦', '#636366', null, 6)
  ) as c (tipo, nome, icone, cor, papel, ordem)
  where dono is not null
    and not exists (
      select 1 from public.categorias x where x.user_id = dono and x.tipo = c.tipo and lower(x.nome) = lower(c.nome)
    );
$$;
revoke execute on function public.criar_categorias_padrao(uuid) from anon;
