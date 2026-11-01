import { useState } from 'react'
import { categoriaPelaDescricao, doTipo } from '../lib/categorias'
import { COR } from '../lib/charts'
import {
  agruparContas, aproxConta, dataDaBaixa, fmtConta, fraseDaSituacao, hojeLocal, inicioDoMes, mesesComAtraso, totaisDoMes, type SituacaoConta,
} from '../lib/contasFixas'
import { casasDaMoeda, mascarar, paraCampoMoeda } from '../lib/dinheiro'
import { fmtDataCurta, fmtMesAno, fmtMoeda, fmtValor, MESES_NOME, parseNumero, simbolo, noMeioDaFrase } from '../lib/format'
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
import { Cartao, Modal, Palco, Segmentado, Vazio } from '../components/ui'
import { confirmar } from '../components/Avisos'
import { CampoData, CampoMes, Seletor } from '../components/Escolhas'
import type { Ctx } from './contexto'
import { IconeCategoria } from '../components/IconeCategoria'
import '../components/contas.css'
import { tx } from '../lib/textos'

/** Pontos de partida para quem não sabe por onde começar. */
const EXEMPLOS: { nome: string; tipo: Tipo; icone: string; dica: string; categoria: string }[] = [
  { nome: tx('Aluguel'), tipo: 'saida', icone: '🏠', dica: tx('ou prestação da casa'), categoria: tx('Moradia') },
  { nome: tx('Luz'), tipo: 'saida', icone: '💡', dica: tx('o valor muda, você acerta na hora de pagar'), categoria: tx('Moradia') },
  { nome: tx('Internet'), tipo: 'saida', icone: '📶', dica: tx('casa ou celular'), categoria: tx('Moradia') },
  { nome: tx('Celular'), tipo: 'saida', icone: '📱', dica: tx('plano ou aparelho'), categoria: tx('Assinaturas') },
  { nome: tx('Academia'), tipo: 'saida', icone: '🏋️', dica: tx('mensalidade'), categoria: tx('Saúde') },
  { nome: tx('Streaming'), tipo: 'saida', icone: '📺', dica: tx('Netflix, Spotify, Disney…'), categoria: tx('Assinaturas') },
  { nome: tx('Salário'), tipo: 'entrada', icone: '💼', dica: tx('o dia em que cai na conta'), categoria: tx('Salário') },
]

type Modelo = Pick<(typeof EXEMPLOS)[number], 'nome' | 'tipo' | 'categoria'>

