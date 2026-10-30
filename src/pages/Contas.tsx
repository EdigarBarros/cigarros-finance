import { useState } from 'react'
import { categoriaPelaDescricao, doTipo } from '../lib/categorias'
import { COR } from '../lib/charts'
import {
  agruparContas, aproxConta, dataDaBaixa, fmtConta, fraseDaSituacao, hojeLocal, inicioDoMes, mesesComAtraso, totaisDoMes, type SituacaoConta,
} from '../lib/contasFixas'
import { casasDaMoeda, mascarar, paraCampoMoeda } from '../lib/dinheiro'
import { fmtDataCurta, fmtMoeda, fmtValor, MESES_NOME, parseNumero, simbolo } from '../lib/format'
import { moedasUsaveis } from '../lib/moedas'
import { mesmoNome } from '../lib/rotulos'
import type { ContaFixa, Tipo } from '../lib/types'
import { EscolhaCategoria, Selo } from '../components/Categorias'
import { CampoCotacao } from '../components/CampoCotacao'
import { EscolhaMoeda } from '../components/EscolhaMoeda'
import { EscolhaBanco } from '../components/Formularios'
import { Icone } from '../components/Icone'
import { Numero } from '../components/Numero'
import { PoteMeta } from '../components/PoteMeta'
import { Cartao, Modal, Segmentado, Vazio } from '../components/ui'
import type { Ctx } from './contexto'
import { IconeCategoria } from '../components/IconeCategoria'
import '../components/contas.css'

/** Pontos de partida para quem não sabe por onde começar. */
const EXEMPLOS: { nome: string; tipo: Tipo; icone: string; dica: string; categoria: string }[] = [
  { nome: 'Aluguel', tipo: 'saida', icone: '🏠', dica: 'ou prestação da casa', categoria: 'Moradia' },
  { nome: 'Luz', tipo: 'saida', icone: '💡', dica: 'o valor muda, você acerta na hora de pagar', categoria: 'Moradia' },
  { nome: 'Internet', tipo: 'saida', icone: '📶', dica: 'casa ou celular', categoria: 'Moradia' },
  { nome: 'Celular', tipo: 'saida', icone: '📱', dica: 'plano ou aparelho', categoria: 'Assinaturas' },
  { nome: 'Academia', tipo: 'saida', icone: '🏋️', dica: 'mensalidade', categoria: 'Saúde' },
  { nome: 'Streaming', tipo: 'saida', icone: '📺', dica: 'Netflix, Spotify, Disney…', categoria: 'Assinaturas' },
  { nome: 'Salário', tipo: 'entrada', icone: '💼', dica: 'o dia em que cai na conta', categoria: 'Salário' },
]

type Modelo = Pick<(typeof EXEMPLOS)[number], 'nome' | 'tipo' | 'categoria'>

const mesDe = (iso: string | null) => (iso ? iso.slice(0, 7) : '')
const quando = (iso: string) => `${MESES_NOME[Number(iso.slice(5, 7)) - 1].toLowerCase()}/${iso.slice(0, 4)}`

const MES_CURTO = (m: number) => MESES_NOME[m - 1].slice(0, 3).toLowerCase()

/**
 * Contas que se repetem todo mês: o pote do mês enche conforme você paga, a linha do mês mostra quando vence cada uma
 * e cada conta é um boleto que ganha o carimbo "pago" com um toque em "Paguei" (o app lança por você).
 */
