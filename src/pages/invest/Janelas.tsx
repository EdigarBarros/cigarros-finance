/**
 * As janelas do Invest: cadastrar um investimento, registrar ou corrigir uma operação, atualizar os valores, montar o plano e
 * a explicação de uma descoberta. Todas validam o que foi digitado antes de gravar (valor positivo, data plausível, tamanho
 * dos textos) e só fecham quando a gravação deu certo.
 */
import { useState, type CSSProperties, type ReactNode } from 'react'
import type { Achado } from '../../lib/achados'
import { avisar, confirmar } from '../../lib/avisos'
import { hojeLocal } from '../../lib/cartoes'
import { dataPlausivel, erroDataFora, erroValorGrande, fmtTaxa, mascarar, parseTaxa, valorGrandeDemais } from '../../lib/dinheiro'
import { fmtDataCurta, fmtDataLonga, fmtMoeda, fmtValor, mesEAno, parseNumero, paraCampo, simbolo } from '../../lib/format'
import { mesJaChegou } from '../../lib/guardado'
import { numero as numeroLivre } from '../../lib/invest/importar'
import {
  CLASSES, infoClasse, moedaDoAtivo, NOME_INDEXADOR, nomeOperacao, rotuloDoAtivo, SUBCLASSES_RENDA_FIXA, SUBTIPOS_PROVENTO,
  type Ativo, type Classe, type Foco, type Indexador, type Liquidez, type LinhaPendente, type Operacao, type Plano, type TipoOperacao,
} from '../../lib/invest/tipos'
import { moedasUsaveis } from '../../lib/moedas'
import type { NovaOperacao, NovoAtivo } from '../../lib/useInvest'
import { tx } from '../../lib/textos'
import { CampoData, CampoMes } from '../../components/Escolhas'
import { EscolhaMoeda } from '../../components/EscolhaMoeda'
import { Icone } from '../../components/Icone'
import { Interruptor, Modal, Palco } from '../../components/ui'
import { COR_DO_TOM } from '../analiseApoio'
import type { Ctx } from '../contexto'
import { fmtQtd, fonteDoValor } from './apoio'

const texto = (s: string, max: number) => s.replace(/\s+/g, ' ').trim().slice(0, max) || null
/** Quantidade e preço aceitam até 8 casas ("0,00012345"); dinheiro continua com 2. */
const livre = (s: string) => {
  // digitado no jeito brasileiro: "1.000" é mil (o leitor de arquivos, que recebe números de planilha, leria 1)
  const t = s.trim()
  const n = numeroLivre(/^\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, '') : t)
  return n !== null && Number.isFinite(n) ? n : null
}
/** Número para pôr num campo: vírgula decimal, sem ponto de milhar, até 8 casas. */
const paraCampoLivre = (n: number) => String(Number(n.toFixed(8))).replace('.', ',')
const soNumero = (s: string) => s.replace(/[^\d.,]/g, '').slice(0, 20)

function Campo({ rotulo, ajuda, opcional, children }: { rotulo: string; ajuda?: ReactNode; opcional?: boolean; children: ReactNode }) {
  return (
    <label className="campo">
      <span className="campo-rotulo">{rotulo} {opcional && <small>{tx('(opcional)')}</small>}</span>
      {children}
      {ajuda && <span className="campo-ajuda">{ajuda}</span>}
    </label>
  )
}
const CampoDinheiro = ({ valor, aoMudar, prefixo, placeholder = '0,00' }: { valor: string; aoMudar: (v: string) => void; prefixo: string; placeholder?: string }) => (
  <span className="campo-caixa"><span className="prefixo">{prefixo}</span><input inputMode="decimal" value={valor} onChange={(e) => aoMudar(mascarar(e.target.value))} placeholder={placeholder} /></span>
)

// ---------- investimento ----------

