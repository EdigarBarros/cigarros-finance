-- Migração 29: Pix de pagamento único (30 dias de acesso). O Stripe não libera o Pix recorrente (Pix Automático) nesta conta, então
-- quem prefere Pix paga um checkout avulso de R$ 9,99 e ganha 30 dias. O acesso acaba sozinho quando periodo_fim passa; para
-- continuar, a pessoa paga de novo (e os dias novos se somam aos que sobraram).
-- Supabase > SQL Editor > New query > colar > Run. Pode ser rodada de novo sem problema. Não mexe em quem já tem assinatura,
-- teste ou cortesia. Precisa da migração 12 (tabela assinaturas).
--
-- ORDEM: rode antes de publicar o site com o botão de Pix (sem o status 'pix' o banco recusaria a gravação do webhook).

do $$
begin
  if to_regclass('public.assinaturas') is null then
    raise exception 'Rode a migração 12 (tabela assinaturas) antes desta.';
  end if;
end $$;

-- 1) Novo status 'pix': acesso pago por Pix, vale enquanto periodo_fim estiver no futuro.
alter table public.assinaturas drop constraint if exists assinaturas_status_check;
alter table public.assinaturas add constraint assinaturas_status_check check (status in (
  'sem_assinatura', 'teste', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused', 'cortesia', 'pix'));

-- 2) Registro de cada Pix recebido. A chave é o id da sessão de pagamento do Stripe: o Stripe reenvia avisos, e sem isto o mesmo
--    Pix somaria 30 dias duas vezes. Só o servidor (service role) lê e grava: com a segurança por linha ligada e sem política,
--    ninguém de fora enxerga.
create table if not exists public.pagamentos_pix (
  sessao_id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  valor integer not null,
  moeda text not null,
  dias integer not null default 30,
  pago_em timestamptz not null default now()
);
create index if not exists pagamentos_pix_user_idx on public.pagamentos_pix (user_id);
alter table public.pagamentos_pix enable row level security;
revoke all on public.pagamentos_pix from anon, authenticated;

-- 3) Registra o Pix e libera o acesso NUMA transação só (quem chama é o stripe-webhook, com a chave de serviço).
--    Devolve até quando vale o acesso, ou null se este Pix já tinha sido registrado (reenvio do aviso: não soma de novo).
--    Pix pago antes de vencer soma 30 dias ao que sobrou. Quem está em cortesia ou com assinatura/teste do Stripe ativos
--    não tem a linha trocada (o checkout já nem deixa pagar nesses casos; isto cobre só uma corrida).
create or replace function public.registrar_pix(p_sessao text, p_user uuid, p_valor integer, p_moeda text, p_customer text, p_dias integer default 30)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  v_fim_atual timestamptz;
  v_fim timestamptz;
begin
  insert into public.pagamentos_pix (sessao_id, user_id, valor, moeda, dias)
  values (p_sessao, p_user, p_valor, p_moeda, p_dias)
  on conflict (sessao_id) do nothing;
  if not found then
    return null;
  end if;

  select status, periodo_fim into v_status, v_fim_atual from public.assinaturas where user_id = p_user for update;
  if v_status in ('cortesia', 'trialing', 'active') then
    return v_fim_atual;
  end if;

  v_fim := greatest(now(), case when v_status = 'pix' then v_fim_atual end) + make_interval(days => p_dias);
  insert into public.assinaturas (user_id, status, periodo_fim, stripe_customer_id, moeda, cancela_no_fim, atualizado_em)
  values (p_user, 'pix', v_fim, p_customer, lower(p_moeda), false, now())
  on conflict (user_id) do update set
    status = 'pix',
    periodo_fim = v_fim,
    stripe_customer_id = coalesce(excluded.stripe_customer_id, public.assinaturas.stripe_customer_id),
    moeda = excluded.moeda,
    cancela_no_fim = false,
    atualizado_em = now();
  return v_fim;
end;
$$;
revoke all on function public.registrar_pix(text, uuid, integer, text, text, integer) from public, anon, authenticated;
grant execute on function public.registrar_pix(text, uuid, integer, text, text, integer) to service_role;

-- 4) Acesso: igual à migração 20, mais o Pix enquanto vale.
create or replace function public.tem_acesso() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.assinaturas a
    where a.user_id = auth.uid()
      and (a.status in ('trialing', 'active', 'past_due', 'cortesia')
        or (a.status = 'teste' and a.teste_fim > now())
        or (a.status = 'pix' and a.periodo_fim > now()))
  );
$$;
revoke all on function public.tem_acesso() from public, anon;
grant execute on function public.tem_acesso() to authenticated;

notify pgrst, 'reload schema';