export function Contas(c: Ctx) {
  const [editando, setEditando] = useState<ContaFixa | 'nova' | null>(null)
  const [modelo, setModelo] = useState<Modelo | undefined>()
  const [outroValor, setOutroValor] = useState<SituacaoConta | null>(null)
  const { contas } = c.contas
  const sits = c.situacoesContas
  const t = totaisDoMes(sits)
  const g = agruparContas(sits)
  const nomeMes = MESES_NOME[c.mes - 1].toLowerCase()
  const anteriores = mesesComAtraso(contas, c.d.lancs, c.ano, c.mes)
  const nova = (m?: Modelo) => { setModelo(m); setEditando('nova') }
  const totalSaidas = t.jaPago + t.faltaPagar

  if (c.contas.semTabela) {
    return (
      <div className="pagina">
        <header className="pagina-topo"><div><h1>Contas do mês</h1></div></header>
        <Cartao><Vazio>Para usar as contas do mês, falta atualizar o banco de dados: rode <code>supabase/migracao-07-contas-fixas.sql</code> no SQL Editor do Supabase.</Vazio></Cartao>
      </div>
    )
  }

  const grupo = (titulo: string, itens: SituacaoConta[], icone: string) => itens.length > 0 && (
    <section className="ct-grupo">
      <h2 className="ct-grupo-titulo"><Icone nome={icone} tamanho={18} /> {titulo}
        <small>{itens.length} · {fmtValor(itens.reduce((a, s) => a + s.valor, 0))}</small></h2>
      <div className="ct-boletos">
        {itens.map((s, i) => (
          <Boleto key={s.conta.id} s={s} c={c} indice={i} aoEditar={() => setEditando(s.conta)} aoOutroValor={() => setOutroValor(s)} />
        ))}
      </div>
    </section>
  )

  return (
    <div className="pagina pg-contas">
      <header className="pagina-topo">
        <div>
          <h1>Contas do mês</h1>
          <p className="sub">{contas.length ? `O que vence em ${nomeMes}. Toque em “Paguei” e o app lança por você.` : 'Nunca mais esqueça uma conta.'}</p>
        </div>
        {contas.length > 0 && <button className="btn primario" onClick={() => nova()}><Icone nome="mais" tamanho={16} /> Nova conta</button>}
      </header>

      {anteriores.length > 0 && (
        <div className="conta-aviso" role="status">
          <Icone nome="sino" tamanho={16} />
          <span>Ficou conta sem pagar em {anteriores.map((a) => `${MESES_NOME[a.mes - 1].toLowerCase()} (${a.qtd})`).join(', ')}.</span>
          <button className="link" onClick={() => c.irParaMes(anteriores[0].mes)}>Ver {MESES_NOME[anteriores[0].mes - 1].toLowerCase()}</button>
        </div>
      )}

      {!contas.length && <SemContas aoNova={nova} />}

      {sits.length > 0 && (
        <section className="ct-topo">
          <div className="cartao ct-pote">
            <PoteMeta progresso={totalSaidas ? t.jaPago / totalSaidas : t.temEntradas ? 1 : 0} cor={COR.entradas} icone="🧾" tamanho={112} />
            <span className="ct-pote-texto">
              <small>pago em {nomeMes}</small>
              <strong><Numero valor={t.jaPago} formato={fmtValor} /></strong>
              <small>de {fmtValor(totalSaidas)}</small>
              <span className="chips-info">
                {t.faltaPagar > 0 && <span className="chip-info">falta {fmtValor(t.faltaPagar)}</span>}
                {t.qtdAtrasadas > 0 && <span className="chip-info ruim">{t.qtdAtrasadas} atrasada{t.qtdAtrasadas > 1 ? 's' : ''}</span>}
                {t.temEntradas && <span className="chip-info bom">{t.aReceber > 0 ? `a receber ${fmtValor(t.aReceber)}` : `recebido ${fmtValor(t.jaRecebido)}`}</span>}
                {t.faltaPagar === 0 && totalSaidas > 0 && <span className="chip-info bom">tudo pago 🎉</span>}
              </span>
            </span>
          </div>
          <LinhaDoMes c={c} sits={sits} />
        </section>
      )}

      {contas.length > 0 && !sits.length && (
        <Cartao><Vazio>Nenhuma conta vale em {nomeMes} de {c.ano}. Confira abaixo o mês em que cada uma começa.</Vazio></Cartao>
      )}

      {/* uma grade só, da mais urgente para a já paga: o selo de cada boleto diz a situação */}
      {grupo(`Contas de ${nomeMes}`, [...g.atrasadas, ...g.estaSemana, ...g.maisAFrente, ...g.pagas], 'calendario')}

      {contas.length > 0 && (
        <Cartao titulo="Suas contas fixas" acao={<span className="conta-grupo-total">{contas.length}</span>}>
          <ul className="conta-gerenciar">
            {contas.map((x) => {
              const cat = c.categorias.find((k) => k.id === x.categoria_id)
              return (
                <li key={x.id} className={x.ativa ? '' : 'pausada'}>
                  <button type="button" onClick={() => setEditando(x)}>
                    <Selo c={cat ?? { icone: x.tipo === 'entrada' ? '💰' : '🧾', cor: '#636366' }} />
                    <span className="conta-info">
                      <strong>{x.descricao}{!x.ativa && <span className="conta-etiqueta">pausada</span>}</strong>
                      <small>
                        {x.tipo === 'entrada' ? 'cai' : 'vence'} todo dia {x.dia}
                        {x.fim ? ` · até ${quando(x.fim)}` : ''}
                        {x.inicio > inicioDoMes(c.ano, c.mes) ? ` · começa em ${quando(x.inicio)}` : ''}
                      </small>
                    </span>
                    <span className={`conta-valor ${x.tipo === 'entrada' ? 'entrada' : ''}`}>{x.tipo === 'entrada' ? '+' : ''}{fmtValor(x.valor)}</span>
                    <Icone nome="dir" tamanho={16} />
                  </button>
                </li>
              )
            })}
          </ul>
        </Cartao>
      )}

      {editando && (
        <FormConta c={c} conta={editando === 'nova' ? undefined : editando} modelo={modelo} aoFechar={() => setEditando(null)} />
      )}
      {outroValor && <FormBaixa c={c} s={outroValor} aoFechar={() => setOutroValor(null)} />}
    </div>
  )
}

