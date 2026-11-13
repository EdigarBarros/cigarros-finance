-- Migração 33: suporte dentro do app (pedidos de ajuda, como tickets). Rodável de novo.
-- Supabase > SQL Editor > New query > colar > Run.
--
-- COMO FUNCIONA
--   * A pessoa abre um pedido de ajuda de qualquer tela do painel: escolhe o assunto (pagamento e assinatura, algo não
--     funciona, minha conta, dúvida, sugestão, outro), escreve e manda. Vão junto, à vista dela, a tela em que estava,
--     a versão do app e o aparelho (site no computador, site no celular ou app Android).
--   * O suporte responde pelo painel de suporte (repositório Painel-Opus-Cash, função "admin" com a chave de serviço).
--   * Situação do pedido: 'aberto' (esperando o suporte), 'respondido' (esperando a pessoa), 'resolvido' (encerrado).
--     A pessoa responder um pedido respondido ou resolvido volta ele para 'aberto'.
--   * "Lido": cada lado guarda quando viu a conversa pela última vez, para os avisos de resposta nova.
--
-- SEGURANÇA
--   * RLS ligado. A pessoa só LÊ os próprios pedidos e as mensagens deles (auth.uid()). Ninguém grava direto nas tabelas:
--     a pessoa age só pelas funções suporte_* abaixo (sempre na própria conta) e o suporte pela chave de serviço.
--   * Limites contra abuso: no máximo 5 pedidos abertos ao mesmo tempo, 20 mensagens a cada 10 minutos, texto de até 4000
--     letras e assunto de até 120.

create table if not exists public.suporte_tickets (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users on delete cascade,
  categoria             text not null check (categoria in ('pagamento', 'bug', 'conta', 'duvida', 'sugestao', 'outro')),
  assunto               text not null check (char_length(assunto) between 3 and 120),
  status                text not null default 'aberto' check (status in ('aberto', 'respondido', 'resolvido')),
  tela                  text,
  versao                text,
  aparelho              text,
  idioma                text,
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now(),
  ultima_mensagem_em    timestamptz not null default now(),
  ultima_mensagem_de    text not null default 'pessoa' check (ultima_mensagem_de in ('pessoa', 'suporte')),
  lido_pela_pessoa_em   timestamptz not null default now(),
  lido_pelo_suporte_em  timestamptz,
  resolvido_em          timestamptz
);
create index if not exists suporte_tickets_user on public.suporte_tickets (user_id, ultima_mensagem_em desc);
create index if not exists suporte_tickets_status on public.suporte_tickets (status, ultima_mensagem_em desc);

create table if not exists public.suporte_mensagens (
  id         bigint generated always as identity primary key,
  ticket_id  uuid not null references public.suporte_tickets on delete cascade,
  autor      text not null check (autor in ('pessoa', 'suporte')),
  texto      text not null check (char_length(texto) between 1 and 4000),
  admin_id   uuid,
  criado_em  timestamptz not null default now()
);
create index if not exists suporte_mensagens_ticket on public.suporte_mensagens (ticket_id, id);

alter table public.suporte_tickets enable row level security;
alter table public.suporte_mensagens enable row level security;
revoke all on public.suporte_tickets from anon, authenticated;
revoke all on public.suporte_mensagens from anon, authenticated;
grant select on public.suporte_tickets to authenticated;
grant select on public.suporte_mensagens to authenticated;

drop policy if exists "pessoa le os proprios pedidos" on public.suporte_tickets;
create policy "pessoa le os proprios pedidos" on public.suporte_tickets
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "pessoa le as mensagens dos proprios pedidos" on public.suporte_mensagens;
create policy "pessoa le as mensagens dos proprios pedidos" on public.suporte_mensagens
  for select to authenticated using (exists (select 1 from public.suporte_tickets t where t.id = ticket_id and t.user_id = auth.uid()));

-- Limite de mensagens da pessoa (todas as conversas dela): 20 a cada 10 minutos.
create or replace function public.suporte_conferir_ritmo(p_user uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.suporte_mensagens m join public.suporte_tickets t on t.id = m.ticket_id
      where t.user_id = p_user and m.autor = 'pessoa' and m.criado_em > now() - interval '10 minutes') >= 20 then
    raise exception 'suporte_ritmo' using hint = 'Muitas mensagens em pouco tempo. Espere alguns minutos e mande de novo.';
  end if;
