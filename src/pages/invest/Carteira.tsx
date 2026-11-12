/**
 * Invest → Carteira: cada investimento, com busca, filtro por tipo e ordenação, e o detalhe de um ativo (o que ele vale e de
 * onde vem esse valor, quanto custou, o resultado separado em partes e todas as operações, que dá para corrigir ou apagar).
 */
import { useMemo, useState, type CSSProperties } from 'react'
import { confirmar } from '../../lib/avisos'
import { fmtDataCurta, fmtMoeda, fmtValor } from '../../lib/format'
import { desempenho, linhaDoTempo, type Posicao } from '../../lib/invest/carteira'
import { diasEntre } from '../../lib/invest/indices'
import { CLASSES, infoClasse, NOME_INDEXADOR, nomeOperacao, nomeSubclasse, rotuloDoAtivo, type Classe, type Operacao } from '../../lib/invest/tipos'
import { fmtTaxa } from '../../lib/dinheiro'
import { fmtCurto } from '../../lib/visuais'
import { tx } from '../../lib/textos'
import { Icone } from '../../components/Icone'
import { Numero } from '../../components/Numero'
import { Rosquinha } from '../../components/Vitrine'
import type { Ctx } from '../contexto'
import { amostrar } from './analista'
import { Fatia, GraficoDeLinhas, Quadro, SeloDoValor, type AcoesInvest } from './apoio'
import { fmtQtd, fmtVariacao, fonteDoValor, tomDoNumero } from './formatos'

type Ordem = 'valor' | 'resultado' | 'nome' | 'vencimento'
const POR_PAGINA = 30
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Quanto o ativo rendeu sobre o que custou (resultado ÷ o que foi aplicado nele); null sem base. */
const retornoSimples = (p: Posicao) => (p.aplicadoP > 0 ? p.resultadoP / p.aplicadoP : null)