const mesDe = (iso: string | null) => (iso ? iso.slice(0, 7) : '')
const quando = (iso: string) => fmtMesAno(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)))

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
  const nomeMes = noMeioDaFrase(MESES_NOME[c.mes - 1])
  const anteriores = mesesComAtraso(contas, c.d.lancs, c.ano, c.mes)
  const nova = (m?: Modelo) => { setModelo(m); setEditando('nova') }
  const totalSaidas = t.jaPago + t.faltaPagar

  if (c.contas.semTabela) {
    return (
      <div className="pagina">
        <header className="pagina-topo"><div><h1>{tx('Contas do mês')}</h1></div></header>
        <Cartao><Vazio>{tx('Para usar as contas do mês, falta atualizar o banco de dados: rode')} <code>supabase/migracao-07-contas-fixas.sql</code> {tx('no SQL Editor do Supabase.')}</Vazio></Cartao>
      </div>
    )
  }

  // o total do grupo é só o das contas a pagar (o mesmo do pote ao lado); o que entra aparece separado, com "+"
  const grupo = (titulo: string, itens: SituacaoConta[], icone: string) => itens.length > 0 && (
    <section className="ct-grupo">
      <h2 className="ct-grupo-titulo"><Icone nome={icone} tamanho={18} /> {titulo}
        <small>
          {itens.length} · {fmtValor(itens.filter((s) => s.conta.tipo === 'saida').reduce((a, s) => a + s.valor, 0))}
          {itens.some((s) => s.conta.tipo === 'entrada') && ` · +${fmtValor(itens.filter((s) => s.conta.tipo === 'entrada').reduce((a, s) => a + s.valor, 0))}`}
        </small></h2>
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
          <h1>{tx('Contas do mês')}</h1>
          <p className="sub">{contas.length ? tx('O que vence em {0}. Toque em “Paguei” e o app lança por você.', nomeMes) : tx('Nunca mais esqueça uma conta.')}</p>
        </div>
        {contas.length > 0 && <button className="btn primario" onClick={() => nova()}><Icone nome="mais" tamanho={16} /> {tx('Nova conta')}</button>}
      </header>

      {anteriores.length > 0 && (
        <div className="conta-aviso" role="status">
          <Icone nome="sino" tamanho={16} />
          <span>{tx('Ficou conta sem pagar em')} {anteriores.map((a) => `${noMeioDaFrase(MESES_NOME[a.mes - 1])} (${a.qtd})`).join(', ')}.</span>
          <button className="link" onClick={() => c.irParaMes(anteriores[0].mes)}>{tx('Ver {0}', MESES_NOME[anteriores[0].mes - 1].toLowerCase())}</button>
        </div>
      )}

      {!contas.length && <SemContas aoNova={nova} />}

      {sits.length > 0 && (
        <section className="ct-topo">
          <div className="cartao ct-pote">
            <PoteMeta progresso={totalSaidas ? t.jaPago / totalSaidas : t.temEntradas ? 1 : 0} cor={COR.entradas} icone="🧾" tamanho={112} />
            <span className="ct-pote-texto">
              <small>{tx('pago em {0}', nomeMes)}</small>
              <strong><Numero valor={t.jaPago} formato={fmtValor} /></strong>
              <small>{tx('de {0}', fmtValor(totalSaidas))}</small>
              <span className="chips-info">
                {t.faltaPagar > 0 && <span className="chip-info">{tx('falta {0}', fmtValor(t.faltaPagar))}</span>}
                {t.qtdAtrasadas > 0 && <span className="chip-info ruim">{(t.qtdAtrasadas === 1 ? tx('1 atrasada') : tx('{0} atrasadas', t.qtdAtrasadas))}</span>}
                {t.temEntradas && <span className="chip-info bom">{t.aReceber > 0 ? tx('a receber {0}', fmtValor(t.aReceber)) : tx('recebido {0}', fmtValor(t.jaRecebido))}</span>}
                {t.faltaPagar === 0 && totalSaidas > 0 && <span className="chip-info bom">{tx('tudo pago 🎉')}</span>}
              </span>
            </span>
          </div>
          <LinhaDoMes c={c} sits={sits} />
        </section>
      )}

      {contas.length > 0 && !sits.length && (
        <Cartao><Vazio>{tx('Nenhuma conta vale em {0} de {1}. Confira abaixo o mês em que cada uma começa.', nomeMes, c.ano)}</Vazio></Cartao>
      )}

      {/* uma grade só, da mais urgente para a já paga: o selo de cada boleto diz a situação */}
      {grupo(tx('Contas de {0}', nomeMes), [...g.atrasadas, ...g.estaSemana, ...g.maisAFrente, ...g.pagas], 'calendario')}

      {contas.length > 0 && (
        <Cartao titulo={tx('Suas contas fixas')} acao={<span className="conta-grupo-total">{contas.length}</span>}>
          <ul className="conta-gerenciar">
            {contas.map((x) => {
              const cat = c.categorias.find((k) => k.id === x.categoria_id)
              return (
                <li key={x.id} className={x.ativa ? '' : 'pausada'}>
                  <button type="button" onClick={() => setEditando(x)}>
                    <Selo c={cat ?? { icone: x.tipo === 'entrada' ? '💰' : '🧾', cor: '#636366' }} />
                    <span className="conta-info">
                      <strong>{x.descricao}{!x.ativa && <span className="conta-etiqueta">{tx('pausada')}</span>}</strong>
                      <small>
                        {tx('{0} todo dia {1}', x.tipo === 'entrada' ? tx('cai') : tx('vence'), x.dia)}
                        {x.fim ? ` · ${tx('até {0}', quando(x.fim))}` : ''}
                        {x.inicio > inicioDoMes(c.ano, c.mes) ? ` · ${tx('começa em {0}', quando(x.inicio))}` : ''}
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
    { nome: tx('Aluguel'), icone: '🏠', cor: '#ff9f0a', dia: 5, valor: 'R$ 1.200', pago: true },
    { nome: tx('Luz'), icone: '💡', cor: '#ffd60a', dia: 12, valor: 'R$ 180', pago: false },
    { nome: tx('Internet'), icone: '📶', cor: '#64d2ff', dia: 20, valor: 'R$ 99', pago: false },
  ]
  return (
    <section className="cartao ct-vazio">
      <div className="ct-vazio-pilha" aria-hidden="true">
        {exemplos.map((e) => (
          <div key={e.nome} className={`ct-boleto exemplo ${e.pago ? 'paga' : 'a_vencer'}`} style={{ '--c': e.cor } as React.CSSProperties}>
            <span className="ct-boleto-canhoto"><b>{String(e.dia).padStart(2, '0')}</b><small>{tx('todo mês')}</small></span>
            <span className="ct-boleto-corpo">
              <span className="ct-boleto-cab"><span className="ct-boleto-icone"><IconeCategoria emoji={e.icone} tamanho={18} /></span><strong>{e.nome}</strong></span>
              <span className="ct-boleto-valor">{e.valor}</span>
              <span className="ct-boleto-codigo" />
            </span>
            {e.pago && <span className="ct-carimbo">{tx('pago')}</span>}
          </div>
        ))}
      </div>
      <div className="ct-vazio-texto">
        <h2>{tx('Nunca mais esqueça uma conta')}</h2>
        <p>{tx('Cadastre uma vez o que se repete todo mês. O app lembra o vencimento, avisa o que atrasou e, com um toque em “Paguei”, lança o gasto por você.')}</p>
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
          <strong>{tx('Outra conta')}</strong>
          <small>{tx('do seu jeito')}</small>
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
      <h3 className="ccd-titulo">{tx('Linha do mês')} <small>{MESES_NOME[c.mes - 1]}</small></h3>
      <div className="ct-linha-trilho">
        <i className="ct-linha-base" />
        {ehMesAtual && <i className="ct-linha-feito" style={{ width: `${pos(hoje.dia)}%` }} />}
        {ehMesAtual && <span className="ct-linha-hoje" style={{ left: `${pos(hoje.dia)}%` }}><small>{tx('hoje')}</small></span>}
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
        <span className="ct-linha-legenda"><i className="paga" />{tx('paga')}<i className="a_vencer" />{tx('a vencer')}<i className="atrasada" />{tx('atrasada')}</span>
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
          <span className="ct-boleto-nome"><strong>{conta.descricao}</strong><small>{cat?.nome ?? (entrada ? tx('entrada fixa') : tx('conta'))}</small></span>
        </button>
        <span className="ct-boleto-valor">{entrada ? '+ ' : ''}{fmtConta(s)}{s.moeda && <small className="conta-aprox">{aproxConta(s)}</small>}</span>
        <span className={`chip-estado ${s.estado}`}>{fraseDaSituacao(s)}</span>
        {sugestao && (
          <div className="ct-sugestao" role="status">
            <span className="ct-sugestao-texto">
              <Icone nome="ideia" tamanho={14} />
              <span>{tx('Parece que já')} {entrada ? tx('caiu') : tx('foi pago')}: <b>{sugestao.lanc.descricao}</b> · {fmtValor(sugestao.lanc.valor)} · {fmtDataCurta(sugestao.lanc.data)}</span>
            </span>
            <span className="ct-sugestao-acoes">
              <button className="btn primario" onClick={() => c.ligarAConta(sugestao.lanc.id, conta.id)}><Icone nome="check" tamanho={14} /> {tx('É esse')}</button>
              <button className="btn" onClick={() => c.recusarVinculo(sugestao.lanc.id, conta.id)}>{tx('Não é')}</button>
            </span>
          </div>
        )}
        <div className="ct-boleto-acoes">
          {s.baixa ? (
            <>
              <button className="btn" onClick={() => c.editarLancamento(s.baixa!)}><Icone nome="lapis" tamanho={14} /> {tx('Editar')}</button>
              <button className="btn" onClick={async () => { if (await confirmar(tx('Desfazer? O lançamento de {0} será apagado e a conta volta a ficar em aberto.', fmtConta(s)), { botao: tx('Desfazer'), perigo: true })) c.desfazerBaixa(s) }}>
                <Icone nome="desfazer" tamanho={14} /> {tx('Desfazer')}
              </button>
            </>
          ) : (
            <>
              <button className="btn primario conta-paguei" onClick={() => (s.semCotacao ? aoOutroValor() : c.pagarConta(s))}>
                <Icone nome={entrada ? 'receber' : 'check'} tamanho={16} /> {entrada ? tx('Recebi') : tx('Paguei')}
              </button>
              <button className="icone-btn" onClick={aoOutroValor} title={tx('Outro valor ou outra data')} aria-label={tx('Outro valor ou outra data')}><Icone nome="lapis" tamanho={16} /></button>
            </>
          )}
        </div>
      </div>
      {s.estado === 'paga' && <span className="ct-carimbo">{entrada ? tx('recebido') : tx('pago')}</span>}
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
    if (!n || n <= 0) return setErro(tx('Informe um valor maior que zero.'))
    if (!data || data.slice(0, 7) !== `${c.ano}-${mm}`) return setErro(tx('Escolha uma data dentro de {0}.', noMeioDaFrase(MESES_NOME[c.mes - 1])))
    // campo de cotação vazio = a de hoje, a mesma que a tela mostra (senão cairia na combinada da conta sem ninguém ver)
    const taxa = s.moeda ? cotacao ?? c.taxas[s.moeda] : undefined
    if (s.moeda && !taxa) return setErro(tx('Não há cotação de hoje para {0}. Informe a cotação que você pagou.', s.moeda))
    c.pagarConta(s, { valor: n, data, ...(s.moeda && taxa ? { cotacao: taxa } : {}) })
    aoFechar()
  }

  return (
    <Modal titulo={s.conta.descricao} aoFechar={aoFechar}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); salvar() }}>
        <label className="valor-grande" style={{ '--c': entrada ? COR.entradas : COR.saidas } as React.CSSProperties}>
          <span>{simbolo(moeda)}</span>
          <input autoFocus inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => { setValor(mascarar(e.target.value, casasDaMoeda(moeda))); setErro(null) }} aria-label={tx('Valor')} />
        </label>
        {s.moeda && (
          <div className="cotacao">
            <CampoCotacao moeda={s.moeda} principal={c.perfil.moeda} taxaDia={c.taxas[s.moeda]} valor={cotacao} aoMudar={(t) => { setCotacao(t); setErro(null) }} />
            <span className="campo-ajuda">
              {parseNumero(valor) && (cotacao ?? c.taxas[s.moeda]) ? <>≈ <b>{fmtValor(parseNumero(valor)! * (cotacao ?? c.taxas[s.moeda]))}</b> {tx('na sua moeda.')} </> : null}
              {s.conta.cotacao && cotacao === s.conta.cotacao ? tx('Cotação combinada na conta; troque se pagou por outra.') : cotacao ? tx('Cotação que você informou.') : c.taxas[s.moeda] ? tx('Cotação de hoje; troque se pagou por outra.') : tx('Sem cotação automática agora: informe a que você pagou.')}
            </span>
          </div>
        )}
        <label className="campo">
          <span className="campo-rotulo">{entrada ? tx('Dia em que recebeu') : tx('Dia em que pagou')}</span>
          <CampoData valor={data} aoMudar={setData} obrigatorio rotulo={entrada ? tx('Dia em que recebeu') : tx('Dia em que pagou')}
            min={`${c.ano}-${mm}-01`} max={`${c.ano}-${mm}-${String(ultimo).padStart(2, '0')}`} />
          <span className="campo-ajuda">{tx('O valor de costume é {0}. Aqui você muda só para este mês.', fmtMoeda(s.conta.valor, moeda))}</span>
        </label>
        {erro && <p className="form-erro">{erro}</p>}
        <div className="form-acoes">
          <span className="espaco" />
          <button type="button" className="btn" onClick={aoFechar}>{tx('Cancelar')}</button>
          <button type="submit" className="btn primario">{entrada ? tx('Recebi') : tx('Paguei')}</button>
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

  const corConta = entrada ? COR.entradas : COR.saidas
  const catConta = c.categorias.find((k) => k.id === categoriaId)

  const salvar = () => {
    if (!nome.trim()) return setErro(tx('Dê um nome para a conta (ex.: Aluguel).'))
    const n = parseNumero(valor)
    if (!n || n <= 0) return setErro(tx('Informe o valor, mesmo que aproximado. Você pode mudar na hora de pagar.'))
    if (!dia) return setErro(entrada ? tx('Escolha o dia em que o dinheiro cai.') : tx('Escolha o dia do vencimento.'))
    if (!inicio) return setErro(tx('Escolha a partir de qual mês vale.'))
    if (fim && fim < inicio) return setErro(tx('O último mês não pode ser antes do primeiro.'))
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
    <Modal titulo={conta ? tx('Editar conta fixa') : tx('Nova conta fixa')} aoFechar={aoFechar} tamanho="tela" cor={corConta} palco={
      <Palco cor={catConta?.cor ?? corConta}
        icone={catConta ? <IconeCategoria emoji={catConta.icone} tamanho={46} /> : <Icone nome="calendario" tamanho={42} />}>
        {nome.trim() && <span className="palco-legenda">{nome.trim()}</span>}
        <span className="palco-valor">
          <small>{entrada ? tx('Quanto costuma cair') : tx('Quanto costuma ser')}</small>
          <strong>{fmtMoeda(parseNumero(valor) ?? 0, moeda)}</strong>
          {dia && <em><Icone nome="calendario" tamanho={14} /> {entrada ? tx('Cai todo dia') : tx('Vence todo dia')} {dia}</em>}
        </span>
      </Palco>
    }>
      <form className="form" onSubmit={(e) => { e.preventDefault(); salvar() }}>
        <Segmentado rotulo={tx('Tipo')} valor={tipo} aoMudar={mudarTipo}
          opcoes={[{ id: 'saida', nome: tx('Conta a pagar'), cor: COR.saidas }, { id: 'entrada', nome: tx('Entrada fixa'), cor: COR.entradas }]} />
        <label className="campo">
          <span className="campo-rotulo">{tx('Nome')}</span>
          <input autoFocus={!modelo && !conta} value={nome} onChange={(e) => aoDigitarNome(e.target.value)} maxLength={40}
            placeholder={entrada ? tx('Ex.: Salário, Aluguel recebido…') : tx('Ex.: Aluguel, Luz, Internet, Academia…')} />
        </label>
        {moedas.length > 1 && !c.contas.semMoeda && (
          <EscolhaMoeda moedas={moedas} valor={moeda}
            aoMudar={(m) => { setMoeda(m); setCotacao(null); setValor((t) => { const x = parseNumero(t); return x ? paraCampoMoeda(x, m) : t }) }} />
        )}
        <div className="form-linha">
          <label className="campo-valor">
            <span className="campo-rotulo">{entrada ? tx('Quanto costuma cair') : tx('Quanto costuma ser')}</span>
            <span className="campo-caixa">
              <span className="prefixo">{simbolo(moeda)}</span>
              <input autoFocus={Boolean(modelo) && !conta} inputMode="decimal" value={valor} onChange={(e) => { setValor(mascarar(e.target.value, casasDaMoeda(moeda))); setErro(null) }} placeholder="0,00" />
            </span>
          </label>
          <label className="campo">
            <span className="campo-rotulo">{entrada ? tx('Cai todo dia') : tx('Vence todo dia')}</span>
            <Seletor valor={String(dia)} aoMudar={(v) => { setDia(v); setErro(null) }} rotulo={tx('Dia')} placeholder={tx('Escolha…')}
              opcoes={Array.from({ length: 31 }, (_, i) => ({ valor: String(i + 1), rotulo: String(i + 1) }))} />
          </label>
        </div>
        {Number(dia) > 28 && <span className="campo-ajuda">{tx('Em meses mais curtos, vale o último dia do mês.')}</span>}
        {moeda !== c.perfil.moeda && (
          <div className="campo">
            <span className="campo-rotulo">{tx('Cotação que você paga')} <small>(opcional)</small></span>
            <CampoCotacao key={moeda} moeda={moeda} principal={c.perfil.moeda} taxaDia={c.taxas[moeda]} valor={cotacao} aoMudar={setCotacao} />
            <span className="campo-ajuda">
              {parseNumero(valor) && (cotacao ?? c.taxas[moeda]) ? <>{tx('Dá')} <b>≈ {fmtValor(parseNumero(valor)! * (cotacao ?? c.taxas[moeda]))}</b> {tx('por mês na sua moeda.')} </> : null}
              {cotacao ? tx('Com a cotação que você combinou, o total do mês fica exato.') : tx('Em branco, vale a cotação do dia. Com a que você paga, o valor da conta fica certo.')}
            </span>
          </div>
        )}
        <EscolhaCategoria
          key={tipo}
          grade
          tipo={tipo}
          opcoes={doTipo(c.categorias, tipo)}
          valor={categoriaId}
          aoMudar={(id) => { setCategoriaId(id); setMexeuCategoria(true) }}
          aoCriar={c.d.categoriasAntigas ? undefined : c.d.addCategoria}
        />
        {(c.v.bancos || bancoId) && <EscolhaBanco grade bancos={c.d.bancos} valor={bancoId} aoMudar={setBancoId} aoNovoBanco={c.d.addBanco} />}
        <div className="form-linha">
          <label className="campo">
            <span className="campo-rotulo">{tx('A partir de')}</span>
            <CampoMes valor={inicio} aoMudar={setInicio} rotulo={tx('A partir de')} obrigatorio />
          </label>
          <label className="campo">
            <span className="campo-rotulo">{tx('Até quando?')} <small>(opcional)</small></span>
            <CampoMes valor={fim} aoMudar={setFim} rotulo={tx('Até quando?')} min={inicio} />
          </label>
        </div>
        <span className="campo-ajuda">
          {entrada
            ? tx('A conta aparece todo mês a partir daí. Se já recebeu neste mês, é só tocar em “Recebi” depois. Deixe o “até quando” em branco se ela não tem data para acabar.')
            : tx('A conta aparece todo mês a partir daí. Se já pagou neste mês, é só tocar em “Paguei” depois. Deixe o “até quando” em branco se ela não tem data para acabar.')}
        </span>
        {erro && <p className="form-erro">{erro}</p>}
        <div className="form-acoes">
          {conta && (
            confirmar
              ? <button type="button" className="btn perigo" onClick={() => { void c.contas.delConta(conta.id); aoFechar() }}>{tx('Excluir mesmo')}</button>
              : <button type="button" className="btn perigo" onClick={() => setConfirmar(true)}>{tx('Excluir')}</button>
          )}
          {conta && (
            <button type="button" className="btn" onClick={() => { void c.contas.updConta(conta.id, { ativa: !conta.ativa }); aoFechar() }}>
              {conta.ativa ? tx('Pausar') : tx('Reativar')}
            </button>
          )}
          <span className="espaco" />
          <button type="button" className="btn" onClick={aoFechar}>{tx('Cancelar')}</button>
          <button type="submit" className="btn primario">{conta ? tx('Salvar') : tx('Criar conta')}</button>
        </div>
        {confirmar && <span className="campo-ajuda">{tx('Os lançamentos já pagos não somem: só deixam de estar ligados a esta conta.')}</span>}
        {conta && !confirmar && <span className="campo-ajuda">{tx('Pausar esconde a conta dos meses que ainda não foram pagos, sem excluir o histórico.')}</span>}
      </form>
    </Modal>
  )
}
