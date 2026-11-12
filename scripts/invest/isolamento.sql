-- Teste de isolamento do Invest (cenário 8): roda a migração 27 num Postgres de teste com o mesmo esquema de acesso do
-- Supabase (auth.uid(), papel authenticated, tem_acesso()) e confere que uma pessoa não lê, não grava e não apaga nada
-- da carteira de outra, e que quem não tem acesso (assinatura vencida) não lê nem a própria.
-- Rodar: scripts/invest/isolamento.sh (precisa de um Postgres local; nada aqui toca o banco de verdade).
\set ON_ERROR_STOP on
\set QUIET on
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create role authenticated nologin;
create role anon nologin;
grant usage on schema public, auth to authenticated, anon;
alter default privileges in schema public grant all on tables to authenticated, anon;
-- o mínimo das tabelas que a migração referencia
create table public.bancos (id uuid primary key default gen_random_uuid(), user_id uuid not null);
create table public.lancamentos (id uuid primary key default gen_random_uuid(), user_id uuid not null);
create table public.assinaturas (user_id uuid primary key, status text not null, teste_fim timestamptz);
create function public.tem_acesso() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.assinaturas a where a.user_id = auth.uid()
    and (a.status in ('trialing', 'active', 'past_due', 'cortesia') or (a.status = 'teste' and a.teste_fim > now())));
$$;
\i supabase/migracao-27-invest.sql
-- rodar de novo não pode dar erro (a migração é feita para isso)
\i supabase/migracao-27-invest.sql

insert into auth.users values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), ('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
insert into public.assinaturas values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'active', null), ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cortesia', null),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'canceled', null);

create schema teste;
create function teste.espera(nome text, ok boolean) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FALHOU: %', nome; end if;
  raise notice 'ok: %', nome;
end $$;
-- roda um comando que TEM de ser recusado pelo banco
create function teste.recusa(nome text, comando text) returns void language plpgsql as $$
begin
  begin
    execute comando;
  exception when others then
    raise notice 'ok: % (recusado: %)', nome, sqlstate;
    return;
  end;
  raise exception 'FALHOU: % (o banco aceitou)', nome;
end $$;
grant usage on schema teste to authenticated, anon;
\set QUIET off

-- ===== Ana cadastra a carteira dela =====
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false);
insert into public.invest_ativos (id, nome, classe) values ('a1a1a1a1-0000-4000-8000-000000000001', 'CDB da Ana', 'renda_fixa');
insert into public.invest_operacoes (ativo_id, tipo, data, valor, chave) values ('a1a1a1a1-0000-4000-8000-000000000001', 'compra', '2026-01-10', 1000, 'i:teste:1');
insert into public.invest_precos (ativo_id, data, natureza, valor) values ('a1a1a1a1-0000-4000-8000-000000000001', '2026-02-10', 'saldo', 1010);
insert into public.invest_importacoes (arquivo, hash) values ('mov.xlsx', 'abc');
insert into public.invest_config (plano) values ('{"aporteMensal": 500}');
select teste.espera('Ana vê o próprio ativo', (select count(*) from public.invest_ativos) = 1);
select teste.recusa('a mesma chave de importação não entra duas vezes',
  $$insert into public.invest_operacoes (ativo_id, tipo, data, valor, chave) values ('a1a1a1a1-0000-4000-8000-000000000001', 'compra', '2026-01-10', 1000, 'i:teste:1')$$);
select teste.recusa('tipo de operação inventado é recusado',
  $$insert into public.invest_operacoes (ativo_id, tipo, data, valor) values ('a1a1a1a1-0000-4000-8000-000000000001', 'drop table', '2026-01-10', 1)$$);

