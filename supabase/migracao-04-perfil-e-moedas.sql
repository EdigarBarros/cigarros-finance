-- ATENÇÃO: NÃO rode esta migração de novo depois da migração 12. Ela apaga a política "dono" de perfis e a recria SEM
-- tem_acesso(), e o bloqueio de quem não pagou deixa de valer no banco. Se rodar, rode a migração 20 logo em seguida.
-- Migração 4: perfil de cada pessoa (o painel se adapta a ela) e outras moedas.
-- Supabase > SQL Editor > New query > colar > Run. Só acrescenta; nada é apagado.

-- Respostas das perguntas iniciais e ajustes do painel.
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

-- Lançamento feito em outra moeda: o valor original fica guardado; "valor" segue na moeda principal.
alter table public.lancamentos add column if not exists valor_original numeric(14, 2);
alter table public.lancamentos add column if not exists moeda_original text;

-- Saldo guardado em cada outra moeda ({ "USD": 1200, "EUR": 300 }). O dólar que já existia vem junto.
alter table public.meses add column if not exists moedas jsonb not null default '{}'::jsonb;
update public.meses set moedas = jsonb_build_object('USD', usd) where usd > 0 and moedas = '{}'::jsonb;

alter table public.perfis enable row level security;
drop policy if exists "dono" on public.perfis;
create policy "dono" on public.perfis for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
