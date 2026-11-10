-- Migração 26: quando cada parte de uma dívida começou (o dia da compra ou do empréstimo).
-- Supabase > SQL Editor > New query > colar > Run. Só acrescenta e pode ser rodada de novo sem problema.
-- Precisa da migração 21 (partes da dívida).
--
-- O vencimento continua sendo o dia combinado para pagar (de cada parcela, ou do valor único). `inicio` é só para saber
-- desde quando aquela parte existe ("Pão, desde 4 de novembro, pagar até dia 11").
-- Sem esta migração o app funciona como antes (só não guarda quando a parte começou).

alter table public.divida_partes add column if not exists inicio date;
comment on column public.divida_partes.inicio is 'Quando a parte começou (compra ou empréstimo); o vencimento é o dia combinado para pagar.';

notify pgrst, 'reload schema';
