-- Migração 37: histórico das conferências de uma dívida ("estava R$ 1.200, o banco mostrou R$ 950").
-- Supabase > SQL Editor > New query > colar > Run. Só acrescenta e pode ser rodada de novo sem problema.
--
-- Cada vez que a pessoa usa "Conferi com o banco" (ou paga uma dívida com juros de atraso ainda não conferidos), o app anota
-- uma linha: o dia, quanto o app mostrava (`antes`) e quanto o banco mostrou (`depois`), os dois na moeda principal.
-- A diferença é o que a dívida subiu ou caiu "por fora" (juros, desconto, acordo, estorno). O consultor lê esse histórico.
-- Sem esta migração o app funciona como antes (só não guarda nem mostra o histórico).

create table if not exists public.divida_conferencias (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  divida_id   uuid not null references public.dividas on delete cascade,
  data        date not null,
  -- o que o app mostrava e o que o banco mostrou, na moeda principal
  antes       numeric(14, 2) not null check (antes >= 0),
  depois      numeric(14, 2) not null check (depois >= 0),
  -- 'conferir': a pessoa digitou o valor do banco; 'pagar': o app acertou os juros do atraso antes de um pagamento
  origem      text not null default 'conferir' check (origem in ('conferir', 'pagar')),
  created_at  timestamptz not null default now()
);
create index if not exists divida_conferencias_divida on public.divida_conferencias (divida_id, data);

-- Mesma regra das outras tabelas de dados (migração 20): só o dono, e só com acesso.
alter table public.divida_conferencias enable row level security;
drop policy if exists "dono" on public.divida_conferencias;
do $$
begin
  if to_regprocedure('public.tem_acesso()') is not null then
    execute 'create policy "dono" on public.divida_conferencias for all to authenticated
      using (user_id = (select auth.uid()) and (select public.tem_acesso()))
      with check (user_id = (select auth.uid()) and (select public.tem_acesso()))';
  else
    execute 'create policy "dono" on public.divida_conferencias for all to authenticated
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))';
  end if;
end $$;

notify pgrst, 'reload schema';
