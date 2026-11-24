-- Migração 45: dívida "em espera" (a pessoa não pretende pagar agora).
-- Supabase > SQL Editor > New query > colar > Run. Só acrescenta e pode ser rodada de novo sem problema.
--
-- A dívida continua existindo e correndo juros (dá para pagar, conferir com o banco e ver na página Dívidas, à parte),
-- mas fica fora do consultor, dos gráficos, da Início e do "Para fazer". A página Dívidas mostra o que se deve nas
-- ativas e o total geral, com as em espera.
-- Sem esta migração o app funciona como antes (a opção "Pôr em espera" não aparece).

alter table public.dividas add column if not exists em_espera boolean not null default false;

comment on column public.dividas.em_espera is 'A pessoa não pretende pagar agora: fica fora do consultor, dos gráficos e da Início.';

notify pgrst, 'reload schema';
