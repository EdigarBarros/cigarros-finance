-- Migração 19: juros de cada dívida (para o app dizer qual dívida pagar primeiro: a que cobra mais juros).
-- Supabase > SQL Editor > New query > colar > Run. Só acrescenta e pode ser rodada de novo sem problema.
--
-- juros_mes = quanto a dívida cresce por mês, em percentual (2.5 quer dizer 2,5% ao mês). null = a pessoa não informou.
-- Vale de 0 a 100. Sem esta migração o app funciona como antes (só não guarda os juros nem dá os conselhos que dependem deles).

alter table public.dividas add column if not exists juros_mes numeric;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'dividas_juros_mes_entre_0_e_100') then
    alter table public.dividas
      add constraint dividas_juros_mes_entre_0_e_100 check (juros_mes is null or (juros_mes >= 0 and juros_mes <= 100));
  end if;
end $$;

comment on column public.dividas.juros_mes is 'Juros da dívida em % ao mês (2.5 = 2,5% ao mês); null = não informado.';

notify pgrst, 'reload schema';
