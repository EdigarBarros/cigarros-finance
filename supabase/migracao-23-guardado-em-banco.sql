-- Migração 23: saída que é dinheiro passando de uma conta sua para o seu dinheiro guardado (Itaú → porquinho do PicPay).
-- Supabase > SQL Editor > New query > colar > Run. Só acrescenta e pode ser rodada de novo sem problema.
--
-- Um lançamento de saída pode apontar para onde o dinheiro foi guardado:
--   guardado_banco_id  banco que recebeu (o PicPay). Com ele preenchido, a saída não conta como gasto do mês.
--   guardado_tipo      onde fica nesse banco: 'cc' (conta), 'caixinha' (o porquinho) ou 'reserva'.
--   guardado_saldo     true quando o app já somou o valor ao saldo guardado e tirou da conta de origem (banco_id);
--                      serve para desfazer certinho se o lançamento for editado ou apagado.
-- Apagar o banco de destino solta o vínculo (o lançamento volta a contar como saída comum).
-- Sem esta migração o app funciona como antes; só não dá para marcar a saída como "guardado em".

alter table public.lancamentos add column if not exists guardado_banco_id uuid references public.bancos on delete set null;
alter table public.lancamentos add column if not exists guardado_tipo text;
alter table public.lancamentos add column if not exists guardado_saldo boolean not null default false;
alter table public.lancamentos drop constraint if exists lancamentos_guardado_tipo_check;
alter table public.lancamentos add constraint lancamentos_guardado_tipo_check
  check (guardado_tipo is null or guardado_tipo in ('cc', 'caixinha', 'reserva'));
create index if not exists lancamentos_guardado on public.lancamentos (guardado_banco_id) where guardado_banco_id is not null;

notify pgrst, 'reload schema';
