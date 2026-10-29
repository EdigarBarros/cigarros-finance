-- Migração 12: assinatura paga (Stripe). 7 dias grátis com cartão, depois cobrança mensal.
-- Supabase > SQL Editor > New query > colar > Run. Só acrescenta e pode ser rodada de novo sem problema.
--
-- Uma linha por pessoa. Quem grava é só o servidor (as funções stripe-* usam a chave de serviço): a pessoa só consegue LER a
-- própria linha. Cortesia (acesso liberado, sem cobrança) é dada à mão, só para os e-mails escolhidos. Conta nova não tem
-- linha até assinar, e sem linha o app mostra a tela de assinatura em vez do painel.
-- O bloqueio dentro do banco (RLS) está na migração 13, para ligar depois de testar o fluxo.

create table if not exists public.assinaturas (
  user_id                 uuid primary key references auth.users on delete cascade,
  status                  text not null default 'sem_assinatura' check (status in (
    'sem_assinatura', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused', 'cortesia')),
  stripe_customer_id      text,
  stripe_subscription_id  text,
  teste_fim               timestamptz,
  periodo_fim             timestamptz,
  cancela_no_fim          boolean not null default false,
  moeda                   text,
  atualizado_em           timestamptz not null default now()
);
create index if not exists assinaturas_customer on public.assinaturas (stripe_customer_id) where stripe_customer_id is not null;

alter table public.assinaturas enable row level security;
drop policy if exists "ler a propria" on public.assinaturas;
create policy "ler a propria" on public.assinaturas for select to authenticated using (user_id = (select auth.uid()));
-- sem política de escrita de propósito: ninguém liga a própria assinatura pelo navegador
revoke insert, update, delete on public.assinaturas from anon, authenticated;

-- ATENÇÃO: esta migração NÃO libera ninguém por conta própria. (Antes ela dava 'cortesia' a todos os usuários existentes,
-- o que era uma armadilha: rodar de novo depois do lançamento liberaria de graça quem tivesse se cadastrado.)
-- Para dar cortesia a contas específicas (você e amigos), use supabase/dar-cortesia.sql, informando os e-mails.

notify pgrst, 'reload schema';
