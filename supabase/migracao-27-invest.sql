-- Migração 27: OpusCash Invest (a carteira de investimentos: ativos, operações, preços, importações e o plano).
-- Supabase > SQL Editor > New query > colar > Run. Só acrescenta e pode ser rodada de novo sem problema.
--
-- Até aqui o app guardava só um número por mês (meses.investimentos). Ele continua lá, intocado: é o histórico "não
-- detalhado" de quem já usava. A partir do mês da primeira operação cadastrada aqui, o valor investido passa a sair das
-- operações (o app faz a conta; nada é copiado para meses.investimentos).
--
--   invest_ativos       cada investimento: CDB, Tesouro, ação, fundo imobiliário, ETF, fundo...
--   invest_operacoes    tudo o que aconteceu com ele: aplicação/compra, resgate/venda, provento, juros, amortização, taxa,
--                       desdobramento, grupamento, bonificação, transferência, vencimento e ajuste. É a fonte dos saldos.
--   invest_precos       o que cada ativo valia em cada dia que alguém informou (preço da cota ou saldo da aplicação),
--                       com a fonte e a data de referência. O app nunca inventa preço: sem linha aqui, usa o da última operação.
--   invest_importacoes  cada arquivo importado: de onde veio, quantas linhas entraram e as que ficaram para revisar.
--   invest_config       uma linha por pessoa: o plano (meta, aporte, hipóteses) e o que a tela aprendeu com o uso.
--
-- Sem esta migração o app funciona como antes; a área Invest avisa que falta rodá-la.

create table if not exists public.invest_ativos (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  nome          text not null check (char_length(nome) between 1 and 120),
  -- código de negociação (PETR4, MXRF11) quando tem
  codigo        text check (codigo is null or char_length(codigo) <= 24),
  classe        text not null check (classe in ('renda_fixa', 'acao', 'fii', 'etf', 'fundo', 'internacional', 'previdencia', 'cripto', 'outro')),
  -- cdb, lci, lca, tesouro_selic, tesouro_prefixado, tesouro_ipca, debenture, cri_cra, poupanca...
  subclasse     text check (subclasse is null or char_length(subclasse) <= 40),
  -- true: acompanhado pelo valor aplicado (CDB, Tesouro, previdência); false: por quantidade × preço (ações, FIIs, ETFs)
  por_valor     boolean not null default false,
  instituicao   text check (instituicao is null or char_length(instituicao) <= 80),
  banco_id      uuid references public.bancos on delete set null,
  -- moeda do ativo (null = a moeda principal da pessoa)
  moeda         text check (moeda is null or char_length(moeda) = 3),
  emissor       text check (emissor is null or char_length(emissor) <= 80),
  setor         text check (setor is null or char_length(setor) <= 60),
  -- renda fixa: como rende. 'pre' = taxa em % ao ano; 'cdi' e 'selic' = % do índice (110 = 110% do CDI);
  -- 'ipca' = % ao ano acima da inflação
  indexador     text check (indexador is null or indexador in ('pre', 'cdi', 'selic', 'ipca')),
  taxa          numeric(10, 4) check (taxa is null or (taxa >= 0 and taxa <= 1000)),
  vencimento    date,
  -- quando dá para tirar o dinheiro: todo dia, só no vencimento, ou depois de N dias do pedido
  liquidez      text check (liquidez is null or liquidez in ('diaria', 'vencimento', 'prazo')),
  liquidez_dias integer check (liquidez_dias is null or liquidez_dias between 0 and 3650),
  obs           text check (obs is null or char_length(obs) <= 500),
  created_at    timestamptz not null default now(),
  -- para a operação e o preço só poderem apontar para um ativo da mesma pessoa
  unique (id, user_id)
);
create index if not exists invest_ativos_dono on public.invest_ativos (user_id);

create table if not exists public.invest_importacoes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  arquivo     text not null check (char_length(arquivo) <= 200),
  -- impressão digital do conteúdo: o mesmo arquivo importado de novo é reconhecido
  hash        text not null check (char_length(hash) <= 80),
  formato     text check (formato is null or char_length(formato) <= 60),
  instituicao text check (instituicao is null or char_length(instituicao) <= 80),
  linhas      integer not null default 0,
  importadas  integer not null default 0,
  repetidas   integer not null default 0,
  -- linhas que o app não conseguiu entender ou que a pessoa deixou para depois: ficam aqui até serem resolvidas
  pendentes   jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists invest_importacoes_dono on public.invest_importacoes (user_id, created_at);

