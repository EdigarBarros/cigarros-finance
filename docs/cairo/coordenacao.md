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

### Pedidos

(nenhum ainda)
