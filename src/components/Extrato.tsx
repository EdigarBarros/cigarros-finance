import { useMemo, useRef, useState } from 'react'
import { categoriaPelaDescricao, doTipo } from '../lib/categorias'
import { parecencaComConta, situacoesDoMes, sugestoesDoMes } from '../lib/contasFixas'
import { lerExtrato, limparDescricao, type LinhaExtrato } from '../lib/extrato'
import { infoForma } from '../lib/formas'
import { fmtValor, MESES_NOME } from '../lib/format'
import { mesmoNome } from '../lib/rotulos'
import { CATALOGO_BANCOS } from '../lib/bancos'
import type { Lancamento, Tipo } from '../lib/types'
import type { Ctx } from '../pages/contexto'
import { BancoIcone } from './BancoIcone'
import { Icone } from './Icone'
import { Modal } from './ui'
import { tx } from '../lib/textos'

interface Linha extends LinhaExtrato {
  chave: number
  incluir: boolean
  repetido: boolean
  categoria_id: string
  /** Conta do mês de que esta linha parece ser (a pensão que caiu): vira a baixa dela ao importar. */
  conta_fixa_id: string
  /** Por que parece já lançado, quando não é o mesmo dia e valor ("já marcada como recebida em Pensão"). */
  repetidoPor?: string
}

/**
 * Liga as linhas do extrato às contas do mês (só do ano aberto, onde dá para saber o que já foi pago): a linha que parece
 * ser de uma conta sem baixa no mês vira a baixa dela; a que repete uma baixa já dada ("Recebi" tocado antes de importar)
 * vem desmarcada.
 */
function ligarAsContas(linhas: Linha[], c: Ctx): Linha[] {
  const contas = c.v.contas && !c.contas.semTabela ? c.contas.contas : []
  if (!contas.length) return linhas
  const saida = linhas.map((l) => ({ ...l }))
  const doAno = saida.filter((l) => Number(l.data.slice(0, 4)) === c.ano)
  const comoLanc = (l: Linha): Lancamento => ({
    id: `extrato-${l.chave}`, ano: c.ano, mes: Number(l.data.slice(5, 7)), tipo: l.tipo, descricao: l.descricao, valor: l.valor, data: l.data,
  })
  for (const mes of new Set(doAno.map((l) => Number(l.data.slice(5, 7))))) {
    const sits = situacoesDoMes(contas, c.d.lancs, c.ano, mes, undefined, c.taxas)
    const doMes = doAno.filter((l) => Number(l.data.slice(5, 7)) === mes)
    for (const s of sits) {
      const mem = c.memoriaContas.get(s.conta.id)
      if (!s.baixa || !mem) continue
      for (const l of doMes) {
        if (l.repetido || Math.abs(l.valor - s.baixa.valor) >= 0.005 || !parecencaComConta(s.conta, mem, comoLanc(l), true)) continue
        Object.assign(l, { repetido: true, incluir: false, repetidoPor: tx('{0} já está como {1} em Contas do mês', s.conta.descricao, s.conta.tipo === 'entrada' ? 'recebida' : 'paga') })
        break
      }
    }
    const novos = doMes.filter((l) => !l.repetido)
    for (const [contaId, sug] of sugestoesDoMes(sits, novos.map(comoLanc), c.ano, mes, c.memoriaContas)) {
      const l = novos.find((x) => `extrato-${x.chave}` === sug.lanc.id)!
      l.conta_fixa_id = contaId
      if (sug.conta.categoria_id) l.categoria_id = sug.conta.categoria_id
    }
  }
  return saida
}

const FORMATOS = [
  { ext: 'PDF', cor: '#ff5a5f' }, { ext: 'CSV', cor: '#30d158' }, { ext: tx('Excel'), cor: '#1fa463' },
  { ext: tx('Word'), cor: '#2b7cd3' }, { ext: 'OFX', cor: '#bf5af2' }, { ext: 'TXT', cor: '#8e8e93' },
]
const dataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/**
 * Importar extrato do banco: a pessoa escolhe o arquivo (PDF, CSV, Excel, Word, OFX, TXT), o app lê, limpa os nomes e
 * mostra tudo para revisar antes de gravar: nome (com o original embaixo), entrada ou saída, categoria sugerida e os
 * que parecem repetidos (já lançados) vêm desmarcados.
 */