/** Conta sem contas fixas: uma pilha de boletos de exemplo e os atalhos para começar. */
function SemContas({ aoNova }: { aoNova: (m?: Modelo) => void }) {
  const exemplos = [
    { nome: 'Aluguel', icone: '🏠', cor: '#ff9f0a', dia: 5, valor: 'R$ 1.200', pago: true },
    { nome: 'Luz', icone: '💡', cor: '#ffd60a', dia: 12, valor: 'R$ 180', pago: false },
    { nome: 'Internet', icone: '📶', cor: '#64d2ff', dia: 20, valor: 'R$ 99', pago: false },
  ]
  return (
    <section className="cartao ct-vazio">
      <div className="ct-vazio-pilha" aria-hidden="true">
        {exemplos.map((e) => (
          <div key={e.nome} className={`ct-boleto exemplo ${e.pago ? 'paga' : 'a_vencer'}`} style={{ '--c': e.cor } as React.CSSProperties}>
            <span className="ct-boleto-canhoto"><b>{String(e.dia).padStart(2, '0')}</b><small>todo mês</small></span>
            <span className="ct-boleto-corpo">
              <span className="ct-boleto-cab"><span className="ct-boleto-icone"><IconeCategoria emoji={e.icone} tamanho={18} /></span><strong>{e.nome}</strong></span>
              <span className="ct-boleto-valor">{e.valor}</span>
              <span className="ct-boleto-codigo" />
            </span>
            {e.pago && <span className="ct-carimbo">pago</span>}
          </div>
        ))}
      </div>
      <div className="ct-vazio-texto">
        <h2>Nunca mais esqueça uma conta</h2>
        <p>Cadastre uma vez o que se repete todo mês. O app lembra o vencimento, avisa o que atrasou e, com um toque em “Paguei”, lança o gasto por você.</p>
      </div>
      <div className="mt-modelos ct-modelos">
        {EXEMPLOS.map((e, i) => (
          <button key={e.nome} type="button" className="mt-modelo" style={{ '--c': e.tipo === 'entrada' ? '#30d158' : CORES_EXEMPLO[i % CORES_EXEMPLO.length], animationDelay: `${i * 45}ms` } as React.CSSProperties}
            onClick={() => aoNova(e)}>
            <span className="mt-modelo-icone"><IconeCategoria emoji={e.icone} tamanho={22} /></span>
            <strong>{e.nome}</strong>
            <small>{e.dica}</small>
          </button>
        ))}
        <button type="button" className="mt-modelo" style={{ '--c': '#9d6bff' } as React.CSSProperties} onClick={() => aoNova()}>
          <span className="mt-modelo-icone"><Icone nome="mais" tamanho={22} /></span>
          <strong>Outra conta</strong>
          <small>do seu jeito</small>
        </button>
      </div>
    </section>
  )
}
const CORES_EXEMPLO = ['#ff9f0a', '#ffd60a', '#64d2ff', '#0a84ff', '#ff375f', '#bf5af2']

