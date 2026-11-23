-- Migração 39: compra no cartão que outra pessoa paga (a assinatura que está no seu cartão, mas quem paga é a sua mãe).
-- Supabase > SQL Editor > New query > colar > Run. Só acrescenta e pode ser rodada de novo sem problema.
--
-- `pago_por` é o nome de quem paga (vazio = você). A compra continua na fatura e no limite do cartão, como no banco, mas
-- não conta nos seus gastos; e o dinheiro que essa pessoa te passa não precisa ser lançado como entrada.
-- Sem esta migração o app funciona como antes (o campo "Quem paga esta compra?" não aparece).

alter table public.lancamentos add column if not exists pago_por text check (pago_por is null or char_length(pago_por) <= 60);

notify pgrst, 'reload schema';