create table if not exists public.invest_operacoes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  ativo_id      uuid not null,
  tipo          text not null check (tipo in ('compra', 'venda', 'provento', 'juros', 'amortizacao', 'taxa', 'imposto',
                  'desdobramento', 'grupamento', 'bonificacao', 'transferencia', 'vencimento', 'ajuste')),
  -- dividendo, jcp, rendimento... (só para provento)
  subtipo       text check (subtipo is null or char_length(subtipo) <= 40),
  data          date not null,
  quantidade    numeric(24, 8),
  preco         numeric(24, 8) check (preco is null or preco >= 0),
  -- valor bruto da operação, na moeda do ativo
  valor         numeric(16, 2) not null default 0,
  -- corretagem, emolumentos e outras taxas da operação
  custos        numeric(16, 2) not null default 0 check (custos >= 0),
  -- imposto retido na operação (IR, IOF)
  impostos      numeric(16, 2) not null default 0 check (impostos >= 0),
  -- desdobramento e grupamento: por quanto a quantidade é multiplicada (2 = cada 1 vira 2; 0.1 = cada 10 viram 1)
  fator         numeric(16, 8) check (fator is null or fator > 0),
  moeda         text check (moeda is null or char_length(moeda) = 3),
  -- quanto valia 1 da moeda do ativo na moeda principal no dia (null = moeda principal, ou cotação não informada)
  cotacao       numeric(18, 8) check (cotacao is null or cotacao > 0),
  -- conta de onde o dinheiro saiu ou para onde foi
  banco_id      uuid references public.bancos on delete set null,
  -- true quando o app já acertou o saldo dessa conta em Dinheiro guardado (para desfazer certinho ao editar ou apagar)
  mexe_saldo    boolean not null default false,
  -- provento que a pessoa quis ver também como entrada do mês
  lancamento_id uuid references public.lancamentos on delete set null,
  -- de onde veio o registro: digitado, de um arquivo, ou da posição informada por um arquivo
  origem        text not null default 'manual' check (origem in ('manual', 'importacao', 'posicao')),
  importacao_id uuid references public.invest_importacoes on delete set null,
  -- identifica a operação dentro do arquivo de origem: a mesma linha importada duas vezes dá a mesma chave
  chave         text check (chave is null or char_length(chave) <= 120),
  obs           text check (obs is null or char_length(obs) <= 500),
  created_at    timestamptz not null default now(),
  -- preenchido quando a operação é corrigida depois de criada
  atualizado_em timestamptz,
  foreign key (ativo_id, user_id) references public.invest_ativos (id, user_id) on delete cascade
);
create index if not exists invest_operacoes_ativo on public.invest_operacoes (ativo_id, data);
create index if not exists invest_operacoes_dono on public.invest_operacoes (user_id, data);
-- importar o mesmo arquivo duas vezes não duplica: a segunda tentativa bate nesta regra
create unique index if not exists invest_operacoes_chave on public.invest_operacoes (user_id, chave) where chave is not null;

create table if not exists public.invest_precos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  ativo_id    uuid not null,
  -- o dia a que o valor se refere
  data        date not null,
  -- 'preco': valor de 1 cota/ação; 'saldo': quanto a aplicação inteira valia nesse dia
  natureza    text not null check (natureza in ('preco', 'saldo')),
  valor       numeric(24, 8) not null check (valor >= 0),
  moeda       text check (moeda is null or char_length(moeda) = 3),
  -- quem disse esse valor: a pessoa, um arquivo importado, ou um serviço de cotações (quando houver)
  fonte       text not null default 'manual' check (char_length(fonte) <= 40),
  -- quando o valor foi obtido
  referencia  timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  foreign key (ativo_id, user_id) references public.invest_ativos (id, user_id) on delete cascade,
  unique (ativo_id, data, natureza)
);
create index if not exists invest_precos_dono on public.invest_precos (user_id);

create table if not exists public.invest_config (
  user_id    uuid primary key default auth.uid() references auth.users on delete cascade,
  -- meta de patrimônio, aporte planejado, hipóteses das projeções e o que a pessoa disse sobre si
  plano      jsonb not null default '{}'::jsonb,
  -- o que a tela aprendeu com o uso (mesmo formato do gosto do Consultor)
  gosto      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Mesma regra das outras tabelas de dados (migração 20): só o dono, e só com acesso.
do $$
declare t text;
begin
  foreach t in array array['invest_ativos', 'invest_operacoes', 'invest_precos', 'invest_importacoes', 'invest_config'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "dono" on public.%I', t);
    if to_regprocedure('public.tem_acesso()') is not null then
      execute format('create policy "dono" on public.%I for all to authenticated
        using (user_id = (select auth.uid()) and (select public.tem_acesso()))
        with check (user_id = (select auth.uid()) and (select public.tem_acesso()))', t);
    else
      execute format('create policy "dono" on public.%I for all to authenticated
        using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
