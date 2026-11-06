-- Migração 24: a memória do consultor (lib/memoria.ts), guardada no perfil para valer em qualquer aparelho.
-- Supabase > SQL Editor > New query > colar > Run. Só acrescenta e pode ser rodada de novo sem problema.
--
-- perfis.consultor (jsonb): o que o consultor aprendeu com a pessoa.
--   objetivo       o que ela escolheu ("dividas", "guardar", "tranquilo", "controle", "crescer", "fechar-mes")
--   acompanhados   os passos do plano que o app está conferindo: o número do dia em que sugeriu, o mês que decide e,
--                  depois de conferido, se deu certo ("funcionou") ou não ("nao")
-- Sem esta migração o app funciona igual: a memória fica guardada só no aparelho.

alter table public.perfis add column if not exists consultor jsonb not null default '{}'::jsonb;

notify pgrst, 'reload schema';