-- ===== Bia não enxerga nem mexe em nada da Ana =====
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', false);
select teste.espera('Bia não vê ativos da Ana', (select count(*) from public.invest_ativos) = 0);
select teste.espera('Bia não vê operações da Ana', (select count(*) from public.invest_operacoes) = 0);
select teste.espera('Bia não vê preços da Ana', (select count(*) from public.invest_precos) = 0);
select teste.espera('Bia não vê importações da Ana', (select count(*) from public.invest_importacoes) = 0);
select teste.espera('Bia não vê o plano da Ana', (select count(*) from public.invest_config) = 0);
with x as (update public.invest_ativos set nome = 'invadido' returning 1) select teste.espera('Bia não altera ativos da Ana', (select count(*) from x) = 0);
with x as (update public.invest_operacoes set valor = 1 returning 1) select teste.espera('Bia não altera operações da Ana', (select count(*) from x) = 0);
with x as (delete from public.invest_ativos returning 1) select teste.espera('Bia não apaga ativos da Ana', (select count(*) from x) = 0);
with x as (delete from public.invest_config returning 1) select teste.espera('Bia não apaga o plano da Ana', (select count(*) from x) = 0);
select teste.recusa('Bia não pendura operação no ativo da Ana',
  $$insert into public.invest_operacoes (ativo_id, tipo, data, valor) values ('a1a1a1a1-0000-4000-8000-000000000001', 'venda', '2026-03-01', 999)$$);
select teste.recusa('Bia não pendura preço no ativo da Ana',
  $$insert into public.invest_precos (ativo_id, data, natureza, valor) values ('a1a1a1a1-0000-4000-8000-000000000001', '2026-03-01', 'saldo', 1)$$);
select teste.recusa('Bia não grava ativo em nome da Ana',
  $$insert into public.invest_ativos (user_id, nome, classe) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'falso', 'acao')$$);
select teste.recusa('Bia não grava o plano em nome da Ana',
  $$insert into public.invest_config (user_id, plano) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '{}')$$);
-- a mesma chave de importação em outra conta é permitida (a regra é por pessoa)
insert into public.invest_ativos (id, nome, classe) values ('b1b1b1b1-0000-4000-8000-000000000001', 'CDB da Bia', 'renda_fixa');
insert into public.invest_operacoes (ativo_id, tipo, data, valor, chave) values ('b1b1b1b1-0000-4000-8000-000000000001', 'compra', '2026-01-10', 1000, 'i:teste:1');
select teste.espera('Bia vê só o dela', (select count(*) from public.invest_operacoes) = 1);

-- ===== Caio, sem acesso (assinatura cancelada), não lê nem grava =====
select set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', false);
select teste.espera('sem acesso, não lê nada', (select count(*) from public.invest_ativos) = 0);
select teste.recusa('sem acesso, não grava', $$insert into public.invest_ativos (nome, classe) values ('x', 'acao')$$);

-- ===== sem estar logado =====
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select teste.espera('anônimo não lê nada', (select count(*) from public.invest_ativos) + (select count(*) from public.invest_operacoes) + (select count(*) from public.invest_config) = 0);
select teste.recusa('anônimo não grava', $$insert into public.invest_ativos (user_id, nome, classe) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'x', 'acao')$$);

-- ===== o que é da Ana continua inteiro, e apagar o ativo leva as operações e os preços dele =====
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false);
select teste.espera('a carteira da Ana está intacta', (select nome from public.invest_ativos) = 'CDB da Ana' and (select valor from public.invest_operacoes) = 1000
  and (select count(*) from public.invest_precos) = 1 and (select plano ->> 'aporteMensal' from public.invest_config) = '500');
delete from public.invest_ativos where id = 'a1a1a1a1-0000-4000-8000-000000000001';
select teste.espera('apagar o ativo apaga operações e preços dele', (select count(*) from public.invest_operacoes) + (select count(*) from public.invest_precos) = 0);
reset role;
select teste.espera('e não tocou no que é da Bia', (select count(*) from public.invest_operacoes) = 1);
\echo ISOLAMENTO: TUDO CERTO
