/**
 * OpusCash Invest: a área de investimentos (veja docs/arquitetura-do-painel.md, seção 4.22).
 *
 * Quatro abas sobre os mesmos dados (lib/useInvest.ts, refeitos a cada operação):
 *  - **Visão geral**: quanto há investido, quanto foi aportado, o resultado, a evolução e o que vem pela frente;
 *  - **Carteira**: cada investimento, com filtros, o detalhe de cada um e as operações;
 *  - **Análises**: as descobertas do analista (lib/invest/descobertas.ts), montadas pelo mesmo compositor do Consultor;
 *  - **Planejamento**: meta, aportes, cenários e renda dos investimentos.
 *
 * A página só guarda o que está aberto (a aba, o ativo, a janela); as contas vêm prontas do contexto (`c.invest`).
 */
import { lazy, Suspense, useState } from 'react'
import type { Achado } from '../lib/achados'
import { fmtValor, mesEAno } from '../lib/format'
import { legadoDigitado } from '../lib/invest/saldos'
import type { Ativo, LinhaPendente, Operacao, TipoOperacao } from '../lib/invest/tipos'
import { useMovimento } from '../lib/tema'
import { tx } from '../lib/textos'
import { Icone } from '../components/Icone'
import { Cartao, Vazio } from '../components/ui'
import type { Ctx } from './contexto'
import type { AcoesInvest, Aba } from './invest/apoio'
import { Analises } from './invest/Analises'
import { Carteira, DetalheDoAtivo } from './invest/Carteira'
import { Planejamento } from './invest/Planejamento'
import { VisaoGeral } from './invest/VisaoGeral'
import './analise.css'
import './invest.css'

const janelas = () => import('./invest/Janelas')
const FormAtivo = lazy(() => janelas().then((m) => ({ default: m.FormAtivo })))
const FormOperacao = lazy(() => janelas().then((m) => ({ default: m.FormOperacao })))
const AtualizarValores = lazy(() => janelas().then((m) => ({ default: m.AtualizarValores })))
const FormPlano = lazy(() => janelas().then((m) => ({ default: m.FormPlano })))
const PorQue = lazy(() => janelas().then((m) => ({ default: m.PorQue })))
const importacao = () => import('./invest/Importar')
const ImportarArquivo = lazy(() => importacao().then((m) => ({ default: m.ImportarArquivo })))
const Pendencias = lazy(() => importacao().then((m) => ({ default: m.Pendencias })))

type Janela =
  | { tipo: 'ativo'; ativo?: Ativo }
  | { tipo: 'operacao'; op?: Operacao; ativoId?: string; tipoInicial?: TipoOperacao; pendente?: { importacaoId: string; linha: LinhaPendente } }
  | { tipo: 'valores'; ativoId?: string }
  | { tipo: 'importar' }
  | { tipo: 'pendencias' }
  | { tipo: 'plano' }
  | { tipo: 'porque'; achado: Achado }

const ABAS: { id: Aba; nome: () => string; icone: string }[] = [
  { id: 'geral', nome: () => tx('Visão geral'), icone: 'inicio' },
  { id: 'carteira', nome: () => tx('Carteira'), icone: 'carteira' },
  { id: 'analises', nome: () => tx('Análises'), icone: 'ideia' },
  { id: 'plano', nome: () => tx('Planejamento'), icone: 'meta' },
]

const abaGuardada = (): Aba => {
  try {
    const a = sessionStorage.getItem('opuscash-invest-aba') as Aba | null
    return ABAS.some((x) => x.id === a) ? a! : 'geral'
  } catch { return 'geral' }
}

