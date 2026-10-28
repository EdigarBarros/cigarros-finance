-- Migração 13: o banco só entrega os dados de quem tem acesso (teste grátis, assinatura em dia ou cortesia).
-- RODE SÓ DEPOIS de testar o fluxo de assinatura com uma conta nova (migração 12 + funções stripe-* no ar).
-- Sem isto, a tela de assinatura bloqueia o painel, mas alguém que chame a API direto ainda leria os próprios dados.
-- Pode ser rodada de novo. Para desfazer, rode a migração de cada tabela de novo (a política "dono" volta ao normal).

create or replace function public.tem_acesso() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.assinaturas a
    where a.user_id = auth.uid() and a.status in ('trialing', 'active', 'cortesia')
  );
$$;
revoke all on function public.tem_acesso() from public;
grant execute on function public.tem_acesso() to authenticated;

do $$
declare t text;
begin
  foreach t in array array['lancamentos', 'categorias', 'bancos', 'dividas', 'divida_saldos', 'meses', 'metas', 'meta_movimentos',
                           'contas_fixas', 'cartoes', 'faturas_pagas'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists "dono" on public.%I', t);
      execute format('create policy "dono" on public.%I for all to authenticated
        using (user_id = (select auth.uid()) and public.tem_acesso())
        with check (user_id = (select auth.uid()) and public.tem_acesso())', t);
    end if;
  end loop;
end $$;
-- "perfis" fica de fora: a tela de assinatura lê a moeda da pessoa dali.

notify pgrst, 'reload schema';
