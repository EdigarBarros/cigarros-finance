/**
 * O topo do Consultor, desenhado para ser lido num olhar (veja docs/arquitetura-do-painel.md, seção 4.7):
 *  - **Seu perfil**: o jeito que o motor detectou (lib/jeito.ts), num emblema animado, com o número que o resume e as
 *    réguas que mostram onde a pessoa está (gasta tudo ↔ guarda muito, sem dívidas ↔ dívidas pesadas…);
 *  - **Agora**: três blocos do mesmo tamanho (quanto dá para gastar hoje, a nota e como o mês fecha), só medidores e números;
 *  - **Próximo passo**: uma faixa com um passo por vez;
 *  - **Objetivo**: seis ícones para escolher; escolhido, uma faixa com o caminho até ele e o que o consultor aprendeu.
 * Tudo anima ao entrar na tela e para com "Animações reduzidas" (.analise.parado).
 */
import { useMemo, useState, type CSSProperties } from 'react'
import type { Analise } from '../lib/analise'
import { fmtDataCurta, fmtValor, MESES_NOME, noMeioDaFrase } from '../lib/format'
import { perfilDe, reguasDe, tracosDe, type CorDoTraco } from '../lib/jeito'
import { OBJETIVOS, type MemoriaConsultor } from '../lib/memoria'
import { tx } from '../lib/textos'
import { Icone } from '../components/Icone'
import { Numero } from '../components/Numero'
import { Velocimetro, type Nivel } from '../components/Vitrine'
import { Medidor } from './AnaliseGraficos'
import { COR_DO_TOM, fmtCurto, useEmVista } from './analiseApoio'
import type { Ctx } from './contexto'
import './analiseTopo.css'

const COR: Record<CorDoTraco, string> = { ...COR_DO_TOM, neutro: 'var(--an-destino)' }

/** "Por quê?": a explicação fica escondida até a pessoa pedir. */
export function PorQue({ texto }: { texto: string }) {
  const [aberto, setAberto] = useState(false)
  if (!texto) return null
  return (
    <div className={`an-porque ${aberto ? 'aberto' : ''}`}>
      <button className="link" onClick={() => setAberto(!aberto)} aria-expanded={aberto}>
        {aberto ? tx('Esconder') : tx('Por quê?')} <Icone nome={aberto ? 'cima' : 'abaixo'} tamanho={14} />
      </button>
      {aberto && <p>{texto}</p>}
    </div>
  )
}

// ---------- seu perfil ----------

