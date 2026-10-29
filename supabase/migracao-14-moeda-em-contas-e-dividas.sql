-- Migração 14: moeda própria em contas do mês e em dívidas (conta de internet em dólar, dívida de US$ 5…).
-- Supabase > SQL Editor > New query > colar > Run. Só acrescenta e pode ser rodada de novo sem problema.
--
-- null = a moeda principal da pessoa (como era antes). Com um código (USD, ARS…), o valor da conta fixa e a parcela e os saldos da
-- dívida ficam nessa moeda; os totais do painel continuam na moeda principal, pela cotação do dia. Sem esta migração o app
-- funciona como antes (só não guarda a moeda).

alter table public.contas_fixas add column if not exists moeda text;
alter table public.dividas add column if not exists moeda text;

notify pgrst, 'reload schema';
