import { COR } from '../lib/charts'
import { SEM_CATEGORIA } from '../lib/categorias'
import { FORMAS, infoForma, type FormaPagamento } from '../lib/formas'
import { fmtDataCurta, fmtDataLonga, fmtMoeda, fmtValor, MESES_NOME, noMeioDaFrase } from '../lib/format'
import { ehEmprestimo } from '../lib/dividas'
import { ehGuardado } from '../lib/guardado'
import { NOME_TIPO_CAIXA } from '../lib/rotulos'
import type { Banco, Categoria, Lancamento } from '../lib/types'
import { Icone } from '../components/Icone'
import { CenaLancamentos } from '../components/Vazios'
import { Segmentado } from '../components/ui'
import { Seletor } from '../components/Escolhas'
import type { Ctx } from './contexto'
import { estornoTotal, foiEstornado, valorAntesDoEstorno } from '../lib/estorno'
import { tx } from '../lib/textos'
import { somaPrevistos, type Previsto } from '../lib/previstos'
import { ResumoDoMes } from './lancamentos/ResumoDoMes'
import { doisDig, somaDias, somaTipo, useLancamentosFiltrados, type Filtro } from './lancamentos/useLancamentos'
import { pagoDaFatura } from '../lib/cartoes'

export const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', tx('sáb')]
const SEMANA_LETRA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

/**
 * Lançamentos do mês em duas colunas. À esquerda, presa ao rolar: o calendário do mês (cada dia mais forte quanto mais
 * saiu; tocar filtra o dia) e "Para onde foi", as categorias em barras (tocar filtra a categoria). À direita: o resumo
 * (entrou, saiu, sobrou), a barra de filtros e os lançamentos em cartões, numa linha do tempo por dia ou pelos maiores.
 */
