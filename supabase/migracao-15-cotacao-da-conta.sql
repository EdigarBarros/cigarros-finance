-- Migração 15: cotação combinada na conta do mês em outra moeda (a internet de 33.000 pesos que se paga a 1 R$ = 287 ARS).
-- Supabase > SQL Editor > New query > colar > Run. Só acrescenta e pode ser rodada de novo sem problema.
--
-- null = vale a cotação do dia. Com um valor, é quanto vale 1 unidade da moeda da conta na moeda principal da pessoa, e o app
-- usa essa cotação para mostrar quanto a conta vale e como sugestão na hora de dar baixa. Sem esta migração o app funciona como
-- antes (só não guarda a cotação).

alter table public.contas_fixas add column if not exists cotacao numeric(18, 8) check (cotacao is null or cotacao > 0);

notify pgrst, 'reload schema';
