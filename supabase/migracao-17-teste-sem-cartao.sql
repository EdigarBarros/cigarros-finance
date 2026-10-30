-- Migração 17: teste grátis de 7 dias SEM cartão. A conta nasce já em teste; o cartão só é pedido quando a pessoa decide assinar.
-- Supabase > SQL Editor > New query > colar > Run. Pode ser rodada de novo sem problema. Não mexe em quem tem 'cortesia' nem em
-- quem já tem assinatura no Stripe.

-- 1) Novo status 'teste': teste grátis do OpusCash (sem Stripe). Vale enquanto teste_fim estiver no futuro.
alter table public.assinaturas drop constraint if exists assinaturas_status_check;
alter table public.assinaturas add constraint assinaturas_status_check check (status in (
  'sem_assinatura', 'teste', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused', 'cortesia'));

-- 2) Conta nova ganha o teste na hora do cadastro (quem grava é o banco, não o navegador).
create or replace function public.iniciar_teste() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.assinaturas (user_id, status, teste_fim)
  values (new.id, 'teste', now() + interval '7 days')
  on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.iniciar_teste() from public, anon, authenticated;
drop trigger if exists iniciar_teste on auth.users;
create trigger iniciar_teste after insert on auth.users for each row execute function public.iniciar_teste();

-- 3) Acesso: o teste do OpusCash vale só até teste_fim. (Mesma função da migração 16, com o 'teste' a mais.)
create or replace function public.tem_acesso() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.assinaturas a
    where a.user_id = auth.uid()
      and (a.status in ('trialing', 'active', 'past_due', 'cortesia') or (a.status = 'teste' and a.teste_fim > now()))
  );
$$;
revoke all on function public.tem_acesso() from public, anon;
grant execute on function public.tem_acesso() to authenticated;

notify pgrst, 'reload schema';