export function Carteira({ c, acoes }: { c: Ctx; acoes: AcoesInvest }) {
  const inv = c.invest
  const k = inv.c
  const nivel = c.perfil.detalhe
  const [busca, setBusca] = useState('')
  const [classe, setClasse] = useState<Classe | 'todos'>('todos')
  const [ordem, setOrdem] = useState<Ordem>('valor')
  const [encerrados, setEncerrados] = useState(false)
  const [pagina, setPagina] = useState(1)
  const comOperacao = k.posicoes.filter((p) => p.taxa !== null)
  const fechadas = comOperacao.filter((p) => !p.aberta)
  const classes = CLASSES.filter((x) => comOperacao.some((p) => p.ativo.classe === x.id && (p.aberta || encerrados)))
  const lista = (() => {
    const q = semAcento(busca.trim())
    const base = comOperacao.filter((p) => (p.aberta || encerrados)
      && (classe === 'todos' || p.ativo.classe === classe)
      && (!q || semAcento(`${p.ativo.nome} ${p.ativo.codigo ?? ''} ${p.ativo.instituicao ?? ''} ${p.ativo.emissor ?? ''}`).includes(q)))
    const por: Record<Ordem, (a: Posicao, b: Posicao) => number> = {
      valor: (a, b) => b.valorP - a.valorP,
      resultado: (a, b) => b.resultadoP - a.resultadoP,
      nome: (a, b) => rotuloDoAtivo(a.ativo).localeCompare(rotuloDoAtivo(b.ativo)),
      vencimento: (a, b) => (a.ativo.vencimento ?? '9999').localeCompare(b.ativo.vencimento ?? '9999'),
    }
    return base.sort((a, b) => Number(b.aberta) - Number(a.aberta) || por[ordem](a, b))
  })()
  const visiveis = lista.slice(0, pagina * POR_PAGINA)

  return (
    <>
      <section className="cartao inv-tres-topo">
        <ul className="inv-tres">
          <li>
            <small>{tx('Investido hoje')}</small>
            <b className="grande"><Numero valor={k.valor} formato={fmtValor} /></b>
            <span>{k.abertas.length === 1 ? tx('em 1 ativo') : tx('em {0} ativos', k.abertas.length)}</span>
          </li>
          <li>
            <small>{tx('Você aportou')}</small>
            <b>{fmtValor(k.aportadoLiquido)}</b>
            <span>{tx('o que pôs, menos o que tirou')}</span>
          </li>
          <li>
            <small>{tx('Resultado até hoje')}</small>
            <b className={tomDoNumero(k.resultado)}>{k.resultado > 0 ? '+' : ''}{fmtValor(k.resultado)}</b>
            <span>{tx('{0} no que você tem, {1} já no bolso', fmtValor(k.naoRealizado), fmtValor(k.realizado + k.proventos))}</span>
          </li>
        </ul>
      </section>

      <div className="inv-filtros">
        <label className="inv-busca">
          <Icone nome="busca" tamanho={17} />
          <input type="search" value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1) }} placeholder={tx('Buscar por nome, código ou instituição')} aria-label={tx('Buscar investimento')} />
        </label>
        <div className="chips" role="radiogroup" aria-label={tx('Tipo de investimento')}>
          <button role="radio" aria-checked={classe === 'todos'} className={`chip ${classe === 'todos' ? 'ativo' : ''}`} onClick={() => { setClasse('todos'); setPagina(1) }}>{tx('Todos')}</button>
          {classes.map((x) => (
            <button key={x.id} role="radio" aria-checked={classe === x.id} className={`chip ${classe === x.id ? 'ativo' : ''}`} onClick={() => { setClasse(x.id); setPagina(1) }}>{x.nome()}</button>
          ))}
        </div>
      </div>

      <section className="cartao inv-lista-cartao">
        <header className="inv-lista-cab">
          <h3><Icone nome="carteira" tamanho={17} /> {tx('Minha carteira')} <small>{lista.length === 1 ? tx('1 ativo') : tx('{0} ativos', lista.length)}</small></h3>
          <label className="inv-ordem">
            <span>{tx('Ordenar por')}</span>
            <select value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)}>
              <option value="valor">{tx('Maior valor')}</option>
              <option value="resultado">{tx('Maior resultado')}</option>
              <option value="nome">{tx('Nome')}</option>
              <option value="vencimento">{tx('Vencimento mais próximo')}</option>
            </select>
          </label>
        </header>
        {visiveis.length ? (
          <ul className="inv-ativos">
            {visiveis.map((p) => {
              const info = infoClasse(p.ativo.classe)
              const r = retornoSimples(p)
              return (
                <li key={p.ativo.id} className={p.aberta ? '' : 'encerrado'}>
                  <button onClick={() => acoes.abrirAtivo(p.ativo.id)} style={{ '--c': info.cor } as CSSProperties}>
                    <span className="inv-linha-ic"><Icone nome={info.icone} tamanho={18} /></span>
                    <span className="inv-ativo-nome">
                      <b>{rotuloDoAtivo(p.ativo)}</b>
                      <small>{[p.ativo.codigo ? p.ativo.nome : null, nomeSubclasse(p.ativo.subclasse) ?? info.nome(), p.ativo.instituicao].filter(Boolean).join(' · ')}</small>
                      {p.alertas.length > 0 && <span className="inv-selo antigo"><Icone nome="sino" tamanho={11} /> {p.alertas.includes('vencido') ? tx('venceu') : tx('confira as operações')}</span>}
                    </span>
                    <span className="inv-ativo-valor">
                      <b>{p.aberta ? fmtValor(p.valorP) : tx('Encerrado')}</b>
                      {p.aberta && <Fatia fracao={p.participacao} cor={info.cor} />}
                      <small>{p.aberta ? <>{fmtVariacao(p.participacao).replace('+', '')} {tx('da carteira')}</> : fmtDataCurta(p.ultimaOperacao)}</small>
                    </span>
                    <span className="inv-ativo-resultado">
                      <b className={tomDoNumero(p.resultadoP)}>{p.resultadoP > 0 ? '+' : ''}{fmtValor(p.resultadoP)}</b>
                      {r !== null && <small className={tomDoNumero(r)}>{fmtVariacao(r)}</small>}
                      {p.aberta && <SeloDoValor av={p.avaliacao} curto />}
                    </span>
                    <Icone nome="dir" tamanho={16} />
                  </button>
                </li>
              )
            })}
          </ul>
        ) : <p className="quadro-vazio">{busca || classe !== 'todos' ? tx('Nenhum investimento com esse filtro.') : tx('Nenhum investimento em aberto.')}</p>}
        {lista.length > visiveis.length && (
          <button className="btn an-mais" onClick={() => setPagina(pagina + 1)}><Icone nome="abaixo" tamanho={16} /> {tx('Mostrar mais {0}', Math.min(POR_PAGINA, lista.length - visiveis.length))}</button>
        )}
        {fechadas.length > 0 && (
          <button className="link inv-encerrados" onClick={() => setEncerrados(!encerrados)}>
            {encerrados ? tx('Esconder os encerrados') : fechadas.length === 1 ? tx('Mostrar 1 investimento encerrado') : tx('Mostrar {0} investimentos encerrados', fechadas.length)}
          </button>
        )}
      </section>

      <div className="inv-acoes-carteira">
        <button className="btn primario" onClick={acoes.novoAtivo}><Icone nome="mais" tamanho={16} /> {tx('Novo investimento')}</button>
        <button className="btn" onClick={() => acoes.novaOperacao()}><Icone nome="trocar" tamanho={16} /> {tx('Registrar operação')}</button>
        <button className="btn" onClick={() => acoes.atualizarValores()}><Icone nome="relogio" tamanho={16} /> {tx('Atualizar valores')}</button>
      </div>

      <section className="vt-grade-2">
        <Quadro icone="carteira" titulo={tx('Distribuição')}>
          <div className="inv-composicao">
            <Rosquinha partes={k.porClasse.map((f) => ({ rotulo: f.rotulo, valor: f.valor, cor: f.cor ?? 'var(--caixa)' }))} tamanho={c.mobile ? 128 : 150}><small>{fmtCurto(k.valor)}</small></Rosquinha>
            <ul className="inv-legenda">
              {k.porClasse.map((f) => <li key={f.id}><i style={{ background: f.cor }} /><span>{f.rotulo}</span><b>{fmtVariacao(f.fracao).replace('+', '')}</b><small>{fmtValor(f.valor)}</small></li>)}
            </ul>
          </div>
        </Quadro>
        <Quadro icone="inicio" titulo={tx('Corretoras e bancos')}>
          <ul className="inv-legenda larga">
            {k.porInstituicao.slice(0, 8).map((f) => <li key={f.id}><span>{f.rotulo}</span><b>{fmtVariacao(f.fracao).replace('+', '')}</b><small>{fmtValor(f.valor)}</small></li>)}
          </ul>
        </Quadro>
      </section>

      {nivel !== 'simples' && <Movimentacoes c={c} acoes={acoes} />}
    </>
  )
}