/** Os dias do mês numa linha, com cada conta no dia em que vence (cor da situação) e o dia de hoje marcado. */
function LinhaDoMes({ c, sits }: { c: Ctx; sits: SituacaoConta[] }) {
  const dias = new Date(c.ano, c.mes, 0).getDate()
  const [hojeIso] = useState(hojeLocal)
  const hoje = { ano: Number(hojeIso.slice(0, 4)), mes: Number(hojeIso.slice(5, 7)), dia: Number(hojeIso.slice(8, 10)) }
  const ehMesAtual = hoje.ano === c.ano && hoje.mes === c.mes
  const pos = (d: number) => ((d - 0.5) / dias) * 100
  const porDia = new Map<number, SituacaoConta[]>()
  for (const s of sits) porDia.set(s.dia, [...(porDia.get(s.dia) ?? []), s])
  return (
    <div className="cartao ct-linha">
      <h3 className="ccd-titulo">Linha do mês <small>{MESES_NOME[c.mes - 1]}</small></h3>
      <div className="ct-linha-trilho">
        <i className="ct-linha-base" />
        {ehMesAtual && <i className="ct-linha-feito" style={{ width: `${pos(hoje.dia)}%` }} />}
        {ehMesAtual && <span className="ct-linha-hoje" style={{ left: `${pos(hoje.dia)}%` }}><small>hoje</small></span>}
        {[...porDia.entries()].map(([d, xs], i) => {
          const estado = xs.some((s) => s.estado === 'atrasada') ? 'atrasada' : xs.every((s) => s.estado === 'paga') ? 'paga' : xs.some((s) => s.estado === 'vence_hoje') ? 'vence_hoje' : 'a_vencer'
          const cat = c.categorias.find((k) => k.id === xs[0].conta.categoria_id)
          return (
            <span key={d} className={`ct-linha-marco ${estado}`} style={{ left: `${pos(d)}%`, animationDelay: `${200 + i * 60}ms` }}
              title={xs.map((s) => `${s.conta.descricao}: ${fmtConta(s)}`).join(' · ')}>
              <span className="ct-linha-pino"><IconeCategoria emoji={cat?.icone ?? (xs[0].conta.tipo === 'entrada' ? '💰' : '🧾')} tamanho={14} /></span>
              <small>{d}{xs.length > 1 && <sup>×{xs.length}</sup>}</small>
            </span>
          )
        })}
      </div>
      <div className="ct-linha-pe">
        <span>1 {MES_CURTO(c.mes)}</span>
        <span className="ct-linha-legenda"><i className="paga" />paga<i className="a_vencer" />a vencer<i className="atrasada" />atrasada</span>
        <span>{dias} {MES_CURTO(c.mes)}</span>
      </div>
    </div>
  )
}

