-- Migração 10: dívidas com calendário de parcelas e dinheiro a receber ("me devem").
-- Supabase > SQL Editor > New query > colar > Run. Só acrescenta e pode ser rodada de novo sem problema.
--
-- • sentido: 'devo' (você deve) ou 'me_devem' (alguém deve a você: venda parcelada, empréstimo que você fez…).
--   O recebimento é um lançamento de entrada ligado pelo mesmo divida_id; o pagamento continua sendo uma saída.
-- • pessoa: com quem é a dívida (banco, loja, amigo).
-- • inicio: dia em que vence a 1ª parcela (as outras vencem no mesmo dia dos meses seguintes). Sem parcela fixa,
--   é a data combinada para pagar tudo. Com ele o app mostra cada parcela como paga, parcial, atrasada ou a vencer.
-- • total_parcelas: de quantas parcelas é a dívida (opcional; sem ele, sai do valor e da parcela).

alter table public.dividas add column if not exists sentido text not null default 'devo';
alter table public.dividas drop constraint if exists dividas_sentido_check;
alter table public.dividas add constraint dividas_sentido_check check (sentido in ('devo', 'me_devem'));
alter table public.dividas add column if not exists pessoa text;
alter table public.dividas add column if not exists inicio date;
alter table public.dividas add column if not exists total_parcelas smallint check (total_parcelas is null or total_parcelas between 1 and 600);
alter table public.dividas add column if not exists obs text;

notify pgrst, 'reload schema';
