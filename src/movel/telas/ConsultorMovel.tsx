/**
 * Consultor no celular. A proposta do Consultor é montar a própria tela (lib/composicao.ts escolhe a ordem, o desenho e o
 * tamanho de cada descoberta; lib/gosto.ts aprende com o que a pessoa faz), então aqui o celular NÃO impõe cartões nem
 * ordem: só põe o topo colorido com o veredito do próprio Consultor (a nota e o plano de ação) e as ações, e logo abaixo
 * vem a tela que ele montou, com as mesmas peças e na mesma ordem da tela do computador (manchete, o que mudou, agora,
 * próximo passo, objetivo e as faixas, com favoritar, esconder e "outro jeito").
 */
import { useState } from 'react'
import { faturaDoDestino } from '../../lib/faturasAPagar'
import { CartaoDoPlanejamento, Planejamento } from '../../components/Planejamento'
import { Interruptor } from '../../components/ui'
import { semMovimento, useMovimento } from '../../lib/tema'
import { tx } from '../../lib/textos'
import { InterruptorDoKairo, OQueMudou, PlanoDeAcao, useDesdeAUltimaVisita, useHumorDoKairo, useMontagem, usePlanejarAoAbrir } from '../../pages/Analise'
import { Kairo, KairoMarca } from '../../components/Kairo'
import { Agora, JeitoDeFalar, Objetivo, ProximoPasso, SeuPerfil } from '../../pages/AnaliseTopo'
import { Faixas, Manchete, useTelaViva } from '../../pages/AnaliseTela'
import type { Ctx } from '../../pages/contexto'
import '../../pages/analise.css'
import { BotoesDeAcao, HeroDeslizante, type Acao, type PaginaDoHero } from '../primitivas'
import type { Tom } from '../tom'

/** Leva a tela até uma parte do Consultor (o plano, o objetivo). */
const irAte = (seletor: string) => document.querySelector(seletor)?.scrollIntoView({ block: 'start', behavior: semMovimento() ? 'auto' : 'smooth' })