/** Uma conta como boleto: canhoto com o dia, o valor, a situação e o carimbo "pago" quando foi paga. */
function Boleto({ s, c, indice, aoEditar, aoOutroValor }: { s: SituacaoConta; c: Ctx; indice: number; aoEditar: () => void; aoOutroValor: () => void }) {
  const { conta } = s
  const entrada = conta.tipo === 'entrada'
  const cat = c.categorias.find((k) => k.id === conta.categoria_id)
  const cor = cat?.cor ?? (entrada ? COR.entradas : '#8e8e93')
  // o dinheiro desta conta pode já estar num lançamento (do extrato, por exemplo): pergunta antes de lançar de novo
  const sugestao = s.baixa ? undefined : c.sugestaoDaConta(conta.id)
  return (
    <article className={`ct-boleto ${s.estado} ${entrada ? 'entrada' : ''}`} style={{ '--c': cor, animationDelay: `${Math.min(indice, 8) * 60}ms` } as React.CSSProperties}>
      <span className="ct-boleto-canhoto">
        <b>{String(s.dia).padStart(2, '0')}</b>
        <small>{MES_CURTO(c.mes)}</small>
      </span>
      <div className="ct-boleto-corpo">
        <button type="button" className="ct-boleto-cab" onClick={aoEditar}>
          <span className="ct-boleto-icone"><IconeCategoria emoji={cat?.icone ?? (entrada ? '💰' : '🧾')} tamanho={18} /></span>
          <span className="ct-boleto-nome"><strong>{conta.descricao}</strong><small>{cat?.nome ?? (entrada ? 'entrada fixa' : 'conta')}</small></span>
        </button>
        <span className="ct-boleto-valor">{entrada ? '+ ' : ''}{fmtConta(s)}{s.moeda && <small className="conta-aprox">{aproxConta(s)}</small>}</span>
        <span className={`chip-estado ${s.estado}`}>{fraseDaSituacao(s)}</span>
        {sugestao && (
          <div className="ct-sugestao" role="status">
            <span className="ct-sugestao-texto">
              <Icone nome="ideia" tamanho={14} />
              <span>Parece que já {entrada ? 'caiu' : 'foi pago'}: <b>{sugestao.lanc.descricao}</b> · {fmtValor(sugestao.lanc.valor)} · {fmtDataCurta(sugestao.lanc.data)}</span>
            </span>
            <span className="ct-sugestao-acoes">
              <button className="btn primario" onClick={() => c.ligarAConta(sugestao.lanc.id, conta.id)}><Icone nome="check" tamanho={14} /> É esse</button>
              <button className="btn" onClick={() => c.recusarVinculo(sugestao.lanc.id, conta.id)}>Não é</button>
            </span>
          </div>
        )}
        <div className="ct-boleto-acoes">
          {s.baixa ? (
            <>
              <button className="btn" onClick={() => c.editarLancamento(s.baixa!)}><Icone nome="lapis" tamanho={14} /> Editar</button>
              <button className="btn" onClick={() => { if (confirm(`Desfazer? O lançamento de ${fmtConta(s)} será apagado e a conta volta a ficar em aberto.`)) c.desfazerBaixa(s) }}>
                <Icone nome="desfazer" tamanho={14} /> Desfazer
              </button>
            </>
          ) : (
            <>
              <button className="btn primario conta-paguei" onClick={() => c.pagarConta(s)}>
                <Icone nome={entrada ? 'receber' : 'check'} tamanho={16} /> {entrada ? 'Recebi' : 'Paguei'}
              </button>
              <button className="icone-btn" onClick={aoOutroValor} title="Outro valor ou outra data" aria-label="Outro valor ou outra data"><Icone nome="lapis" tamanho={16} /></button>
            </>
          )}
        </div>
      </div>
      {s.estado === 'paga' && <span className="ct-carimbo">{entrada ? 'recebido' : 'pago'}</span>}
    </article>
  )
}