export function FormAtivo({ c, ativo, aoFechar, aoCriar, aoExcluir }: { c: Ctx; ativo?: Ativo; aoFechar: () => void; aoCriar: (a: Ativo) => void; aoExcluir: () => void }) {
  const inv = c.invest.d
  const [classe, setClasse] = useState<Classe>(ativo?.classe ?? 'renda_fixa')
  const [nome, setNome] = useState(ativo?.nome ?? '')
  const [codigo, setCodigo] = useState(ativo?.codigo ?? '')
  const [subclasse, setSubclasse] = useState(ativo?.subclasse ?? 'cdb')
  const [porValor, setPorValor] = useState(ativo?.por_valor ?? infoClasse(ativo?.classe ?? 'renda_fixa').porValor)
  const [instituicao, setInstituicao] = useState(ativo?.instituicao ?? '')
  const [moeda, setMoeda] = useState(ativo?.moeda ?? c.perfil.moeda)
  const [emissor, setEmissor] = useState(ativo?.emissor ?? '')
  const [setor, setSetor] = useState(ativo?.setor ?? '')
  const [indexador, setIndexador] = useState<Indexador | ''>(ativo?.indexador ?? '')
  const [taxa, setTaxa] = useState(ativo?.taxa !== null && ativo?.taxa !== undefined ? fmtTaxa(ativo.taxa) : '')
  const [vencimento, setVencimento] = useState(ativo?.vencimento ?? '')
  const [liquidez, setLiquidez] = useState<Liquidez | ''>(ativo?.liquidez ?? '')
  const [liquidezDias, setLiquidezDias] = useState(ativo?.liquidez_dias ? String(ativo.liquidez_dias) : '')
  const [obs, setObs] = useState(ativo?.obs ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const info = infoClasse(classe)
  const fixa = classe === 'renda_fixa'
  const temOperacoes = Boolean(ativo && inv.operacoes.some((o) => o.ativo_id === ativo.id))
  const moedas = moedasUsaveis(c.perfil, ativo?.moeda)
  const instituicoes = [...new Set([...c.d.bancos.map((b) => b.nome), ...inv.ativos.map((a) => a.instituicao).filter((x): x is string => Boolean(x))])]
  const mudarClasse = (x: Classe) => {
    setClasse(x)
    if (!temOperacoes) setPorValor(infoClasse(x).porValor)
  }
  const escolherTitulo = (id: string) => {
    setSubclasse(id)
    const padrao = SUBCLASSES_RENDA_FIXA.find((s) => s.id === id)?.indexador
    if (padrao) setIndexador(padrao)
    if (!nome.trim() || SUBCLASSES_RENDA_FIXA.some((s) => s.nome() === nome.trim())) setNome(SUBCLASSES_RENDA_FIXA.find((s) => s.id === id)?.nome() ?? '')
  }
  const salvar = async () => {
    const n = texto(nome, 120) ?? texto(codigo, 24)
    if (!n) return setErro(tx('Dê um nome para o investimento.'))
    const t = taxa.trim() ? parseTaxa(taxa) : null
    if (taxa.trim() && (t === null || t < 0 || t > 1000)) return setErro(tx('Confira a taxa: use um número como 12,5 ou 110.'))
    if (indexador && t === null) return setErro(tx('Informe a taxa (ou deixe "como rende" em branco).'))
    if (vencimento && !dataPlausivel(vencimento)) return setErro(erroDataFora())
    const dias = liquidez === 'prazo' ? Number(liquidezDias) : null
    if (liquidez === 'prazo' && (!Number.isInteger(dias) || dias! < 0 || dias! > 3650)) return setErro(tx('Diga em quantos dias o dinheiro cai na conta depois do pedido.'))
    const dados: NovoAtivo = {
      nome: n, codigo: porValor ? null : texto(codigo.toUpperCase(), 24), classe, subclasse: fixa ? subclasse : null, por_valor: porValor,
      instituicao: texto(instituicao, 80), banco_id: c.d.bancos.find((b) => b.nome.toLowerCase() === instituicao.trim().toLowerCase())?.id ?? null,
      moeda: moeda === c.perfil.moeda ? null : moeda, emissor: texto(emissor, 80), setor: texto(setor, 60),
      indexador: porValor && indexador ? indexador : null, taxa: porValor && indexador ? t : null, vencimento: porValor && vencimento ? vencimento : null,
      liquidez: liquidez || null, liquidez_dias: dias, obs: texto(obs, 500),
    }
    setSalvando(true)
    if (ativo) {
      if (await inv.updAtivo(ativo.id, dados)) aoFechar()
    } else {
      const criado = await inv.addAtivo(dados)
      if (criado) aoCriar(criado)
    }
    setSalvando(false)
  }
  return (
    <Modal titulo={ativo ? tx('Editar investimento') : tx('Novo investimento')} aoFechar={aoFechar} tamanho="tela" cor={info.cor}
      palco={<Palco icone={<Icone nome={info.icone} tamanho={44} />} cor={info.cor}><span className="palco-legenda">{nome.trim() || codigo.trim() || info.nome()}</span></Palco>}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); void salvar() }}>
        <div className="campo">
          <span className="campo-rotulo">{tx('Que tipo de investimento é?')}</span>
          <div className="chips" role="radiogroup" aria-label={tx('Tipo de investimento')}>
            {CLASSES.map((x) => (
              <button key={x.id} type="button" role="radio" aria-checked={classe === x.id} className={`chip ${classe === x.id ? 'ativo' : ''}`} onClick={() => mudarClasse(x.id)}>{x.nome()}</button>
            ))}
          </div>
        </div>
        {fixa && (
          <div className="campo">
            <span className="campo-rotulo">{tx('Qual título?')}</span>
            <div className="chips" role="radiogroup" aria-label={tx('Título de renda fixa')}>
              {SUBCLASSES_RENDA_FIXA.map((s) => (
                <button key={s.id} type="button" role="radio" aria-checked={subclasse === s.id} className={`chip ${subclasse === s.id ? 'ativo' : ''}`} onClick={() => escolherTitulo(s.id)}>{s.nome()}</button>
              ))}
            </div>
          </div>
        )}
        <div className="form-linha">
          {!porValor && (
            <Campo rotulo={tx('Código de negociação')} ajuda={tx('Como aparece na corretora: PETR4, MXRF11…')}>
              <input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase().slice(0, 24))} placeholder="PETR4" autoFocus={!ativo} />
            </Campo>
          )}
          <Campo rotulo={tx('Nome')} opcional={!porValor}>
            <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} placeholder={porValor ? tx('Ex.: CDB Banco X 2029') : tx('Ex.: Petrobras')} autoFocus={!ativo && porValor} />
          </Campo>
        </div>
        {(classe === 'fundo' || classe === 'outro' || classe === 'previdencia') && (
          <div className="campo">
            <Interruptor ligado={!porValor} aoMudar={(v) => !temOperacoes && setPorValor(!v)} rotulo={tx('Acompanhar por quantidade de cotas e preço')} />
            <span className="campo-ajuda">{temOperacoes ? tx('Não dá para trocar depois que há operações.') : tx('Desligado, você informa só o valor aplicado e o saldo de vez em quando.')}</span>
          </div>
        )}
        <div className="form-linha">
          <Campo rotulo={tx('Corretora ou banco')} opcional>
            <input value={instituicao} onChange={(e) => setInstituicao(e.target.value)} maxLength={80} list="inv-instituicoes" placeholder={tx('Onde está o investimento')} />
            <datalist id="inv-instituicoes">{instituicoes.map((x) => <option key={x} value={x} />)}</datalist>
          </Campo>
          {fixa ? (
            <Campo rotulo={tx('Emissor')} opcional ajuda={tx('O banco que emitiu o título (para a conta do FGC).')}>
              <input value={emissor} onChange={(e) => setEmissor(e.target.value)} maxLength={80} />
            </Campo>
          ) : !porValor ? (
            <Campo rotulo={tx('Setor')} opcional ajuda={tx('Bancos, energia, logística… Serve para ver a concentração.')}>
              <input value={setor} onChange={(e) => setSetor(e.target.value)} maxLength={60} />
            </Campo>
          ) : <span />}
        </div>
        {porValor && (
          <>
            <div className="campo">
              <span className="campo-rotulo">{tx('Como rende')} <small>{tx('(opcional)')}</small></span>
              <div className="chips" role="radiogroup" aria-label={tx('Como rende')}>
                <button type="button" role="radio" aria-checked={!indexador} className={`chip ${!indexador ? 'ativo' : ''}`} onClick={() => setIndexador('')}>{tx('Não sei / outro')}</button>
                {(['pre', 'cdi', 'selic', 'ipca'] as const).map((i) => (
                  <button key={i} type="button" role="radio" aria-checked={indexador === i} className={`chip ${indexador === i ? 'ativo' : ''}`} onClick={() => setIndexador(i)}>{NOME_INDEXADOR[i]()}</button>
                ))}
              </div>
              <span className="campo-ajuda">{tx('Com a taxa, o app estima o rendimento pelos índices oficiais. Sem ela, você informa o saldo de vez em quando.')}</span>
            </div>
            <div className="form-linha">
              {indexador && (
                <Campo rotulo={indexador === 'pre' ? tx('Taxa ao ano (%)') : indexador === 'ipca' ? tx('Taxa acima da inflação, ao ano (%)') : tx('Quanto do índice (%)')}>
                  <span className="campo-caixa"><input inputMode="decimal" value={taxa} onChange={(e) => setTaxa(soNumero(e.target.value))} placeholder={indexador === 'cdi' || indexador === 'selic' ? '100' : '12,5'} /><span className="prefixo">%</span></span>
                </Campo>
              )}
              <Campo rotulo={tx('Vencimento')} opcional>
                <CampoData valor={vencimento} aoMudar={setVencimento} rotulo={tx('Vencimento')} />
              </Campo>
            </div>
          </>
        )}
        <div className="campo">
          <span className="campo-rotulo">{tx('Quando dá para tirar o dinheiro')} <small>{tx('(opcional)')}</small></span>
          <div className="chips" role="radiogroup" aria-label={tx('Liquidez')}>
            {([['', tx('Não informar')], ['diaria', tx('Todo dia')], ['vencimento', tx('Só no vencimento')], ['prazo', tx('Dias depois do pedido')]] as const).map(([id, n]) => (
              <button key={id} type="button" role="radio" aria-checked={liquidez === id} className={`chip ${liquidez === id ? 'ativo' : ''}`} onClick={() => setLiquidez(id)}>{n}</button>
            ))}
          </div>
          {liquidez === 'prazo' && <input className="inv-campo-curto" inputMode="numeric" value={liquidezDias} onChange={(e) => setLiquidezDias(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder={tx('Quantos dias')} aria-label={tx('Quantos dias')} />}
        </div>
        {moedas.length > 1 && (
          <div className="campo">
            <span className="campo-rotulo">{tx('Moeda')}</span>
            <EscolhaMoeda moedas={moedas} valor={moeda} aoMudar={setMoeda} travada={temOperacoes} />
          </div>
        )}
        <Campo rotulo={tx('Anotação')} opcional><input value={obs} onChange={(e) => setObs(e.target.value)} maxLength={500} /></Campo>
        {erro && <p className="form-erro">{erro}</p>}
        <div className="form-acoes">
          {ativo && <button type="button" className="btn perigo" onClick={async () => {
            if (!(await confirmar(tx('Apagar {0} com todas as operações e valores informados? Isso não pode ser desfeito.', rotuloDoAtivo(ativo)), { titulo: tx('Apagar investimento'), botao: tx('Apagar tudo'), perigo: true }))) return
            const ops = inv.operacoes.filter((o) => o.ativo_id === ativo.id)
            if (await inv.delAtivo(ativo.id)) {
              for (const o of ops) { c.ajustarSaldosDaOperacao(o, undefined); if (o.lancamento_id) void c.d.delLanc(o.lancamento_id) }
              aoExcluir()
            }
          }}>{tx('Apagar')}</button>}
          <button type="button" className="btn" onClick={aoFechar}>{tx('Cancelar')}</button>
          <button className="btn primario" disabled={salvando}>{ativo ? tx('Salvar') : tx('Salvar e registrar a aplicação')}</button>
        </div>
      </form>
    </Modal>
  )
}

