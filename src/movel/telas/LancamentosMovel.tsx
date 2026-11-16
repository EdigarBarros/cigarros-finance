/**
 * Lançamentos no celular: o topo que desliza (saiu, entrou, sobrou, já com os filtros), as ações (gasto, entrada, filtrar,
 * mais), as categorias em pílulas que filtram, o calendário do mês e os lançamentos em cartões, um por dia. Os filtros e as
 * contas são os mesmos da tela do computador (pages/lancamentos/useLancamentos.ts).
 */
import { useState } from 'react'
import { IconeCategoria } from '../../components/IconeCategoria'
import { Icone } from '../../components/Icone'
import { Modal, Segmentado } from '../../components/ui'
import { Seletor } from '../../components/Escolhas'
import { COR } from '../../lib/charts'
import { SEM_CATEGORIA } from '../../lib/categorias'
import { FORMAS, formaDe, infoForma, type FormaPagamento } from '../../lib/formas'
import { fmtDataCurta, fmtDataLonga, fmtValor, MESES_NOME, noMeioDaFrase } from '../../lib/format'
import { ehGuardado } from '../../lib/guardado'
import { tx } from '../../lib/textos'
import type { Lancamento } from '../../lib/types'
import { CalorDoMes, NoDia } from '../../pages/Lancamentos'
import { somaDias, useLancamentosFiltrados, type Filtro } from '../../pages/lancamentos/useLancamentos'
import type { Ctx } from '../../pages/contexto'
import { ListaDaFolha } from '../Casca'
import { BotoesDeAcao, CarrosselDeDicas, CartaoWidget, HeroDeslizante, IconeRedondo, LinhaDeLista, type PaginaDoHero } from '../primitivas'
import type { Tom } from '../tom'

