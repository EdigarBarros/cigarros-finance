-- Migração 35: os cartões da Início do celular que a pessoa escolheu (src/movel, lib/widgets.ts).
-- Supabase > SQL Editor > New query > colar > Run. Só acrescenta e pode ser rodada de novo sem problema.
--
-- perfis.celular (jsonb): o que a pessoa arrumou no celular.
--   v        versão do formato (1)
--   inicio   a Início: { base, ordem, removidos, em }
--     base       o jeito de ver em que a arrumação foi feita ('simples', 'equilibrado' ou 'detalhado')
--     ordem      os cartões, na ordem em que aparecem
--     removidos  os cartões do modelo que a pessoa tirou (não voltam sozinhos)
--     em         quando foi arrumada (o aparelho e o banco ficam com a mais recente)
-- Sem esta migração o app funciona igual: a arrumação fica guardada só no aparelho.

alter table public.perfis add column if not exists celular jsonb;

notify pgrst, 'reload schema';
