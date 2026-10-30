-- Migração 19: guarda QUANDO a pessoa assinou, para a aba "Plano" das Configurações mostrar "Você assinou em ...".
-- Supabase > SQL Editor > New query > colar > Run. Pode ser rodada de novo sem problema. Só acrescenta uma coluna.
--
-- Quem preenche é o webhook do Stripe (funcao stripe-webhook), a cada aviso de assinatura. Quem já assinou antes desta migração fica
-- sem a data até o próximo aviso do Stripe (renovação ou mudança), e a tela simplesmente esconde essa linha enquanto não houver.
-- ORDEM: rode esta migração ANTES de publicar a função stripe-webhook nova.

alter table public.assinaturas add column if not exists assinada_em timestamptz;

notify pgrst, 'reload schema';
