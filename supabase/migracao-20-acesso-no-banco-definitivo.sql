-- Migração 20: versão FINAL do bloqueio no banco. Define de novo tem_acesso() e recria a política "dono" de todas as tabelas de dados
-- da pessoa, exigindo ser o dono E ter acesso. Substitui a migração 13 (que passa a ser desnecessária).
-- Supabase > SQL Editor > New query > colar > Run. Pode ser rodada de novo sem problema.
--
-- QUANDO RODAR:
--   • Banco novo: depois do schema.sql e das migrações 9 a 19 (veja o README). É ela que liga o bloqueio de quem não pagou.
--   • Sempre que rodar de novo o schema.sql ou as migrações 4, 5, 6, 7, 8, 13 ou 16: elas apagam a política "dono" e a recriam SEM
--     tem_acesso() (13 e 16 também voltam tem_acesso() para uma versão sem o teste grátis). Esta migração conserta isso.
--   • Precisa da migração 12 (tabela assinaturas) já rodada.
--
-- Por que existe: as migrações antigas redefinem a mesma função e as mesmas políticas, então a ordem em que são rodadas decide o que
-- vale. Aqui fica a definição certa num lugar só, para rodar por último.

do $$
begin
  if to_regclass('public.assinaturas') is null then
    raise exception 'Rode a migração 12 (tabela assinaturas) antes desta.';
  end if;
end $$;

-- 1) Quem tem acesso: teste grátis do OpusCash enquanto vale (migração 17/18), teste do Stripe, assinatura em dia, cobrança recusada
--    ainda em nova tentativa (past_due, migração 16) e cortesia. A função só é chamada pelas políticas de quem está logado.
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

-- 2) Política "dono" de cada tabela de dados: só o dono, e só com acesso. (select ...) em volta das funções para o Postgres avaliar
--    uma vez por consulta, e não uma vez por linha.
do $$
declare t text;
begin
  foreach t in array array['lancamentos', 'categorias', 'bancos', 'dividas', 'divida_saldos', 'meses', 'metas', 'meta_movimentos',
                           'contas_fixas', 'cartoes', 'faturas_pagas'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists "dono" on public.%I', t);
      execute format('create policy "dono" on public.%I for all to authenticated
        using (user_id = (select auth.uid()) and (select public.tem_acesso()))
        with check (user_id = (select auth.uid()) and (select public.tem_acesso()))', t);
    end if;
  end loop;
end $$;
-- "perfis" fica de fora de propósito: a tela de assinatura lê a moeda da pessoa dali.

notify pgrst, 'reload schema';