export function Lancamentos(c: Ctx) {
  const {
    tipo, setTipo, banco, setBanco, forma, setForma, categoria, dia, setCategoria, setDia, ordem, setOrdem, todasCategorias, setTodasCategorias, busca, setBusca, hoje, pesquisando, origem, temNoMes, previstos, comCalendario, noCartao, comprasNoCartao, totalNoCartao, semDia, filtrados, grupos, tipoChips, chips, entrou, saiu, filtrando, limpar, formasDoMes, valorDaForma, bancoDe, cartaoDe, totalChips, chipsVisiveis, comBancos, comFormas, nivel,
  } = useLancamentosFiltrados(c)
  const cartao = (l: Lancamento, i: number, mostrarData: boolean) => (
    <CartaoLancamento key={l.id} l={l} indice={i} categoria={c.categoriaDe(l)} banco={bancoDe(l)} cartao={cartaoDe(l)} emprestimo={ehEmprestimo(l, c.d.dividas)}
      guardadoEm={ehGuardado(l) ? c.d.bancos.find((b) => b.id === l.guardado_banco_id) : undefined} mostrarData={mostrarData} aoClicar={() => c.editarLancamento(l)} />
  )

  return (
    <div className="pagina pg-lanc">
      <header className="pagina-topo">
        <div>
          <h1>{tx('Lançamentos')}</h1>
          <p className="sub">{pesquisando ? tx('Busca em {0} inteiro · {1}', c.ano, filtrados.length) : tx('{0} de {1} · {2}', MESES_NOME[c.mes - 1], c.ano, filtrados.length)} {filtrados.length === 1 ? tx('lançamento') : tx('lançamentos')}{filtrando ? (' ' + tx('com os filtros')) : ''}</p>
        </div>
        <div className="lc-topo-acoes">
          <button className="btn" onClick={c.importarExtrato} title={tx('PDF, CSV, Excel, Word ou OFX do banco')}>{tx('Importar extrato')}</button>
          <button className="btn" onClick={c.organizarNomes}>{tx('Organizar nomes')}</button>
          <span className="so-desktop lc-topo-novo">
            <button className="btn lc-btn-entrada" onClick={() => c.novoLancamento('entrada')}>+ {tx('Entrada')}</button>
            <button className="btn lc-btn-saida" onClick={() => c.novoLancamento('saida')}>− {tx('Saída')}</button>
          </span>
        </div>
      </header>

      {noCartao.length > 0 && (
        <section className="lc-nota-cartao" aria-label={tx('Compras no cartão')}>
          <Icone nome="cartao" tamanho={18} />
          <span>
            {pesquisando
              ? (comprasNoCartao === 1 ? tx('1 compra no cartão combina com a busca.') : tx('{0} compras no cartão combinam com a busca.', comprasNoCartao))
              : (comprasNoCartao === 1 ? tx('1 compra no cartão na fatura de {0} ({1}) fica na tela Cartões.', noMeioDaFrase(MESES_NOME[c.mes - 1]), fmtValor(totalNoCartao)) : tx('{0} compras no cartão na fatura de {1} ({2}) ficam na tela Cartões.', comprasNoCartao, noMeioDaFrase(MESES_NOME[c.mes - 1]), fmtValor(totalNoCartao)))}
            {!pesquisando && pagoDaFatura(c.faturas)}
          </span>
          <button className="btn" onClick={() => c.irPara('cartoes')}>{tx('Ver em Cartões')} <Icone nome="seta" tamanho={14} /></button>
        </section>
      )}

      <div className={`lc-grade ${comCalendario ? '' : 'sem-lado'}`}>
        {comCalendario && (
          <aside className="lc-lado">
            <CalorDoMes ano={c.ano} mes={c.mes} lancs={semDia} previstos={previstos} dia={dia} hoje={hoje} aoEscolher={(d) => setDia(d === dia ? null : d)} />

            {chips.length > 0 && (
              <section className="cartao lc-cats" aria-label={tx('Categorias')}>
                <header className="lc-cats-cab">
                  <h3 className="ccd-titulo">{tipoChips === 'entrada' ? tx('De onde veio') : tx('Para onde foi')}</h3>
                  <button className="link" onClick={c.gerenciarCategorias}>{tx('Editar categorias')}</button>
                </header>
                <div className="lc-cats-lista">
                  {chipsVisiveis.map((k, i) => (
                    <button key={k.id} className={`lc-cat ${categoria === k.id ? 'ativo' : ''} ${categoria !== 'todos' && categoria !== k.id ? 'apagado' : ''}`}
                      style={{ '--c': k.cor, '--p': totalChips ? k.total / chips[0].total : 0, animationDelay: `${i * 40}ms` } as React.CSSProperties}
                      onClick={() => setCategoria(categoria === k.id ? 'todos' : k.id)} aria-pressed={categoria === k.id}
                      title={k.n === 1 ? tx('1 lançamento') : tx('{0} lançamentos', k.n)}>
                      <span className="lc-cat-nome">{k.nome}</span>
                      <span className="lc-cat-valor">{fmtValor(k.total)}<small>{totalChips ? Math.round((k.total / totalChips) * 100) : 0}%</small></span>
                      <span className="lc-cat-barra"><i /></span>
                    </button>
                  ))}
                </div>
                {chips.length > 6 && (
                  <button className="link lc-cats-mais" onClick={() => setTodasCategorias(!todasCategorias)}>
                    {todasCategorias ? tx('Mostrar menos') : tx('Ver todas as {0}', chips.length)}
                  </button>
                )}
              </section>
            )}
          </aside>
        )}

        <div className="lc-principal">
          {dia && comCalendario && (
            <NoDia dia={dia} hoje={hoje} lancs={semDia.filter((l) => l.data === dia)} previstos={previstos.get(dia) ?? []} aoFechar={() => setDia(null)}
              aoAbrir={(p) => c.irPara(p.origem === 'conta' ? 'contas' : p.origem === 'cartao' ? 'cartoes' : 'dividas')} />
          )}
          {(entrou > 0 || saiu > 0 || filtrando) && !(dia && comCalendario) && (
            <ResumoDoMes lancs={filtrados} entrou={entrou} saiu={saiu} ano={c.ano} mes={c.mes} hoje={hoje}
              quantos={nivel === 'detalhado' && filtrados.length ? filtrados.length : undefined} />
          )}

          {(temNoMes || filtrando) && (
            <section className="lc-barra">
              <label className="busca">
                <Icone nome="busca" tamanho={16} />
                <input type="search" placeholder={tx('Buscar por nome, valor ou data')} value={busca} onChange={(e) => setBusca(e.target.value)} />
              </label>
              <Segmentado rotulo={tx('Tipo')} valor={tipo} aoMudar={(t) => { setTipo(t); setCategoria('todos') }}
                opcoes={[{ id: 'todos', nome: tx('Todos') }, { id: 'entrada', nome: tx('Entradas'), cor: COR.entradas }, { id: 'saida', nome: tx('Saídas'), cor: COR.saidas }]} />
              {nivel !== 'simples' && (
                <Segmentado rotulo={tx('Ordem')} valor={ordem} aoMudar={setOrdem}
                  opcoes={[{ id: 'data', nome: tx('Por dia') }, { id: 'valor', nome: tx('Maiores') }]} />
              )}
              {nivel === 'detalhado' && comBancos && (
                <Seletor className={`lc-select ${banco !== 'todos' ? 'ativo' : ''}`} valor={banco} aoMudar={setBanco} rotulo={tx('Banco')}
                  opcoes={[
                    { valor: 'todos', rotulo: tx('Todos os bancos') },
                    ...c.d.bancos.map((b) => ({ valor: b.id, rotulo: b.nome, cor: b.cor })),
                    { valor: 'sem', rotulo: tx('Sem banco') },
                  ]} />
              )}
              {nivel === 'detalhado' && comFormas && (
                <Seletor className={`lc-select ${forma !== 'todos' ? 'ativo' : ''}`} valor={forma} rotulo={tx('Forma de pagamento')}
                  aoMudar={(v) => setForma(v as Filtro<FormaPagamento | 'sem'>)}
                  opcoes={[
                    { valor: 'todos', rotulo: tx('Todas as formas') },
                    ...FORMAS.filter((f) => formasDoMes.has(f.id) || forma === f.id).map((f) => ({ valor: f.id, rotulo: f.nome, detalhe: valorDaForma(f.id), cor: f.cor })),
                    ...((formasDoMes.has('sem') || forma === 'sem') ? [{ valor: 'sem', rotulo: tx('Sem forma'), detalhe: valorDaForma('sem') }] : []),
                  ]} />
              )}
            </section>
          )}

          {filtrando && (
            <div className="lc-filtrando">
              {pesquisando && <span className="chip-info">{tx('Em {0} inteiro', c.ano)}</span>}
              {dia && <span className="chip-info">{fmtDataLonga(dia)}</span>}
              {categoria !== 'todos' && <span className="chip-info">{categoria === 'sem' ? SEM_CATEGORIA.nome : chips.find((k) => k.id === categoria)?.nome ?? c.categorias.find((k) => k.id === categoria)?.nome ?? tx('Categoria')}</span>}
              <span>{tx('{0} de {1}', filtrados.length, origem.length)}</span>
              <button className="link" onClick={limpar}><Icone nome="fechar" tamanho={13} /> {tx('Limpar filtros')}</button>
            </div>
          )}

          {!filtrados.length && dia && comCalendario ? null : !filtrados.length ? (
            <section className={`cartao ${filtrando ? 'lc-vazio' : tx('lc-vazio vz-vazio')}`}>
              {filtrando ? <span className="lc-vazio-icone"><Icone nome="busca" tamanho={30} /></span> : <CenaLancamentos />}
              {filtrando
                ? <><strong>{tx('Nada com esses filtros')}</strong>{pesquisando && <p>{tx('A busca olha {0} inteiro: nome, valor (150 ou 150,40) ou data (25/10, outubro, 2025). Para outro ano, troque o ano no topo.', c.ano)}</p>}</>
                : <h2>{c.d.lancs.length === 0 ? tx('Comece a fazer seus lançamentos') : tx('Nada lançado em {0}', noMeioDaFrase(MESES_NOME[c.mes - 1]))}</h2>}
              {!filtrando && <p>{c.d.lancs.length === 0
                ? tx('Registre o que entrou e o que saiu, um por um, ou traga tudo de uma vez do extrato do seu banco. O painel se monta sozinho.')
                : tx('Quando você lançar algo neste mês, ele aparece aqui, dia a dia.')}</p>}
              {filtrando
                ? <button className="btn" onClick={limpar}>{tx('Limpar filtros')}</button>
                : <span className="lc-vazio-acoes">
                    <button className="btn lc-btn-entrada" onClick={() => c.novoLancamento('entrada')}>+ {tx('Entrada')}</button>
                    <button className="btn lc-btn-saida" onClick={() => c.novoLancamento('saida')}>− {tx('Saída')}</button>
                    <button className="btn" onClick={c.importarExtrato}>{tx('Importar extrato ou planilha')}</button>
                  </span>}
            </section>
          ) : ordem === 'valor' ? (
            <div className="lc-cartoes">{filtrados.map((l, i) => cartao(l, i, true))}</div>
          ) : (
            <div className="lc-linha-tempo">
              {grupos.map(([d, itens], gi) => {
                const saldo = itens.filter((l) => !ehGuardado(l)).reduce((a, l) => a + (l.tipo === 'entrada' ? l.valor : -l.valor), 0)
                const data = d ? new Date(`${d}T12:00:00`) : null
                const ontem = data && d === somaDias(hoje, -1)
                return (
                  <section key={d} className={`lc-dia ${d === hoje ? 'hoje' : ''} ${d === dia ? 'ativo' : ''}`} style={{ animationDelay: `${Math.min(gi, 8) * 50}ms` }}>
                    <button className="lc-dia-marco" onClick={() => d && setDia(d === dia ? null : d)} title={tx('Mostrar só este dia')} disabled={!d}>
                      <b>{data ? doisDig(data.getDate()) : '—'}</b>
                      <small>{data ? SEMANA[data.getDay()] : ''}</small>
                    </button>
                    <div className="lc-dia-corpo">
                      <header className="lc-dia-cab">
                        <span className="lc-dia-nome">{d === hoje ? tx('Hoje') : ontem ? tx('Ontem') : d ? fmtDataLonga(d) : tx('Sem data')}</span>
                        <small>{itens.length} {itens.length === 1 ? tx('lançamento') : tx('lançamentos')}</small>
                        <span className={`lc-dia-saldo ${saldo < 0 ? 'negativo' : 'positivo'}`}>{saldo < 0 ? '−' : '+'} {fmtValor(Math.abs(saldo))}</span>
                      </header>
                      <div className="lc-cartoes">{itens.map((l, i) => cartao(l, i, false))}</div>
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Um lançamento como cartão: a categoria em cima, na cor dela (sem selo), a descrição, o valor grande e, embaixo, em
 * texto, o que ele é além de um gasto comum (banco, forma, cartão e parcela, dívida, conta do mês, outra moeda).
 */
function CartaoLancamento({ l, banco, categoria, cartao, emprestimo, guardadoEm, aoClicar, mostrarData, indice }: {
  l: Lancamento; banco?: Banco; categoria?: Categoria; cartao?: { nome: string; cor: string }; emprestimo?: boolean; guardadoEm?: Banco
  aoClicar: () => void; mostrarData: boolean; indice: number
}) {
  const entrada = l.tipo === 'entrada'
  const k = categoria ?? SEM_CATEGORIA
  const parcelado = Boolean(l.compra_id && (l.parcelas ?? 1) > 1)
  const etiquetas = [
    banco && { id: 'bc', texto: banco.nome, cor: banco.cor },
    l.guardado_banco_id && { id: 'gd', texto: guardadoEm ? tx('Guardado em {0} ({1})', guardadoEm.nome, NOME_TIPO_CAIXA[l.guardado_tipo ?? 'caixinha'].toLowerCase()) : tx('Guardado'), cor: guardadoEm?.cor, classe: 'guardado-em' },
    l.cartao_id && { id: 'cc', texto: cartao ? tx('Cartão {0}', cartao.nome) : tx('Cartão'), cor: cartao?.cor },
    parcelado && { id: 'pc', texto: tx('Parcela {0} de {1}', l.parcela, l.parcelas) },
    !l.cartao_id && l.forma && { id: 'fp', texto: infoForma(l.forma).nome },
    l.divida_id && { id: 'dv', texto: emprestimo ? (entrada ? tx('Dinheiro emprestado') : tx('Empréstimo que você fez')) : entrada ? tx('Recebido de quem devia') : tx('Pagamento de dívida') },
    l.conta_fixa_id && { id: 'cf', texto: tx('Todo mês') },
    foiEstornado(l) && { id: 'es', texto: estornoTotal(l) ? tx('Estornada') : tx('Estorno de {0}', fmtValor(l.estorno_valor!)), classe: 'estorno' },
  ].filter(Boolean) as { id: string; texto: string; cor?: string; classe?: string }[]
  return (
    <button className={`lc-card ${entrada ? 'entrada' : ''} ${ehGuardado(l) ? 'guardado' : ''} ${estornoTotal(l) ? 'estornado' : ''}`} onClick={aoClicar}
      style={{ '--c': k.cor, animationDelay: `${Math.min(indice, 12) * 30}ms` } as React.CSSProperties}>
      <span className="lc-card-topo">
        <span className="lc-card-cat">{k.nome}</span>
        {mostrarData && l.data && <small>{fmtDataCurta(l.data)}</small>}
      </span>
      <span className="lc-card-desc">{l.descricao || (entrada ? tx('Entrada') : tx('Saída'))}</span>
      <span className="lc-card-valor">
        {estornoTotal(l) ? <s>{fmtValor(valorAntesDoEstorno(l))}</s> : <>{entrada ? '+' : '−'} {fmtValor(l.valor)}</>}
        {foiEstornado(l) && !estornoTotal(l) && <small><s>{fmtValor(valorAntesDoEstorno(l))}</s></small>}
        {l.moeda_original && l.valor_original != null && <small>{fmtMoeda(l.valor_original, l.moeda_original)}</small>}
      </span>
      {etiquetas.length > 0 && (
        <span className="lc-card-etiquetas">
          {etiquetas.map((e) => <span key={e.id} style={e.cor ? ({ '--e': e.cor } as React.CSSProperties) : undefined} className={`${e.cor ? 'com-cor' : ''} ${e.classe ?? ''}`}>{e.texto}</span>)}
        </span>
      )}
    </button>
  )
}

/**
 * Calendário do mês: cada dia pinta mais forte quanto mais saiu nele, com um pontinho verde quando entrou dinheiro.
 * Tocar num dia mostra só os lançamentos dele (tocar de novo volta a mostrar todos).
 */
export function CalorDoMes({ ano, mes, lancs, previstos, dia, hoje, aoEscolher }: {
  ano: number; mes: number; lancs: Lancamento[]; previstos: Map<string, Previsto[]>; dia: string | null; hoje: string; aoEscolher: (d: string) => void
}) {
  const total = new Date(ano, mes, 0).getDate()
  const offset = new Date(ano, mes - 1, 1).getDay()
  const porDia = Array.from({ length: total }, (_, i) => {
    const d = `${ano}-${doisDig(mes)}-${doisDig(i + 1)}`
    const ls = lancs.filter((l) => l.data === d)
    const ps = previstos.get(d)
    return { d, n: i + 1, saiu: somaTipo(ls, 'saida'), entrou: somaTipo(ls, 'entrada'), qtd: ls.length, vaiSair: somaPrevistos(ps, 'saida'), vaiEntrar: somaPrevistos(ps, 'entrada') }
  })
  const maior = Math.max(1, ...porDia.map((x) => x.saiu))
  const pico = porDia.reduce((a, x) => (x.saiu > a.saiu ? x : a), porDia[0])
  return (
    <div className="cartao lc-calor">
      <header className="lc-calor-cab">
        <h3 className="ccd-titulo">{tx('Dia a dia')}</h3>
        {pico.saiu > 0 && <small>{tx('dia que mais saiu:')} <b>{pico.n}</b> ({fmtValor(pico.saiu)})</small>}
      </header>
      <div className="lc-calor-grade" role="grid" aria-label={tx('Gastos por dia de {0}', MESES_NOME[mes - 1])}>
        {SEMANA_LETRA.map((s, i) => <span key={i} className="lc-calor-semana">{s}</span>)}
        {Array.from({ length: offset }, (_, i) => <span key={`v${i}`} />)}
        {porDia.map((x, i) => (
          <button key={x.d} role="gridcell"
            className={`lc-calor-dia ${x.d === hoje ? 'hoje' : ''} ${x.d === dia ? 'ativo' : ''} ${x.qtd ? '' : 'vazio'} ${x.d > hoje ? 'futuro' : ''} ${x.vaiSair || x.vaiEntrar ? 'previsto' : ''}`}
            style={{ '--i': x.saiu / maior, animationDelay: `${i * 12}ms` } as React.CSSProperties}
            title={[
              x.qtd ? tx('{0}: saiu {1}', x.n, fmtValor(x.saiu)) + (x.entrou ? tx(', entrou {0}', fmtValor(x.entrou)) : '') : tx('{0}: nada lançado', x.n),
              x.vaiSair ? tx('vai sair {0}', fmtValor(x.vaiSair)) : '',
              x.vaiEntrar ? tx('vai entrar {0}', fmtValor(x.vaiEntrar)) : '',
            ].filter(Boolean).join(' · ')}
            onClick={() => aoEscolher(x.d)} aria-pressed={x.d === dia}>
            {x.n}
            {x.entrou > 0 && <i className="lc-calor-entrou" />}
            {(x.vaiSair > 0 || x.vaiEntrar > 0) && (
              <span className="lc-calor-prev" aria-hidden="true">
                {x.vaiEntrar > 0 && <i className="entra" />}
                {x.vaiSair > 0 && <i className="sai" />}
              </span>
            )}
          </button>
        ))}
      </div>
      <span className="lc-calor-legenda"><small>{tx('menos')}</small><i /><i /><i /><i /><small>{tx('mais gasto')}</small><i className="entrou" /><small>{tx('entrou')}</small></span>
      {previstos.size > 0 && (
        <span className="lc-calor-legenda lc-calor-legenda-prev">
          <i className="prev-entra" /><small>{tx('vai entrar')}</small><i className="prev-sai" /><small>{tx('vai sair')}</small>
          <small className="lc-calor-dica">{tx('Toque num dia para ver')}</small>
        </span>
      )}
    </div>
  )
}

/**
 * O dia escolhido no calendário: quanto entra e quanto sai nele (o que já foi lançado mais o que ainda vem), numa barra que
 * mostra qual lado pesa mais, e a lista do que está previsto e ainda não foi lançado (contas do mês e parcelas).
 */
export function NoDia({ dia, hoje, lancs, previstos, aoFechar, aoAbrir }: {
  dia: string; hoje: string; lancs: Lancamento[]; previstos: Previsto[]; aoFechar: () => void; aoAbrir: (p: Previsto) => void
}) {
  const passou = dia < hoje
  const entra = Math.round((somaTipo(lancs, 'entrada') + somaPrevistos(previstos, 'entrada')) * 100) / 100
  const sai = Math.round((somaTipo(lancs, 'saida') + somaPrevistos(previstos, 'saida')) * 100) / 100
  const saldo = entra - sai
  const total = entra + sai
  const data = new Date(`${dia}T12:00:00`)
  const distancia = Math.round((data.getTime() - new Date(`${hoje}T12:00:00`).getTime()) / 86400000)
  const quando = distancia === 0 ? tx('Hoje') : distancia === 1 ? tx('Amanhã') : distancia === -1 ? tx('Ontem')
    : distancia > 1 ? tx('Daqui a {0} dias', distancia) : tx('Há {0} dias', -distancia)
  const ordenados = [...previstos].sort((a, b) => Number(b.atrasado) - Number(a.atrasado) || (a.tipo === b.tipo ? b.valor - a.valor : a.tipo === 'entrada' ? -1 : 1))
  const origem = (p: Previsto) => p.prometido ? (p.origem === 'receber' ? tx('Prometeu pagar neste dia') : tx('Você combinou pagar neste dia'))
    : p.origem === 'cartao' ? tx('Fatura do cartão') : p.origem === 'conta'
    ? (p.tipo === 'entrada' ? tx('Entrada fixa') : tx('Conta do mês'))
    : p.origem === 'receber'
      ? (p.detalhe ? tx('Parcela {0} de quem te deve', p.detalhe) : tx('Quem te deve'))
      : (p.detalhe ? tx('Parcela {0} da dívida', p.detalhe) : tx('Dívida'))
  return (
    <section className="cartao lc-nodia" aria-label={tx('O dia {0}', fmtDataLonga(dia))}>
      <header className="lc-nodia-cab">
        <span className="lc-nodia-data">
          <b>{doisDig(data.getDate())}</b>
          <small>{SEMANA[data.getDay()]}</small>
        </span>
        <span className="lc-nodia-titulo">
          <strong>{fmtDataLonga(dia)}</strong>
          <small>{quando}</small>
        </span>
        <button className="icone-btn" onClick={aoFechar} aria-label={tx('Ver o mês todo')} title={tx('Ver o mês todo')}><Icone nome="fechar" tamanho={16} /></button>
      </header>

      <div className="lc-nodia-numeros">
        <span className="lc-nodia-num entra">
          <small><Icone nome="receber" tamanho={14} /> {passou ? tx('Entrou') : tx('Vai entrar')}</small>
          <b>+ {fmtValor(entra)}</b>
        </span>
        <span className="lc-nodia-num sai">
          <small><Icone nome="enviar" tamanho={14} /> {passou ? tx('Saiu') : tx('Vai sair')}</small>
          <b>− {fmtValor(sai)}</b>
        </span>
      </div>
      {total > 0 && (
        <div className="lc-nodia-balanca">
          <span className="lc-nodia-barra" role="img" aria-label={tx('Entra {0}, sai {1}', fmtValor(entra), fmtValor(sai))}>
            <i className="entra" style={{ flexGrow: entra }} />
            <i className="sai" style={{ flexGrow: sai }} />
          </span>
          <small className={saldo < 0 ? 'negativo' : 'positivo'}>
            {saldo < 0 ? tx('No dia, sai {0} a mais do que entra', fmtValor(-saldo)) : saldo > 0 ? tx('No dia, entra {0} a mais do que sai', fmtValor(saldo)) : tx('No dia, entra o mesmo que sai')}
          </small>
        </div>
      )}

      {ordenados.length > 0 && (
        <div className="lc-nodia-lista">
          <h4>{tx('Ainda não lançado')}</h4>
          {ordenados.map((p) => (
            <button key={p.chave} type="button" className={`lc-nodia-item ${p.tipo}`} onClick={() => aoAbrir(p)}>
              <span className="lc-nodia-icone"><Icone nome={p.prometido ? 'acordo' : p.origem === 'conta' ? 'calendario' : p.origem === 'receber' ? 'receber' : p.origem === 'cartao' ? 'cartao' : 'divida'} tamanho={16} /></span>
              <span className="lc-nodia-nome">
                <strong>{p.nome}</strong>
                <small>{origem(p)}{p.atrasado && <em>{p.tipo === 'entrada' ? tx('não caiu') : tx('atrasada')}</em>}</small>
              </span>
              <span className="lc-nodia-valor">{p.tipo === 'entrada' ? '+' : '−'} {fmtValor(p.valor)}</span>
            </button>
          ))}
        </div>
      )}
      <p className="lc-nodia-rodape">
        {lancs.length
          ? (lancs.length === 1 ? tx('1 lançamento feito neste dia, logo abaixo.') : tx('{0} lançamentos feitos neste dia, logo abaixo.', lancs.length))
          : ordenados.length ? tx('Nada lançado ainda neste dia.') : tx('Nada lançado nem previsto para este dia.')}
      </p>
    </section>
  )
}
