-- Migração 11: forma de pagamento do lançamento (Pix, débito, dinheiro, boleto, transferência).
-- Supabase > SQL Editor > New query > colar > Run. Só acrescenta e pode ser rodada de novo sem problema.
--
-- Compra no cartão de crédito não usa esta coluna: ela já é identificada por cartao_id (e o app mostra como "Crédito").
-- Sem esta migração o app continua funcionando; só não guarda Pix/débito/dinheiro nos lançamentos.

alter table public.lancamentos add column if not exists forma text;
alter table public.lancamentos drop constraint if exists lancamentos_forma_check;
alter table public.lancamentos add constraint lancamentos_forma_check
  check (forma is null or forma in ('pix', 'debito', 'dinheiro', 'boleto', 'transferencia'));
create index if not exists lancamentos_forma on public.lancamentos (forma) where forma is not null;

notify pgrst, 'reload schema';
