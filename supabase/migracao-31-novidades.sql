-- Migração 31: novidades do app (o pop-up "Tem novidade!" que aparece uma vez depois de uma atualização). Rodável de novo.
-- Supabase > SQL Editor > New query > colar > Run.
--
-- Quem cria, edita e publica é o painel de suporte (repositório painel-opus-cash, tela Novidades), pela chave de serviço.
-- O site e o app só LEEM as publicadas: publicar uma novidade não precisa de versão nova do site nem do app.
-- Textos em três idiomas: {"pt": "...", "en": "...", "es": "..."} (en e es são opcionais; sem eles, vale o pt).
-- Quem já viu: o app guarda "novidade:<id>" em perfis.dispensadas (vale em qualquer aparelho da pessoa).

create table if not exists public.novidades (
  id            bigint generated always as identity primary key,
  titulo        jsonb not null check (jsonb_typeof(titulo) = 'object' and coalesce(titulo->>'pt', '') <> ''),
  -- até 4 itens: [{"icone": "pessoa", "texto": {"pt": "Fale com a gente", "en": "...", "es": "..."}}]
  itens         jsonb not null default '[]'::jsonb check (jsonb_typeof(itens) = 'array' and jsonb_array_length(itens) <= 4),
  icone         text not null default 'estrela' check (icone ~ '^[a-z_]{1,30}$'),
  cor           text not null default 'marca' check (cor in ('marca', 'verde', 'azul', 'violeta', 'amarelo', 'rosa')),
  -- para onde o botão leva: uma página do painel do app ('inicio', 'lancamentos', ...) ou 'configuracoes'; null = só fechar
  tela          text check (tela is null or tela ~ '^[a-z_]{1,30}$'),
  onde          text not null default 'todos' check (onde in ('todos', 'site', 'app')),
  publicada_em  timestamptz,
  criada_em     timestamptz not null default now(),
  atualizada_em timestamptz not null default now()
);
create index if not exists novidades_publicadas on public.novidades (publicada_em desc) where publicada_em is not null;

alter table public.novidades enable row level security;
revoke all on public.novidades from anon, authenticated;
grant select on public.novidades to authenticated;
drop policy if exists "ler publicadas" on public.novidades;
create policy "ler publicadas" on public.novidades for select to authenticated
  using (publicada_em is not null and publicada_em <= now());

notify pgrst, 'reload schema';
