-- Migração 6: metas para qualquer objetivo (viagem, reserva, carro…), no lugar da meta fixa em dólar.
-- Supabase > SQL Editor > New query > colar > Run. Só acrescenta; a coluna antiga meta_usd continua lá.

create table if not exists public.metas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  nome        text not null,
  icone       text not null default '🎯',
  cor         text not null default '#9d6bff',
  moeda       text not null default 'BRL',
  alvo        numeric(14, 2) not null check (alvo > 0),
  -- prazo opcional: o app calcula quanto guardar por mês para chegar nele
  prazo       date,
  ordem       integer not null default 0,
  created_at  timestamptz not null default now()
);

-- Cada vez que a pessoa guarda (valor positivo) ou retira (negativo) dinheiro de uma meta, na moeda dela.
create table if not exists public.meta_movimentos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  meta_id     uuid not null references public.metas on delete cascade,
  data        date not null,
  valor       numeric(14, 2) not null check (valor <> 0),
  descricao   text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists meta_movimentos_meta on public.meta_movimentos (meta_id, data);

alter table public.metas enable row level security;
alter table public.meta_movimentos enable row level security;
drop policy if exists "dono" on public.metas;
create policy "dono" on public.metas for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "dono" on public.meta_movimentos;
create policy "dono" on public.meta_movimentos for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- A meta em dólar de antes vira uma meta em USD, já com o dólar que a pessoa tinha guardado.
insert into public.metas (user_id, nome, icone, cor, moeda, alvo)
select distinct on (m.user_id) m.user_id, 'Meta em dólar', '💵', '#63e6e2', 'USD', m.meta_usd
from public.meses m
where m.meta_usd > 0
  and not exists (select 1 from public.metas x where x.user_id = m.user_id and x.nome = 'Meta em dólar')
order by m.user_id, m.ano desc, m.mes desc;

insert into public.meta_movimentos (user_id, meta_id, data, valor, descricao)
select mt.user_id, mt.id, current_date, u.usd, 'Dólar que já estava guardado'
from public.metas mt
join lateral (
  select coalesce((m.moedas ->> 'USD')::numeric, m.usd) as usd
  from public.meses m
  where m.user_id = mt.user_id and coalesce((m.moedas ->> 'USD')::numeric, m.usd) > 0
  order by m.ano desc, m.mes desc
  limit 1
) u on true
where mt.nome = 'Meta em dólar' and mt.moeda = 'USD'
  and not exists (select 1 from public.meta_movimentos x where x.meta_id = mt.id);
