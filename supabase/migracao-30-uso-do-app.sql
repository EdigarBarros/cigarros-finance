-- Migração 30: como as pessoas usam o app (para o painel de suporte melhorar o OpusCash). Rodável de novo.
-- Supabase > SQL Editor > New query > colar > Run.
--
-- O QUE É GUARDADO (e o que NÃO é):
--   * uso_presenca: uma linha por conta. Quando a pessoa foi vista pela última vez, em qual tela, se está com o app aberto
--     agora, o idioma escolhido, se é o site ou o app Android e a versão. Atualizada a cada minuto com o app aberto e visível.
--   * uso_telas: por dia e por tela, quanto tempo a pessoa ficou (segundos), quantas vezes tocou ou digitou (só o NÚMERO de
--     toques e teclas, nunca o que foi digitado) e quantas vezes abriu a tela.
--   * uso_marcos: acontecimentos de uso, como "pulou o tutorial no passo 3 de 9" ou "viu o tutorial inteiro".
--   NADA do que a pessoa escreve ou lança (valores, descrições, nomes de contas) passa por aqui.
--
-- Segurança: as tabelas têm RLS ligado, sem política, e nenhuma permissão para anon/authenticated. A pessoa só escreve pelas
-- funções uso_ping e uso_marco (sempre na própria conta, auth.uid()). Só o painel de suporte (chave de serviço) lê.

create table if not exists public.uso_presenca (
  user_id      uuid primary key references auth.users on delete cascade,
  visto_em     timestamptz not null default now(),
  aberto       boolean not null default true,
  tela         text,
  idioma       text,
  aparelho     text,
  versao       text,
  entrou_em    timestamptz not null default now()
);

create table if not exists public.uso_telas (
  user_id     uuid not null references auth.users on delete cascade,
  dia         date not null,
  tela        text not null,
  segundos    integer not null default 0,
  interacoes  integer not null default 0,
  visitas     integer not null default 0,
  primary key (user_id, dia, tela)
);
create index if not exists uso_telas_dia on public.uso_telas (dia);

create table if not exists public.uso_marcos (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users on delete cascade,
  tipo       text not null check (char_length(tipo) <= 40),
  detalhe    jsonb not null default '{}'::jsonb,
  criado_em  timestamptz not null default now()
);
create index if not exists uso_marcos_user on public.uso_marcos (user_id, criado_em desc);

do $$
declare t text;
begin
  foreach t in array array['uso_presenca', 'uso_telas', 'uso_marcos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- Sinal de vida do app (a cada minuto com a tela visível, ao trocar de tela e ao sair).
--   p_telas: {"inicio": {"s": 42, "i": 7, "v": 1}, ...} = segundos, interações (toques/teclas) e visitas desde o último sinal.
--   p_saiu: a pessoa fechou ou escondeu o app.
create or replace function public.uso_ping(p_tela text, p_idioma text, p_aparelho text, p_versao text,
                                           p_telas jsonb default '{}'::jsonb, p_saiu boolean default false)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_dia date := (now() at time zone 'America/Sao_Paulo')::date;
  v_tela text;
  v_val jsonb;
  n integer := 0;
  limpa text := '^[a-z0-9_-]{1,40}$';
begin
  if v_user is null then return; end if;
  if p_tela is not null and p_tela !~ limpa then p_tela := null; end if;

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

  if jsonb_typeof(p_telas) = 'object' then
    for v_tela, v_val in select * from jsonb_each(p_telas) loop
      n := n + 1;
      exit when n > 30;
      continue when v_tela !~ limpa or jsonb_typeof(v_val) <> 'object';
      insert into public.uso_telas as u (user_id, dia, tela, segundos, interacoes, visitas)
      values (v_user, v_dia, v_tela,
              least(greatest(coalesce((v_val->>'s')::numeric, 0), 0), 900)::integer,
              least(greatest(coalesce((v_val->>'i')::numeric, 0), 0), 3000)::integer,
              least(greatest(coalesce((v_val->>'v')::numeric, 0), 0), 100)::integer)
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
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if p_tipo not in ('tutorial_pulou', 'tutorial_terminou', 'tutorial_reviu', 'questionario_terminou', 'questionario_refez') then return; end if;
  if pg_column_size(p_detalhe) > 1000 then p_detalhe := '{}'::jsonb; end if;
  insert into public.uso_marcos (user_id, tipo, detalhe) values (auth.uid(), p_tipo, coalesce(p_detalhe, '{}'::jsonb));
end;
$$;

revoke all on function public.uso_ping(text, text, text, text, jsonb, boolean) from public, anon;
revoke all on function public.uso_marco(text, jsonb) from public, anon;
grant execute on function public.uso_ping(text, text, text, text, jsonb, boolean) to authenticated;
grant execute on function public.uso_marco(text, jsonb) to authenticated;

notify pgrst, 'reload schema';
