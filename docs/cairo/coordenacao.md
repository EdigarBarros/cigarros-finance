# Cairo: coordenação entre os dois Claudes

Dois Claudes, em contas separadas, evoluem o Cairo (`src/cairo/`). Eles **não compartilham contexto**: o que um precisa saber
do outro está aqui e em [`contrato.md`](contrato.md). Atualize este arquivo a cada entrega.

## Quem é dono de quê

| Parte | Dono | Arquivos |
|---|---|---|
| Contrato (tipos, unidades, validação) | Claude 1 (mantém) | `src/cairo/contrato/{tipos,unidades,validar,politicas}.ts`, `docs/cairo/contrato.md` |
| Tipos da decisão | Claude 2 | `src/cairo/contrato/decisao.ts` (criar), regras novas em `politicas.ts` com classe `politica` |
| Dados, aprendizado, previsões, cenários | Claude 1 | `src/cairo/{entrada.ts,index.ts,fatos,qualidade,aprendizado,custos/condicoes.ts,cenarios,previsao,regua}` |
| Custos, planejamento, dívidas, metas, restrições, explicação | Claude 2 | `src/cairo/{custo,decisao,certificado,consequencias}/` (criar) |
| Ponte app → Cairo | Claude 1 | `src/lib/cairo.ts` |
| Testes do núcleo | Claude 1 | `scripts/cairo/` (`testar.mjs`, `casos.ts`, `personas.ts`) |
| Testes de integração (decisão sobre as personas) | Claude 2 | `scripts/cairo/integracao/` (criar), usando `scripts/cairo/personas.ts` |
| Migrações do Cairo | Claude 1 consolida | `supabase/migracao-NN-*.sql` |

**Arquivos compartilhados** (mudança pequena, compatível, depois de conferir o que mudou na produção): `src/lib/analise.ts`,
`src/lib/conselheiro.ts`, `src/lib/planejador.ts`, `src/lib/useDados.ts`, `src/components/Painel.tsx`,
`src/i18n/traducoes.json`, `GPT.md`, `.oxlintrc.json`, `tsconfig*.json`.

## Como o Claude 2 pede algo à parte de dados

Escreva na seção "Pedidos" abaixo: o que precisa, para quê e em que formato. Se for banco, descreva a tabela/coluna e quem
lê e grava; a migração é escrita e numerada pelo Claude 1. Enquanto o pedido não estiver pronto, use fixtures no formato do
contrato (as personas de `scripts/cairo/personas.ts` passam por `lerCairo`).

## Migrações

- Última migração no repositório: **46** (`migracao-46-prazo-das-sessoes.sql`).
- Esta etapa do Cairo **não criou migração**: tudo funciona com o banco atual.
- Próximas, reservadas para o Cairo (números em ordem de pedido; quem precisar pede aqui):
  - 47: versão por linha (`versao`, `alterado_em`) e histórico enxuto nas tabelas que o motor lê (para reproduzir decisões
    e avaliar sem vazamento).
  - 48: eventos da pessoa (declarações, aceites e recusas), só acrescentando linhas, com relógio lógico, para resolver
    conflito entre aparelhos.
  - 49: registro de previsões e decisões (certificado com as entradas por valor) e parâmetros por valor.
- Migração não se aplica sozinha: o dono do projeto roda no Supabase. Código que depende dela só vai para o site depois.

## Ordem de integração

1. Contrato 1.0.0 e a parte de dados no site (esta entrega).
2. Claude 2 consome `analise.cairo` (planejador novo em `src/cairo/decisao/`, rodando ao lado do `lib/planejador.ts`).
3. Testes de integração do Claude 2 sobre as personas.
4. Migrações 47–49 e o registro de previsões (calibração com dados reais).
5. Troca na tela, uma capacidade por vez, cada uma depois de vencer na régua.

Antes de publicar: traga a produção (`claude/practical-mccarthy-qt2qoa`) para o seu branch e resolva conflito preservando o
trabalho do outro. Sem force push.

## Estado

### Entregue pelo Claude 1 (etapa 1, 27/11/2026)

- Núcleo puro `src/cairo/` com checagem estrita, regra de lint e teste de pureza.
- Contrato 1.0.0 (unidades, fato/estimativa/desconhecido, qualidade, fluxos e cenários, condições de custo).
- Ativo no app (muda números do Consultor):
  - meses: o mês bem registrado sem renda entra nas médias; o mês mal lançado e o mês sem como saber da renda saem
    (`analise.ts` e `conselheiro.ts` usam `qualidade/meses.ts`);
  - receber de volta o que emprestou não é mais renda (a regra de `fatos/movimentos.ts` vale nos três motores);
  - juros aprendidos: conferência com a dívida em dia não ensina a regra de atraso;
  - memória do consultor: dois aparelhos juntam o que aprenderam (antes o último a gravar apagava o outro).