export function ConsultorMovel({ c, aoMudarTom }: { c: Ctx; aoMudarTom: (t: Tom, cor?: string) => void }) {
  const a = c.analise
  const nivel = c.perfil.detalhe
  const movimento = useMovimento()
  const desdeAVisita = useDesdeAUltimaVisita(c.idUsuario, a)
  // a tela que o Consultor monta (a mesma da aba do computador): o gosto é lido na abertura e gravado ao sair
  const tela = useTelaViva(c, a)
  // depois de uma mudança, a tela se monta ao vivo (pages/Analise.tsx, useMontagem)
  const montando = useMontagem(c.reanalise, desdeAVisita) && !c.contaNova
  const ir = (x: { destino?: Parameters<Ctx['irPara']>[0] }) => x.destino && c.irPara(x.destino)
  const [planejando, setPlanejando] = useState(false)
  // os passos do plano que falam do Planejamento (destino 'analise') abrem a mesa em vez de navegar
  const irPara: Ctx['irPara'] = (p) => (p === 'analise' ? setPlanejando(true) : c.irPara(p))
  usePlanejarAoAbrir(c, setPlanejando)
  const humor = useHumorDoKairo(c)
  const pl = a.planoDoMes

  // ---------- topo: o veredito do próprio Consultor ----------
  const paginas: PaginaDoHero[] = [
    a.nota !== null
      ? { id: 'nota', tom: a.tom === 'bom' ? 'sobra' : a.tom === 'ruim' ? 'falta' : 'dividas', rotulo: tx('Saúde do seu dinheiro'), valor: `${a.nota}/100`, sub: a.rotulo }
      : { id: 'nota', tom: 'invest', rotulo: tx('Saúde do seu dinheiro'), valor: '—', sub: tx('Lance mais um mês e o consultor começa a dar a nota.') },
    // o plano do mês que a pessoa montou (ou o convite para montar), logo depois da nota
    ...(a.quadros ? [{
      id: 'planejar', tom: (pl?.placar.fechado ? 'sobra' : 'invest') as Tom, rotulo: tx('Seu plano do mês'),
      valor: pl ? tx('{0}% com dinheiro', pl.placar.pct) : tx('Sem plano'),
      sub: pl?.proximo ? tx('Próximo: {0}', pl.proximo.pagar.map((x) => x.nome).slice(0, 2).join(', ')) : tx('Diga com qual dinheiro sai cada conta.'),
      pilula: { texto: pl ? tx('Abrir o plano') : tx('Planejar o mês'), acao: () => setPlanejando(true) },
    }] : []),
    ...(a.acoes.length ? [{
      id: 'plano', tom: 'invest' as const, rotulo: tx('Seu plano de ação'),
      valor: a.acoes.length === 1 ? tx('1 passo') : tx('{0} passos', a.acoes.length), sub: a.acoes[0].titulo,
      pilula: { texto: tx('Ver o plano'), acao: () => irAte('.consultor-movel .an-plano, .consultor-movel .an-passo') },
    }] : []),
  ]
  const acoes: Acao[] = c.contaNova ? [
    { id: 'lancar', icone: 'mais', rotulo: tx('Lançar'), acao: () => c.novoLancamento('saida') },
    { id: 'importar', icone: 'relatorio', rotulo: tx('Importar'), acao: c.importarExtrato },
  ] : [
    { id: 'planejar', icone: 'calendario', rotulo: tx('Planejar'), acao: () => setPlanejando(true) },
    { id: 'plano', icone: 'ideia', rotulo: tx('Plano'), acao: () => irAte('.consultor-movel .an-plano, .consultor-movel .an-passo') },
    { id: 'objetivo', icone: 'meta', rotulo: tx('Objetivo'), acao: () => irAte('.consultor-movel .an-obj, .consultor-movel .an-obj-faixa') },
    { id: 'avisos', icone: 'sino', rotulo: c.avisosDaAnalise ? tx('Avisos ligados') : tx('Avisos desligados'), acao: () => c.mudarAvisosDaAnalise(!c.avisosDaAnalise) },
  ]

  return (
    <div className={`pagina analise an-${nivel} consultor-movel ${movimento === 'reduzido' ? 'parado' : ''}`}>
      <HeroDeslizante paginas={paginas} aoMudar={(p) => aoMudarTom(p.tom)} />
      <BotoesDeAcao acoes={acoes} />
      <div className="an-kairo-faixa">
        <Kairo humor={montando ? 'pensando' : humor} tamanho={46} vivo flutua />
        <span>
          <KairoMarca sub={false} />
          <small>{c.contaNova ? tx('Ele começa a pensar no primeiro lançamento.') : a.resumo[0] ?? tx('Estou de olho nos seus números.')}</small>
        </span>
      </div>

      {c.contaNova ? (
        <section className="cartao an-vazio">
          <span className="an-vazio-kairo"><Kairo humor="calmo" tamanho={64} vivo flutua sombra /></span>
          <h2>{tx('O Kairo começa no primeiro lançamento')}</h2>
          <p>{tx('Lance o que entra e o que sai. A cada lançamento, os gráficos se refazem sozinhos.')}</p>
        </section>
      ) : (
        <div className={`consultor-movel-tela ${montando ? 'montando' : ''}`}>
          {montando && <span className="an-varredura" aria-hidden="true" />}
          {/* daqui para baixo, a tela que o Consultor montou: mesmas peças e mesma ordem do computador */}
          {montando && <OQueMudou reanalise={c.reanalise} desdeAVisita={desdeAVisita} max={nivel === 'detalhado' ? 4 : 3} aoVivo />}
          <CartaoDoPlanejamento a={a} planejamento={c.planejamento} aoAbrir={() => setPlanejando(true)} />
          <Manchete t={tela} aoIr={ir} />
          <SeuPerfil a={a} nivel={nivel} />
          {!montando && <OQueMudou reanalise={c.reanalise} desdeAVisita={desdeAVisita} max={nivel === 'detalhado' ? 4 : 2} />}
          <Agora a={a} nivel={nivel} />
          {nivel === 'detalhado' ? <PlanoDeAcao a={a} aoIr={irPara} /> : <ProximoPasso a={a} aoIr={irPara} />}
          <Objetivo a={a} memoria={c.memoria} nivel={nivel} aoEscolher={c.escolherObjetivo} />
          <JeitoDeFalar a={a} aoEscolher={c.escolherFirmeza} />
          <Faixas t={tela} aoIr={ir} nivel={nivel} />
          <footer className="an-rodape">
            <label className="an-avisos">
              <Interruptor ligado={c.avisosDaAnalise} aoMudar={c.mudarAvisosDaAnalise} rotulo={tx('Avisar quando a análise mudar')} />
              <span>{tx('Avisar quando a análise mudar')}</span>
            </label>
            <InterruptorDoKairo c={c} />
            <p>{tx('Orientações de educação financeira, feitas com o que você lançou. Não é recomendação de investimento.')}</p>
          </footer>
        </div>
      )}
      {planejando && (
        <Planejamento a={a} planejamento={c.planejamento} salvar={c.salvarPlanejamento} aoFechar={() => setPlanejando(false)}
          aoLancarEntrada={() => { setPlanejando(false); c.novoLancamento('entrada') }}
          faturaDe={(d) => faturaDoDestino(c.faturasAPagar, d)}
          aoPagarFatura={(chave) => { setPlanejando(false); c.pagarFatura(chave, undefined, () => setPlanejando(true)) }} />
      )}
    </div>
  )
}