export function ImportarExtrato({ c, aoFechar }: { c: Ctx; aoFechar: () => void }) {
  const [etapa, setEtapa] = useState<'escolher' | 'lendo' | 'revisar' | 'gravando' | 'pronto'>('escolher')
  const [erro, setErro] = useState<string | null>(null)
  const [arquivo, setArquivo] = useState('')
  const [formato, setFormato] = useState('')
  const [bancoLido, setBancoLido] = useState<string | undefined>()
  const [bancoId, setBancoId] = useState('')
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [filtro, setFiltro] = useState<'todos' | 'revisar' | 'repetidos'>('todos')
  const [gravados, setGravados] = useState(0)
  const [arrastando, setArrastando] = useState(false)
  const entrada = useRef<HTMLInputElement>(null)

  const ler = async (f: File | undefined) => {
    if (!f) return
    setErro(null)
    setArquivo(f.name)
    setEtapa('lendo')
    try {
      const r = await lerExtrato(f, c.ano)
      if (!r.linhas.length) throw new Error('Não achei lançamentos nesse arquivo. Confira se é o extrato (com data e valor de cada movimentação).')
      const existentes = c.d.lancs
      const prontas = r.linhas.map((l, i): Linha => {
        const repetido = existentes.some((x) => x.data === l.data && Math.abs(x.valor - l.valor) < 0.005 && x.tipo === l.tipo)
        return { ...l, chave: i, repetido, incluir: !repetido, conta_fixa_id: '', categoria_id: categoriaPelaDescricao(l.descricao, l.tipo, c.categorias)?.id ?? '' }
      })
      setLinhas(ligarAsContas(prontas, c))
      setFormato(r.formato)
      setBancoLido(r.banco)
      const meu = r.banco ? c.d.bancos.find((b) => mesmoNome(b.nome, r.banco!)) : undefined
      setBancoId(meu?.id ?? '')
      setEtapa('revisar')
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
      setEtapa('escolher')
    } finally {
      if (entrada.current) entrada.current.value = ''
    }
  }

  const mudar = (chave: number, patch: Partial<Linha>) => setLinhas((xs) => xs.map((x) => (x.chave === chave ? { ...x, ...patch } : x)))
  const escolhidas = linhas.filter((l) => l.incluir)
  const soma = (t: Tipo) => escolhidas.filter((l) => l.tipo === t).reduce((a, l) => a + l.valor, 0)
  const paraRevisar = linhas.filter((l) => l.revisar)
  const repetidos = linhas.filter((l) => l.repetido)
  const visiveis = filtro === 'revisar' ? paraRevisar : filtro === 'repetidos' ? repetidos : linhas
  const catalogo = bancoLido ? CATALOGO_BANCOS.find((b) => b.nome === bancoLido) : undefined
  const bancoNovo = bancoLido && !c.d.bancos.some((b) => mesmoNome(b.nome, bancoLido))
  const nomeConta = (id: string) => c.contas.contas.find((k) => k.id === id)?.descricao ?? tx('Conta do mês')
  const ligadas = escolhidas.filter((l) => l.conta_fixa_id).length

  const importar = async () => {
    setEtapa('gravando')
    let banco = bancoId || null
    if (!banco && bancoNovo && catalogo && c.v.bancos) banco = (await c.d.addBanco(catalogo.nome, catalogo.cor))?.id ?? null
    const n = await c.d.addLancs(escolhidas.map((l) => ({
      ano: Number(l.data.slice(0, 4)), mes: Number(l.data.slice(5, 7)), tipo: l.tipo, valor: l.valor,
      descricao: l.descricao.trim() || (l.tipo === 'entrada' ? tx('Entrada') : tx('Saída')), data: l.data,
      categoria_id: l.categoria_id || null, banco_id: banco, divida_id: null, forma: l.forma ?? null,
      ...(l.conta_fixa_id ? { conta_fixa_id: l.conta_fixa_id } : {}),
    })))
    setGravados(n)
    setEtapa('pronto')
  }

  const periodo = linhas.length ? `${dataCurta(linhas[0].data)} a ${dataCurta(linhas[linhas.length - 1].data)}` : ''
  const ultimoMes = escolhidas.length ? escolhidas[escolhidas.length - 1].data : ''

  return (
    <Modal titulo={tx('Importar extrato')} aoFechar={aoFechar} tamanho="grande">
      <div className="ex">
        {(etapa === 'escolher' || etapa === 'lendo') && (
          <div className="ex-escolher">
            <label className={`ex-zona ${arrastando ? 'arrastando' : ''} ${etapa === 'lendo' ? 'lendo' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setArrastando(true) }} onDragLeave={() => setArrastando(false)}
              onDrop={(e) => { e.preventDefault(); setArrastando(false); void ler(e.dataTransfer.files[0]) }}>
              <input ref={entrada} type="file" hidden accept=".pdf,.csv,.txt,.ofx,.qfx,.xlsx,.xls,.ods,.docx"
                onChange={(e) => void ler(e.target.files?.[0])} disabled={etapa === 'lendo'} />
              <span className="ex-folhas" aria-hidden="true">
                {FORMATOS.slice(0, 4).map((f, i) => (
                  <span key={f.ext} className="ex-folha" style={{ '--c': f.cor, '--i': i } as React.CSSProperties}><b>{f.ext}</b><i /><i /><i /></span>
                ))}
              </span>
              {etapa === 'lendo' ? (
                <>
                  <strong><span className="ex-girando"><Icone nome="relogio" tamanho={18} /></span> {tx('Lendo {0}…', arquivo)}</strong>
                  <small>{tx('Achando datas, valores e arrumando os nomes.')}</small>
                </>
              ) : (
                <>
                  <strong>{tx('Arraste o extrato aqui ou toque para escolher')}</strong>
                  <small>{tx('PDF, CSV, Excel, Word, OFX ou TXT, do banco que for.')}</small>
                </>
              )}
            </label>
            {erro && <p className="form-erro ex-erro"><Icone nome="sino" tamanho={16} /> {erro}</p>}
            <div className="ex-dicas">
              <div><span className="ex-dica-icone"><Icone nome="importar" tamanho={18} /></span><p><b>{tx('Como tirar o extrato:')}</b> {tx('no app do banco, procure “Extrato” → “Exportar” ou “Compartilhar”. CSV, Excel ou OFX são os mais certeiros; PDF também funciona.')}</p></div>
              <div><span className="ex-dica-icone"><Icone nome="ideia" tamanho={18} /></span><p><b>{tx('Nomes arrumados:')}</b> {tx('o app tira CPF, CNPJ, códigos e o “TRANSFERÊNCIA RECEBIDA PELO PIX” do começo. O que não der para entender fica marcado para você revisar.')}</p></div>
              <div><span className="ex-dica-icone"><Icone nome="check" tamanho={18} /></span><p><b>{tx('Nada é gravado')}</b> {tx('antes de você revisar. O que parecer já lançado (mesmo dia, valor e tipo) vem desmarcado.')}</p></div>
            </div>
          </div>
        )}

        {etapa === 'revisar' && (
          <div className="ex-revisar">
            <header className="ex-cab">
              <span className="ex-arquivo">
                {catalogo ? <BancoIcone nome={catalogo.nome} cor={catalogo.cor} tamanho={40} /> : <span className="ex-arquivo-icone"><Icone nome="relatorio" tamanho={20} /></span>}
                <span><strong>{arquivo}</strong><small>{formato}{bancoLido ? ` · ${bancoLido}` : ''} · {periodo}</small></span>
              </span>
              <span className="ex-resumo">
                <span className="chip-info bom">+ {fmtValor(soma('entrada'))}</span>
                <span className="chip-info ruim">− {fmtValor(soma('saida'))}</span>
                <span className="chip-info">{tx('{0} de {1}', escolhidas.length, linhas.length)}</span>
              {ligadas > 0 && <span className="chip-info" title={tx('Contam como pagas ou recebidas em Contas do mês')}>{tx('{0} de contas do mês', ligadas)}</span>}
              </span>
              {c.v.bancos && (
                <label className="ex-banco">
                  <span>{tx('Banco')}</span>
                  <select value={bancoId} onChange={(e) => setBancoId(e.target.value)}>
                    <option value="">{bancoNovo && catalogo ? tx('Criar "{0}"', catalogo.nome) : tx('Nenhum')}</option>
                    {c.d.bancos.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
                  </select>
                </label>
              )}
            </header>

            <div className="ex-filtros">
              {([['todos', tx('Todos ({0})', linhas.length)], ['revisar', tx('Para revisar ({0})', paraRevisar.length)], ['repetidos', tx('Já lançados ({0})', repetidos.length)]] as const).map(([id, rotulo]) => (
                <button key={id} className={`lc-banco ${filtro === id ? 'ativo' : ''}`} onClick={() => setFiltro(id)} disabled={id !== 'todos' && rotulo.endsWith('(0)')}>{rotulo}</button>
              ))}
              <span className="espaco" />
              <button className="link" onClick={() => setLinhas((xs) => xs.map((x) => ({ ...x, incluir: !x.repetido })))}>{tx('Marcar todos os novos')}</button>
              <button className="link" onClick={() => setLinhas((xs) => xs.map((x) => ({ ...x, incluir: false })))}>{tx('Desmarcar todos')}</button>
            </div>

            <ul className="ex-lista">
              {visiveis.map((l, i) => (
                <li key={l.chave} className={`ex-linha ${l.incluir ? '' : 'desmarcada'} ${l.revisar ? 'revisar' : ''}`} style={{ animationDelay: `${Math.min(i, 20) * 20}ms` }}>
                  <input type="checkbox" checked={l.incluir} onChange={(e) => mudar(l.chave, { incluir: e.target.checked })} aria-label={tx('Importar este')} />
                  <span className="ex-data">{dataCurta(l.data)}</span>
                  <button type="button" className={`ex-tipo ${l.tipo}`} title={tx('Trocar entrada/saída')}
                    onClick={() => mudar(l.chave, { tipo: l.tipo === 'entrada' ? 'saida' : 'entrada', categoria_id: '', conta_fixa_id: '' })}>
                    <Icone nome={l.tipo === 'entrada' ? 'receber' : 'enviar'} tamanho={14} />
                  </button>
                  <span className="ex-nome">
                    <input value={l.descricao} onChange={(e) => mudar(l.chave, { descricao: e.target.value })} placeholder={tx('Dê um nome')} aria-label={tx('Descrição')} />
                    <small>
                      {l.revisar && <em><Icone nome="sino" tamanho={11} /> {l.revisar}</em>}
                      {l.repetido && <em className="rep" title={l.repetidoPor}>{l.repetidoPor ?? tx('parece já lançado')}</em>}
                      {l.conta_fixa_id && (
                        <button type="button" className="ex-conta" title={tx('Não é dessa conta: tocar para desligar')}
                          onClick={() => mudar(l.chave, { conta_fixa_id: '' })}>
                          <Icone nome="calendario" tamanho={11} /> {nomeConta(l.conta_fixa_id)} <Icone nome="fechar" tamanho={10} />
                        </button>
                      )}
                      {l.forma && <em className="forma">{infoForma(l.forma).nome}</em>}
                      {l.original && l.original !== l.descricao && <span title={l.original}>{tx('era: {0}', l.original)}</span>}
                    </small>
                  </span>
                  <select className="ex-cat" value={l.categoria_id} onChange={(e) => mudar(l.chave, { categoria_id: e.target.value })} aria-label={tx('Categoria')}>
                    <option value="">{tx('Sem categoria')}</option>
                    {doTipo(c.categorias, l.tipo).map((k) => <option key={k.id} value={k.id}>{k.nome}</option>)}
                  </select>
                  <span className={`ex-valor ${l.tipo}`}>{l.tipo === 'entrada' ? '+' : '−'} {fmtValor(l.valor)}</span>
                </li>
              ))}
            </ul>

            <footer className="ex-acoes">
              <button className="btn" onClick={() => { setLinhas([]); setEtapa('escolher') }}><Icone nome="esq" tamanho={16} /> {tx('Outro arquivo')}</button>
              <span className="espaco" />
              <button className="btn primario" disabled={!escolhidas.length} onClick={() => void importar()}>
                <Icone nome="importar" tamanho={16} /> {tx('Importar {0}', escolhidas.length)} {escolhidas.length === 1 ? tx('lançamento') : tx('lançamentos')}
              </button>
            </footer>
          </div>
        )}

        {(etapa === 'gravando' || etapa === 'pronto') && (
          <div className="ex-pronto">
            <span className={`qz-pronto ${etapa === 'gravando' ? 'gravando' : ''}`}><Icone nome={etapa === 'gravando' ? 'relogio' : 'check'} tamanho={40} /></span>
            <h2>{etapa === 'gravando' ? tx('Importando…') : (gravados === 1 ? tx('1 lançamento importado') : tx('{0} lançamentos importados', gravados))}</h2>
            {etapa === 'pronto' && (
              <>
                <p>{tx('Eles já entram nos totais, gráficos e categorias. Dá para editar qualquer um em Lançamentos.')}</p>
                <div className="ex-pronto-acoes">
                  <button className="btn" onClick={() => { setLinhas([]); setEtapa('escolher') }}>{tx('Importar outro')}</button>
                  <button className="btn primario" onClick={() => {
                    aoFechar()
                    if (ultimoMes && Number(ultimoMes.slice(0, 4)) === c.ano) c.irParaMes(Number(ultimoMes.slice(5, 7)))
                    c.irPara('lancamentos')
                  }}>{tx('Ver lançamentos')}{ultimoMes ? ` de ${MESES_NOME[Number(ultimoMes.slice(5, 7)) - 1].toLowerCase()}` : ''}</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

/**
 * Organizar nomes: passa a mesma limpeza da importação nos lançamentos do ano aberto e mostra o antes → depois para
 * a pessoa aceitar (nomes iguais aparecem uma vez só, com quantos lançamentos usam). Os que viraram só números ficam
 * com o campo em branco, para a pessoa escrever.
 */
export function OrganizarNomes({ c, aoFechar }: { c: Ctx; aoFechar: () => void }) {
  const grupos = useMemo(() => {
    const m = new Map<string, { original: string; tipo: Tipo; ids: string[]; exemplo: string }>()
    for (const l of c.d.lancs) {
      const k = `${l.tipo}|${l.descricao.trim()}`
      // data e valor de um deles, para lembrar o que era quando o nome é só número
      const g = m.get(k) ?? { original: l.descricao.trim(), tipo: l.tipo, ids: [], exemplo: `${l.data ? dataCurta(l.data) : tx('sem data')} · ${fmtValor(l.valor)}` }
      g.ids.push(l.id)
      m.set(k, g)
    }
    return [...m.values()].map((g) => {
      const r = limparDescricao(g.original, g.tipo)
      const semNome = Boolean(r.revisar && /sem nome|sem descri/.test(r.revisar))
      return { ...g, sugestao: semNome ? '' : r.descricao, revisar: r.revisar, semNome, forma: r.forma }
    }).filter((g) => g.semNome || (g.sugestao && g.sugestao !== g.original))
      .sort((a, b) => Number(b.semNome) - Number(a.semNome) || b.ids.length - a.ids.length)
  }, [c.d.lancs])
  const [nomes, setNomes] = useState<Record<string, string>>(() => Object.fromEntries(grupos.map((g) => [g.original + g.tipo, g.sugestao])))
  const [marcados, setMarcados] = useState<Record<string, boolean>>(() => Object.fromEntries(grupos.map((g) => [g.original + g.tipo, !g.semNome])))
  const [feito, setFeito] = useState<number | null>(null)
  const aplicaveis = grupos.filter((g) => marcados[g.original + g.tipo] && nomes[g.original + g.tipo]?.trim())
  const total = aplicaveis.reduce((a, g) => a + g.ids.length, 0)

  const aplicar = async () => {
    // o "Pix" que sai do nome vai para a forma de pagamento (sem sobrescrever uma forma que a pessoa já tenha escolhido)
    const sem = new Set(c.d.lancs.filter((l) => !l.forma && !l.cartao_id).map((l) => l.id))
    await c.d.renomearLancs(aplicaveis.flatMap((g) => g.ids.map((id) => ({ id, descricao: nomes[g.original + g.tipo].trim(), forma: g.forma && sem.has(id) ? g.forma : undefined }))))
    setFeito(total)
  }

  return (
    <Modal titulo={tx('Organizar nomes')} aoFechar={aoFechar} tamanho="grande">
      <div className="ex">
        {feito !== null ? (
          <div className="ex-pronto">
            <span className="qz-pronto"><Icone nome="check" tamanho={40} /></span>
            <h2>{feito} {feito === 1 ? tx('lançamento arrumado') : tx('lançamentos arrumados')}</h2>
            <p>{tx('Os nomes novos já aparecem em todo o app.')}</p>
            <div className="ex-pronto-acoes"><button className="btn primario" onClick={aoFechar}>{tx('Fechar')}</button></div>
          </div>
        ) : !grupos.length ? (
          <div className="ex-pronto">
            <span className="qz-pronto"><Icone nome="check" tamanho={40} /></span>
            <h2>{tx('Os nomes de {0} já estão organizados', c.ano)}</h2>
            <p>{tx('Nada com CPF, CNPJ, código ou texto de banco sobrando.')}</p>
            <div className="ex-pronto-acoes"><button className="btn primario" onClick={aoFechar}>{tx('Fechar')}</button></div>
          </div>
        ) : (
          <div className="ex-revisar">
            <p className="ex-intro">
              {tx('Achei')} <b>{grupos.length}</b> {grupos.length === 1 ? tx('nome que dá') : tx('nomes que dão')} {tx('para arrumar nos lançamentos de {0}. Confira, mude o que quiser e aplique. Os que eram só números ficam em branco para você escrever.', c.ano)}
            </p>
            <ul className="ex-lista">
              {grupos.map((g, i) => {
                const k = g.original + g.tipo
                return (
                  <li key={k} className={`ex-linha org ${marcados[k] ? '' : 'desmarcada'} ${g.semNome ? 'revisar' : ''}`} style={{ animationDelay: `${Math.min(i, 20) * 20}ms` }}>
                    <input type="checkbox" checked={Boolean(marcados[k])} onChange={(e) => setMarcados({ ...marcados, [k]: e.target.checked })} aria-label={tx('Arrumar este')} />
                    <span className={`ex-tipo ${g.tipo}`}><Icone nome={g.tipo === 'entrada' ? 'receber' : 'enviar'} tamanho={14} /></span>
                    <span className="org-antes" title={g.original}>
                      <s>{g.original || tx('(sem nome)')}</s>
                      <small>{g.ids.length === 1 ? g.exemplo : tx('{0} lançamentos', g.ids.length)}</small>
                    </span>
                    <Icone nome="seta" tamanho={16} />
                    <span className="ex-nome">
                      <input value={nomes[k] ?? ''} placeholder={tx('Escreva o nome')} aria-label={tx('Nome novo')}
                        onChange={(e) => { setNomes({ ...nomes, [k]: e.target.value }); setMarcados({ ...marcados, [k]: Boolean(e.target.value.trim()) }) }} />
                      {g.revisar && <small><em><Icone nome="sino" tamanho={11} /> {g.revisar}</em></small>}
                    </span>
                  </li>
                )
              })}
            </ul>
            <footer className="ex-acoes">
              <span className="espaco" />
              <button className="btn" onClick={aoFechar}>{tx('Cancelar')}</button>
              <button className="btn primario" disabled={!total} onClick={() => void aplicar()}>
                <Icone nome="check" tamanho={16} /> {tx('Arrumar {0}', total)} {total === 1 ? tx('lançamento') : tx('lançamentos')}
              </button>
            </footer>
          </div>
        )}
      </div>
    </Modal>
  )
}
