import { useMemo, useRef, useState } from 'react'
import { categoriaPelaDescricao, doTipo } from '../lib/categorias'
import { lerExtrato, limparDescricao, type LinhaExtrato } from '../lib/extrato'
import { infoForma } from '../lib/formas'
import { fmtValor, MESES_NOME } from '../lib/format'
import { mesmoNome } from '../lib/rotulos'
import { CATALOGO_BANCOS } from '../lib/bancos'
import type { Tipo } from '../lib/types'
import type { Ctx } from '../pages/contexto'
import { BancoIcone } from './BancoIcone'
import { Icone } from './Icone'
import { Modal } from './ui'

interface Linha extends LinhaExtrato {
  chave: number
  incluir: boolean
  repetido: boolean
  categoria_id: string
}

const FORMATOS = [
  { ext: 'PDF', cor: '#ff5a5f' }, { ext: 'CSV', cor: '#30d158' }, { ext: 'Excel', cor: '#1fa463' },
  { ext: 'Word', cor: '#2b7cd3' }, { ext: 'OFX', cor: '#bf5af2' }, { ext: 'TXT', cor: '#8e8e93' },
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
        return { ...l, chave: i, repetido, incluir: !repetido, categoria_id: categoriaPelaDescricao(l.descricao, l.tipo, c.categorias)?.id ?? '' }
      })
      setLinhas(prontas)
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

  const importar = async () => {
    setEtapa('gravando')
    let banco = bancoId || null
    if (!banco && bancoNovo && catalogo && c.v.bancos) banco = (await c.d.addBanco(catalogo.nome, catalogo.cor))?.id ?? null
    const n = await c.d.addLancs(escolhidas.map((l) => ({
      ano: Number(l.data.slice(0, 4)), mes: Number(l.data.slice(5, 7)), tipo: l.tipo, valor: l.valor,
      descricao: l.descricao.trim() || (l.tipo === 'entrada' ? 'Entrada' : 'Saída'), data: l.data,
      categoria_id: l.categoria_id || null, banco_id: banco, divida_id: null, forma: l.forma ?? null,
    })))
    setGravados(n)
    setEtapa('pronto')
  }

  const periodo = linhas.length ? `${dataCurta(linhas[0].data)} a ${dataCurta(linhas[linhas.length - 1].data)}` : ''
  const ultimoMes = escolhidas.length ? escolhidas[escolhidas.length - 1].data : ''

  return (
    <Modal titulo="Importar extrato" aoFechar={aoFechar} tamanho="grande">
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
                  <strong><span className="ex-girando"><Icone nome="relogio" tamanho={18} /></span> Lendo {arquivo}…</strong>
                  <small>Achando datas, valores e arrumando os nomes.</small>
                </>
              ) : (
                <>
                  <strong>Arraste o extrato aqui ou toque para escolher</strong>
                  <small>PDF, CSV, Excel, Word, OFX ou TXT, do banco que for.</small>
                </>
              )}
            </label>
            {erro && <p className="form-erro ex-erro"><Icone nome="sino" tamanho={16} /> {erro}</p>}
            <div className="ex-dicas">
              <div><span className="ex-dica-icone"><Icone nome="importar" tamanho={18} /></span><p><b>Como tirar o extrato:</b> no app do banco, procure “Extrato” → “Exportar” ou “Compartilhar”. CSV, Excel ou OFX são os mais certeiros; PDF também funciona.</p></div>
              <div><span className="ex-dica-icone"><Icone nome="ideia" tamanho={18} /></span><p><b>Nomes arrumados:</b> o app tira CPF, CNPJ, códigos e o “TRANSFERÊNCIA RECEBIDA PELO PIX” do começo. O que não der para entender fica marcado para você revisar.</p></div>
              <div><span className="ex-dica-icone"><Icone nome="check" tamanho={18} /></span><p><b>Nada é gravado</b> antes de você revisar. O que parecer já lançado (mesmo dia, valor e tipo) vem desmarcado.</p></div>
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
                <span className="chip-info">{escolhidas.length} de {linhas.length}</span>
              </span>
              {c.v.bancos && (
                <label className="ex-banco">
                  <span>Banco</span>
                  <select value={bancoId} onChange={(e) => setBancoId(e.target.value)}>
                    <option value="">{bancoNovo && catalogo ? `Criar "${catalogo.nome}"` : 'Nenhum'}</option>
                    {c.d.bancos.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
                  </select>
                </label>
              )}
            </header>

            <div className="ex-filtros">
              {([['todos', `Todos (${linhas.length})`], ['revisar', `Para revisar (${paraRevisar.length})`], ['repetidos', `Já lançados (${repetidos.length})`]] as const).map(([id, rotulo]) => (
                <button key={id} className={`lc-banco ${filtro === id ? 'ativo' : ''}`} onClick={() => setFiltro(id)} disabled={id !== 'todos' && rotulo.endsWith('(0)')}>{rotulo}</button>
              ))}
              <span className="espaco" />
              <button className="link" onClick={() => setLinhas((xs) => xs.map((x) => ({ ...x, incluir: !x.repetido })))}>Marcar todos os novos</button>
              <button className="link" onClick={() => setLinhas((xs) => xs.map((x) => ({ ...x, incluir: false })))}>Desmarcar todos</button>
            </div>

            <ul className="ex-lista">
              {visiveis.map((l, i) => (
                <li key={l.chave} className={`ex-linha ${l.incluir ? '' : 'desmarcada'} ${l.revisar ? 'revisar' : ''}`} style={{ animationDelay: `${Math.min(i, 20) * 20}ms` }}>
                  <input type="checkbox" checked={l.incluir} onChange={(e) => mudar(l.chave, { incluir: e.target.checked })} aria-label="Importar este" />
                  <span className="ex-data">{dataCurta(l.data)}</span>
                  <button type="button" className={`ex-tipo ${l.tipo}`} title="Trocar entrada/saída"
                    onClick={() => mudar(l.chave, { tipo: l.tipo === 'entrada' ? 'saida' : 'entrada', categoria_id: '' })}>
                    <Icone nome={l.tipo === 'entrada' ? 'receber' : 'enviar'} tamanho={14} />
                  </button>
                  <span className="ex-nome">
                    <input value={l.descricao} onChange={(e) => mudar(l.chave, { descricao: e.target.value })} placeholder="Dê um nome" aria-label="Descrição" />
                    <small>
                      {l.revisar && <em><Icone nome="sino" tamanho={11} /> {l.revisar}</em>}
                      {l.repetido && <em className="rep">parece já lançado</em>}
                      {l.forma && <em className="forma">{infoForma(l.forma).nome}</em>}
                      {l.original && l.original !== l.descricao && <span title={l.original}>era: {l.original}</span>}
                    </small>
                  </span>
                  <select className="ex-cat" value={l.categoria_id} onChange={(e) => mudar(l.chave, { categoria_id: e.target.value })} aria-label="Categoria">
                    <option value="">Sem categoria</option>
                    {doTipo(c.categorias, l.tipo).map((k) => <option key={k.id} value={k.id}>{k.nome}</option>)}
                  </select>
                  <span className={`ex-valor ${l.tipo}`}>{l.tipo === 'entrada' ? '+' : '−'} {fmtValor(l.valor)}</span>
                </li>
              ))}
            </ul>

            <footer className="ex-acoes">
              <button className="btn" onClick={() => { setLinhas([]); setEtapa('escolher') }}><Icone nome="esq" tamanho={16} /> Outro arquivo</button>
              <span className="espaco" />
              <button className="btn primario" disabled={!escolhidas.length} onClick={() => void importar()}>
                <Icone nome="importar" tamanho={16} /> Importar {escolhidas.length} {escolhidas.length === 1 ? 'lançamento' : 'lançamentos'}
              </button>
            </footer>
          </div>
        )}

        {(etapa === 'gravando' || etapa === 'pronto') && (
          <div className="ex-pronto">
            <span className={`qz-pronto ${etapa === 'gravando' ? 'gravando' : ''}`}><Icone nome={etapa === 'gravando' ? 'relogio' : 'check'} tamanho={40} /></span>
            <h2>{etapa === 'gravando' ? 'Importando…' : `${gravados} ${gravados === 1 ? 'lançamento importado' : 'lançamentos importados'}`}</h2>
            {etapa === 'pronto' && (
              <>
                <p>Eles já entram nos totais, gráficos e categorias. Dá para editar qualquer um em Lançamentos.</p>
                <div className="ex-pronto-acoes">
                  <button className="btn" onClick={() => { setLinhas([]); setEtapa('escolher') }}>Importar outro</button>
                  <button className="btn primario" onClick={() => {
                    aoFechar()
                    if (ultimoMes && Number(ultimoMes.slice(0, 4)) === c.ano) c.irParaMes(Number(ultimoMes.slice(5, 7)))
                    c.irPara('lancamentos')
                  }}>Ver lançamentos{ultimoMes ? ` de ${MESES_NOME[Number(ultimoMes.slice(5, 7)) - 1].toLowerCase()}` : ''}</button>
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
      const g = m.get(k) ?? { original: l.descricao.trim(), tipo: l.tipo, ids: [], exemplo: `${l.data ? dataCurta(l.data) : 'sem data'} · ${fmtValor(l.valor)}` }
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
    <Modal titulo="Organizar nomes" aoFechar={aoFechar} tamanho="grande">
      <div className="ex">
        {feito !== null ? (
          <div className="ex-pronto">
            <span className="qz-pronto"><Icone nome="check" tamanho={40} /></span>
            <h2>{feito} {feito === 1 ? 'lançamento arrumado' : 'lançamentos arrumados'}</h2>
            <p>Os nomes novos já aparecem em todo o app.</p>
            <div className="ex-pronto-acoes"><button className="btn primario" onClick={aoFechar}>Fechar</button></div>
          </div>
        ) : !grupos.length ? (
          <div className="ex-pronto">
            <span className="qz-pronto"><Icone nome="check" tamanho={40} /></span>
            <h2>Os nomes de {c.ano} já estão organizados</h2>
            <p>Nada com CPF, CNPJ, código ou texto de banco sobrando.</p>
            <div className="ex-pronto-acoes"><button className="btn primario" onClick={aoFechar}>Fechar</button></div>
          </div>
        ) : (
          <div className="ex-revisar">
            <p className="ex-intro">
              Achei <b>{grupos.length}</b> {grupos.length === 1 ? 'nome que dá' : 'nomes que dão'} para arrumar nos lançamentos de {c.ano}.
              Confira, mude o que quiser e aplique. Os que eram só números ficam em branco para você escrever.
            </p>
            <ul className="ex-lista">
              {grupos.map((g, i) => {
                const k = g.original + g.tipo
                return (
                  <li key={k} className={`ex-linha org ${marcados[k] ? '' : 'desmarcada'} ${g.semNome ? 'revisar' : ''}`} style={{ animationDelay: `${Math.min(i, 20) * 20}ms` }}>
                    <input type="checkbox" checked={Boolean(marcados[k])} onChange={(e) => setMarcados({ ...marcados, [k]: e.target.checked })} aria-label="Arrumar este" />
                    <span className={`ex-tipo ${g.tipo}`}><Icone nome={g.tipo === 'entrada' ? 'receber' : 'enviar'} tamanho={14} /></span>
                    <span className="org-antes" title={g.original}>
                      <s>{g.original || '(sem nome)'}</s>
                      <small>{g.ids.length === 1 ? g.exemplo : `${g.ids.length} lançamentos`}</small>
                    </span>
                    <Icone nome="seta" tamanho={16} />
                    <span className="ex-nome">
                      <input value={nomes[k] ?? ''} placeholder="Escreva o nome" aria-label="Nome novo"
                        onChange={(e) => { setNomes({ ...nomes, [k]: e.target.value }); setMarcados({ ...marcados, [k]: Boolean(e.target.value.trim()) }) }} />
                      {g.revisar && <small><em><Icone nome="sino" tamanho={11} /> {g.revisar}</em></small>}
                    </span>
                  </li>
                )
              })}
            </ul>
            <footer className="ex-acoes">
              <span className="espaco" />
              <button className="btn" onClick={aoFechar}>Cancelar</button>
              <button className="btn primario" disabled={!total} onClick={() => void aplicar()}>
                <Icone nome="check" tamanho={16} /> Arrumar {total} {total === 1 ? 'lançamento' : 'lançamentos'}
              </button>
            </footer>
          </div>
        )}
      </div>
    </Modal>
  )
}
