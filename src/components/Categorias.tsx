import { useState } from 'react'
import { CORES, doTipo, ICONES } from '../lib/categorias'
import { IconeCategoria } from './IconeCategoria'
import type { Categoria, Tipo } from '../lib/types'
import { Icone } from './Icone'
import { Modal, Segmentado } from './ui'

type NovaCategoria = Omit<Categoria, 'id' | 'ordem'>

/** Cor para uma categoria nova: a primeira que ainda não está em uso, para o gráfico não repetir cores. */
const corLivre = (usadas: Categoria[]) => CORES.find((k) => !usadas.some((c) => c.cor === k)) ?? CORES[usadas.length % CORES.length]

/** Quadradinho arredondado com o desenho da categoria, na cor dela. */
export function Selo({ c, tamanho = 30 }: { c: { icone: string; cor: string }; tamanho?: number }) {
  return (
    <span className="selo" style={{ '--c': c.cor, width: tamanho, height: tamanho } as React.CSSProperties} aria-hidden="true">
      <IconeCategoria emoji={c.icone} tamanho={Math.round(tamanho * 0.5)} />
    </span>
  )
}

/**
 * Escolha da categoria no formulário: as mais usadas primeiro, o resto em "mais", e "+ nova"
 * para criar ali mesmo, sem sair do lançamento.
 */
export function EscolhaCategoria({ opcoes, valor, aoMudar, aoCriar, tipo }: {
  /** Já na ordem de uso. */
  opcoes: Categoria[]; valor: string; aoMudar: (id: string) => void
  /** undefined: não dá para criar (banco sem a migração 5). */
  aoCriar?: (c: NovaCategoria) => Promise<Categoria | undefined>; tipo: Tipo
}) {
  const [todas, setTodas] = useState(false)
  const [criando, setCriando] = useState(false)
  const LIMITE = 8
  const visiveis = todas || opcoes.length <= LIMITE + 1 ? opcoes : opcoes.slice(0, LIMITE)
  const escondida = !visiveis.some((c) => c.id === valor) ? opcoes.find((c) => c.id === valor) : undefined

  return (
    <div className="campo">
      <span className="campo-rotulo">Categoria</span>
      <div className="chips">
        {[...visiveis, ...(escondida ? [escondida] : [])].map((c) => (
          <button key={c.id} type="button" className={`chip ${valor === c.id ? 'ativo' : ''}`} style={{ '--c': c.cor } as React.CSSProperties}
            onClick={() => aoMudar(valor === c.id ? '' : c.id)}>
            <span className="chip-icone"><IconeCategoria emoji={c.icone} tamanho={15} /></span>{c.nome}
          </button>
        ))}
        {visiveis.length < opcoes.length && (
          <button type="button" className="chip" onClick={() => setTodas(true)}>Mais {opcoes.length - visiveis.length}…</button>
        )}
        {aoCriar && !criando && <button type="button" className="chip novo" onClick={() => setCriando(true)}>+ Nova categoria</button>}
      </div>
      {aoCriar && criando && (
        <EditorCategoria
          tipo={tipo}
          corInicial={corLivre(opcoes)}
          compacto
          aoCancelar={() => setCriando(false)}
          aoSalvar={async (c) => {
            const nova = await aoCriar(c)
            if (nova) { aoMudar(nova.id); setCriando(false) }
          }}
        />
      )}
    </div>
  )
}

