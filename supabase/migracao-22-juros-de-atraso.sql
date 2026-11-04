-- Migração 22: juros de atraso (a dívida atrasada cresce sozinha, pela regra do credor).
-- Supabase > SQL Editor > New query > colar > Run. Só acrescenta e pode ser rodada de novo sem problema.
-- Precisa das migrações 19 (juros da dívida) e 21 (partes da dívida). Num banco novo, rode antes da 20.
--
-- juros_mes (migração 19) é o juro do contrato, usado nos conselhos. Os campos abaixo dizem quanto a dívida cresce
-- ENQUANTO ESTÁ ATRASADA, para o app estimar o valor de hoje sem esperar a pessoa conferir com o banco:
--   atraso_juros_mes  % ao mês cobrado no atraso (17.5 = 17,5% ao mês). null = a dívida não cresce sozinha.
--   atraso_tipo       'simples' (juros só sobre o valor da parcela) ou 'composto' (juros sobre juros).
--   atraso_multa      % cobrado uma vez quando a parcela vence sem ser paga (padrão 2).
--   atraso_base       'parcela' (cada parcela atrasada cresce) ou 'saldo' (o saldo inteiro cresce, como num cartão).
--   conferido_em      dia em que os valores foram conferidos com o banco: os juros contam a partir daqui.
-- Em divida_partes, valor_original é o valor da parcela no contrato (a base dos juros simples). null = usar o valor.
-- Sem esta migração o app funciona como antes (as dívidas só não crescem sozinhas).

alter table public.dividas add column if not exists atraso_juros_mes numeric;
alter table public.dividas add column if not exists atraso_tipo text not null default 'simples';
alter table public.dividas add column if not exists atraso_multa numeric not null default 2;
alter table public.dividas add column if not exists atraso_base text not null default 'parcela';
alter table public.dividas add column if not exists conferido_em date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'dividas_atraso_juros_entre_0_e_100') then
    alter table public.dividas
      add constraint dividas_atraso_juros_entre_0_e_100 check (atraso_juros_mes is null or (atraso_juros_mes >= 0 and atraso_juros_mes <= 100));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dividas_atraso_multa_entre_0_e_100') then
    alter table public.dividas
      add constraint dividas_atraso_multa_entre_0_e_100 check (atraso_multa >= 0 and atraso_multa <= 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dividas_atraso_tipo_valido') then
    alter table public.dividas add constraint dividas_atraso_tipo_valido check (atraso_tipo in ('simples', 'composto'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dividas_atraso_base_valida') then
    alter table public.dividas add constraint dividas_atraso_base_valida check (atraso_base in ('parcela', 'saldo'));
  end if;
end $$;

comment on column public.dividas.atraso_juros_mes is 'Juros cobrados no atraso, em % ao mês; null = a dívida não cresce sozinha.';
comment on column public.dividas.atraso_tipo is 'simples (juros só sobre a parcela) ou composto (juros sobre juros).';
comment on column public.dividas.atraso_multa is 'Multa em % cobrada uma vez quando a parcela vence sem ser paga.';
comment on column public.dividas.atraso_base is 'parcela (cada parcela atrasada cresce) ou saldo (o saldo inteiro cresce).';
comment on column public.dividas.conferido_em is 'Dia em que os valores foram conferidos com o banco: os juros de atraso contam a partir daqui.';

-- a tabela só existe com a migração 21; sem ela, esta parte fica de fora
do $$
begin
  if to_regclass('public.divida_partes') is not null then
    alter table public.divida_partes add column if not exists valor_original numeric(14, 2);
    comment on column public.divida_partes.valor_original is 'Valor da parcela no contrato (base dos juros simples); null = usar o valor.';
  end if;
end $$;

notify pgrst, 'reload schema';
