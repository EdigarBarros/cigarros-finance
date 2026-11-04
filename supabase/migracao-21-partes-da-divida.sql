-- Migração 21: partes de uma dívida (mini-dívidas que formam uma dívida maior).
-- Supabase > SQL Editor > New query > colar > Run. Só acrescenta e pode ser rodada de novo sem problema.
--
-- Exemplo: o crédito do Mercado Pago é uma dívida só de R$ 630, mas dentro dela há várias compras parceladas (mouse 5x,
-- microfone 6x, cabo 6x), cada parcela com o seu valor e o seu vencimento. Cada linha aqui é UMA parcela de UMA parte:
-- "Microfone, parcela 2 de 6, R$ 78,50, vence 02/03". Com partes, o calendário da dívida sai delas (a soma de cada dia)
-- em vez de "parcela fixa todo mês". O saldo da dívida continua em divida_saldos: o app mantém o saldo igual à soma das partes.
-- Sem esta migração o app funciona como antes (só não mostra nem guarda as partes).

create table if not exists public.divida_partes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  divida_id   uuid not null references public.dividas on delete cascade,
  -- de que é a parte: "Microfone", "Mouse sem fio"
  nome        text not null default '',
  valor       numeric(14, 2) not null check (valor > 0),
  vencimento  date not null,
  -- "parcela 2 de 6" (opcional: parte sem parcelamento fica sem os dois)
  parcela     smallint check (parcela is null or parcela >= 1),
  parcelas    smallint check (parcelas is null or parcelas >= 1),
  created_at  timestamptz not null default now()
);
create index if not exists divida_partes_divida on public.divida_partes (divida_id, vencimento);

-- Mesma regra das outras tabelas de dados (migração 20): só o dono, e só com acesso.
alter table public.divida_partes enable row level security;
drop policy if exists "dono" on public.divida_partes;
do $$
begin
  if to_regprocedure('public.tem_acesso()') is not null then
    execute 'create policy "dono" on public.divida_partes for all to authenticated
      using (user_id = (select auth.uid()) and (select public.tem_acesso()))
      with check (user_id = (select auth.uid()) and (select public.tem_acesso()))';
  else
    execute 'create policy "dono" on public.divida_partes for all to authenticated
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))';
  end if;
end $$;

notify pgrst, 'reload schema';
