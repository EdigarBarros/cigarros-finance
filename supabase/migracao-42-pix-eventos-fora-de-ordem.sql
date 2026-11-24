-- Exige as migrações 29 e 34. Registra um estorno mesmo quando ele chega antes do aviso de pagamento.
begin;

create table if not exists public.estornos_pix_pendentes (
  sessao_id text primary key,
  estornado_em timestamptz not null default now()
);
alter table public.estornos_pix_pendentes enable row level security;
revoke all on public.estornos_pix_pendentes from public, anon, authenticated;

create or replace function public.registrar_pix(p_sessao text, p_user uuid, p_valor integer, p_moeda text, p_customer text, p_dias integer default 30)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_estornado_em timestamptz;
  v_status text;
  v_periodo_fim timestamptz;
  v_teste_fim timestamptz;
  v_base timestamptz;
  v_fim timestamptz;
begin
  -- O mesmo bloqueio é adquirido no estorno, mesmo antes de existir um pagamento.
  perform pg_advisory_xact_lock(hashtextextended('opuscash:pix:' || p_sessao, 0));
  delete from public.estornos_pix_pendentes where sessao_id = p_sessao
    returning estornado_em into v_estornado_em;

  insert into public.pagamentos_pix (sessao_id, user_id, valor, moeda, dias, creditado, estornado_em)
  values (p_sessao, p_user, p_valor, p_moeda, p_dias, v_estornado_em is null, v_estornado_em)
  on conflict (sessao_id) do nothing;
  if not found then
    return jsonb_build_object('repetido', true);
  end if;

  if v_estornado_em is not null then
    return jsonb_build_object('creditado', false, 'estornado', true);
  end if;

  -- Garante uma linha a bloquear mesmo se duas sessões diferentes chegarem antes da assinatura.
  insert into public.assinaturas (user_id) values (p_user) on conflict (user_id) do nothing;

  select status, periodo_fim, teste_fim into v_status, v_periodo_fim, v_teste_fim
  from public.assinaturas where user_id = p_user for update;
  if v_status in ('cortesia', 'trialing', 'active') then
    update public.pagamentos_pix set creditado = false where sessao_id = p_sessao;
    return jsonb_build_object('creditado', false);
  end if;

  v_base := now();
  if v_status = 'pix' and v_periodo_fim > v_base then v_base := v_periodo_fim; end if;
  if v_status = 'teste' and v_teste_fim > v_base then v_base := v_teste_fim; end if;
  v_fim := v_base + make_interval(days => p_dias);

  insert into public.assinaturas (user_id, status, periodo_fim, stripe_customer_id, moeda, cancela_no_fim, atualizado_em)
  values (p_user, 'pix', v_fim, p_customer, lower(p_moeda), false, now())
  on conflict (user_id) do update set
    status = 'pix',
    periodo_fim = v_fim,
    stripe_customer_id = coalesce(excluded.stripe_customer_id, public.assinaturas.stripe_customer_id),
    moeda = excluded.moeda,
    cancela_no_fim = false,
    atualizado_em = now();
  return jsonb_build_object('creditado', true, 'fim', v_fim);
end;
$$;
revoke all on function public.registrar_pix(text, uuid, integer, text, text, integer) from public, anon, authenticated;
grant execute on function public.registrar_pix(text, uuid, integer, text, text, integer) to service_role;

create or replace function public.estornar_pix(p_sessao text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_pag public.pagamentos_pix;
  v_status text;
  v_periodo_fim timestamptz;
  v_teste_fim timestamptz;
  v_fim timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended('opuscash:pix:' || p_sessao, 0));
  select * into v_pag from public.pagamentos_pix where sessao_id = p_sessao for update;
  if not found then
    insert into public.estornos_pix_pendentes (sessao_id) values (p_sessao)
      on conflict (sessao_id) do nothing;
    return jsonb_build_object('sem_registro', true, 'estorno_pendente', true);
  end if;
  if v_pag.estornado_em is not null then return jsonb_build_object('repetido', true); end if;

  update public.pagamentos_pix set estornado_em = now() where sessao_id = p_sessao;
  if not v_pag.creditado then return jsonb_build_object('ajustado', false, 'motivo', 'pago sem crédito'); end if;

  select status, periodo_fim, teste_fim into v_status, v_periodo_fim, v_teste_fim
  from public.assinaturas where user_id = v_pag.user_id for update;
  if v_status is distinct from 'pix' then
    return jsonb_build_object('ajustado', false, 'motivo', coalesce(v_status, 'sem assinatura'),
      'ajustar_no_stripe', v_status in ('trialing', 'active', 'past_due'));
  end if;

  v_fim := v_periodo_fim - make_interval(days => v_pag.dias);
  if v_teste_fim is not null and v_teste_fim > now() and v_fim <= v_teste_fim then
    update public.assinaturas set status = 'teste', periodo_fim = null, atualizado_em = now() where user_id = v_pag.user_id;
    return jsonb_build_object('ajustado', true, 'status', 'teste', 'fim', v_teste_fim);
  end if;
  update public.assinaturas set periodo_fim = v_fim, atualizado_em = now() where user_id = v_pag.user_id;
  return jsonb_build_object('ajustado', true, 'status', 'pix', 'fim', v_fim);
end;
$$;
revoke all on function public.estornar_pix(text) from public, anon, authenticated;
grant execute on function public.estornar_pix(text) to service_role;

notify pgrst, 'reload schema';
commit;
