-- Exige as migrações 16 e 30. Limites por conta, inclusive quando a gravação vem de uma versão antiga.
begin;

create table if not exists public.telemetria_ritmo (
  user_id uuid not null references auth.users on delete cascade,
  canal text not null,
  minuto timestamptz not null,
  quantidade integer not null,
  primary key (user_id, canal)
);
alter table public.telemetria_ritmo enable row level security;
revoke all on public.telemetria_ritmo from public, anon, authenticated;

create or replace function public.reservar_telemetria(p_canal text, p_limite integer)
returns boolean
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_user uuid := auth.uid();
  v_minuto timestamptz := date_trunc('minute', clock_timestamp());
begin
  if v_user is null then return false; end if;
  insert into public.telemetria_ritmo as r (user_id, canal, minuto, quantidade)
  values (v_user, p_canal, v_minuto, 1)
  on conflict (user_id, canal) do update set
    minuto = excluded.minuto,
    quantidade = case when r.minuto < excluded.minuto then 1 else r.quantidade + 1 end
  where r.minuto < excluded.minuto or (r.minuto = excluded.minuto and r.quantidade < p_limite);
  return found;
end;
$$;
revoke all on function public.reservar_telemetria(text, integer) from public, anon, authenticated;

create or replace function public.filtrar_erro_app()
returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if auth.uid() is not null then
    if not public.reservar_telemetria('erros_app', 12) then return null; end if;
    new.criado_em := now();
  end if;
  if new.mensagem is null or new.mensagem not in ('TypeError', 'RangeError', 'SyntaxError', 'ReferenceError', 'AbortError') then
    new.mensagem := 'Erro do aplicativo';
  end if;
  if new.onde not in ('janela', 'promessa', 'tela', 'consultor', 'invest importar', 'invest gravar importacao',
                      'leitor pdf', 'extrato pdf', 'importar extrato', 'extrato sem lancamentos') then
    new.onde := null;
  end if;
  if new.versao !~ '^(dev|[0-9a-f]{7,12}|[0-9]{13})$' then new.versao := null; end if;
  new.detalhe := null;
  return new;
end;
$$;
revoke all on function public.filtrar_erro_app() from public, anon, authenticated;
drop trigger if exists filtrar_erro_app on public.erros_app;
create trigger filtrar_erro_app before insert on public.erros_app for each row execute function public.filtrar_erro_app();

create or replace function public.uso_ping(p_tela text, p_idioma text, p_aparelho text, p_versao text,
                                           p_telas jsonb default '{}'::jsonb, p_saiu boolean default false)
returns void
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_user uuid := auth.uid();
  v_dia date := (now() at time zone 'America/Sao_Paulo')::date;
  v_tela text;
  v_val jsonb;
  n integer := 0;
  telas_permitidas text[] := array['painel', 'inicio', 'lancamentos', 'analise', 'invest', 'contas', 'cartoes',
    'dividas', 'metas', 'patrimonio', 'ano', 'carregando', 'questionario_refazer', 'questionario', 'tutorial',
    'novidade', 'editar_lancamento', 'lancar', 'importar', 'categorias', 'configuracoes', 'excluir_conta',
    'zerar_dados', 'meses', 'assinatura'];
begin
  if not public.reservar_telemetria('uso_ping', 20) then return; end if;
  if p_tela <> all(telas_permitidas) then p_tela := null; end if;
  if p_idioma not in ('pt', 'en', 'es') then p_idioma := null; end if;
  if p_aparelho not in ('app_android', 'site_celular', 'site_computador', 'site') then p_aparelho := null; end if;
  if p_versao !~ '^(dev|[0-9a-f]{7,12}|[0-9]{13})$' then p_versao := null; end if;

  insert into public.uso_presenca as p (user_id, visto_em, aberto, tela, idioma, aparelho, versao, entrou_em)
  values (v_user, now(), not coalesce(p_saiu, false), p_tela, left(p_idioma, 12), left(p_aparelho, 20), left(p_versao, 40), now())
  on conflict (user_id) do update set
    visto_em = now(),
    aberto = not coalesce(p_saiu, false),
    tela = coalesce(excluded.tela, p.tela),
    idioma = coalesce(excluded.idioma, p.idioma),
    aparelho = coalesce(excluded.aparelho, p.aparelho),
    versao = coalesce(excluded.versao, p.versao),
    -- volta depois de 10 minutos fora conta como uma entrada nova
    entrou_em = case when not p.aberto or p.visto_em < now() - interval '10 minutes' then now() else p.entrou_em end;

  if jsonb_typeof(p_telas) = 'object' and octet_length(p_telas::text) <= 16000 then
    for v_tela, v_val in select * from jsonb_each(p_telas) loop
      n := n + 1;
      exit when n > 30;
      continue when v_tela <> all(telas_permitidas) or jsonb_typeof(v_val) <> 'object';
      insert into public.uso_telas as u (user_id, dia, tela, segundos, interacoes, visitas)
      values (v_user, v_dia, v_tela,
              least(greatest(case when jsonb_typeof(v_val->'s') = 'number' then (v_val->>'s')::numeric else 0 end, 0), 900)::integer,
              least(greatest(case when jsonb_typeof(v_val->'i') = 'number' then (v_val->>'i')::numeric else 0 end, 0), 3000)::integer,
              least(greatest(case when jsonb_typeof(v_val->'v') = 'number' then (v_val->>'v')::numeric else 0 end, 0), 100)::integer)
      on conflict (user_id, dia, tela) do update set
        segundos = u.segundos + excluded.segundos,
        interacoes = u.interacoes + excluded.interacoes,
        visitas = u.visitas + excluded.visitas;
    end loop;
  end if;
end;
$$;

-- Acontecimento de uso (tutorial pulado ou visto, por exemplo). Só tipos conhecidos; detalhe pequeno.
create or replace function public.uso_marco(p_tipo text, p_detalhe jsonb default '{}'::jsonb)
returns void
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if p_tipo is null or p_tipo not in ('tutorial_pulou', 'tutorial_terminou', 'tutorial_reviu',
                                     'questionario_terminou', 'questionario_refez') then return; end if;
  if not public.reservar_telemetria('uso_marco', 10) then return; end if;
  if octet_length(p_detalhe::text) > 1000 then p_detalhe := '{}'::jsonb; end if;
  insert into public.uso_marcos (user_id, tipo, detalhe)
  values (auth.uid(), p_tipo, jsonb_strip_nulls(jsonb_build_object(
    'modo', case when p_detalhe->>'modo' in ('simples', 'equilibrado', 'detalhado') then p_detalhe->>'modo' end,
    'como', case when p_detalhe->>'como' in ('pulou', 'terminou') then p_detalhe->>'como' end,
    'passo', case when jsonb_typeof(p_detalhe->'passo') = 'number' and p_detalhe->>'passo' ~ '^[0-9]{1,3}$' then p_detalhe->'passo' end,
    'total', case when jsonb_typeof(p_detalhe->'total') = 'number' and p_detalhe->>'total' ~ '^[0-9]{1,3}$' then p_detalhe->'total' end
  )));
end;
$$;

revoke all on function public.uso_ping(text, text, text, text, jsonb, boolean) from public, anon;
revoke all on function public.uso_marco(text, jsonb) from public, anon;
grant execute on function public.uso_ping(text, text, text, text, jsonb, boolean) to authenticated;
grant execute on function public.uso_marco(text, jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
