-- Migração 36: juros de atraso por dia (em % ou em reais) e o valor que a pessoa recebeu num empréstimo com juros já combinados.
-- Supabase > SQL Editor > New query > colar > Run. Só acrescenta e pode ser rodada de novo sem problema.
-- Precisa da migração 22 (juros de atraso).
--
--   valor_recebido     quanto a pessoa recebeu de fato (ou quanto custava à vista), na moeda da dívida. Ex.: pegou R$ 250 e
--                      vai devolver R$ 270: valor_recebido = 250 e a dívida vale 270 (R$ 20 são juros). Em "me devem", quanto
--                      ela emprestou. null = não informado.
--   atraso_periodo     de quanto em quanto tempo vale `atraso_juros_mes`: 'mes' (como antes) ou 'dia' (5 = 5% ao dia).
--   atraso_reais_dia   valor fixo cobrado por dia de atraso (R$ 20 por dia), na moeda da dívida. null = não cobra.
-- Sem esta migração o app funciona como antes: o "Sei quanto recebi", o "% ao dia" e o "R$ por dia" ficam escondidos.

alter table public.dividas add column if not exists valor_recebido numeric;
alter table public.dividas add column if not exists atraso_periodo text not null default 'mes';
alter table public.dividas add column if not exists atraso_reais_dia numeric;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'dividas_valor_recebido_positivo') then
    alter table public.dividas add constraint dividas_valor_recebido_positivo check (valor_recebido is null or valor_recebido >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dividas_atraso_periodo_valido') then
    alter table public.dividas add constraint dividas_atraso_periodo_valido check (atraso_periodo in ('mes', 'dia'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dividas_atraso_reais_dia_positivo') then
    alter table public.dividas add constraint dividas_atraso_reais_dia_positivo check (atraso_reais_dia is null or atraso_reais_dia >= 0);
  end if;
end $$;

comment on column public.dividas.valor_recebido is 'Quanto a pessoa recebeu (ou emprestou) de fato; a diferença para o total são os juros já combinados. null = não informado.';
comment on column public.dividas.atraso_periodo is 'mes: atraso_juros_mes é % ao mês; dia: é % ao dia.';
comment on column public.dividas.atraso_reais_dia is 'Valor fixo cobrado por dia de atraso, na moeda da dívida; null = não cobra.';

notify pgrst, 'reload schema';