// ---------- operação ----------

const TIPOS_PRINCIPAIS: TipoOperacao[] = ['compra', 'venda', 'provento']
const OUTROS_TIPOS: TipoOperacao[] = ['juros', 'amortizacao', 'vencimento', 'taxa', 'imposto', 'bonificacao', 'desdobramento', 'grupamento', 'transferencia', 'ajuste']
const AJUDA_DO_TIPO: Partial<Record<TipoOperacao, () => string>> = {
  amortizacao: () => tx('Devolução de parte do que você aplicou: baixa o custo, não é ganho.'),
  vencimento: () => tx('O título venceu: informe o valor que voltou para a conta. A posição é encerrada.'),
  taxa: () => tx('Taxa cobrada à parte (custódia, administração).'),
  imposto: () => tx('Imposto pago à parte (come-cotas, DARF). O imposto retido numa venda vai no campo próprio da venda.'),
  bonificacao: () => tx('Cotas recebidas sem pagar: informe quantas e, se a empresa informou, o custo atribuído.'),
  desdobramento: () => tx('Cada cota virou várias: informe por quanto a quantidade foi multiplicada (2 = cada 1 virou 2).'),
  grupamento: () => tx('Várias cotas viraram uma: informe o fator (0,1 = cada 10 viraram 1).'),
  transferencia: () => tx('Só um registro de que o investimento mudou de instituição. Não mexe em quantidade nem em custo.'),
  ajuste: () => tx('Correção ou posição inicial: soma (ou tira, com sinal de menos) quantidade e custo. Fica marcada como ajuste.'),
}

