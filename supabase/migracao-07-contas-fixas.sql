-- ATENÇÃO: NÃO rode esta migração de novo depois da migração 12. Ela apaga a política "dono" de contas_fixas e a recria SEM
-- tem_acesso(), e o bloqueio de quem não pagou deixa de valer no banco. Se rodar, rode a migração 20 logo em seguida.
-- Migração 7: contas fixas e a pagar (aluguel, luz, internet, salário…): o que se repete todo mês.
-- Supabase > SQL Editor > New query > colar > Run. Só acrescenta; pode rodar mais de uma vez.
-- Precisa das migrações 3 (bancos) e 5 (categorias) já rodadas.

create table if not exists public.contas_fixas (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  tipo          text not null check (tipo in ('entrada', 'saida')),
  descricao     text not null,
  -- valor de costume; ao dar baixa a pessoa pode trocar (a conta de luz muda)
  valor         numeric(14, 2) not null check (valor > 0),
  categoria_id  uuid references public.categorias on delete set null,
  banco_id      uuid references public.bancos on delete set null,
  -- dia do vencimento (ou do recebimento); em mês mais curto vale o último dia
  dia           smallint not null check (dia between 1 and 31),
  -- primeiro e último mês em que vale (sempre o dia 1 do mês); sem fim, continua para sempre
  inicio        date not null,
  fim           date,
  ativa         boolean not null default true,
  created_at    timestamptz not null default now(),
  check (fim is null or fim >= inicio)
);
create index if not exists contas_fixas_user on public.contas_fixas (user_id);

-- A baixa ("Paguei" / "Recebi") é um lançamento comum ligado à conta fixa.
-- Se a conta for apagada, o lançamento continua existindo, só deixa de estar ligado a ela.
alter table public.lancamentos add column if not exists conta_fixa_id uuid references public.contas_fixas on delete set null;
-- no máximo uma baixa por conta em cada mês
create unique index if not exists lancamentos_conta_fixa_mes on public.lancamentos (conta_fixa_id, ano, mes) where conta_fixa_id is not null;

alter table public.contas_fixas enable row level security;
drop policy if exists "dono" on public.contas_fixas;
create policy "dono" on public.contas_fixas for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
