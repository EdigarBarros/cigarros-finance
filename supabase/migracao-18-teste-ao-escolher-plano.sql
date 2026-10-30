-- Migração 18: o teste grátis de 7 dias começa quando a pessoa ESCOLHE o plano, não no cadastro.
-- Supabase > SQL Editor > New query > colar > Run. Pode ser rodada de novo sem problema. Não mexe em quem já tem teste,
-- cortesia ou assinatura no Stripe.
--
-- Fluxo novo: criar conta -> tela de planos (teste grátis ou assinar) -> painel. Conta nova nasce SEM linha em "assinaturas"
-- (sem acesso). Ao clicar em "Começar teste grátis", o app chama iniciar_teste_gratis(), que grava o teste no banco.

-- 1) Conta nova deixa de ganhar o teste sozinha.
drop trigger if exists iniciar_teste on auth.users;

-- 2) Quem grava o teste é o banco, nunca o navegador, e só uma vez por conta: quem já teve teste (teste_fim preenchido) ou
--    já assinou não consegue reiniciar. Devolve true se começou o teste agora.
create or replace function public.iniciar_teste_gratis() returns boolean
language plpgsql security definer set search_path = public as $$
declare
  eu uuid := auth.uid();
  atual public.assinaturas%rowtype;
begin
  if eu is null then return false; end if;
  select * into atual from public.assinaturas where user_id = eu;
  if found then
    -- a linha pode existir só com o cliente do Stripe (quem abriu o pagamento antes de testar): ainda vale o teste
    if atual.status <> 'sem_assinatura' or atual.teste_fim is not null then return false; end if;
    update public.assinaturas set status = 'teste', teste_fim = now() + interval '7 days', atualizado_em = now() where user_id = eu;
  else
    insert into public.assinaturas (user_id, status, teste_fim) values (eu, 'teste', now() + interval '7 days');
  end if;
  return true;
end;
$$;
revoke all on function public.iniciar_teste_gratis() from public, anon;
grant execute on function public.iniciar_teste_gratis() to authenticated;

notify pgrst, 'reload schema';
