-- ATENÇÃO: NÃO rode esta migração de novo depois da migração 12. Ela apaga a política "dono" de cartoes e faturas_pagas e a recria SEM
-- tem_acesso(), e o bloqueio de quem não pagou deixa de valer no banco. Se rodar, rode a migração 20 logo em seguida.
-- Migração 8: cartão de crédito (fatura, fechamento e vencimento, compras parceladas).
-- Supabase > SQL Editor > New query > colar > Run. Só acrescenta e pode ser rodada de novo sem problema.
--
-- Como funciona: cada parcela de uma compra no cartão é um lançamento de saída (cartao_id, compra_id, parcela, parcelas)
-- com a data de vencimento da fatura em que ela cai. Assim o "saiu no mês" mostra o que a pessoa de fato paga naquele
-- mês. Pagar a fatura só marca a fatura como paga em faturas_pagas, sem criar outra saída (senão contaria em dobro).

create table if not exists public.cartoes (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users on delete cascade,
  nome             text not null,
  cor              text not null default '#9d6bff',
  -- banco emissor (opcional); se o banco for apagado, o cartão continua
  banco_id         uuid references public.bancos on delete set null,
  limite           numeric(14, 2) check (limite is null or limite > 0),
  -- compras feitas depois do dia de fechamento entram na fatura do mês seguinte
  dia_fechamento   smallint not null check (dia_fechamento between 1 and 31),
  dia_vencimento   smallint not null check (dia_vencimento between 1 and 31),
  ativo            boolean not null default true,
  created_at       timestamptz not null default now()
);
create unique index if not exists cartoes_user_nome on public.cartoes (user_id, lower(nome));

-- Parcelas: cada uma é uma saída. compra_id junta as parcelas da mesma compra; "parcela" de "parcelas" (3 de 10).
-- data_compra é o dia em que a pessoa comprou; "data" fica sendo o vencimento da fatura.
-- Se o cartão for apagado, as saídas continuam, só deixam de ter cartão.
alter table public.lancamentos add column if not exists cartao_id uuid references public.cartoes on delete set null;
alter table public.lancamentos add column if not exists compra_id uuid;
alter table public.lancamentos add column if not exists parcela smallint check (parcela >= 1);
alter table public.lancamentos add column if not exists parcelas smallint check (parcelas >= 1);
alter table public.lancamentos add column if not exists data_compra date;
create index if not exists lancamentos_cartao on public.lancamentos (cartao_id, ano, mes) where cartao_id is not null;
create index if not exists lancamentos_compra on public.lancamentos (compra_id) where compra_id is not null;

-- Faturas que a pessoa marcou como pagas (ano e mes são os do vencimento). banco_id: de onde saiu o dinheiro (opcional).
create table if not exists public.faturas_pagas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  cartao_id   uuid not null references public.cartoes on delete cascade,
  ano         smallint not null,
  mes         smallint not null check (mes between 1 and 12),
  valor       numeric(14, 2) not null,
  pago_em     date not null default current_date,
  banco_id    uuid references public.bancos on delete set null,
  created_at  timestamptz not null default now(),
  unique (cartao_id, ano, mes)
);

alter table public.cartoes enable row level security;
alter table public.faturas_pagas enable row level security;
drop policy if exists "dono" on public.cartoes;
create policy "dono" on public.cartoes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "dono" on public.faturas_pagas;
create policy "dono" on public.faturas_pagas for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
