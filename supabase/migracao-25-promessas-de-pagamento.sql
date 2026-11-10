-- Migração 25: promessas de pagamento de uma dívida ("vai pagar dia 30"; não pagou; "agora paga amanhã").
-- Supabase > SQL Editor > New query > colar > Run. Só acrescenta e pode ser rodada de novo sem problema.
--
-- Cada linha é uma promessa: a data em que ficou de pagar (ou de você pagar, numa dívida sua), o valor prometido (opcional:
-- vazio = o que estiver atrasado) e uma anotação. O app não guarda se foi cumprida: ele vê pelos pagamentos lançados até
-- a data. A promessa mais nova que ainda não passou é a que vale: o cartão mostra "prometeu pagar amanhã" e o calendário
-- dos lançamentos põe o valor nesse dia.
-- Sem esta migração o app funciona como antes (só não mostra nem guarda as promessas).

create table if not exists public.divida_promessas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  divida_id   uuid not null references public.dividas on delete cascade,
  -- o dia prometido
  data        date not null,
  -- quanto ficou de pagar, na moeda da dívida (null = o que estiver atrasado)
  valor       numeric(14, 2) check (valor is null or valor > 0),
  obs         text,
  created_at  timestamptz not null default now()
);
create index if not exists divida_promessas_divida on public.divida_promessas (divida_id, data);

-- Mesma regra das outras tabelas de dados (migração 20): só o dono, e só com acesso.
alter table public.divida_promessas enable row level security;
drop policy if exists "dono" on public.divida_promessas;
do $$
begin
  if to_regprocedure('public.tem_acesso()') is not null then
    execute 'create policy "dono" on public.divida_promessas for all to authenticated
      using (user_id = (select auth.uid()) and (select public.tem_acesso()))
      with check (user_id = (select auth.uid()) and (select public.tem_acesso()))';
  else
    execute 'create policy "dono" on public.divida_promessas for all to authenticated
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))';
  end if;
end $$;

notify pgrst, 'reload schema';
