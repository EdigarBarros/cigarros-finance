-- Migração 9: mais funções no cartão de crédito e foto de perfil.
-- Supabase > SQL Editor > New query > colar > Run. Só acrescenta e pode ser rodada de novo sem problema.
--
-- • Fatura renegociada: o banco transformou a fatura em parcelas (uma dívida). A fatura fica marcada como
--   "renegociada" em faturas_pagas, ligada à dívida criada; as compras dela deixam de contar nas saídas do mês,
--   e o que sai do bolso passa a ser cada parcela paga da dívida (assim nada conta em dobro).
-- • Juros e multa de uma fatura paga com atraso viram uma saída (juros_lanc_id aponta para ela).
-- • Limite garantido: dinheiro guardado numa caixinha do banco que vira limite extra no cartão.
--   garantia_caixinha = usar o valor da caixinha do banco do cartão (tela Patrimônio) em vez de um valor fixo.

alter table public.faturas_pagas add column if not exists tipo text not null default 'paga';
alter table public.faturas_pagas drop constraint if exists faturas_pagas_tipo_check;
alter table public.faturas_pagas add constraint faturas_pagas_tipo_check check (tipo in ('paga', 'renegociada'));
alter table public.faturas_pagas add column if not exists juros numeric(14, 2) not null default 0 check (juros >= 0);
alter table public.faturas_pagas add column if not exists juros_lanc_id uuid references public.lancamentos on delete set null;
alter table public.faturas_pagas add column if not exists divida_id uuid references public.dividas on delete set null;
alter table public.faturas_pagas add column if not exists obs text;

alter table public.cartoes add column if not exists limite_garantido numeric(14, 2) not null default 0 check (limite_garantido >= 0);
alter table public.cartoes add column if not exists garantia_caixinha boolean not null default false;

-- Foto de perfil: imagem pequena (já reduzida no aparelho) guardada como data URL.
alter table public.perfis add column if not exists foto text;

notify pgrst, 'reload schema';