export function FormOperacao({ c, op, ativoId, tipoInicial, pendente, aoFechar, aoNovoAtivo }: {
  c: Ctx; op?: Operacao; ativoId?: string; tipoInicial?: TipoOperacao; pendente?: { importacaoId: string; linha: LinhaPendente }; aoFechar: () => void; aoNovoAtivo: () => void
}) {
  const inv = c.invest
  const ativos = inv.d.ativos
  const [idAtivo, setIdAtivo] = useState(op?.ativo_id ?? ativoId ?? (ativos.length === 1 ? ativos[0].id : ''))
  const [tipo, setTipo] = useState<TipoOperacao>(op?.tipo ?? tipoInicial ?? 'compra')
  const [maisTipos, setMaisTipos] = useState(Boolean(op && OUTROS_TIPOS.includes(op.tipo)) || Boolean(tipoInicial && OUTROS_TIPOS.includes(tipoInicial)))
  const [data, setData] = useState(op?.data ?? hojeLocal())
  const [quantidade, setQuantidade] = useState(op?.quantidade !== null && op?.quantidade !== undefined ? paraCampoLivre(op.quantidade) : '')
  const [preco, setPreco] = useState(op?.preco !== null && op?.preco !== undefined ? paraCampoLivre(op.preco) : '')
  const [valor, setValor] = useState(op?.valor ? paraCampo(op.valor) : '')
  const [valorMexido, setValorMexido] = useState(Boolean(op))
  const [custos, setCustos] = useState(op?.custos ? paraCampo(op.custos) : '')
  const [impostos, setImpostos] = useState(op?.impostos ? paraCampo(op.impostos) : '')
  const [fator, setFator] = useState(op?.fator ? paraCampoLivre(op.fator) : '')
  const [subtipo, setSubtipo] = useState(op?.subtipo ?? 'dividendo')
  const [obs, setObs] = useState(op?.obs ?? '')
  const ativo = ativos.find((a) => a.id === idAtivo)
  const moeda = ativo ? moedaDoAtivo(ativo, c.perfil.moeda) : c.perfil.moeda
  const outraMoeda = moeda !== c.perfil.moeda
  const [cotacao, setCotacao] = useState(op?.cotacao ? paraCampoLivre(op.cotacao) : '')
  const [bancoId, setBancoId] = useState(op?.banco_id ?? ativo?.banco_id ?? '')
  const [mexeSaldo, setMexeSaldo] = useState(op?.mexe_saldo ?? false)
  const [comoEntrada, setComoEntrada] = useState(Boolean(op?.lancamento_id))
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const porValor = ativo?.por_valor ?? false
  const posicao = inv.c.posicoes.find((p) => p.ativo.id === idAtivo)
  const usaQuantidade = !porValor && (tipo === 'compra' || tipo === 'venda' || tipo === 'bonificacao' || tipo === 'ajuste')
  const usaFator = tipo === 'desdobramento' || tipo === 'grupamento'
  const usaValor = !usaFator && tipo !== 'transferencia'
  const moveDinheiro = ['compra', 'venda', 'provento', 'juros', 'amortizacao', 'vencimento', 'taxa', 'imposto'].includes(tipo)
  const ehRenda = tipo === 'provento' || tipo === 'juros'
  const [anoOp, mesOp] = [Number(data.slice(0, 4)), Number(data.slice(5, 7))]
  const mesAberto = data ? mesJaChegou(anoOp, mesOp) : false
  const cor = ativo ? infoClasse(ativo.classe).cor : 'var(--destaque)'
  // quantidade × preço preenche o valor, até a pessoa mexer nele
  const contaDoValor = (q: string, p: string) => {
    const [nq, np] = [livre(q), livre(p)]
    if (!valorMexido && nq !== null && np !== null) setValor(paraCampo(Math.round(nq * np * 100) / 100))
  }
  const escolherAtivo = (id: string) => {
    setIdAtivo(id)
    const a = ativos.find((x) => x.id === id)
    if (!op && a?.banco_id) setBancoId(a.banco_id)
  }
  const salvar = async () => {
    if (!ativo) return setErro(tx('Escolha o investimento.'))
    if (!data || !dataPlausivel(data)) return setErro(erroDataFora())
    const q = usaQuantidade ? livre(quantidade) : null
    const p = usaQuantidade && tipo !== 'bonificacao' ? livre(preco) : null
    const v = usaValor ? parseNumero(valor) ?? 0 : 0
    const f = usaFator ? livre(fator) : null
    if (usaQuantidade && tipo !== 'ajuste' && (q === null || q <= 0)) return setErro(tx('Informe a quantidade.'))
    if (usaFator && (f === null || f <= 0)) return setErro(tx('Informe o fator.'))
    if (usaValor && !['bonificacao', 'ajuste'].includes(tipo) && v <= 0) return setErro(tx('Informe o valor.'))
    if (tipo === 'ajuste' && !v && !q) return setErro(tx('Informe a quantidade ou o valor do ajuste.'))
    if (valorGrandeDemais(Math.abs(v))) return setErro(erroValorGrande())
    const cst = parseNumero(custos) ?? 0
    const imp = parseNumero(impostos) ?? 0
    if (cst < 0 || imp < 0 || ((tipo === 'venda' || ehRenda) && cst + imp > v)) return setErro(tx('Taxas e imposto não podem passar do valor da operação.'))
    const ct = outraMoeda ? livre(cotacao) : null
    if (outraMoeda && cotacao.trim() && (ct === null || ct <= 0)) return setErro(tx('Confira a cotação.'))
    if (tipo === 'venda' && !porValor && posicao && q !== null && !op && q > posicao.quantidade + 1e-7
      && !(await confirmar(tx('Você tem {0} e está vendendo {1}. Registrar mesmo assim? O app vai apontar que as operações não fecham.', fmtQtd(posicao.quantidade), fmtQtd(q)), { titulo: tx('Venda maior que a posição'), botao: tx('Registrar assim') }))) return
    const banco = moveDinheiro && bancoId ? bancoId : null
    const dados: NovaOperacao = {
      ativo_id: ativo.id, tipo, subtipo: tipo === 'provento' ? subtipo : null, data, quantidade: q, preco: p, valor: tipo === 'ajuste' ? v : Math.abs(v), custos: cst, impostos: imp, fator: f,
      moeda: outraMoeda ? moeda : null, cotacao: ct, banco_id: banco, mexe_saldo: Boolean(banco && mexeSaldo && mesAberto), lancamento_id: op?.lancamento_id ?? null,
      origem: op?.origem ?? 'manual', importacao_id: op?.importacao_id ?? pendente?.importacaoId ?? null, chave: op?.chave ?? null, obs: texto(obs, 500),
    }
    setSalvando(true)
    // provento que também conta como entrada do mês: o lançamento nasce junto e fica ligado à operação
    const liquidoP = Math.round((dados.valor - cst - imp) * (ct ?? (outraMoeda ? c.taxas[moeda] ?? 1 : 1)) * 100) / 100
    const lanc = { ano: anoOp, mes: mesOp, tipo: 'entrada' as const, descricao: tx('{0} de {1}', nomeOperacao(tipo, porValor), rotuloDoAtivo(ativo)), valor: liquidoP, data, banco_id: banco,
      categoria_id: c.categorias.find((x) => x.tipo === 'entrada' && /rendimento|dividendo|investimento/i.test(x.nome))?.id ?? null }
    if (ehRenda && comoEntrada && !dados.lancamento_id) dados.lancamento_id = (await c.d.addLanc(lanc))?.id ?? null
    else if (dados.lancamento_id && (!ehRenda || !comoEntrada)) { void c.d.delLanc(dados.lancamento_id); dados.lancamento_id = null } else if (dados.lancamento_id) void c.d.updLanc(dados.lancamento_id, lanc)
    let ok = false
    if (op) {
      ok = await inv.d.updOperacao(op.id, dados)
      if (ok) c.ajustarSaldosDaOperacao(op, { ...op, ...dados })
    } else {
      const criada = await inv.d.addOperacao(dados)
      ok = Boolean(criada)
      if (criada) c.ajustarSaldosDaOperacao(undefined, criada)
      if (criada && pendente) inv.d.resolverPendente(pendente.importacaoId, pendente.linha)
    }
    // mudou de instituição: o cadastro do investimento acompanha
    if (ok && tipo === 'transferencia' && obs.trim()) void inv.d.updAtivo(ativo.id, { instituicao: texto(obs, 80) })
    setSalvando(false)
    if (ok) aoFechar()
  }
  const apagar = async () => {
    if (!op || !ativo || !(await confirmar(tx('Apagar esta operação? A posição, o custo e o resultado de {0} serão refeitos sem ela.', rotuloDoAtivo(ativo)), { titulo: tx('Apagar operação'), botao: tx('Apagar'), perigo: true }))) return
    if (await inv.d.delOperacao(op.id)) {
      c.ajustarSaldosDaOperacao(op, undefined)
      if (op.lancamento_id) void c.d.delLanc(op.lancamento_id)
      aoFechar()
    }
  }
  const botaoDoTipo = (t: TipoOperacao) => (
    <button key={t} type="button" role="radio" aria-checked={tipo === t} className={`chip ${tipo === t ? 'ativo' : ''}`} onClick={() => setTipo(t)}>{nomeOperacao(t, porValor)}</button>
  )
  const valorDigitado = parseNumero(valor) ?? 0
  return (
    <Modal titulo={op ? tx('Corrigir operação') : tx('Registrar operação')} aoFechar={aoFechar} tamanho="tela" cor={cor}
      palco={(
        <Palco icone={<Icone nome={ativo ? infoClasse(ativo.classe).icone : 'investir'} tamanho={44} />} cor={cor}>
          {ativo && <span className="palco-legenda">{rotuloDoAtivo(ativo)}</span>}
          {valorDigitado > 0 && <span className="palco-valor"><small>{nomeOperacao(tipo, porValor)}</small><strong>{fmtMoeda(valorDigitado, moeda)}</strong></span>}
          {posicao?.aberta && <span className="palco-legenda fraca">{porValor ? tx('Hoje: {0}', fmtMoeda(posicao.valor, moeda)) : tx('Hoje: {0} cotas', fmtQtd(posicao.quantidade))}</span>}
        </Palco>
      )}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); void salvar() }}>
        {pendente && <p className="inv-pendente-texto"><b>{tx('Linha do arquivo:')}</b> {pendente.linha.texto}</p>}
        <Campo rotulo={tx('Investimento')}>
          <select value={idAtivo} onChange={(e) => escolherAtivo(e.target.value)} disabled={Boolean(op)}>
            <option value="">{tx('Escolher…')}</option>
            {ativos.map((a) => <option key={a.id} value={a.id}>{a.codigo ? `${a.codigo} · ${a.nome}` : a.nome}{a.instituicao ? ` (${a.instituicao})` : ''}</option>)}
          </select>
          {!op && <button type="button" className="link" onClick={aoNovoAtivo}>{tx('Cadastrar outro investimento')}</button>}
        </Campo>
        <div className="campo">
          <span className="campo-rotulo">{tx('O que aconteceu?')}</span>
          <div className="chips" role="radiogroup" aria-label={tx('Tipo de operação')}>
            {TIPOS_PRINCIPAIS.map(botaoDoTipo)}
            {maisTipos ? OUTROS_TIPOS.map(botaoDoTipo) : <button type="button" className="chip novo" onClick={() => setMaisTipos(true)}>{tx('Outros…')}</button>}
          </div>
          {AJUDA_DO_TIPO[tipo] && <span className="campo-ajuda">{AJUDA_DO_TIPO[tipo]!()}</span>}
        </div>
        <Campo rotulo={tx('Dia')} ajuda={data > hojeLocal() ? tx('Data futura: fica como previsto e só passa a contar quando o dia chegar.') : undefined}>
          <CampoData valor={data} aoMudar={setData} rotulo={tx('Dia da operação')} obrigatorio />
        </Campo>
        {usaQuantidade && (
          <div className="form-linha">
            <Campo rotulo={tx('Quantidade')}>
              <span className="campo-caixa"><input inputMode="decimal" value={quantidade} onChange={(e) => { setQuantidade(soNumero(e.target.value)); contaDoValor(e.target.value, preco) }} placeholder="0" /></span>
            </Campo>
            {tipo !== 'bonificacao' && (
              <Campo rotulo={tx('Preço de cada uma')}>
                <span className="campo-caixa"><span className="prefixo">{simbolo(moeda)}</span><input inputMode="decimal" value={preco} onChange={(e) => { setPreco(soNumero(e.target.value)); contaDoValor(quantidade, e.target.value) }} placeholder="0,00" /></span>
              </Campo>
            )}
          </div>
        )}
        {usaFator && (
          <Campo rotulo={tx('Fator')}><span className="campo-caixa"><input inputMode="decimal" value={fator} onChange={(e) => setFator(soNumero(e.target.value))} placeholder={tipo === 'desdobramento' ? '2' : '0,1'} /></span></Campo>
        )}
        {usaValor && (
          <div className="form-linha">
            <Campo rotulo={tipo === 'bonificacao' ? tx('Custo atribuído') : tipo === 'ajuste' ? tx('Custo a somar') : ehRenda ? tx('Valor bruto') : tx('Valor total')} opcional={tipo === 'bonificacao' || tipo === 'ajuste'}>
              <CampoDinheiro valor={valor} aoMudar={(v) => { setValor(v); setValorMexido(true) }} prefixo={simbolo(moeda)} />
            </Campo>
            {(tipo === 'compra' || tipo === 'venda') && <Campo rotulo={tx('Taxas e corretagem')} opcional><CampoDinheiro valor={custos} aoMudar={setCustos} prefixo={simbolo(moeda)} /></Campo>}
            {(tipo === 'venda' || tipo === 'vencimento' || ehRenda) && <Campo rotulo={tx('Imposto retido')} opcional><CampoDinheiro valor={impostos} aoMudar={setImpostos} prefixo={simbolo(moeda)} /></Campo>}
          </div>
        )}
        {tipo === 'provento' && (
          <div className="campo">
            <span className="campo-rotulo">{tx('Que provento?')}</span>
            <div className="chips" role="radiogroup" aria-label={tx('Tipo de provento')}>
              {SUBTIPOS_PROVENTO.map((s) => <button key={s.id} type="button" role="radio" aria-checked={subtipo === s.id} className={`chip ${subtipo === s.id ? 'ativo' : ''}`} onClick={() => setSubtipo(s.id)}>{s.nome()}</button>)}
            </div>
          </div>
        )}
        {outraMoeda && usaValor && (
          <Campo rotulo={tx('Cotação do dia: 1 {0} em {1}', moeda, c.perfil.moeda)} opcional ajuda={c.taxas[moeda] ? tx('Em branco, vale a de hoje ({0}) e o resultado do câmbio desta operação fica zerado.', fmtValor(c.taxas[moeda])) : tx('Sem cotação, esta operação fica fora dos totais na sua moeda.')}>
            <span className="campo-caixa"><span className="prefixo">{simbolo()}</span><input inputMode="decimal" value={cotacao} onChange={(e) => setCotacao(soNumero(e.target.value))} placeholder="0,00" /></span>
          </Campo>
        )}
        {moveDinheiro && c.v.bancos && c.d.bancos.length > 0 && (
          <div className="campo">
            <span className="campo-rotulo">{tipo === 'compra' || tipo === 'taxa' || tipo === 'imposto' ? tx('De que conta o dinheiro saiu?') : tx('Em que conta o dinheiro caiu?')} <small>{tx('(opcional)')}</small></span>
            <select value={bancoId} onChange={(e) => setBancoId(e.target.value)}>
              <option value="">{tx('Não informar')}</option>
              {c.d.bancos.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
            </select>
            {bancoId && mesAberto && (
              <>
                <Interruptor ligado={mexeSaldo} aoMudar={setMexeSaldo} rotulo={tipo === 'compra' || tipo === 'taxa' || tipo === 'imposto' ? tx('Tirar do saldo dessa conta em Dinheiro guardado') : tx('Somar ao saldo dessa conta em Dinheiro guardado')} />
                <span className="campo-ajuda">{tx('Ligue se o saldo que você informou em {0} ainda não considera esta operação. Assim o dinheiro só muda de lugar e o patrimônio não conta em dobro.', mesEAno(anoOp, mesOp))}</span>
              </>
            )}
          </div>
        )}
        {ehRenda && (
          <div className="campo">
            <Interruptor ligado={comoEntrada} aoMudar={setComoEntrada} rotulo={tx('Contar também como entrada do mês')} />
            <span className="campo-ajuda">{tx('Cria um lançamento de entrada com o valor líquido. Deixe desligado se esse dinheiro já entra pelo extrato do banco.')}</span>
          </div>
        )}
        <Campo rotulo={tipo === 'transferencia' ? tx('Para qual instituição foi') : tx('Anotação')} opcional={tipo !== 'transferencia'}><input value={obs} onChange={(e) => setObs(e.target.value)} maxLength={tipo === 'transferencia' ? 80 : 500} /></Campo>
        {erro && <p className="form-erro">{erro}</p>}
        <div className="form-acoes">
          {op && <button type="button" className="btn perigo" onClick={() => void apagar()}>{tx('Apagar')}</button>}
          <button type="button" className="btn" onClick={aoFechar}>{tx('Cancelar')}</button>
          <button className="btn primario" disabled={salvando}>{tx('Salvar')}</button>
        </div>
      </form>
    </Modal>
  )
}