/** "Paguei" com outro valor ou outra data (a conta de luz muda todo mês). */
function FormBaixa({ c, s, aoFechar }: { c: Ctx; s: SituacaoConta; aoFechar: () => void }) {
  const entrada = s.conta.tipo === 'entrada'
  const moeda = s.moeda ?? c.perfil.moeda
  const [valor, setValor] = useState(paraCampoMoeda(s.valorNativo, moeda))
  // a cotação combinada da conta (se houver) já vem preenchida; dá para trocar pela que valeu no dia do pagamento
  const [cotacao, setCotacao] = useState<number | null>(s.conta.cotacao ?? null)
  const [data, setData] = useState(dataDaBaixa(s.conta, c.ano, c.mes))
  const [erro, setErro] = useState<string | null>(null)
  const mm = String(c.mes).padStart(2, '0')
  const ultimo = new Date(c.ano, c.mes, 0).getDate()

  const salvar = () => {
    const n = parseNumero(valor)
    if (!n || n <= 0) return setErro('Informe um valor maior que zero.')
    if (!data || data.slice(0, 7) !== `${c.ano}-${mm}`) return setErro(`Escolha uma data dentro de ${MESES_NOME[c.mes - 1].toLowerCase()}.`)
    c.pagarConta(s, { valor: n, data, ...(s.moeda && cotacao ? { cotacao } : {}) })
    aoFechar()
  }

  return (
    <Modal titulo={s.conta.descricao} aoFechar={aoFechar}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); salvar() }}>
        <label className="valor-grande" style={{ '--c': entrada ? COR.entradas : COR.saidas } as React.CSSProperties}>
          <span>{simbolo(moeda)}</span>
          <input autoFocus inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => { setValor(mascarar(e.target.value, casasDaMoeda(moeda))); setErro(null) }} aria-label="Valor" />
        </label>
        {s.moeda && (
          <div className="cotacao">
            <CampoCotacao moeda={s.moeda} principal={c.perfil.moeda} taxaDia={c.taxas[s.moeda]} valor={cotacao} aoMudar={setCotacao} />
            <span className="campo-ajuda">
              {parseNumero(valor) && (cotacao ?? c.taxas[s.moeda]) ? <>≈ <b>{fmtValor(parseNumero(valor)! * (cotacao ?? c.taxas[s.moeda]))}</b> na sua moeda. </> : null}
              {s.conta.cotacao && cotacao === s.conta.cotacao ? 'Cotação combinada na conta; troque se pagou por outra.' : cotacao ? 'Cotação que você informou.' : 'Cotação de hoje; troque se pagou por outra.'}
            </span>
          </div>
        )}
        <label className="campo">
          <span className="campo-rotulo">{entrada ? 'Dia em que recebeu' : 'Dia em que pagou'}</span>
          <input type="date" value={data} min={`${c.ano}-${mm}-01`} max={`${c.ano}-${mm}-${String(ultimo).padStart(2, '0')}`}
            onChange={(e) => setData(e.target.value)} required />
          <span className="campo-ajuda">O valor de costume é {fmtMoeda(s.conta.valor, moeda)}. Aqui você muda só para este mês.</span>
        </label>
        {erro && <p className="form-erro">{erro}</p>}
        <div className="form-acoes">
          <span className="espaco" />
          <button type="button" className="btn" onClick={aoFechar}>Cancelar</button>
          <button type="submit" className="btn primario">{entrada ? 'Recebi' : 'Paguei'}</button>
        </div>
      </form>
    </Modal>
  )
}