/** Nome, emoji e cor de uma categoria (nova ou existente). */
function EditorCategoria({ inicial, tipo, corInicial, compacto, aoSalvar, aoExcluir, aoCancelar }: {
  inicial?: Categoria; tipo: Tipo; corInicial?: string; compacto?: boolean
  aoSalvar: (c: NovaCategoria) => void | Promise<void>; aoExcluir?: () => void; aoCancelar: () => void
}) {
  const [nome, setNome] = useState(inicial?.nome ?? '')
  const [icone, setIcone] = useState(inicial?.icone ?? '🏷️')
  const [cor, setCor] = useState(inicial?.cor ?? corInicial ?? CORES[0])
  const [confirmar, setConfirmar] = useState(false)
  const salvar = () => {
    if (!nome.trim()) return
    void aoSalvar({ tipo, nome: nome.trim(), icone, cor, papel: inicial?.papel ?? null })
  }

  return (
    <div className="editor-categoria" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); salvar() } }}>
      <div className="editor-categoria-nome">
        <Selo c={{ icone, cor }} tamanho={40} />
        <input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} maxLength={30}
          placeholder={tipo === 'saida' ? 'Ex.: Academia, Filhos, Viagens…' : 'Ex.: Aluguel recebido, Pensão…'} aria-label="Nome da categoria" />
      </div>
      <div className="grade-icones" role="radiogroup" aria-label="Ícone">
        {(compacto ? ICONES.slice(0, 20) : ICONES).map((i) => (
          <button key={i} type="button" role="radio" aria-checked={icone === i} className={icone === i ? 'ativo' : ''} onClick={() => setIcone(i)}>{i}</button>
        ))}
      </div>
      <div className="chips" role="radiogroup" aria-label="Cor">
        {CORES.map((k) => (
          <button key={k} type="button" role="radio" aria-checked={cor === k} aria-label={k} className={`cor ${cor === k ? 'ativo' : ''}`}
            style={{ background: k }} onClick={() => setCor(k)} />
        ))}
      </div>
      {inicial?.papel === 'divida' && <span className="campo-ajuda">É nesta categoria que as saídas podem abater uma dívida, por isso ela não pode ser apagada.</span>}
      <div className="form-acoes">
        {aoExcluir && !inicial?.papel && (
          confirmar
            ? <button type="button" className="btn perigo" onClick={aoExcluir}>Sim, excluir</button>
            : <button type="button" className="btn perigo" onClick={() => setConfirmar(true)}>Excluir</button>
        )}
        <span className="espaco" />
        <button type="button" className="btn" onClick={aoCancelar}>Cancelar</button>
        <button type="button" className="btn primario" disabled={!nome.trim()} onClick={salvar}>{inicial ? 'Salvar' : 'Criar'}</button>
      </div>
      {confirmar && <span className="campo-ajuda">Os lançamentos dela não somem: só ficam "sem categoria".</span>}
    </div>
  )
}

/** Tela de categorias: criar, renomear, trocar emoji e cor, apagar. */
export function GerenciarCategorias({ categorias, contagem, aoCriar, aoEditar, aoExcluir, aoFechar }: {
  categorias: Categoria[]
  /** Quantos lançamentos (no ano aberto) cada categoria tem. */
  contagem: Record<string, number>
  aoCriar: (c: NovaCategoria) => Promise<Categoria | undefined>
  aoEditar: (id: string, c: Partial<Categoria>) => void
  aoExcluir: (id: string) => void
  aoFechar: () => void
}) {
  const [tipo, setTipo] = useState<Tipo>('saida')
  const [editando, setEditando] = useState<string | 'nova' | null>(null)
  const lista = doTipo(categorias, tipo)

  return (
    <Modal titulo="Categorias" aoFechar={aoFechar}>
      <div className="form">
        <div className="categorias-topo">
          <Segmentado rotulo="Tipo" valor={tipo} aoMudar={(t) => { setTipo(t); setEditando(null) }}
            opcoes={[{ id: 'saida', nome: 'Saídas' }, { id: 'entrada', nome: 'Entradas' }]} />
          {editando !== 'nova' && <button type="button" className="btn primario" onClick={() => setEditando('nova')}><Icone nome="mais" tamanho={16} /> Criar categoria</button>}
        </div>
        {editando === 'nova' && (
          <EditorCategoria tipo={tipo} corInicial={corLivre(lista)} aoCancelar={() => setEditando(null)}
            aoSalvar={async (c) => { if (await aoCriar(c)) setEditando(null) }} />
        )}
        <ul className="lista-categorias">
          {lista.map((c) => (
            <li key={c.id}>
              {editando === c.id ? (
                <EditorCategoria inicial={c} tipo={tipo} aoCancelar={() => setEditando(null)}
                  aoSalvar={(x) => { aoEditar(c.id, { nome: x.nome, icone: x.icone, cor: x.cor }); setEditando(null) }}
                  aoExcluir={() => { aoExcluir(c.id); setEditando(null) }} />
              ) : (
                <button type="button" className="categoria-linha" onClick={() => setEditando(c.id)}>
                  <Selo c={c} />
                  <span className="categoria-linha-nome">{c.nome}</span>
                  <span className="categoria-linha-sub">{contagem[c.id] ? `${contagem[c.id]} ${contagem[c.id] === 1 ? 'lançamento' : 'lançamentos'}` : ''}</span>
                  <Icone nome="dir" tamanho={16} />
                </button>
              )}
            </li>
          ))}
          {!lista.length && <li className="quadro-vazio">Nenhuma categoria de {tipo === 'saida' ? 'saída' : 'entrada'}. Toque em Criar categoria.</li>}
        </ul>
        <p className="dica">Dica: ao lançar, o app já sugere a categoria pela descrição ("iFood" → Alimentação) e aprende com o que você escolhe.</p>
      </div>
    </Modal>
  )
}
