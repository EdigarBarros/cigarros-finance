-- Migração 32: a arte das novidades (montada no editor do painel de suporte). Rodável de novo.
-- novidades.arte: {"formato": "em_pe"|"deitado", "fundo": "noite"|..., "elementos": [{ "id", "tipo", "x", "y", "w", "h", ... }]}
-- Sem arte (null), o pop-up usa o cartão simples (ícone, título e itens). O painel confere o conteúdo antes de gravar.

alter table public.novidades add column if not exists arte jsonb;
alter table public.novidades drop constraint if exists novidades_arte_check;
alter table public.novidades add constraint novidades_arte_check
  check (arte is null or (jsonb_typeof(arte) = 'object' and pg_column_size(arte) < 60000));

notify pgrst, 'reload schema';