function FormConta({ c, conta, modelo, aoFechar }: { c: Ctx; conta?: ContaFixa; modelo?: Modelo; aoFechar: () => void }) {
  const hint = (tipo: Tipo, nome: string) => {
    const pelaDica = modelo?.categoria ? c.categorias.find((k) => k.tipo === tipo && mesmoNome(k.nome, modelo.categoria)) : undefined
    return (pelaDica ?? categoriaPelaDescricao(nome, tipo, c.categorias))?.id ?? ''
  }
  const [tipo, setTipo] = useState<Tipo>(conta?.tipo ?? modelo?.tipo ?? 'saida')
  const [nome, setNome] = useState(conta?.descricao ?? modelo?.nome ?? '')
  const moedaInicial = conta?.moeda || c.perfil.moeda
  const [moeda, setMoeda] = useState(moedaInicial)
  const [cotacao, setCotacao] = useState<number | null>(conta?.cotacao ?? null)
  const [valor, setValor] = useState(conta ? paraCampoMoeda(conta.valor, moedaInicial) : '')
  const moedas = moedasUsaveis(c.perfil, conta?.moeda)
  const [dia, setDia] = useState(conta ? String(conta.dia) : '')
  const [categoriaId, setCategoriaId] = useState(conta ? conta.categoria_id ?? '' : hint(modelo?.tipo ?? 'saida', modelo?.nome ?? ''))
  const [mexeuCategoria, setMexeuCategoria] = useState(Boolean(conta))
  const [bancoId, setBancoId] = useState(conta?.banco_id ?? '')
  const [inicio, setInicio] = useState(mesDe(conta?.inicio ?? null) || `${c.ano}-${String(c.mes).padStart(2, '0')}`)
  const [fim, setFim] = useState(mesDe(conta?.fim ?? null))
  const [erro, setErro] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState(false)
  const entrada = tipo === 'entrada'

  const mudarTipo = (t: Tipo) => {
    setTipo(t)
    if (!c.categorias.some((k) => k.id === categoriaId && k.tipo === t)) {
      setCategoriaId(hint(t, nome))
      setMexeuCategoria(false)
    }
  }
  const aoDigitarNome = (texto: string) => {
    setNome(texto)
    if (mexeuCategoria) return
    const sugerida = categoriaPelaDescricao(texto, tipo, c.categorias)
    if (sugerida) setCategoriaId(sugerida.id)
  }

  const salvar = () => {
    if (!nome.trim()) return setErro('Dê um nome para a conta (ex.: Aluguel).')
    const n = parseNumero(valor)
    if (!n || n <= 0) return setErro('Informe o valor, mesmo que aproximado. Você pode mudar na hora de pagar.')
    if (!dia) return setErro(entrada ? 'Escolha o dia em que o dinheiro cai.' : 'Escolha o dia do vencimento.')
    if (!inicio) return setErro('Escolha a partir de qual mês vale.')
    if (fim && fim < inicio) return setErro('O último mês não pode ser antes do primeiro.')
    const dados = {
      tipo, descricao: nome.trim(), valor: n, dia: Number(dia), moeda: moeda === c.perfil.moeda ? null : moeda, cotacao: moeda === c.perfil.moeda ? null : cotacao,
      categoria_id: categoriaId || null, banco_id: bancoId || null,
      inicio: `${inicio}-01`, fim: fim ? `${fim}-01` : null, ativa: conta?.ativa ?? true,
    }
    if (conta) void c.contas.updConta(conta.id, dados)
    else void c.contas.addConta(dados)
    aoFechar()
  }

  return (
    <Modal titulo={conta ? 'Editar conta fixa' : 'Nova conta fixa'} aoFechar={aoFechar}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); salvar() }}>
        <Segmentado rotulo="Tipo" valor={tipo} aoMudar={mudarTipo}
          opcoes={[{ id: 'saida', nome: 'Conta a pagar', cor: COR.saidas }, { id: 'entrada', nome: 'Entrada fixa', cor: COR.entradas }]} />
        <label className="campo">
          <span className="campo-rotulo">Nome</span>
          <input autoFocus={!modelo && !conta} value={nome} onChange={(e) => aoDigitarNome(e.target.value)} maxLength={40}
            placeholder={entrada ? 'Ex.: Salário, Aluguel recebido…' : 'Ex.: Aluguel, Luz, Internet, Academia…'} />
        </label>
        {moedas.length > 1 && !c.contas.semMoeda && (
          <EscolhaMoeda moedas={moedas} valor={moeda}
            aoMudar={(m) => { setMoeda(m); setCotacao(null); setValor((t) => { const x = parseNumero(t); return x ? paraCampoMoeda(x, m) : t }) }} />
        )}
        <div className="form-linha">
          <label className="campo-valor">
            <span className="campo-rotulo">{entrada ? 'Quanto costuma cair' : 'Quanto costuma ser'}</span>
            <span className="campo-caixa">
              <span className="prefixo">{simbolo(moeda)}</span>
              <input autoFocus={Boolean(modelo) && !conta} inputMode="decimal" value={valor} onChange={(e) => { setValor(mascarar(e.target.value, casasDaMoeda(moeda))); setErro(null) }} placeholder="0,00" />
            </span>
          </label>
          <label className="campo">
            <span className="campo-rotulo">{entrada ? 'Cai todo dia' : 'Vence todo dia'}</span>
            <select value={dia} onChange={(e) => { setDia(e.target.value); setErro(null) }}>
              <option value="">Escolha…</option>
              {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
            </select>
          </label>
        </div>
        {Number(dia) > 28 && <span className="campo-ajuda">Em meses mais curtos, vale o último dia do mês.</span>}
        {moeda !== c.perfil.moeda && (
          <div className="campo">
            <span className="campo-rotulo">Cotação que você paga <small>(opcional)</small></span>
            <CampoCotacao key={moeda} moeda={moeda} principal={c.perfil.moeda} taxaDia={c.taxas[moeda]} valor={cotacao} aoMudar={setCotacao} />
            <span className="campo-ajuda">
              {parseNumero(valor) && (cotacao ?? c.taxas[moeda]) ? <>Dá <b>≈ {fmtValor(parseNumero(valor)! * (cotacao ?? c.taxas[moeda]))}</b> por mês na sua moeda. </> : null}
              {cotacao ? 'Com a cotação que você combinou, o total do mês fica exato.' : 'Em branco, vale a cotação do dia. Com a que você paga, o valor da conta fica certo.'}
            </span>
          </div>
        )}
        <EscolhaCategoria
          key={tipo}
          tipo={tipo}
          opcoes={doTipo(c.categorias, tipo)}
          valor={categoriaId}
          aoMudar={(id) => { setCategoriaId(id); setMexeuCategoria(true) }}
          aoCriar={c.d.categoriasAntigas ? undefined : c.d.addCategoria}
        />
        {(c.v.bancos || bancoId) && <EscolhaBanco bancos={c.d.bancos} valor={bancoId} aoMudar={setBancoId} aoNovoBanco={c.d.addBanco} />}
        <div className="form-linha">
          <label className="campo">
            <span className="campo-rotulo">A partir de</span>
            <input type="month" value={inicio} onChange={(e) => setInicio(e.target.value)} required />
          </label>
          <label className="campo">
            <span className="campo-rotulo">Até quando? <small>(opcional)</small></span>
            <input type="month" value={fim} onChange={(e) => setFim(e.target.value)} min={inicio} />
          </label>
        </div>
        <span className="campo-ajuda">
          A conta aparece todo mês a partir daí. Se já {entrada ? 'recebeu' : 'pagou'} neste mês, é só tocar em “{entrada ? 'Recebi' : 'Paguei'}” depois.
          Deixe o “até quando” em branco se ela não tem data para acabar.
        </span>
        {erro && <p className="form-erro">{erro}</p>}
        <div className="form-acoes">
          {conta && (
            confirmar
              ? <button type="button" className="btn perigo" onClick={() => { void c.contas.delConta(conta.id); aoFechar() }}>Excluir mesmo</button>
              : <button type="button" className="btn perigo" onClick={() => setConfirmar(true)}>Excluir</button>
          )}
          {conta && (
            <button type="button" className="btn" onClick={() => { void c.contas.updConta(conta.id, { ativa: !conta.ativa }); aoFechar() }}>
              {conta.ativa ? 'Pausar' : 'Reativar'}
            </button>
          )}
          <span className="espaco" />
          <button type="button" className="btn" onClick={aoFechar}>Cancelar</button>
          <button type="submit" className="btn primario">{conta ? 'Salvar' : 'Criar conta'}</button>
        </div>
        {confirmar && <span className="campo-ajuda">Os lançamentos já pagos não somem: só deixam de estar ligados a esta conta.</span>}
        {conta && !confirmar && <span className="campo-ajuda">Pausar esconde a conta dos meses que ainda não foram pagos, sem excluir o histórico.</span>}
      </form>
    </Modal>
  )
}