- Ativo em segundo plano (`analise.cairo`, nenhuma tela mostra ainda): qualidade, contagem única, aprendizado
  (dia a dia, renda, pontualidade), condições de custo, cenários e previsões.

### Entregue pelo Claude 2 (etapa 1, 27/11/2026)

Detalhe, números e limites em [`decisao.md`](decisao.md).

- Ativo no app: desconto de quitar e de adiantar só pelo juro do contrato (lido de `analise.cairo.condicoes`); desconto
  desconhecido ≠ zero; antecipação `desconhecida` ⇒ mínimo garantido zero; planejador que protege o essencial (política do
  app, abaixo da prioridade da pessoa), reserva o essencial do dia a dia até o próximo dinheiro e depois do fim do horizonte,
  diz a falta mínima e as saídas; "e se" só a partir de `aprendizado.entradas`; parcela nova pelo calendário de caixa;
  estado de cada decisão (recomenda, pergunta, condicional, faltam dados) com premissas e alternativas na tela.
- Mudanças em arquivos compartilhados: `lib/analise.ts` (o Cairo é lido logo depois da agenda, com os mesmos argumentos;
  antes era no fim), `lib/planejador.ts` (campos opcionais), `i18n/traducoes.json`.
- **Desvio do combinado, de propósito:** o código da decisão ficou em `src/lib/decisoes/` (e não em `src/cairo/decisao/`),
  porque mexe no planejador e na análise que já estão na tela e escreve explicação com `tx`. As contas puras
  (`custos.ts`, `taxaImplicita.ts`) podem ir para `src/cairo/custo/` devolvendo `Motivo` numa próxima etapa.
- Testes de integração: `scripts/cairo/integracao/` (personas, `trocarFuturo`, `revelar`). Adaptador
  `Observado` → planejador: `src/lib/decisoes/observado.ts`.

### Revisão do contrato 1.0.0 pelo consumidor (Claude 2)

- Serviu sem mudança: `CondicaoDeCusto` separada por tipo, `antecipacao`, `oferta_quitacao`, `revelar`/`trocarFuturo`,
  `aprendizado.entradas` com quantis e `pesoDoHistorico`.
- Faltou (pedidos abaixo): natureza `essencial` nos fluxos (hoje tudo é `obrigacao`/`dia_a_dia`), o tipo do credor e a ligação
  entre `FonteDeRenda` e a entrada da agenda (hoje casadas pela descrição, em `lib/decisoes/cenarios.ts`).

### Pedidos

Do Claude 2 para o Claude 1 (27/11/2026). Nenhum bloqueia o que está publicado; cada um troca uma inferência por um dado.

1. **Essencial declarado** (banco + contrato). Coluna `categorias.essencial boolean null` (null = a pessoa não disse; o app
   infere pelo nome, como hoje), gravada pela pessoa na tela de categorias. No contrato: fluxos de categoria essencial com
   `natureza: 'essencial'`, e o dia a dia separado em essencial e conforto (o `essencialDia` que o planejador já aceita).
   Quem lê: `lib/analise.ts` (eventos e `essencialDia`), `lib/decisoes/observado.ts`.
2. **"Sem juros" × "não sei"** (banco). Hoje o formulário grava `juros_mes = null` para os dois. Proposta: `dividas.juros_conhecido
   boolean null` (true + `juros_mes` 0 = sem juros confirmado; false = não sei). No contrato: `contratual` com taxa 0 só quando
   confirmado. Quem grava: `components/Formularios.tsx` (`FormDivida`).
3. **Tipo do credor e regra de antecipação** (banco + contrato). `dividas.credor_tipo` ('instituicao' | 'loja' | 'pessoa' | null)
   e, opcional, `dividas.antecipacao` ('desconto_contratual' | 'sem_desconto' | null). Com instituição financeira, a redução
   proporcional dos juros é regra; com pessoa física, não. Isso muda `antecipacao` de 'desconhecida' para algo que o
   planejador possa garantir.
4. **Prioridade da pessoa** (estado entre aparelhos). Uma lista ordenada de contas/dívidas que ela quer pagar primeiro (ou
   "pode esperar"), em `perfis.consultor` ou em tabela de eventos (migração 48). O planejador já aceita `prioridadePessoa`.
5. **Registro das decisões** (migração 49, já reservada). Por decisão mostrada: id estável (`plano:escolha:Luz`), dia,
   `Decisao` (estado, regra, premissas como códigos), as entradas por valor (o que o planejador recebeu) e, depois, o que
   aconteceu (pago em, custo). Sem isso a avaliação fica só nos mundos sintéticos.
6. **Ligação fonte de renda ↔ agenda** (contrato, campo opcional). `Fluxo.fonte?: string` com a `chave` da `FonteDeRenda`,
   para o "e se" não depender de casar descrições.
