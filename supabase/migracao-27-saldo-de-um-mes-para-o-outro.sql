-- Migração 27: o saldo que passa de um mês para o outro (lib/saldoCorrido.ts).
-- Supabase > SQL Editor > New query > colar > Run. Só acrescenta e pode ser rodada de novo sem problema.
--
-- perfis.saldo_inicial (jsonb): de onde o saldo parte, informado uma vez pela pessoa.
--   valor   quanto ela tinha no começo do mês (pode ser negativo: cheque especial)
--   mes     o mês em que começa a conta, "AAAA-MM"
-- Daí em diante o app calcula sozinho: cada mês começa com o saldo do fim do anterior e soma o que sobrou ou tira o que
-- faltou. Não é um lançamento (não entra no "Entrou") e não mexe no saldo dos bancos (Dinheiro guardado).
-- Sem esta migração o app funciona igual: o ponto de partida fica guardado só no aparelho.

alter table public.perfis add column if not exists saldo_inicial jsonb;

notify pgrst, 'reload schema';