end $$;

-- Abre um pedido de ajuda com a primeira mensagem. Devolve o id do pedido.
create or replace function public.suporte_abrir(p_categoria text, p_assunto text, p_texto text,
                                               p_tela text default null, p_versao text default null,
                                               p_aparelho text default null, p_idioma text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_texto text := btrim(coalesce(p_texto, ''));
  v_assunto text := btrim(coalesce(p_assunto, ''));
begin
  if v_user is null then raise exception 'suporte_sem_login'; end if;
  if char_length(v_texto) < 1 then raise exception 'suporte_texto_vazio'; end if;
  if char_length(v_assunto) < 3 then v_assunto := left(regexp_replace(v_texto, '\s+', ' ', 'g'), 80); end if;
  if char_length(v_assunto) < 3 then raise exception 'suporte_assunto_curto'; end if;
  if (select count(*) from public.suporte_tickets where user_id = v_user and status <> 'resolvido') >= 5 then
    raise exception 'suporte_muitos_abertos' using hint = 'Você já tem 5 pedidos em andamento. Responda ou encerre um deles antes de abrir outro.';
  end if;
  perform public.suporte_conferir_ritmo(v_user);
  insert into public.suporte_tickets (user_id, categoria, assunto, tela, versao, aparelho, idioma)
  values (v_user, p_categoria, left(v_assunto, 120),
          case when p_tela ~ '^[a-z0-9_/#-]{1,60}$' then p_tela end, left(p_versao, 40), left(p_aparelho, 20), left(p_idioma, 12))
  returning id into v_id;
  insert into public.suporte_mensagens (ticket_id, autor, texto) values (v_id, 'pessoa', left(v_texto, 4000));
  return v_id;
end $$;

-- A pessoa escreve de novo num pedido seu. Pedido respondido ou resolvido volta a esperar o suporte.
create or replace function public.suporte_responder(p_ticket uuid, p_texto text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_texto text := btrim(coalesce(p_texto, ''));
begin
  if v_user is null then raise exception 'suporte_sem_login'; end if;
  if char_length(v_texto) < 1 then raise exception 'suporte_texto_vazio'; end if;
  if not exists (select 1 from public.suporte_tickets where id = p_ticket and user_id = v_user) then
    raise exception 'suporte_nao_encontrado';
  end if;
  perform public.suporte_conferir_ritmo(v_user);
  insert into public.suporte_mensagens (ticket_id, autor, texto) values (p_ticket, 'pessoa', left(v_texto, 4000));
  update public.suporte_tickets
     set status = 'aberto', resolvido_em = null, ultima_mensagem_em = now(), ultima_mensagem_de = 'pessoa',
         atualizado_em = now(), lido_pela_pessoa_em = now()
   where id = p_ticket;
end $$;

-- A pessoa viu a conversa (some o aviso de resposta nova).
create or replace function public.suporte_lido(p_ticket uuid)
returns void
language sql security definer set search_path = public as $$
  update public.suporte_tickets set lido_pela_pessoa_em = now() where id = p_ticket and user_id = auth.uid();
$$;

-- A pessoa encerra o pedido (o problema foi resolvido). Responder depois reabre.
create or replace function public.suporte_encerrar(p_ticket uuid)
returns void
language sql security definer set search_path = public as $$
  update public.suporte_tickets set status = 'resolvido', resolvido_em = now(), atualizado_em = now(), lido_pela_pessoa_em = now()
   where id = p_ticket and user_id = auth.uid() and status <> 'resolvido';
$$;

do $$
declare f text;
begin
  -- só a própria pessoa logada usa as funções do app; a de ritmo é interna
  foreach f in array array['suporte_abrir(text, text, text, text, text, text, text)', 'suporte_responder(uuid, text)',
                           'suporte_lido(uuid)', 'suporte_encerrar(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  execute 'revoke all on function public.suporte_conferir_ritmo(uuid) from public, anon, authenticated';
end $$;

notify pgrst, 'reload schema';