// ---------- atualizar valores ----------

export function AtualizarValores({ c, ativoId, aoFechar }: { c: Ctx; ativoId?: string; aoFechar: () => void }) {
  const inv = c.invest
  const abertas = inv.c.posicoes.filter((p) => p.aberta && (!ativoId || p.ativo.id === ativoId))
  const [data, setData] = useState(hojeLocal())
  const [valores, setValores] = useState<Record<string, string>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const salvar = async () => {
    if (!data || !dataPlausivel(data) || data > hojeLocal()) return setErro(tx('O dia do valor não pode ser no futuro.'))
    const novos = abertas.map((p) => ({ p, n: valores[p.ativo.id]?.trim() ? livre(valores[p.ativo.id]) : undefined })).filter((x) => x.n !== undefined)
    if (novos.some((x) => x.n === null || x.n! < 0 || valorGrandeDemais(x.n!))) return setErro(tx('Confira os valores: use só números, como 38,20.'))
    if (!novos.length) return aoFechar()
    setSalvando(true)
    let ok = true
    for (const { p, n } of novos) {
      if (!(await inv.d.salvarPreco({ ativo_id: p.ativo.id, data, natureza: p.ativo.por_valor ? 'saldo' : 'preco', valor: n!, moeda: p.ativo.moeda, fonte: 'manual' }))) ok = false
    }
    setSalvando(false)
    if (ok) aoFechar()
  }
  return (
    <Modal titulo={tx('Atualizar valores')} aoFechar={aoFechar} tamanho="grande">
      <form className="form inv-valores" onSubmit={(e) => { e.preventDefault(); void salvar() }}>
        <p className="inv-nota">{tx('Informe o preço de fechamento de cada cota ou o saldo de cada aplicação, como aparece na corretora. Deixe em branco o que não mudou. O app guarda quem informou e de que dia é o valor.')}</p>
        <Campo rotulo={tx('Os valores são de que dia?')}><CampoData valor={data} aoMudar={setData} rotulo={tx('Dia dos valores')} max={hojeLocal()} obrigatorio /></Campo>
        {abertas.length ? (
          <ul className="inv-valores-lista">
            {abertas.map((p) => (
              <li key={p.ativo.id}>
                <span className="inv-linha-texto">
                  <b>{rotuloDoAtivo(p.ativo)}</b>
                  <small>{fonteDoValor(p.avaliacao)}</small>
                </span>
                <label>
                  <small>{p.ativo.por_valor ? tx('Saldo') : tx('Preço da cota')}</small>
                  <span className="campo-caixa"><span className="prefixo">{simbolo(p.moeda)}</span>
                    <input inputMode="decimal" value={valores[p.ativo.id] ?? ''} onChange={(e) => setValores({ ...valores, [p.ativo.id]: soNumero(e.target.value) })}
                      placeholder={p.ativo.por_valor ? paraCampo(p.valor) : p.avaliacao.preco !== undefined ? paraCampoLivre(p.avaliacao.preco) : '0,00'} aria-label={tx('Valor de {0}', rotuloDoAtivo(p.ativo))} />
                  </span>
                </label>
              </li>
            ))}
          </ul>
        ) : <p className="quadro-vazio">{tx('Nenhum investimento em aberto para atualizar.')}</p>}
        {erro && <p className="form-erro">{erro}</p>}
        <div className="form-acoes">
          <button type="button" className="btn" onClick={aoFechar}>{tx('Cancelar')}</button>
          <button className="btn primario" disabled={salvando}>{tx('Salvar os valores')}</button>
        </div>
      </form>
    </Modal>
  )
}