/** Todas as operações, da mais nova para a mais antiga, com busca e de 30 em 30. */
function Movimentacoes({ c, acoes, ativoId }: { c: Ctx; acoes: AcoesInvest; ativoId?: string }) {
  const inv = c.invest
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(1)
  const ativoDe = useMemo(() => new Map(inv.d.ativos.map((a) => [a.id, a])), [inv.d.ativos])
  const lista = useMemo(() => {
    const q = semAcento(busca.trim())
    return inv.d.operacoes.filter((o) => {
      if (ativoId && o.ativo_id !== ativoId) return false
      const a = ativoDe.get(o.ativo_id)
      return a && (!q || semAcento(`${a.nome} ${a.codigo ?? ''} ${nomeOperacao(o.tipo, a.por_valor)} ${o.data} ${o.obs ?? ''}`).includes(q))
    }).sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : (a.created_at ?? '') < (b.created_at ?? '') ? 1 : -1))
  }, [inv.d.operacoes, ativoDe, busca, ativoId])
  const apagar = async (o: Operacao) => {
    const a = ativoDe.get(o.ativo_id)
    if (!a || !(await confirmar(tx('Apagar esta operação? A posição, o custo e o resultado de {0} serão refeitos sem ela.', rotuloDoAtivo(a)), { titulo: tx('Apagar operação'), botao: tx('Apagar'), perigo: true }))) return
    if (await inv.d.delOperacao(o.id)) {
      c.ajustarSaldosDaOperacao(o, undefined)
      if (o.lancamento_id) void c.d.delLanc(o.lancamento_id)
    }
  }
  return (
    <section className="cartao inv-lista-cartao">
      <header className="inv-lista-cab">
        <h3><Icone nome="historico" tamanho={17} /> {tx('Movimentações')} <small>{lista.length}</small></h3>
        {!ativoId && (
          <label className="inv-busca pequena">
            <Icone nome="busca" tamanho={15} />
            <input type="search" value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1) }} placeholder={tx('Buscar operação')} aria-label={tx('Buscar operação')} />
          </label>
        )}
      </header>
      {lista.length ? (
        <ul className="inv-ops">
          {lista.slice(0, pagina * POR_PAGINA).map((o) => {
            const a = ativoDe.get(o.ativo_id)!
            const entra = o.tipo === 'compra' || o.tipo === 'bonificacao' || (o.tipo === 'ajuste' && o.valor >= 0)
            const futura = o.data > inv.c.hoje
            return (
              <li key={o.id} className={futura ? 'futura' : ''}>
                <span className="inv-op-data">{fmtDataCurta(o.data)}</span>
                <span className="inv-op-texto">
                  <b>{nomeOperacao(o.tipo, a.por_valor)}{!ativoId && <> · {rotuloDoAtivo(a)}</>}</b>
                  <small>
                    {[
                      o.quantidade && !a.por_valor ? tx('{0} × {1}', fmtQtd(o.quantidade), o.preco !== null ? fmtMoeda(o.preco, o.moeda ?? c.perfil.moeda) : '?') : null,
                      o.fator ? tx('fator {0}', fmtQtd(o.fator)) : null,
                      o.custos ? tx('taxas {0}', fmtValor(o.custos)) : null, o.impostos ? tx('imposto {0}', fmtValor(o.impostos)) : null,
                      futura ? tx('previsto') : null,
                      o.origem === 'importacao' ? tx('importado') : o.origem === 'posicao' ? tx('posição inicial') : null,
                      o.atualizado_em ? tx('corrigido') : null, o.obs,
                    ].filter(Boolean).join(' · ')}
                  </small>
                </span>
                <b className={`inv-op-valor ${o.tipo === 'provento' || o.tipo === 'juros' ? 'bom' : ''}`}>
                  {o.valor ? `${entra ? '' : o.tipo === 'provento' || o.tipo === 'juros' ? '+' : ''}${fmtMoeda(o.valor, o.moeda ?? a.moeda ?? c.perfil.moeda)}` : '—'}
                </b>
                <span className="inv-op-acoes">
                  <button className="icone-btn" onClick={() => acoes.editarOperacao(o)} aria-label={tx('Corrigir operação')} title={tx('Corrigir operação')}><Icone nome="lapis" tamanho={15} /></button>
                  <button className="icone-btn" onClick={() => void apagar(o)} aria-label={tx('Apagar operação')} title={tx('Apagar operação')}><Icone nome="lixeira" tamanho={15} /></button>
                </span>
              </li>
            )
          })}
        </ul>
      ) : <p className="quadro-vazio">{tx('Nenhuma operação por aqui.')}</p>}
      {lista.length > pagina * POR_PAGINA && (
        <button className="btn an-mais" onClick={() => setPagina(pagina + 1)}><Icone nome="abaixo" tamanho={16} /> {tx('Mostrar mais {0}', Math.min(POR_PAGINA, lista.length - pagina * POR_PAGINA))}</button>
      )}
    </section>
  )
}

