/**
 * Consultor no celular. A proposta do Consultor é montar a própria tela (lib/composicao.ts escolhe a ordem, o desenho e o
 * tamanho de cada descoberta; lib/gosto.ts aprende com o que a pessoa faz), então aqui o celular NÃO impõe cartões nem
 * ordem: só põe o topo colorido com o veredito do próprio Consultor (a nota e o plano de ação) e as ações, e logo abaixo
 * vem a tela que ele montou, com as mesmas peças e na mesma ordem da tela do computador (manchete, o que mudou, agora,
 * próximo passo, objetivo e as faixas, com favoritar, esconder e "outro jeito").
 */
import { useState } from 'react'
import { Icone } from '../../components/Icone'
import { CartaoDoPlanejamento, Planejamento } from '../../components/Planejamento'
import { Interruptor } from '../../components/ui'
import { semMovimento, useMovimento } from '../../lib/tema'
import { tx } from '../../lib/textos'
import { OQueMudou, PlanoDeAcao, useDesdeAUltimaVisita } from '../../pages/Analise'
import { Agora, Objetivo, ProximoPasso, SeuPerfil } from '../../pages/AnaliseTopo'
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
  const ir = (x: { destino?: Parameters<Ctx['irPara']>[0] }) => x.destino && c.irPara(x.destino)
  const [planejando, setPlanejando] = useState(false)
  // os passos do plano que falam do Planejamento (destino 'analise') abrem a mesa em vez de navegar
  const irPara: Ctx['irPara'] = (p) => (p === 'analise' ? setPlanejando(true) : c.irPara(p))

  // ---------- topo: o veredito do próprio Consultor ----------
  const paginas: PaginaDoHero[] = [
    a.nota !== null
      ? { id: 'nota', tom: a.tom === 'bom' ? 'sobra' : a.tom === 'ruim' ? 'falta' : 'dividas', rotulo: tx('Saúde do seu dinheiro'), valor: `${a.nota}/100`, sub: a.rotulo }
      : { id: 'nota', tom: 'invest', rotulo: tx('Saúde do seu dinheiro'), valor: '—', sub: tx('Lance mais um mês e o consultor começa a dar a nota.') },
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

      {c.contaNova ? (
        <section className="cartao an-vazio">
          <span className="an-vazio-icone"><Icone nome="bussola" tamanho={30} /></span>
          <h2>{tx('Seu consultor começa no primeiro lançamento')}</h2>
          <p>{tx('Lance o que entra e o que sai. A cada lançamento, os gráficos se refazem sozinhos.')}</p>
        </section>
      ) : (
        <div className="consultor-movel-tela">
          {/* daqui para baixo, a tela que o Consultor montou: mesmas peças e mesma ordem do computador */}
          <Manchete t={tela} aoIr={ir} />
          <SeuPerfil a={a} nivel={nivel} />
          <OQueMudou reanalise={c.reanalise} desdeAVisita={desdeAVisita} max={nivel === 'detalhado' ? 4 : 2} />
          <Agora a={a} nivel={nivel} />
          <CartaoDoPlanejamento a={a} planejamento={c.planejamento} aoAbrir={() => setPlanejando(true)} />
          {nivel === 'detalhado' ? <PlanoDeAcao a={a} aoIr={irPara} /> : <ProximoPasso a={a} aoIr={irPara} />}
          <Objetivo a={a} memoria={c.memoria} nivel={nivel} aoEscolher={c.escolherObjetivo} />
          <Faixas t={tela} aoIr={ir} nivel={nivel} />
          <footer className="an-rodape">
            <label className="an-avisos">
              <Interruptor ligado={c.avisosDaAnalise} aoMudar={c.mudarAvisosDaAnalise} rotulo={tx('Avisar quando a análise mudar')} />
              <span>{tx('Avisar quando a análise mudar')}</span>
            </label>
            <p>{tx('Orientações de educação financeira, feitas com o que você lançou. Não é recomendação de investimento.')}</p>
          </footer>
        </div>
      )}
      {planejando && (
        <Planejamento a={a} planejamento={c.planejamento} salvar={c.salvarPlanejamento} aoFechar={() => setPlanejando(false)}
          aoLancarEntrada={() => { setPlanejando(false); c.novoLancamento('entrada') }} />
      )}
    </div>
  )
}
