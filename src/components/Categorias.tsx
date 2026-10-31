import { useState } from 'react'
import { CORES, doTipo, ICONES } from '../lib/categorias'
import { IconeCategoria } from './IconeCategoria'
import type { Categoria, Tipo } from '../lib/types'
import { Icone } from './Icone'
import { Modal, Segmentado } from './ui'
import { tx } from '../lib/textos'

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
export function EscolhaCategoria({ opcoes, valor, aoMudar, aoCriar, tipo, grade }: {
  /** Já na ordem de uso. */
  opcoes: Categoria[]; valor: string; aoMudar: (id: string) => void
  /** undefined: não dá para criar (banco sem a migração 5). */
  aoCriar?: (c: NovaCategoria) => Promise<Categoria | undefined>; tipo: Tipo
  /** Ladrilhos com o ícone grande (telas de cadastro). */
  grade?: boolean
}) {
  const [todas, setTodas] = useState(false)
  const [criando, setCriando] = useState(false)
  const LIMITE = grade ? 11 : 8
  const visiveis = todas || opcoes.length <= LIMITE + 1 ? opcoes : opcoes.slice(0, LIMITE)
  const escondida = !visiveis.some((c) => c.id === valor) ? opcoes.find((c) => c.id === valor) : undefined

  return (
    <div className="campo">
      <span className="campo-rotulo">{grade && <Icone nome="menu" tamanho={15} />}{tx('Categoria')}</span>
      <div className={`chips ${grade ? 'grade' : ''}`}>
        {[...visiveis, ...(escondida ? [escondida] : [])].map((c) => (
          <button key={c.id} type="button" className={`chip ${valor === c.id ? 'ativo' : ''}`} style={{ '--c': c.cor } as React.CSSProperties}
            onClick={() => aoMudar(valor === c.id ? '' : c.id)}>
            <span className="chip-icone"><IconeCategoria emoji={c.icone} tamanho={grade ? 22 : 15} /></span>{c.nome}
          </button>
        ))}
        {visiveis.length < opcoes.length && (
          <button type="button" className="chip" onClick={() => setTodas(true)}>
            {grade && <span className="chip-icone neutro"><Icone nome="reticencias" tamanho={18} /></span>}{tx('Mais {0}…', opcoes.length - visiveis.length)}
          </button>
        )}
        {aoCriar && !criando && (
          <button type="button" className="chip novo" onClick={() => setCriando(true)}>
            {grade && <span className="chip-icone"><Icone nome="mais" tamanho={18} /></span>}{tx('+ Nova categoria')}
          </button>
        )}
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
          placeholder={tipo === 'saida' ? tx('Ex.: Academia, Filhos, Viagens…') : tx('Ex.: Aluguel recebido, Pensão…')} aria-label={tx('Nome da categoria')} />
      </div>
      <div className="grade-icones" role="radiogroup" aria-label={tx('Ícone')}>
        {(compacto ? ICONES.slice(0, 20) : ICONES).map((i) => (
          <button key={i} type="button" role="radio" aria-checked={icone === i} className={icone === i ? 'ativo' : ''} onClick={() => setIcone(i)}>{i}</button>
        ))}
      </div>
      <div className="chips" role="radiogroup" aria-label={tx('Cor')}>
        {CORES.map((k) => (
          <button key={k} type="button" role="radio" aria-checked={cor === k} aria-label={k} className={`cor ${cor === k ? 'ativo' : ''}`}
            style={{ background: k }} onClick={() => setCor(k)} />
        ))}
      </div>
      {inicial?.papel === 'divida' && <span className="campo-ajuda">{tx('É nesta categoria que as saídas podem abater uma dívida, por isso ela não pode ser apagada.')}</span>}
      <div className="form-acoes">
        {aoExcluir && !inicial?.papel && (
          confirmar
            ? <button type="button" className="btn perigo" onClick={aoExcluir}>{tx('Sim, excluir')}</button>
            : <button type="button" className="btn perigo" onClick={() => setConfirmar(true)}>{tx('Excluir')}</button>
        )}
        <span className="espaco" />
        <button type="button" className="btn" onClick={aoCancelar}>{tx('Cancelar')}</button>
        <button type="button" className="btn primario" disabled={!nome.trim()} onClick={salvar}>{inicial ? tx('Salvar') : tx('Criar')}</button>
      </div>
      {confirmar && <span className="campo-ajuda">{tx('Os lançamentos dela não somem: só ficam "sem categoria".')}</span>}
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
    <Modal titulo={tx('Categorias')} aoFechar={aoFechar}>
      <div className="form">
        <div className="categorias-topo">
          <Segmentado rotulo={tx('Tipo')} valor={tipo} aoMudar={(t) => { setTipo(t); setEditando(null) }}
            opcoes={[{ id: 'saida', nome: tx('Saídas') }, { id: 'entrada', nome: tx('Entradas') }]} />
          {editando !== 'nova' && <button type="button" className="btn primario" onClick={() => setEditando('nova')}><Icone nome="mais" tamanho={16} /> {tx('Criar categoria')}</button>}
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
                  <span className="categoria-linha-sub">{contagem[c.id] ? (contagem[c.id] === 1 ? tx('1 lançamento') : tx('{0} lançamentos', contagem[c.id])) : ''}</span>
                  <Icone nome="dir" tamanho={16} />
                </button>
              )}
            </li>
          ))}
          {!lista.length && <li className="quadro-vazio">{tx('Nenhuma categoria de')} {tipo === 'saida' ? tx('saída') : tx('entrada')}{tx('. Toque em Criar categoria.')}</li>}
        </ul>
        <p className="dica">{tx('Dica: ao lançar, o app já sugere a categoria pela descrição ("iFood" → Alimentação) e aprende com o que você escolhe.')}</p>
      </div>
    </Modal>
  )
}