/** O detalhe de um investimento: o valor e de onde ele vem, o custo, o resultado em partes, as características e as operações. */
export function DetalheDoAtivo({ c, p, acoes }: { c: Ctx; p: Posicao; acoes: AcoesInvest }) {
  const inv = c.invest
  const a = p.ativo
  const info = infoClasse(a.classe)
  const fmt = (n: number) => fmtMoeda(n, p.moeda)
  const emOutraMoeda = p.moeda !== c.perfil.moeda
  const linha = useMemo(() => linhaDoTempo(inv.entrada, { ativos: new Set([a.id]) }), [inv.entrada, a.id])
  const d = useMemo(() => desempenho(linha, null), [linha])
  const amostra = useMemo(() => amostrar(linha, null, inv.c.hoje, 40), [linha, inv.c.hoje])
  const precos = inv.d.precos.filter((x) => x.ativo_id === a.id).sort((x, y) => (x.data < y.data ? 1 : -1))
  const pontas = [
    a.indexador && a.taxa !== null ? { rotulo: tx('Como rende'), valor: a.indexador === 'pre' ? tx('{0}% ao ano', fmtTaxa(a.taxa)) : a.indexador === 'ipca' ? tx('IPCA + {0}% ao ano', fmtTaxa(a.taxa)) : tx('{0}{1}', fmtTaxa(a.taxa), NOME_INDEXADOR[a.indexador]()) } : null,
    a.vencimento ? { rotulo: tx('Vencimento'), valor: `${fmtDataCurta(a.vencimento)}${a.vencimento >= inv.c.hoje ? ` (${tx('em {0} dias', diasEntre(inv.c.hoje, a.vencimento))})` : ''}` } : null,
    a.liquidez ? { rotulo: tx('Liquidez'), valor: a.liquidez === 'diaria' ? tx('Todo dia') : a.liquidez === 'vencimento' ? tx('Só no vencimento') : tx('{0} dias depois do pedido', a.liquidez_dias ?? 0) } : null,
    a.instituicao ? { rotulo: tx('Instituição'), valor: a.instituicao } : null,
    a.emissor ? { rotulo: tx('Emissor'), valor: a.emissor } : null,
    a.setor ? { rotulo: tx('Setor'), valor: a.setor } : null,
    emOutraMoeda ? { rotulo: tx('Moeda'), valor: p.taxa ? tx('{0} (1 = {1} hoje)', p.moeda, fmtValor(p.taxa)) : p.moeda } : null,
    a.obs ? { rotulo: tx('Anotação'), valor: a.obs } : null,
  ].filter((x): x is { rotulo: string; valor: string } => x !== null)
  const excluir = async () => {
    if (!(await confirmar(tx('Apagar {0} com todas as operações e valores informados? Isso não pode ser desfeito.', rotuloDoAtivo(a)), { titulo: tx('Apagar investimento'), botao: tx('Apagar tudo'), perigo: true }))) return
    const ops = inv.d.operacoes.filter((o) => o.ativo_id === a.id)
    if (await inv.d.delAtivo(a.id)) {
      for (const o of ops) { c.ajustarSaldosDaOperacao(o, undefined); if (o.lancamento_id) void c.d.delLanc(o.lancamento_id) }
      acoes.abrirAtivo(null)
    }
  }
  return (
    <>
      <header className="inv-ativo-topo" style={{ '--c': info.cor } as CSSProperties}>
        <button className="link voltar" onClick={() => acoes.abrirAtivo(null)}><Icone nome="esq" tamanho={16} /> {tx('Toda a carteira')}</button>
        <div className="inv-ativo-titulo">
          <span className="inv-linha-ic grande"><Icone nome={info.icone} tamanho={24} /></span>
          <div>
            <h2>{rotuloDoAtivo(a)}</h2>
            <p>{[a.codigo ? a.nome : null, nomeSubclasse(a.subclasse) ?? info.nome(), a.instituicao].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
        <div className="inv-topo-acoes">
          <button className="btn primario" onClick={() => acoes.novaOperacao({ ativoId: a.id })}><Icone nome="mais" tamanho={16} /> {tx('Registrar operação')}</button>
          <button className="btn" onClick={() => acoes.atualizarValores(a.id)}><Icone nome="relogio" tamanho={16} /> {a.por_valor ? tx('Informar saldo') : tx('Informar preço')}</button>
          <button className="btn" onClick={() => acoes.editarAtivo(a)}><Icone nome="lapis" tamanho={15} /> {tx('Editar')}</button>
        </div>
      </header>

      {p.alertas.includes('venda-maior') && (
        <div className="alerta" role="status"><span>{tx('Pelas operações cadastradas, foi vendido mais do que havia. Confira se falta alguma compra (ou bonificação) ou se uma venda entrou duas vezes: até lá, quantidade, custo e resultado não são confiáveis.')}</span></div>
      )}
      {p.alertas.includes('vencido') && (
        <div className="alerta inv-aviso" role="status">
          <span>{tx('Este título venceu em {0}. Registre o vencimento com o valor que voltou para a conta.', fmtDataCurta(a.vencimento))}</span>
          <button className="link" onClick={() => acoes.novaOperacao({ ativoId: a.id, tipo: 'vencimento' })}>{tx('Registrar o vencimento')}</button>
        </div>
      )}

      <section className="cartao inv-tres-topo">
        <ul className="inv-tres quatro">
          <li>
            <small>{p.aberta ? tx('Vale hoje') : tx('Posição')}</small>
            <b className="grande">{p.aberta ? fmt(p.valor) : tx('Encerrada')}</b>
            <span>{p.aberta ? <SeloDoValor av={p.avaliacao} /> : fmtDataCurta(p.ultimaOperacao)}{emOutraMoeda && p.aberta ? ` ${fmtValor(p.valorP)}` : ''}</span>
          </li>
          <li>
            <small>{tx('Custo do que você tem')}</small>
            <b>{fmt(p.custo)}</b>
            <span>{p.custoMedio !== null ? tx('{0} × {1} de custo médio', fmtQtd(p.quantidade), fmt(p.custoMedio)) : tx('aplicado {0}, retirado {1}', fmt(p.aplicado), fmt(p.retirado))}</span>
          </li>
          <li>
            <small>{tx('Resultado')}</small>
            <b className={tomDoNumero(p.resultado)}>{p.resultado > 0 ? '+' : ''}{fmt(p.resultado)}</b>
            <span>{d && d.rentabilidade !== null ? tx('{0} de rentabilidade', fmtVariacao(d.rentabilidade)) : tx('desde {0}', fmtDataCurta(p.primeiraOperacao))}</span>
          </li>
          <li>
            <small>{tx('Na carteira')}</small>
            <b>{fmtVariacao(p.participacao).replace('+', '')}</b>
            <Fatia fracao={p.participacao} cor={info.cor} />
          </li>
        </ul>
      </section>

      <section className="vt-grade-2">
        <Quadro icone="ideia" titulo={tx('Como chegamos a esses números')}>
          <dl className="inv-conta">
            {!a.por_valor && <><dt>{tx('Quantidade')}</dt><dd>{fmtQtd(p.quantidade)}</dd></>}
            {p.avaliacao.preco !== undefined && <><dt>{tx('Preço usado')}</dt><dd>{fmt(p.avaliacao.preco)}</dd></>}
            <dt>{tx('De onde vem o valor')}</dt><dd>{fonteDoValor(p.avaliacao)}</dd>
            <dt>{tx('Tudo o que você pôs')}</dt><dd>{fmt(p.aplicado)}</dd>
            <dt>{tx('Tudo o que voltou (vendas, resgates)')}</dt><dd>{fmt(p.retirado)}</dd>
            <dt>{tx('Ganho no que ainda tem')}</dt><dd className={tomDoNumero(p.naoRealizado)}>{fmt(p.naoRealizado)}</dd>
            <dt>{tx('Ganho no que já vendeu ou resgatou')}</dt><dd className={tomDoNumero(p.realizado)}>{fmt(p.realizado)}</dd>
            <dt>{tx('Proventos e juros recebidos')}</dt><dd className={tomDoNumero(p.proventos)}>{fmt(p.proventos)}</dd>
            {(p.custosPagos > 0 || p.impostosPagos > 0) && <><dt>{tx('Taxas e impostos informados')}</dt><dd>{fmt(p.custosPagos + p.impostosPagos)}</dd></>}
            {emOutraMoeda && <><dt>{tx('Resultado só do câmbio')}</dt><dd className={tomDoNumero(p.cambialP)}>{fmtValor(p.cambialP)}</dd></>}
          </dl>
          <p className="inv-nota">{a.por_valor
            ? tx('O saldo parte do último valor informado e soma o que entrou e saiu depois. Com a taxa do título preenchida, o app estima o rendimento pelos índices oficiais (valor bruto).')
            : tx('O custo usa o preço médio das compras, com as taxas. O valor é a quantidade vezes o último preço conhecido: o app não busca cotação sozinho.')}</p>
        </Quadro>
        <Quadro icone="relatorio" titulo={tx('Sobre este investimento')}>
          {pontas.length ? <dl className="inv-conta">{pontas.map((x) => <span key={x.rotulo} className="inv-conta-par"><dt>{x.rotulo}</dt><dd>{x.valor}</dd></span>)}</dl>
            : <p className="quadro-vazio">{tx('Preencha taxa, vencimento, liquidez e setor em Editar: as análises ficam mais completas.')}</p>}
        </Quadro>
      </section>

      {amostra.pontos.length >= 2 && linha.length >= 2 && (
        <Quadro icone="ano" titulo={tx('Evolução')}>
          <GraficoDeLinhas formato={fmtCurto} altura={c.mobile ? 160 : 200} rotulos={amostra.rotulos} series={[
            { nome: tx('Vale'), cor: info.cor, valores: amostra.pontos.map((x) => x?.valor ?? null), area: true },
            { nome: tx('Você aportou'), cor: 'var(--an-destino)', valores: amostra.pontos.map((x) => x?.aportado ?? null), tracejada: true },
          ]} />
        </Quadro>
      )}

      <Movimentacoes c={c} acoes={acoes} ativoId={a.id} />

      {precos.length > 0 && (
        <Quadro icone="relogio" titulo={a.por_valor ? tx('Saldos informados') : tx('Preços informados')}>
          <ul className="inv-ops">
            {precos.slice(0, 12).map((x) => (
              <li key={x.id}>
                <span className="inv-op-data">{fmtDataCurta(x.data)}</span>
                <span className="inv-op-texto"><b>{x.natureza === 'saldo' ? tx('Saldo') : tx('Preço')}</b><small>{x.fonte === 'manual' ? tx('informado por você') : x.fonte === 'importacao' ? tx('arquivo importado') : x.fonte}</small></span>
                <b className="inv-op-valor">{fmt(x.valor)}</b>
                <span className="inv-op-acoes"><button className="icone-btn" onClick={() => void inv.d.delPreco(x.id)} aria-label={tx('Apagar este valor')} title={tx('Apagar este valor')}><Icone nome="lixeira" tamanho={15} /></button></span>
              </li>
            ))}
          </ul>
        </Quadro>
      )}

      <button className="link inv-excluir" onClick={() => void excluir()}><Icone nome="lixeira" tamanho={15} /> {tx('Apagar este investimento')}</button>
    </>
  )
}
