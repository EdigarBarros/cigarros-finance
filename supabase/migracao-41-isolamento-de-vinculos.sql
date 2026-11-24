-- Vínculos entre tabelas de uma conta incluem o dono dos dois lados.
-- Se houver dados legados incompatíveis, a transação falha sem alterar ou apagar registros.
begin;

do $$
declare
  vinculo record;
  acao_exclusao text;
  indice text;
begin
  for vinculo in
    select fk.conname as nome, filha.relname as filha, coluna.attname as coluna, pai.relname as pai,
           fk.confdeltype as ao_excluir
    from pg_constraint fk
    join pg_class filha on filha.oid = fk.conrelid
    join pg_class pai on pai.oid = fk.confrelid
    join pg_attribute coluna on coluna.attrelid = filha.oid and coluna.attnum = fk.conkey[1]
    join pg_attribute alvo on alvo.attrelid = pai.oid and alvo.attnum = fk.confkey[1]
    where fk.contype = 'f'
      and filha.relnamespace = 'public'::regnamespace and pai.relnamespace = 'public'::regnamespace
      and cardinality(fk.conkey) = 1 and alvo.attname = 'id' and alvo.atttypid = 'uuid'::regtype
      and exists (select 1 from pg_attribute where attrelid = filha.oid and attname = 'user_id'
                  and atttypid = 'uuid'::regtype and attnotnull and not attisdropped)
      and exists (select 1 from pg_attribute where attrelid = pai.oid and attname = 'user_id'
                  and atttypid = 'uuid'::regtype and attnotnull and not attisdropped)
      and fk.confupdtype = 'a' and not fk.condeferrable and fk.confmatchtype = 's'
    order by pai.relname, filha.relname, fk.conname
  loop
    acao_exclusao := case vinculo.ao_excluir
      when 'c' then 'cascade'
      when 'n' then format('set null (%I)', vinculo.coluna)
      when 'a' then 'no action'
      when 'r' then 'restrict'
    end;
    if acao_exclusao is null then
      raise exception 'Ação de exclusão não prevista em %.%', vinculo.filha, vinculo.nome;
    end if;

    indice := vinculo.pai || '_id_user_id_isolamento_idx';
    execute format('create unique index if not exists %I on public.%I (id, user_id)', indice, vinculo.pai);
    execute format('alter table public.%I drop constraint %I', vinculo.filha, vinculo.nome);
    execute format('alter table public.%I add constraint %I foreign key (%I, user_id)
      references public.%I (id, user_id) on delete %s', vinculo.filha, vinculo.nome,
      vinculo.coluna, vinculo.pai, acao_exclusao);
  end loop;
end
$$;

notify pgrst, 'reload schema';
commit;