// ---------- o plano ----------

const FOCOS: { id: Foco; nome: () => string }[] = [
  { id: 'crescer', nome: () => tx('Fazer o patrimônio crescer') }, { id: 'renda', nome: () => tx('Viver de renda aos poucos') },
  { id: 'liquidez', nome: () => tx('Ter dinheiro à mão e seguro') }, { id: 'acompanhar', nome: () => tx('Só acompanhar') },
]

export function FormPlano({ c, legado, aoFechar }: { c: Ctx; legado: { valor: number; ano: number; mes: number } | null; aoFechar: () => void }) {
  const p = c.invest.d.plano
  const [foco, setFoco] = useState<Foco | null>(p.foco)
  const [aporte, setAporte] = useState(p.aporteMensal ? paraCampo(p.aporteMensal) : '')
  const [meta, setMeta] = useState(p.metaPatrimonio ? paraCampo(p.metaPatrimonio) : '')
  const [prazo, setPrazo] = useState(p.metaPrazo ?? '')
  const [renda, setRenda] = useState(p.rendaAlvo ? paraCampo(p.rendaAlvo) : '')
  const [maxRV, setMaxRV] = useState(p.maxRendaVariavel !== null ? String(p.maxRendaVariavel) : '')
  const [cen, setCen] = useState({ pessimista: fmtTaxa(p.cenarios.pessimista), base: fmtTaxa(p.cenarios.base), otimista: fmtTaxa(p.cenarios.otimista) })
  const [somar, setSomar] = useState(p.legado === 'somar')
  const [erro, setErro] = useState<string | null>(null)
  const salvar = async () => {
    const dinheiro = (s: string) => (s.trim() ? parseNumero(s) : null)
    const [a, m, r] = [dinheiro(aporte), dinheiro(meta), dinheiro(renda)]
    if ([a, m, r].some((x) => x !== null && (x <= 0 || valorGrandeDemais(x)))) return setErro(tx('Confira os valores: use números maiores que zero.'))
    const rv = maxRV.trim() ? Number(maxRV.replace(',', '.')) : null
    if (rv !== null && (!Number.isFinite(rv) || rv < 0 || rv > 100)) return setErro(tx('O limite de renda variável vai de 0 a 100%.'))
    const taxas = { pessimista: parseTaxa(cen.pessimista), base: parseTaxa(cen.base), otimista: parseTaxa(cen.otimista) }
    if (Object.values(taxas).some((t) => t === null || t < -50 || t > 200)) return setErro(tx('Confira as hipóteses de rendimento ao ano.'))
    if (taxas.pessimista! > taxas.base! || taxas.base! > taxas.otimista!) return setErro(tx('O cenário pessimista não pode render mais que o base, nem o base mais que o otimista.'))
    const novo: Plano = { foco, aporteMensal: a, metaPatrimonio: m, metaPrazo: m && prazo ? prazo : null, rendaAlvo: r, maxRendaVariavel: rv,
      cenarios: { pessimista: taxas.pessimista!, base: taxas.base!, otimista: taxas.otimista! }, legado: somar ? 'somar' : 'substituir' }
    if (await c.invest.d.salvarPlano(novo)) aoFechar()
    else void avisar(tx('Não deu para salvar o plano agora. Tente de novo.'))
  }
  const campoTaxa = (k: keyof typeof cen, rotulo: string) => (
    <Campo rotulo={rotulo}><span className="campo-caixa"><input inputMode="decimal" value={cen[k]} onChange={(e) => setCen({ ...cen, [k]: e.target.value.replace(/[^\d.,-]/g, '').slice(0, 8) })} /><span className="prefixo">%</span></span></Campo>
  )
  return (
    <Modal titulo={tx('Seu plano de investimentos')} aoFechar={aoFechar} tamanho="tela" cor="var(--destaque)"
      palco={<Palco icone={<Icone nome="meta" tamanho={44} />} cor="var(--destaque)"><span className="palco-legenda">{tx('O plano é seu: o app só acompanha.')}</span></Palco>}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); void salvar() }}>
        <div className="campo">
          <span className="campo-rotulo">{tx('O que você mais quer com os investimentos?')}</span>
          <div className="chips" role="radiogroup" aria-label={tx('Foco')}>
            {FOCOS.map((f) => <button key={f.id} type="button" role="radio" aria-checked={foco === f.id} className={`chip ${foco === f.id ? 'ativo' : ''}`} onClick={() => setFoco(foco === f.id ? null : f.id)}>{f.nome()}</button>)}
          </div>
          <span className="campo-ajuda">{tx('As análises desse assunto aparecem primeiro. Nada fica escondido.')}</span>
        </div>
        <div className="form-linha">
          <Campo rotulo={tx('Aporte por mês')} opcional><CampoDinheiro valor={aporte} aoMudar={setAporte} prefixo={simbolo()} /></Campo>
          <Campo rotulo={tx('Renda por mês que você quer')} opcional><CampoDinheiro valor={renda} aoMudar={setRenda} prefixo={simbolo()} /></Campo>
        </div>
        <div className="form-linha">
          <Campo rotulo={tx('Meta de patrimônio investido')} opcional><CampoDinheiro valor={meta} aoMudar={setMeta} prefixo={simbolo()} /></Campo>
          <Campo rotulo={tx('Até quando?')} opcional><CampoMes valor={prazo} aoMudar={setPrazo} rotulo={tx('Até quando?')} min={hojeLocal().slice(0, 7)} /></Campo>
        </div>
        <Campo rotulo={tx('Quanto, no máximo, você quer ter em renda variável?')} opcional
          ajuda={tx('Ações, fundos imobiliários, ETFs e parecidos. O app não decide isso por você: só avisa se a carteira passar do limite que você escolher.')}>
          <span className="campo-caixa"><input inputMode="decimal" value={maxRV} onChange={(e) => setMaxRV(e.target.value.replace(/[^\d.,]/g, '').slice(0, 5))} placeholder="—" /><span className="prefixo">%</span></span>
        </Campo>
        <div className="campo">
          <span className="campo-rotulo">{tx('Hipóteses de rendimento ao ano')}</span>
          <div className="form-linha tres">{campoTaxa('pessimista', tx('Pessimista'))}{campoTaxa('base', tx('Base'))}{campoTaxa('otimista', tx('Otimista'))}</div>
          <span className="campo-ajuda">{tx('São suposições suas para as projeções, não previsões. Ninguém sabe quanto os investimentos vão render.')}</span>
        </div>
        {legado && (
          <div className="campo">
            <Interruptor ligado={somar} aoMudar={setSomar} rotulo={tx('Somar à carteira os {0} que eu informava à mão', fmtValor(legado.valor))} />
            <span className="campo-ajuda">{tx('Ligue só se aquele valor (de {0}) é de investimentos que você não cadastrou aqui. Desligado, o patrimônio usa só a carteira, e o valor antigo fica como histórico.', mesEAno(legado.ano, legado.mes))}</span>
          </div>
        )}
        {erro && <p className="form-erro">{erro}</p>}
        <div className="form-acoes">
          <button type="button" className="btn" onClick={aoFechar}>{tx('Cancelar')}</button>
          <button className="btn primario">{tx('Salvar o plano')}</button>
        </div>
      </form>
    </Modal>
  )
}

