-- Migração 40: compra ou gasto estornado (o banco devolveu o dinheiro, inteiro ou em parte).
-- Supabase > SQL Editor > New query > colar > Run. Só acrescenta e pode ser rodada de novo sem problema.
--
-- Com estorno, `valor` passa a ser o que ainda conta (0 no estorno total) e `estorno_valor` guarda o que voltou, com o dia
-- em `estornado_em`. Assim a fatura, o limite, os gastos e o saldo já tiram o estorno, e o lançamento continua na lista,
-- riscado, com o valor de antes (valor + estorno_valor). Desfazer devolve o valor de antes.
-- Sem esta migração o app funciona como antes (o botão "Foi estornada" não aparece).

alter table public.lancamentos add column if not exists estorno_valor numeric(12, 2) check (estorno_valor is null or estorno_valor > 0);
alter table public.lancamentos add column if not exists estornado_em date;

notify pgrst, 'reload schema';
