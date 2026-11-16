/**
 * Invest no celular: o topo desliza entre o valor da carteira (com o resultado), o que foi aportado e os proventos. Ações:
 * aplicar, novo investimento, atualizar valores e importar. Embaixo, as mesmas quatro abas da tela do computador (visão
 * geral, carteira, análises e planejamento), com as mesmas peças e janelas (`useInvestTela` em pages/Invest.tsx). A aba
 * Análises continua montada pelo próprio analista (o mesmo compositor do Consultor), sem ordem imposta pelo celular.
 */
import { Icone } from '../../components/Icone'
import { fmtValor } from '../../lib/format'
import { useMovimento } from '../../lib/tema'
import { tx } from '../../lib/textos'
import { ABAS, useInvestTela } from '../../pages/Invest'
import { Analises } from '../../pages/invest/Analises'
import { Carteira, DetalheDoAtivo } from '../../pages/invest/Carteira'
import { Planejamento } from '../../pages/invest/Planejamento'
import { VisaoGeral } from '../../pages/invest/VisaoGeral'
import type { Ctx } from '../../pages/contexto'
import { BotoesDeAcao, CartaoWidget, HeroDeslizante, type Acao, type PaginaDoHero } from '../primitivas'
import type { Tom } from '../tom'
import '../../pages/analise.css'
import '../../pages/invest.css'

export function InvestMovel({ c, aoMudarTom }: { c: Ctx; aoMudarTom: (t: Tom, cor?: string) => void }) {
  const inv = c.invest
  const k = inv.c
  const movimento = useMovimento()
  const { aba, abrirAba, ativoAberto, acoes, janelasAbertas } = useInvestTela(c)
  const temCarteira = !inv.d.semTabela && inv.d.carregado && inv.d.ativos.length > 0

  // ---------- topo: a carteira, o aportado e os proventos ----------
  const paginas: PaginaDoHero[] = temCarteira ? [
    {
      id: 'carteira', tom: 'invest', rotulo: tx('Seus investimentos'), valor: fmtValor(k.valor),
      sub: k.resultado >= 0 ? tx('Rendeu {0} até hoje', fmtValor(k.resultado)) : tx('Perdeu {0} até hoje', fmtValor(-k.resultado)),
    },
    { id: 'aportado', tom: 'guardado', rotulo: tx('Você aportou'), valor: fmtValor(k.aportadoLiquido), sub: tx('o que você pôs, menos o que tirou') },
    ...(k.proventos > 0 ? [{ id: 'proventos', tom: 'sobra' as const, rotulo: tx('Proventos recebidos'), valor: fmtValor(k.proventos), sub: tx('dividendos, juros e rendimentos pagos') }] : []),
  ] : [{ id: 'carteira', tom: 'invest', rotulo: tx('Seus investimentos'), valor: fmtValor(0), sub: tx('Comece pelo primeiro investimento') }]
  const acoesTopo: Acao[] = temCarteira ? [
    { id: 'aplicar', icone: 'mais', rotulo: tx('Aplicar'), acao: () => acoes.novaOperacao() },
    { id: 'novo', icone: 'investir', rotulo: tx('Novo'), acao: acoes.novoAtivo },
    { id: 'valores', icone: 'trocar', rotulo: tx('Valores'), acao: () => acoes.atualizarValores() },
    { id: 'importar', icone: 'importar', rotulo: tx('Importar'), acao: acoes.importar },
  ] : [
    { id: 'novo', icone: 'mais', rotulo: tx('Cadastrar'), acao: acoes.novoAtivo },
    { id: 'importar', icone: 'importar', rotulo: tx('Importar'), acao: acoes.importar },
  ]
  const pendentes = inv.d.importacoes.reduce((a, i) => a + i.pendentes.length, 0)
  const aberto = ativoAberto ? k.posicoes.find((p) => p.ativo.id === ativoAberto) : undefined

  return (
    <div className={`pagina analise pg-invest invest-movel ${movimento === 'reduzido' ? 'parado' : ''}`}>
      <HeroDeslizante paginas={paginas} aoMudar={(p) => aoMudarTom(p.tom)} />
      <BotoesDeAcao acoes={acoesTopo} />

      {inv.d.semTabela ? (
        <CartaoWidget titulo={tx('Invest')}>
          <p className="widget-vazio">{tx('Para usar o Invest, falta atualizar o banco de dados: rode')} <code>supabase/migracao-28-invest.sql</code> {tx('no SQL Editor do Supabase.')}</p>
        </CartaoWidget>
      ) : !inv.d.carregado ? (
        <section className="cartao inv-carregando" aria-busy="true"><span className="inv-carregando-barra" /><span>{tx('Abrindo a sua carteira…')}</span></section>
      ) : !temCarteira ? (
        <CartaoWidget titulo={tx('Comece pelo primeiro investimento')}>
          <p className="widget-nota">{tx('Cadastre um CDB, um título do Tesouro, uma ação ou um fundo e registre o que você aplicou. Daí em diante o app acompanha quanto vale, quanto rendeu de verdade e o que vem pela frente.')}</p>
          <p className="widget-nota">{tx('É para acompanhar e entender. O OpusCash não compra, não vende e não recomenda investimentos.')}</p>
        </CartaoWidget>
      ) : (
        <div className="invest-movel-tela">
          {!aberto && (
            <nav className="inv-abas" role="tablist" aria-label={tx('Seções do Invest')}>
              {ABAS.map((a) => (
                <button key={a.id} role="tab" aria-selected={aba === a.id} className={aba === a.id ? 'ativo' : ''} onClick={() => abrirAba(a.id)}>
                  <Icone nome={a.icone} tamanho={16} /> <span>{a.nome()}</span>
                </button>
              ))}
            </nav>
          )}
          {pendentes > 0 && !aberto && (
            <div className="alerta inv-aviso" role="status">
              <span>{pendentes === 1 ? tx('1 linha de um arquivo importado ficou para você revisar.') : tx('{0} linhas de arquivos importados ficaram para você revisar.', pendentes)}</span>
              <button className="link" onClick={acoes.pendencias}>{tx('Revisar')}</button>
            </div>
          )}
          {aberto
            ? <DetalheDoAtivo c={c} p={aberto} acoes={acoes} />
            : aba === 'geral' ? <VisaoGeral c={c} acoes={acoes} />
              : aba === 'carteira' ? <Carteira c={c} acoes={acoes} />
                : aba === 'analises' ? <Analises c={c} acoes={acoes} />
                  : <Planejamento c={c} acoes={acoes} />}
          <p className="inv-rodape">{tx('O Invest serve para acompanhar e entender os seus investimentos. Não é recomendação de compra ou venda, e projeções não são garantia de resultado.')}</p>
        </div>
      )}
      {janelasAbertas}
    </div>
  )
}