export function LancamentosMovel({ c, aoMudarTom }: { c: Ctx; aoMudarTom: (t: Tom) => void }) {
  const f = useLancamentosFiltrados(c)
  const [filtrar, setFiltrar] = useState(false)
  const [mais, setMais] = useState(false)
  const nomeMes = noMeioDaFrase(MESES_NOME[c.mes - 1])
  const n = f.filtrados.length
  const quantos = n === 1 ? tx('1 lançamento') : tx('{0} lançamentos', n)
  // a frase inteira em cada caso (busca, filtros ou o mês todo): nada de juntar pedaços na tradução
  const rotulo = (qual: 'saiu' | 'entrou' | 'sobrou' | 'faltou') => (f.pesquisando
    ? { saiu: tx('Saiu na busca'), entrou: tx('Entrou na busca'), sobrou: tx('Sobrou na busca'), faltou: tx('Faltou na busca') }
    : f.filtrando
      ? { saiu: tx('Saiu em {0}, com os filtros', nomeMes), entrou: tx('Entrou em {0}, com os filtros', nomeMes), sobrou: tx('Sobrou em {0}, com os filtros', nomeMes), faltou: tx('Faltou em {0}, com os filtros', nomeMes) }
      : { saiu: tx('Saiu em {0}', nomeMes), entrou: tx('Entrou em {0}', nomeMes), sobrou: tx('Sobrou em {0}', nomeMes), faltou: tx('Faltou em {0}', nomeMes) })[qual]
  const sobra = f.entrou - f.saiu
  const limpar = f.filtrando ? { texto: tx('Limpar filtros'), acao: f.limpar } : undefined

  // ---------- topo: saiu, entrou e sobrou (com os filtros) ----------
  const paginas: PaginaDoHero[] = [
    { id: 'saiu', tom: 'falta', rotulo: rotulo('saiu'), valor: fmtValor(f.saiu), sub: quantos, pilula: limpar },
    { id: 'entrou', tom: 'sobra', rotulo: rotulo('entrou'), valor: fmtValor(f.entrou), sub: quantos, pilula: limpar },
    {
      id: 'sobrou', tom: sobra < 0 ? 'falta' : 'sobra', rotulo: rotulo(sobra < 0 ? 'faltou' : 'sobrou'), valor: fmtValor(Math.abs(sobra)),
      sub: f.entrou > 0 ? tx('Saiu {0}% do que entrou', Math.round((f.saiu / f.entrou) * 100)) : quantos, pilula: limpar,
    },
  ]

  // ---------- o que mais aparece no topo da lista ----------
  const dicas = f.noCartao.length ? [{
    id: 'cartao', icone: 'cartao',
    titulo: f.pesquisando
      ? (f.comprasNoCartao === 1 ? tx('1 compra no cartão combina com a busca.') : tx('{0} compras no cartão combinam com a busca.', f.comprasNoCartao))
      : (f.comprasNoCartao === 1 ? tx('1 compra no cartão na fatura de {0} ({1}) fica na tela Cartões.', nomeMes, fmtValor(f.totalNoCartao)) : tx('{0} compras no cartão na fatura de {1} ({2}) ficam na tela Cartões.', f.comprasNoCartao, nomeMes, fmtValor(f.totalNoCartao))),
    botao: { texto: tx('Ver em Cartões'), acao: () => c.irPara('cartoes') },
  }] : []
  const nomeDaCategoria = f.categoria === 'sem' ? SEM_CATEGORIA.nome : f.chips.find((k) => k.id === f.categoria)?.nome ?? c.categorias.find((k) => k.id === f.categoria)?.nome ?? tx('Categoria')

  const linha = (l: Lancamento, comData: boolean) => {
    const k = c.categoriaDe(l)
    const entrada = l.tipo === 'entrada'
    const banco = f.bancoDe(l)
    const cartao = f.cartaoDe(l)
    const forma = !l.cartao_id ? formaDe(l) : null
    const sub = [
      comData && l.data ? fmtDataCurta(l.data) : null,
      (k ?? SEM_CATEGORIA).nome,
      ehGuardado(l) ? tx('Guardado') : null,
      cartao ? tx('Cartão {0}', cartao.nome) : banco?.nome ?? (forma ? infoForma(forma).nome : null),
      l.compra_id && (l.parcelas ?? 1) > 1 ? tx('Parcela {0} de {1}', l.parcela, l.parcelas) : null,
    ].filter(Boolean).join(' · ')
    return (
      <LinhaDeLista key={l.id}
        icone={<IconeRedondo cor={(k ?? SEM_CATEGORIA).cor}><IconeCategoria emoji={(k ?? SEM_CATEGORIA).icone} tamanho={20} /></IconeRedondo>}
        titulo={l.descricao || (entrada ? tx('Entrada') : tx('Saída'))} sub={sub}
        valor={`${entrada ? '+' : '−'}${fmtValor(l.valor)}`} tomValor={entrada ? 'entrada' : undefined}
        aoTocar={() => c.editarLancamento(l)} />
    )
  }
  const nomeDoDia = (d: string) => (d === f.hoje ? tx('Hoje') : d === somaDias(f.hoje, -1) ? tx('Ontem') : d ? fmtDataLonga(d) : tx('Sem data'))

  return (
    <div className="pagina lanc-movel">
      <HeroDeslizante paginas={paginas} aoMudar={(p) => aoMudarTom(p.tom)} />
      <BotoesDeAcao acoes={[
        { id: 'gasto', icone: 'desce', rotulo: tx('Gasto'), acao: () => c.novoLancamento('saida') },
        { id: 'entrada', icone: 'sobe', rotulo: tx('Entrada'), acao: () => c.novoLancamento('entrada') },
        { id: 'filtrar', icone: 'ajustes', rotulo: f.filtrando ? tx('Filtrando') : tx('Filtrar'), acao: () => setFiltrar(true) },
        { id: 'mais', icone: 'reticencias', rotulo: tx('Mais'), acao: () => setMais(true) },
      ]} />
      <CarrosselDeDicas dicas={dicas} />

      {f.filtrando && (
        <div className="filtros-movel" role="status">
          {f.pesquisando && <span className="chip-info">{tx('Em {0} inteiro', c.ano)}</span>}
          {f.dia && <span className="chip-info">{fmtDataLonga(f.dia)}</span>}
          {f.categoria !== 'todos' && <span className="chip-info">{nomeDaCategoria}</span>}
          {f.tipo !== 'todos' && <span className="chip-info">{f.tipo === 'entrada' ? tx('Entradas') : tx('Saídas')}</span>}
          <span>{tx('{0} de {1}', n, f.origem.length)}</span>
          <button className="link" onClick={f.limpar}>{tx('Limpar filtros')}</button>
        </div>
      )}

      {f.chips.length > 0 && (
        <section className="pilulas-movel" aria-label={f.tipoChips === 'entrada' ? tx('De onde veio') : tx('Para onde foi')}>
          {f.chips.map((k) => (
            <button key={k.id} className={f.categoria === k.id ? 'ativo' : ''} aria-pressed={f.categoria === k.id}
              onClick={() => f.setCategoria(f.categoria === k.id ? 'todos' : k.id)} style={{ '--c': k.cor } as React.CSSProperties}>
              <IconeCategoria emoji={k.icone} tamanho={16} />
              <span>{k.nome}</span>
              <b>{fmtValor(k.total)}</b>
            </button>
          ))}
        </section>
      )}

      {f.comCalendario && (
        <div className="calendario-movel">
          <CalorDoMes ano={c.ano} mes={c.mes} lancs={f.semDia} previstos={f.previstos} dia={f.dia} hoje={f.hoje} aoEscolher={(d) => f.setDia(d === f.dia ? null : d)} />
        </div>
      )}
      {f.dia && f.comCalendario && (
        <NoDia dia={f.dia} hoje={f.hoje} lancs={f.semDia.filter((l) => l.data === f.dia)} previstos={f.previstos.get(f.dia) ?? []} aoFechar={() => f.setDia(null)}
          aoAbrir={(p) => c.irPara(p.origem === 'conta' ? 'contas' : p.origem === 'cartao' ? 'cartoes' : 'dividas')} />
      )}

      <div className="widgets-movel">
        {!n ? (
          <CartaoWidget>
            <div className="widget-vazio">
              {f.filtrando ? (
                <>
                  <p>{tx('Nada com esses filtros')}</p>
                  <button className="btn" onClick={f.limpar}>{tx('Limpar filtros')}</button>
                </>
              ) : (
                <>
                  <p>{c.d.lancs.length === 0 ? tx('Registre o que entrou e o que saiu, um por um, ou traga tudo de uma vez do extrato do seu banco. O painel se monta sozinho.') : tx('Nada lançado em {0}', nomeMes)}</p>
                  <button className="btn" onClick={c.importarExtrato}>{tx('Importar extrato ou planilha')}</button>
                </>
              )}
            </div>
          </CartaoWidget>
        ) : f.ordem === 'valor' ? (
          <CartaoWidget titulo={tx('Os maiores')}>{f.filtrados.map((l) => linha(l, true))}</CartaoWidget>
        ) : f.grupos.map(([d, itens]) => {
          const saldo = itens.filter((l) => !ehGuardado(l)).reduce((a, l) => a + (l.tipo === 'entrada' ? l.valor : -l.valor), 0)
          return (
            <section key={d} className="widget dia-movel" aria-label={nomeDoDia(d)}>
              <header className="dia-movel-cab">
                <button className="widget-titulo" onClick={() => d && f.setDia(d === f.dia ? null : d)} disabled={!d}>{nomeDoDia(d)}</button>
                <span className={saldo < 0 ? 'negativo' : 'positivo'}>{saldo < 0 ? '−' : '+'}{fmtValor(Math.abs(saldo))}</span>
              </header>
              {itens.map((l) => linha(l, false))}
            </section>
          )
        })}
      </div>

      {filtrar && (
        <Modal titulo={tx('Filtrar')} aoFechar={() => setFiltrar(false)}>
          <div className="form filtrar-movel">
            <Segmentado rotulo={tx('Tipo')} valor={f.tipo} aoMudar={(t) => { f.setTipo(t); f.setCategoria('todos') }}
              opcoes={[{ id: 'todos', nome: tx('Todos') }, { id: 'entrada', nome: tx('Entradas'), cor: COR.entradas }, { id: 'saida', nome: tx('Saídas'), cor: COR.saidas }]} />
            {f.nivel !== 'simples' && (
              <Segmentado rotulo={tx('Ordem')} valor={f.ordem} aoMudar={f.setOrdem}
                opcoes={[{ id: 'data', nome: tx('Por dia') }, { id: 'valor', nome: tx('Maiores') }]} />
            )}
            {f.comBancos && (
              <Seletor className={`lc-select ${f.banco !== 'todos' ? 'ativo' : ''}`} valor={f.banco} aoMudar={f.setBanco} rotulo={tx('Banco')}
                opcoes={[
                  { valor: 'todos', rotulo: tx('Todos os bancos') },
                  ...c.d.bancos.map((b) => ({ valor: b.id, rotulo: b.nome, cor: b.cor })),
                  { valor: 'sem', rotulo: tx('Sem banco') },
                ]} />
            )}
            {f.comFormas && (
              <Seletor className={`lc-select ${f.forma !== 'todos' ? 'ativo' : ''}`} valor={f.forma} rotulo={tx('Forma de pagamento')}
                aoMudar={(v) => f.setForma(v as Filtro<FormaPagamento | 'sem'>)}
                opcoes={[
                  { valor: 'todos', rotulo: tx('Todas as formas') },
                  ...FORMAS.filter((x) => f.formasDoMes.has(x.id) || f.forma === x.id).map((x) => ({ valor: x.id, rotulo: x.nome, detalhe: f.valorDaForma(x.id), cor: x.cor })),
                  ...((f.formasDoMes.has('sem') || f.forma === 'sem') ? [{ valor: 'sem', rotulo: tx('Sem forma'), detalhe: f.valorDaForma('sem') }] : []),
                ]} />
            )}
            <div className="form-acoes">
              {f.filtrando && <button type="button" className="btn" onClick={f.limpar}>{tx('Limpar filtros')}</button>}
              <span className="espaco" />
              <button type="button" className="btn primario" onClick={() => setFiltrar(false)}>{quantos}</button>
            </div>
          </div>
        </Modal>
      )}
      {mais && (
        <Modal titulo={tx('Lançamentos')} aoFechar={() => setMais(false)}>
          <ListaDaFolha aoEscolher={() => setMais(false)}>
            <button onClick={c.importarExtrato}><Icone nome="relatorio" /> {tx('Importar extrato')}</button>
            <button onClick={c.importar}><Icone nome="importar" /> {tx('Importar planilha')}</button>
            <button onClick={c.organizarNomes}><Icone nome="lapis" /> {tx('Organizar nomes')}</button>
            <button onClick={c.gerenciarCategorias}><Icone nome="ajustes" /> {tx('Editar categorias')}</button>
          </ListaDaFolha>
        </Modal>
      )}
    </div>
  )
}
