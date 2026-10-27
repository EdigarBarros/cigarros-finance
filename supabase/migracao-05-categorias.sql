-- Migração 5: categorias que cada pessoa cria, renomeia e apaga (antes eram 4 fixas).
-- Supabase > SQL Editor > New query > colar > Run. Só acrescenta; a coluna antiga "categoria" continua lá.

create table if not exists public.categorias (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  tipo        text not null check (tipo in ('entrada', 'saida')),
  nome        text not null,
  icone       text not null default '🏷️',
  cor         text not null default '#8a8a96',
  -- 'divida': as saídas nesta categoria podem abater uma dívida
  papel       text check (papel in ('divida')),
  ordem       integer not null default 0,
  created_at  timestamptz not null default now()
);
create unique index if not exists categorias_user_nome on public.categorias (user_id, tipo, lower(nome));

alter table public.lancamentos add column if not exists categoria_id uuid references public.categorias on delete set null;
create index if not exists lancamentos_categoria on public.lancamentos (categoria_id) where categoria_id is not null;

alter table public.categorias enable row level security;
drop policy if exists "dono" on public.categorias;
create policy "dono" on public.categorias for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Categorias com que toda conta começa. O app chama na primeira vez (sem categorias ainda).
-- Roda com as permissões de quem chama: as regras acima impedem criar categorias para outra pessoa.
create or replace function public.criar_categorias_padrao(dono uuid default auth.uid())
returns void language sql security invoker set search_path = public as $$
  insert into public.categorias (user_id, tipo, nome, icone, cor, papel, ordem)
  select dono, c.tipo, c.nome, c.icone, c.cor, c.papel, c.ordem
  from (values
    ('saida', 'Alimentação', '🍽️', '#ff9f0a', null, 1),
    ('saida', 'Moradia', '🏠', '#64d2ff', null, 2),
    ('saida', 'Transporte', '🚗', '#0a84ff', null, 3),
    ('saida', 'Saúde', '💊', '#ff6b6b', null, 4),
    ('saida', 'Educação', '📚', '#5e5ce6', null, 5),
    ('saida', 'Lazer', '🎉', '#ff375f', null, 6),
    ('saida', 'Assinaturas', '📺', '#bf5af2', null, 7),
    ('saida', 'Compras', '🛍️', '#ff79c6', null, 8),
    ('saida', 'Cuidados pessoais', '💇', '#e040e0', null, 9),
    ('saida', 'Pets', '🐾', '#a2845e', null, 10),
    ('saida', 'Impostos e taxas', '🧾', '#8e8e93', null, 11),
    ('saida', 'Dívidas e parcelas', '💳', '#ffd60a', 'divida', 12),
    ('saida', 'Outros', '📦', '#636366', null, 13),
    ('entrada', 'Salário', '💼', '#30d158', null, 1),
    ('entrada', 'Renda extra', '🧑‍💻', '#63e6e2', null, 2),
    ('entrada', 'Vendas', '🏷️', '#2dd4bf', null, 3),
    ('entrada', 'Rendimentos', '📈', '#bf5af2', null, 4),
    ('entrada', 'Presentes e ajuda', '🎁', '#ff79c6', null, 5),
    ('entrada', 'Outros', '📦', '#636366', null, 6)
  ) as c (tipo, nome, icone, cor, papel, ordem)
  where dono is not null
    and not exists (
      select 1 from public.categorias x where x.user_id = dono and x.tipo = c.tipo and lower(x.nome) = lower(c.nome)
    );
$$;
revoke execute on function public.criar_categorias_padrao(uuid) from anon;

-- Contas que já existem: ganham as categorias padrão e os lançamentos passam para elas.
do $$
declare u uuid;
begin
  for u in select distinct user_id from public.lancamentos
           union select user_id from public.perfis loop
    if not exists (select 1 from public.categorias where user_id = u) then
      perform public.criar_categorias_padrao(u);
    end if;
  end loop;
end $$;

update public.lancamentos l set categoria_id = c.id
from public.categorias c
where l.categoria_id is null and c.user_id = l.user_id and c.tipo = l.tipo
  and lower(c.nome) = case
    when l.tipo = 'entrada' then 'outros'
    when l.categoria = 'alimentacao' then 'alimentação'
    when l.categoria = 'transporte' then 'transporte'
    when l.categoria = 'divida' then 'dívidas e parcelas'
    else 'outros'
  end;
