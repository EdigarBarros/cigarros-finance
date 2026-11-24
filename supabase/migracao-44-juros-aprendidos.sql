-- Migração 44: o app aprende quanto o banco cobra de juros de verdade, com cada "Conferi com o banco".
-- Supabase > SQL Editor > New query > colar > Run. Só acrescenta e pode ser rodada de novo sem problema.
-- Precisa da migração 37 (histórico das conferências).
--
-- Cada conferência passa a guardar a pista para aprender os juros:
--   juros_estimado  os juros que o app tinha estimado até aquele dia (sem a multa), na moeda principal
--   base_juros      o que estava crescendo (o que falta das parcelas atrasadas, ou o saldo na regra do cartão)
--   dias_juros      há quantos dias os juros contavam
--   qual_valor      'total' (o que se deve, o de sempre) ou 'quitar' (o valor com desconto para quitar hoje; não muda a dívida)
-- Com isso: juros de verdade = depois − antes + juros_estimado. Sem esta migração o app funciona como antes e só aprende
-- com as dívidas que não tinham regra de juros.

alter table public.divida_conferencias add column if not exists juros_estimado numeric(14, 2);
alter table public.divida_conferencias add column if not exists base_juros numeric(14, 2);
alter table public.divida_conferencias add column if not exists dias_juros integer;
alter table public.divida_conferencias add column if not exists qual_valor text not null default 'total';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'divida_conferencias_qual_valor_valido') then
    alter table public.divida_conferencias add constraint divida_conferencias_qual_valor_valido check (qual_valor in ('total', 'quitar'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'divida_conferencias_pista_valida') then
    alter table public.divida_conferencias add constraint divida_conferencias_pista_valida
      check ((juros_estimado is null or juros_estimado >= 0) and (base_juros is null or base_juros >= 0) and (dias_juros is null or dias_juros >= 0));
  end if;
end $$;

notify pgrst, 'reload schema';
