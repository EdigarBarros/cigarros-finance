-- Migração 38: pular uma compra para a próxima fatura e pagar só uma parte da fatura (também com o cofrinho do banco).
-- Supabase > SQL Editor > New query > colar > Run. Só acrescenta e pode ser rodada de novo sem problema.
--
-- 1) "Pular compra" (PicPay e outros bancos): a parcela vai para a fatura seguinte. `pulada_de` guarda o vencimento da fatura
--    em que ela estava antes de pular (o da primeira vez, se pulou mais de uma), para mostrar "pulada de novembro" e desfazer.
-- 2) Pagamento de parte da fatura: cada pagamento que não quita a fatura vira uma linha em `faturas_parciais`; a fatura continua
--    em aberto pelo que falta. O pagamento que completa o valor vai para `faturas_pagas`, como antes.
-- 3) Pagar com o cofrinho (a caixinha do banco, que no PicPay vira limite do cartão): `da_caixinha` diz que o dinheiro saiu
--    dali e `saldo_mexido` que o app tirou o valor da caixinha em Dinheiro guardado (para desfazer só o que foi feito de verdade).
-- Sem esta migração o app funciona como antes: pular compra e pagar parte ficam desligados.

alter table public.lancamentos add column if not exists pulada_de date;

alter table public.faturas_pagas add column if not exists da_caixinha boolean not null default false;
alter table public.faturas_pagas add column if not exists saldo_mexido boolean not null default false;

create table if not exists public.faturas_parciais (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  cartao_id     uuid not null references public.cartoes on delete cascade,
  -- mês e ano do vencimento da fatura (como em faturas_pagas)
  ano           smallint not null,
  mes           smallint not null check (mes between 1 and 12),
  valor         numeric(14, 2) not null check (valor > 0),
  pago_em       date not null default current_date,
  banco_id      uuid references public.bancos on delete set null,
  da_caixinha   boolean not null default false,
  saldo_mexido  boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists faturas_parciais_fatura on public.faturas_parciais (cartao_id, ano, mes);

-- Mesma regra das outras tabelas de dados (migração 20): só o dono, e só com acesso.
alter table public.faturas_parciais enable row level security;
drop policy if exists "dono" on public.faturas_parciais;
do $$
begin
  if to_regprocedure('public.tem_acesso()') is not null then
    execute 'create policy "dono" on public.faturas_parciais for all to authenticated
      using (user_id = (select auth.uid()) and (select public.tem_acesso()))
      with check (user_id = (select auth.uid()) and (select public.tem_acesso()))';
  else
    execute 'create policy "dono" on public.faturas_parciais for all to authenticated
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))';
  end if;
end $$;

notify pgrst, 'reload schema';
