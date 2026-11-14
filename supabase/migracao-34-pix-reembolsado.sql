-- Pix de 30 dias reembolsado: os dias saem do acesso.
-- Antes, o reembolso (pelo Stripe ou pelo painel de suporte) devolvia o dinheiro e a pessoa ficava com os 30 dias.
-- Quem chama estornar_pix é o stripe-webhook (aviso charge.refunded) e o painel de suporte (ação "reembolsar"), com a chave de
-- serviço. Rodável de novo.

alter table public.pagamentos_pix add column if not exists estornado_em timestamptz;

-- Tira os dias do Pix desta sessão (só uma vez por sessão: aviso repetido não tira de novo).
--   pix vigente  -> periodo_fim volta os dias pagos; se o teste grátis ainda corre e o Pix tinha sido somado depois dele, volta a
--                   ser teste; se não sobra nada, o Pix fica vencido (sem acesso, como um Pix que acabou).
--   creditado = false (pago por quem já tinha acesso) -> só marca o estorno, não havia dias a tirar.
--   o Pix já virou assinatura no cartão (trialing/active) -> marca o estorno e devolve {"ajustar_no_stripe": true}: os dias
--                   estão no teste da assinatura e o acerto é lá (painel → Stripe).
-- Devolve: {"repetido": true} | {"sem_registro": true} | {"ajustado": true, "status": ..., "fim": ...} | {"ajustado": false, ...}
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
  select * into v_pag from public.pagamentos_pix where sessao_id = p_sessao for update;
  if not found then return jsonb_build_object('sem_registro', true); end if;
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