/** O perfil detectado em destaque: emblema, nome, o número que o resume, os outros traços e as réguas. */
export function SeuPerfil({ a, nivel }: { a: Analise; nivel: Nivel }) {
  const [ref, vivo] = useEmVista<HTMLElement>()
  const perfil = useMemo(() => perfilDe(tracosDe(a)), [a])
  const reguas = useMemo(() => reguasDe(a).slice(0, nivel === 'simples' ? 2 : 4), [a, nivel])
  const [aberto, setAberto] = useState<string | null>(null)
  if (!perfil) return null
  const p = perfil.principal
  const todos = [p, ...perfil.outros]
  const explicado = todos.find((t) => t.id === aberto)
  const outros = nivel === 'simples' ? [] : perfil.outros
  return (
    <section ref={ref} className={`cartao an-perfil ${vivo ? 'vivo' : ''} ${reguas.length ? '' : 'sem-reguas'}`} style={{ '--c': COR[p.cor] } as CSSProperties}>
      <span className="an-perfil-luz" aria-hidden="true" />
      <div className="an-perfil-quem">
        <button className="an-emblema" onClick={() => setAberto(aberto === p.id ? null : p.id)} aria-expanded={aberto === p.id} aria-label={tx('Por quê?')}>
          <span className="an-emblema-anel" aria-hidden="true" />
          <span className="an-emblema-miolo"><Icone nome={p.icone} tamanho={38} /></span>
        </button>
        <div className="an-perfil-texto">
          <span className="an-perfil-rotulo">{tx('Seu perfil')}</span>
          <strong className="an-perfil-nome">{p.nome}</strong>
          <span className="an-perfil-curto">{p.curto}</span>
          {outros.length > 0 && (
            <div className="an-perfil-outros">
              {outros.map((t, i) => (
                <button key={t.id} className={`an-perfil-chip ${aberto === t.id ? 'aberto' : ''}`} style={{ '--c': COR[t.cor], '--i': i } as CSSProperties}
                  onClick={() => setAberto(aberto === t.id ? null : t.id)} aria-expanded={aberto === t.id}>
                  <Icone nome={t.icone} tamanho={14} /> {t.nome}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {reguas.length > 0 && (
        <ul className="an-reguas">
          {reguas.map((r, i) => (
            <li key={r.id} className="an-regua" style={{ '--v': r.valor, '--i': i, '--t': COR_DO_TOM[r.tom] } as CSSProperties}>
              <span className="an-regua-cab"><Icone nome={r.icone} tamanho={14} /><b>{r.numero}</b></span>
              <span className="an-regua-trilho" role="img" aria-label={`${r.esquerda} — ${r.direita}: ${r.numero}`}>
                <i className="an-regua-feito" /><i className="an-regua-ponto" />
              </span>
              <small className="an-regua-esq" aria-hidden="true">{r.esquerda}</small>
              <small className="an-regua-dir" aria-hidden="true">{r.direita}</small>
            </li>
          ))}
        </ul>
      )}
      {explicado && <p className="an-perfil-porque">{explicado.porque}</p>}
    </section>
  )
}

// ---------- agora: hoje, a nota e o mês ----------

/** Três blocos do mesmo tamanho, lado a lado: o que dá para gastar hoje, a nota e como o mês fecha. */
export function Agora({ a, nivel }: { a: Analise; nivel: Nivel }) {
  return (
    <div className="an-agora-grade">
      {a.plano?.hoje && <BlocoHoje a={a} />}
      <BlocoNota a={a} nivel={nivel} />
      {a.mes && <BlocoMes a={a} />}
    </div>
  )
}

function BlocoHoje({ a }: { a: Analise }) {
  const [ref, vivo] = useEmVista<HTMLElement>()
  const h = a.plano!.hoje!
  const passou = h.resta < 0
  const cheio = h.pode > 0 ? Math.min(1, h.gastou / h.pode) : 1
  const tom = h.pode <= 0 || passou ? 'ruim' : cheio >= 0.8 ? 'medio' : 'bom'
  const porque = [
    h.motivo === 'caixa'
      ? h.ate
        ? tx('Até {0}, quando entra {1}, vencem {2} em contas. Com o saldo de hoje, sobram {3} por dia sem atrasar nada.', fmtDataCurta(h.ate.data), h.ate.descricao, fmtValor(h.antesDoDinheiro), fmtValor(h.porDiaDoCaixa!))
        : tx('Não há dinheiro previsto para entrar até o fim do mês que vem. Com o saldo de hoje e {0} em contas até lá, sobram {1} por dia.', fmtValor(h.antesDoDinheiro), fmtValor(h.porDiaDoCaixa!))
      : h.pode > 0
        ? tx('Pela previsão do mês: tirando as contas e guardando {0}, o que sobra dividido pelos dias que faltam dá {1} por dia.', fmtValor(a.mes?.sobraAlvo ?? 0), fmtValor(h.porDiaDoMes ?? 0))
        : tx('Pela previsão do mês, depois das contas e do que é para guardar ({0}), não sobra nada para os dias que faltam.', fmtValor(a.mes?.sobraAlvo ?? 0)),
    h.porDiaDoCaixa === null ? tx('Informe o saldo dos bancos para eu conferir também se o dinheiro chega antes das contas.') : '',
    tx('O número vale se o que entra e sai estiver lançado, e se refaz a cada lançamento. Renda extra não entra na conta.'),
  ].filter(Boolean).join(' ')
  return (
    <section ref={ref} className={`cartao an-bloco ${vivo ? 'vivo' : ''}`} style={{ '--c': COR_DO_TOM[tom], '--i': 0 } as CSSProperties}>
      <span className="an-bloco-rotulo"><Icone nome="carteira" tamanho={15} /> {tx('Hoje você pode gastar')}</span>
      <div className="an-bloco-desenho">
        <Velocimetro valor={cheio} cor={COR_DO_TOM[tom]}>
          <b className="an-vel-pct">{h.pode > 0 ? `${Math.round(cheio * 100)}%` : <Icone nome="escudo" tamanho={22} />}</b>
          <small className="an-vel-rot">{h.pode > 0 ? tx('do dia já foi') : tx('sem folga')}</small>
        </Velocimetro>
      </div>
      <strong className="an-bloco-numero"><Numero valor={Math.max(0, h.pode)} formato={fmtValor} /></strong>
      <span className={`an-bloco-pe ${passou ? 'ruim' : ''}`}>
        {passou ? tx('Passou {0} hoje', fmtValor(-h.resta)) : h.gastou > 0 ? tx('Ainda dá {0} hoje', fmtValor(h.resta)) : h.ate ? tx('por dia, até {0}', fmtDataCurta(h.ate.data)) : tx('por dia')}
      </span>
      <PorQue texto={porque} />
    </section>
  )
}

function BlocoNota({ a, nivel }: { a: Analise; nivel: Nivel }) {
  const [ref, vivo] = useEmVista<HTMLElement>()
  const iFase = Math.max(0, a.fases.findIndex((f) => f.id === a.fase))
  return (
    <section ref={ref} className={`cartao an-bloco ${vivo ? 'vivo' : ''}`} style={{ '--c': COR_DO_TOM[a.tom], '--i': 1 } as CSSProperties}>
      <span className="an-bloco-rotulo"><Icone nome="bussola" tamanho={15} /> {tx('Sua nota')} <em className="an-bloco-selo">{a.rotulo}</em></span>
      <div className="an-bloco-desenho"><Medidor valor={a.nota} tom={a.tom} /></div>
      <ol className="an-degraus" aria-label={tx('Degrau {0} de 5', iFase + 1)}>
        {a.fases.map((f, i) => <li key={f.id} className={i < iFase ? 'feito' : i === iFase ? 'atual' : ''} style={{ '--i': i } as CSSProperties} title={f.nome} />)}
      </ol>
      <span className="an-bloco-pe">{tx('Degrau {0} de 5', iFase + 1)} · {a.fases[iFase].nome}</span>
      {nivel !== 'simples' && <PorQue texto={a.temFluxo ? a.porqueFase : a.resumo[0]} />}
    </section>
  )
}

function BlocoMes({ a }: { a: Analise }) {
  const [ref, vivo] = useEmVista<HTMLElement>()
  const m = a.mes!
  const sobra = m.resultadoPrevisto >= 0
  const maior = Math.max(1, m.entradasPrevistas, m.saidasPrevistas)
  return (
    <section ref={ref} className={`cartao an-bloco an-bloco-mes ${vivo ? 'vivo' : ''}`} style={{ '--c': COR_DO_TOM[sobra ? 'bom' : 'ruim'], '--i': 2 } as CSSProperties}>
      <span className="an-bloco-rotulo"><Icone nome="calendario" tamanho={15} /> {tx('Como {0} deve fechar', noMeioDaFrase(MESES_NOME[a.hoje.mes - 1]))}</span>
      <div className="an-bloco-desenho an-balanca">
        <span className="entra" style={{ '--w': m.entradasPrevistas / maior } as CSSProperties}>
          <Icone nome="receber" tamanho={15} /><i /><b>{fmtCurto(m.entradasPrevistas)}</b>
        </span>
        <span className="sai" style={{ '--w': m.saidasPrevistas / maior } as CSSProperties}>
          <Icone nome="enviar" tamanho={15} /><i /><b>{fmtCurto(m.saidasPrevistas)}</b>
        </span>
      </div>
      <strong className={`an-bloco-numero ${sobra ? 'bom' : 'ruim'}`}><Numero valor={Math.abs(m.resultadoPrevisto)} formato={fmtValor} /></strong>
      <span className="an-bloco-pe">{sobra ? tx('Deve sobrar') : tx('Pode faltar')}</span>
      {/* A Início prevê o fim do mês só com o que já está marcado; aqui entra também o gasto do dia a dia que ainda deve vir. */}
      {(m.rendaExtraMedia > 0 || m.diaADiaPrevisto > 0) && <PorQue texto={[
        m.diaADiaPrevisto > 0 ? tx('Conta {0} de gasto do dia a dia até o fim do mês, pelo seu costume. A previsão da Início usa só o que já está marcado.', fmtValor(m.diaADiaPrevisto)) : '',
        m.rendaExtraMedia > 0 ? tx('Sem contar renda extra (em média, {0} por mês).', fmtValor(m.rendaExtraMedia)) : '',
      ].filter(Boolean).join(' ')} />}
    </section>
  )
}

// ---------- próximo passo ----------

/** Um passo por vez, numa faixa: ícone, o passo, o ganho e o botão; as setas passam para o próximo. */
export function ProximoPasso({ a, aoIr }: { a: Analise; aoIr: Ctx['irPara'] }) {
  const [i, setI] = useState(0)
  const acoes = a.acoes
  if (!acoes.length) {
    return (
      <section className="cartao an-passo nivel-tudo-certo">
        <span className="an-passo-icone"><Icone nome="check" tamanho={24} /></span>
        <strong className="an-passo-titulo">{tx('Nada pedindo ação agora.')}</strong>
      </section>
    )
  }
  const k = Math.min(i, acoes.length - 1)
  const x = acoes[k]
  return (
    <section className={`cartao an-passo nivel-${x.urgencia}`}>
      <span className="an-passo-icone" key={`ic-${x.id}`} aria-hidden="true"><Icone nome={x.icone} tamanho={24} /></span>
      <div className="an-passo-meio" key={x.id}>
        <span className="an-passo-rotulo">
          {tx('Faça agora')}
          {acoes.length > 1 && <small>{tx('Passo {0} de {1}', k + 1, acoes.length)}</small>}
        </span>
        <strong className="an-passo-titulo">{x.titulo}</strong>
        {x.impacto && <span className="an-impacto"><Icone nome="sobe" tamanho={13} /> {x.impacto}</span>}
        <PorQue texto={x.porque} />
      </div>
      <div className="an-passo-acoes">
        {acoes.length > 1 && (
          <span className="an-passo-nav">
            <button className="icone-btn" onClick={() => setI((k - 1 + acoes.length) % acoes.length)} aria-label={tx('Passo anterior')}><Icone nome="esq" tamanho={16} /></button>
            <button className="icone-btn" onClick={() => setI((k + 1) % acoes.length)} aria-label={tx('Próximo passo')}><Icone nome="dir" tamanho={16} /></button>
          </span>
        )}
        <button className="btn primario" onClick={() => aoIr(x.destino)}>{x.botao} <Icone nome="seta" tamanho={15} /></button>
      </div>
    </section>
  )
}

// ---------- objetivo ----------

/**
 * Sem objetivo: seis ícones para escolher (o consultor se ajusta a ele). Com objetivo: uma faixa com o caminho até ele,
 * o que deu certo, o que foi ajustado e o que está sendo acompanhado (lib/memoria.ts), e o botão de trocar.
 */
export function Objetivo({ a, memoria, nivel, aoEscolher }: { a: Analise; memoria: MemoriaConsultor; nivel: Nivel; aoEscolher: Ctx['escolherObjetivo'] }) {
  const [aberto, setAberto] = useState(false)
  if (memoria.objetivo === null) {
    return (
      <section className="cartao an-obj">
        <span className="an-obj-titulo"><Icone nome="meta" tamanho={17} /> {tx('Qual é o seu objetivo?')}</span>
        <div className="an-obj-opcoes">
          {OBJETIVOS.map((o, i) => (
            <button key={o.id} className="an-obj-opcao" onClick={() => aoEscolher(o.id)} title={o.descricao()} style={{ '--i': i } as CSSProperties}>
              <span className="an-obj-ic"><Icone nome={o.icone} tamanho={20} /></span>
              <span>{o.nome()}</span>
            </button>
          ))}
        </div>
      </section>
    )
  }
  const o = OBJETIVOS.find((x) => x.id === memoria.objetivo)!
  const ap = a.aprendizado
  const contas = [
    { id: 'bom', icone: 'check', n: ap.vitorias.length, rotulo: tx('O que deu certo') },
    { id: 'medio', icone: 'desfazer', n: ap.ajustes.length, rotulo: tx('O que não deu certo') },
    { id: 'olho', icone: 'olho', n: ap.acompanhando.length, rotulo: ap.acompanhando.length === 1 ? tx('Acompanhando 1 passo do plano') : tx('Acompanhando {0} passos do plano', ap.acompanhando.length) },
  ].filter((x) => x.n > 0)
  const temLista = nivel !== 'simples' && contas.length > 0
  return (
    <section className="cartao an-obj-faixa">
      <span className="an-obj-ic grande"><Icone nome={o.icone} tamanho={22} /></span>
      <div className="an-obj-meio">
        {/* a frase já diz o objetivo e onde a pessoa está ("Seu objetivo é sair das dívidas: faltam…") */}
        <strong className="an-obj-frase">{ap.frase ?? o.nome()}</strong>
      </div>
      {contas.length > 0 && (
        <button className="an-obj-contas" onClick={() => temLista && setAberto(!aberto)} aria-expanded={temLista ? aberto : undefined} disabled={!temLista}>
          {contas.map((c) => <span key={c.id} className={`an-obj-conta ${c.id}`} title={c.rotulo}><Icone nome={c.icone} tamanho={14} /> {c.n}</span>)}
        </button>
      )}
      <button className="link an-obj-trocar" onClick={() => aoEscolher(null)} aria-label={tx('Trocar')}><Icone nome="lapis" tamanho={14} /> {tx('Trocar')}</button>
      {aberto && temLista && (
        <ul className="an-obj-lista">
          {ap.vitorias.map((t, i) => <li key={`v${i}`} className="bom"><Icone nome="check" tamanho={14} /> {t}</li>)}
          {ap.ajustes.map((t, i) => <li key={`a${i}`} className="medio"><Icone nome="desfazer" tamanho={14} /> {t} {tx('O próximo passo vem menor.')}</li>)}
          {ap.acompanhando.map((x, i) => <li key={`c${i}`}><Icone nome="olho" tamanho={14} /> {tx('{0} Confiro quando {1} fechar.', x.titulo, noMeioDaFrase(MESES_NOME[x.mes - 1]))}</li>)}
        </ul>
      )}
    </section>
  )
}