// ---------- por que estou vendo isso ----------

const NOME_CONFIANCA = { alta: () => tx('Alta'), media: () => tx('Média'), baixa: () => tx('Baixa') }

export function PorQue({ achado, aoFechar, aoIr }: { achado: Achado; aoFechar: () => void; aoIr: (destino: string) => void }) {
  const p = achado.porQue
  if (!p) return null
  return (
    <Modal titulo={tx('Por que estou vendo isso?')} aoFechar={aoFechar}>
      <div className="inv-porque" style={{ '--c': achado.tom ? COR_DO_TOM[achado.tom] : 'var(--destaque)' } as CSSProperties}>
        <h3>{achado.titulo}</h3>
        <p className="inv-porque-frase">{achado.frase}</p>
        <p>{p.explicacao}</p>
        <h4>{tx('Os números por trás')}</h4>
        <dl className="inv-conta">{p.dados.map((d, i) => <span key={i} className="inv-conta-par"><dt>{d.rotulo}</dt><dd>{d.valor}</dd></span>)}</dl>
        <ul className="inv-porque-meta">
          <li><Icone nome="calendario" tamanho={14} /> <span>{tx('Período')}</span><b>{p.periodo}</b></li>
          <li><Icone nome="relatorio" tamanho={14} /> <span>{tx('De onde vêm os dados')}</span><b>{p.fonte}</b></li>
          <li><Icone nome="escudo" tamanho={14} /> <span>{tx('Confiança')}</span><b className={`inv-confianca ${p.confianca}`}>{NOME_CONFIANCA[p.confianca]()}</b></li>
          <li><Icone nome="relogio" tamanho={14} /> <span>{tx('Calculado em')}</span><b>{fmtDataLonga(p.atualizadoEm) || fmtDataCurta(p.atualizadoEm)}</b></li>
        </ul>
        {p.ressalva && <p className="inv-nota"><Icone nome="sino" tamanho={15} /> {p.ressalva}</p>}
        <p className="inv-nota">{tx('Esta análise descreve a sua carteira com os dados que você informou. Não é recomendação de investimento.')}</p>
        <div className="form-acoes">
          <button className="btn" onClick={aoFechar}>{tx('Fechar')}</button>
          {p.acao && <button className="btn primario" onClick={() => aoIr(p.acao!.ir)}>{p.acao.rotulo} <Icone nome="seta" tamanho={15} /></button>}
        </div>
      </div>
    </Modal>
  )
}
