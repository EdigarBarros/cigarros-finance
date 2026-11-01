-- ATENÇÃO: NÃO rode esta migração de novo depois da 17 ou da 18: o item 1 volta tem_acesso() para uma versão sem o teste grátis
-- (status teste) e tranca quem está no teste. Se rodar, rode a migração 20 logo em seguida.
-- Migração 16: carência quando o cartão falha, teste grátis uma vez por CARTÃO, registro de erros do app e função fechada para anônimos.
-- Supabase > SQL Editor > New query > colar > Run. Só acrescenta e pode ser rodada de novo sem problema.
-- Não mexe em ninguém que tem 'cortesia'.

-- 1) Acesso: além de teste, assinatura em dia e cortesia, 'past_due' (cobrança recusada, o Stripe ainda está tentando de novo) mantém o
--    acesso por alguns dias, em vez de trancar a pessoa na primeira falha. Se o Stripe desistir, o status vira unpaid/canceled e bloqueia.
--    A função só é chamada pelas políticas de quem está logado; anônimo não precisa dela.
create or replace function public.tem_acesso() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.assinaturas a
    where a.user_id = auth.uid() and a.status in ('trialing', 'active', 'past_due', 'cortesia')
  );
$$;
revoke all on function public.tem_acesso() from public, anon;
grant execute on function public.tem_acesso() to authenticated;

-- 2) Teste grátis uma vez por cartão: o webhook guarda a "impressão digital" do cartão (o Stripe a calcula; não é o número) de
--    quem começa um teste. Se outra conta tentar um teste com o mesmo cartão, o teste é encerrado e a cobrança começa.
--    Só o servidor lê e escreve (RLS ligado, sem política).
create table if not exists public.teste_cartoes (
  fingerprint  text primary key,
  -- sem chave estrangeira de propósito: a impressão digital continua valendo mesmo se a conta for excluída (senão bastaria
  -- excluir e recriar a conta para ganhar outro teste)
  user_id      uuid not null,
  criado_em    timestamptz not null default now()
);
alter table public.teste_cartoes enable row level security;
revoke all on public.teste_cartoes from anon, authenticated;

-- 3) Erros do app: quando algo quebra na tela de alguém, o app grava aqui (só quem está logado, só inserir). Você lê pelo SQL Editor:
--    select criado_em, mensagem, onde, user_id from public.erros_app order by criado_em desc limit 50;
create table if not exists public.erros_app (
  id         bigint generated always as identity primary key,
  user_id    uuid default auth.uid() references auth.users on delete set null,
  mensagem   text not null check (char_length(mensagem) <= 500),
  detalhe    text check (detalhe is null or char_length(detalhe) <= 4000),
  onde       text check (onde is null or char_length(onde) <= 300),
  versao     text check (versao is null or char_length(versao) <= 40),
  criado_em  timestamptz not null default now()
);
alter table public.erros_app enable row level security;
revoke all on public.erros_app from anon;
revoke update, delete, select on public.erros_app from authenticated;
grant insert on public.erros_app to authenticated;
drop policy if exists "registrar" on public.erros_app;
create policy "registrar" on public.erros_app for insert to authenticated with check (user_id = (select auth.uid()));

notify pgrst, 'reload schema';