export function Invest(c: Ctx) {
  const inv = c.invest
  const [aba, setAba] = useState<Aba>(abaGuardada)
  const [ativoAberto, setAtivoAberto] = useState<string | null>(null)
  const [janela, setJanela] = useState<Janela | null>(null)
  const movimento = useMovimento()
  const abrirAba = (a: Aba) => {
    setAba(a)
    setAtivoAberto(null)
    try { sessionStorage.setItem('opuscash-invest-aba', a) } catch { /* sem armazenamento */ }
    window.scrollTo({ top: 0 })
  }
  const acoes: AcoesInvest = {
    abrirAba,
    abrirAtivo: (id) => { setAtivoAberto(id); if (id) setAba('carteira'); window.scrollTo({ top: 0 }) },
    novoAtivo: () => setJanela({ tipo: 'ativo' }),
    editarAtivo: (ativo) => setJanela({ tipo: 'ativo', ativo }),
    novaOperacao: (o) => setJanela({ tipo: 'operacao', ativoId: o?.ativoId, tipoInicial: o?.tipo, pendente: o?.pendente }),
    editarOperacao: (op) => setJanela({ tipo: 'operacao', op }),
    atualizarValores: (ativoId) => setJanela({ tipo: 'valores', ativoId }),
    importar: () => setJanela({ tipo: 'importar' }),
    pendencias: () => setJanela({ tipo: 'pendencias' }),
    editarPlano: () => setJanela({ tipo: 'plano' }),
    explicar: (achado) => setJanela({ tipo: 'porque', achado }),
    ir: (destino) => {
      const [tipo, alvo] = destino.split(':')
      if (tipo === 'aba') abrirAba(alvo as Aba)
      else if (tipo === 'ativo') { setJanela(null); setAtivoAberto(alvo); setAba('carteira'); window.scrollTo({ top: 0 }) }
      else if (alvo === 'precos') setJanela({ tipo: 'valores' })
      else if (alvo === 'pendencias') setJanela({ tipo: 'pendencias' })
      else if (alvo === 'plano') setJanela({ tipo: 'plano' })
    },
  }
  const fechar = () => setJanela(null)
  const legado = legadoDigitado(c.d.meses)
  const topo = (sub: string, comAcoes: boolean) => (
    <header className="pagina-topo">
      <div>
        <h1>{tx('Invest')}</h1>
        <p className="sub">{sub}</p>
      </div>
      {comAcoes && (
        <div className="inv-topo-acoes">
          <button className="btn" onClick={acoes.importar}><Icone nome="importar" tamanho={16} /> {tx('Importar arquivo')}</button>
          <button className="btn primario" onClick={acoes.novoAtivo}><Icone nome="mais" tamanho={16} /> {tx('Novo investimento')}</button>
        </div>
      )}
    </header>
  )
  const janelasAbertas = (
    <Suspense fallback={null}>
      {janela?.tipo === 'ativo' && <FormAtivo c={c} ativo={janela.ativo} aoFechar={fechar}
        aoCriar={(a) => setJanela({ tipo: 'operacao', ativoId: a.id })} aoExcluir={() => { fechar(); setAtivoAberto(null) }} />}
      {janela?.tipo === 'operacao' && <FormOperacao key={janela.op?.id ?? janela.ativoId ?? 'nova'} c={c} op={janela.op} ativoId={janela.ativoId} tipoInicial={janela.tipoInicial}
        pendente={janela.pendente} aoFechar={() => (janela.pendente ? setJanela({ tipo: 'pendencias' }) : fechar())} aoNovoAtivo={acoes.novoAtivo} />}
      {janela?.tipo === 'valores' && <AtualizarValores c={c} ativoId={janela.ativoId} aoFechar={fechar} />}
      {janela?.tipo === 'importar' && <ImportarArquivo c={c} aoFechar={fechar} aoVerPendencias={acoes.pendencias} />}
      {janela?.tipo === 'pendencias' && <Pendencias c={c} aoFechar={fechar} acoes={acoes} />}
      {janela?.tipo === 'plano' && <FormPlano c={c} legado={legado} aoFechar={fechar} />}
      {janela?.tipo === 'porque' && <PorQue achado={janela.achado} aoFechar={fechar} aoIr={(d) => { fechar(); acoes.ir(d) }} />}
    </Suspense>
  )

  if (inv.d.semTabela) {
    return (
      <div className="pagina">
        {topo(tx('A sua carteira de investimentos.'), false)}
        <Cartao><Vazio>{tx('Para usar o Invest, falta atualizar o banco de dados: rode')} <code>supabase/migracao-28-invest.sql</code> {tx('no SQL Editor do Supabase.')}</Vazio></Cartao>
      </div>
    )
  }
  if (!inv.d.carregado) {
    return (
      <div className="pagina">
        {topo(tx('A sua carteira de investimentos.'), false)}
        <section className="cartao inv-carregando" aria-busy="true"><span className="inv-carregando-barra" /><span>{tx('Abrindo a sua carteira…')}</span></section>
      </div>
    )
  }

  // Sem nenhum investimento: em vez de uma tela cheia de zeros, o próximo passo.
  if (!inv.d.ativos.length) {
    return (
      <div className={`pagina analise pg-invest ${movimento === 'reduzido' ? 'parado' : ''}`}>
        {topo(tx('A sua carteira de investimentos.'), false)}
        <section className="cartao inv-vazio">
          <span className="inv-vazio-icone"><Icone nome="investir" tamanho={30} /></span>
          <h2>{tx('Comece pelo primeiro investimento')}</h2>
          <p>{tx('Cadastre um CDB, um título do Tesouro, uma ação ou um fundo e registre o que você aplicou. Daí em diante o app acompanha quanto vale, quanto rendeu de verdade e o que vem pela frente.')}</p>
          <div className="inv-vazio-acoes">
            <button className="btn primario" onClick={acoes.novoAtivo}><Icone nome="mais" tamanho={16} /> {tx('Cadastrar um investimento')}</button>
            <button className="btn" onClick={acoes.importar}><Icone nome="importar" tamanho={16} /> {tx('Importar um arquivo da corretora')}</button>
          </div>
          <ul className="inv-vazio-passos">
            <li><Icone nome="check" tamanho={15} /> {tx('Aporte não é rendimento: o app separa o que você pôs do que o dinheiro rendeu.')}</li>
            <li><Icone nome="check" tamanho={15} /> {tx('O valor investido entra no seu patrimônio uma vez só, sem contar o mesmo dinheiro em dobro.')}</li>
            <li><Icone nome="check" tamanho={15} /> {tx('É para acompanhar e entender. O OpusCash não compra, não vende e não recomenda investimentos.')}</li>
          </ul>
          {legado && (
            <p className="inv-nota"><Icone nome="historico" tamanho={15} /> {tx('Os {0} que você informou como investido em {1} continuam valendo até você cadastrar a primeira operação aqui.', fmtValor(legado.valor), mesEAno(legado.ano, legado.mes))}</p>
          )}
        </section>
        {janelasAbertas}
      </div>
    )
  }

  const pendentes = inv.d.importacoes.reduce((a, i) => a + i.pendentes.length, 0)
  const aberto = ativoAberto ? inv.c.posicoes.find((p) => p.ativo.id === ativoAberto) : undefined
  return (
    <div className={`pagina analise pg-invest ${movimento === 'reduzido' ? 'parado' : ''}`}>
      {topo(tx('Quanto você tem, quanto rendeu de verdade e o que vem pela frente.'), true)}
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
      {inv.c.semCotacao.length > 0 && !aberto && (
        <div className="alerta inv-aviso" role="status">
          <span>{tx('Ainda não temos a cotação de {0}: os investimentos nessa moeda ficam fora dos totais por enquanto.', [...new Set(inv.c.semCotacao.map((p) => p.moeda))].join(', '))}</span>
        </div>
      )}
      {aberto
        ? <DetalheDoAtivo c={c} p={aberto} acoes={acoes} />
        : aba === 'geral' ? <VisaoGeral c={c} acoes={acoes} />
          : aba === 'carteira' ? <Carteira c={c} acoes={acoes} />
            : aba === 'analises' ? <Analises c={c} acoes={acoes} />
              : <Planejamento c={c} acoes={acoes} />}
      <p className="inv-rodape">{tx('O Invest serve para acompanhar e entender os seus investimentos. Não é recomendação de compra ou venda, e projeções não são garantia de resultado.')}</p>
      {janelasAbertas}
    </div>
  )
}
