import { useRef, useState } from 'react'
import type { Sugestao } from '../lib/adaptacao'
import { reduzirFoto } from '../lib/foto'
import { MOEDAS } from '../lib/moedas'
import { DETALHES, MODULOS } from '../lib/perfil'
import { definirMovimento, definirTema, useMovimento, useTema, type Movimento, type PreferenciaTema } from '../lib/tema'
import type { Categoria, Modulo, Perfil } from '../lib/types'
import { estiloLente, useLente } from '../lib/useLente'
import { Bandeira } from './Bandeira'
import { PreviaDetalhe, PreviaTema } from './Previas'
import { Selo } from './Categorias'
import { PARTES_ZERAR, type EscolhaZerar, type ParteZerar } from '../lib/zerar'
import { Icone } from './Icone'
import { Interruptor, Modal, Opcao } from './ui'

type Secao = 'perfil' | 'aparencia' | 'painel' | 'categorias' | 'dados' | 'conta'
const SECOES: { id: Secao; nome: string; icone: string; sub: string }[] = [
  { id: 'perfil', nome: 'Perfil', icone: 'carteira', sub: 'Seu nome e as moedas que você usa' },
  { id: 'aparencia', nome: 'Aparência', icone: 'sol', sub: 'Tema e animações' },
  { id: 'painel', nome: 'Painel', icone: 'ajustes', sub: 'O que aparece e o jeito de ver' },
  { id: 'categorias', nome: 'Categorias', icone: 'lista', sub: 'Onde cada lançamento se encaixa' },
  { id: 'dados', nome: 'Dados', icone: 'exportar', sub: 'Backup, planilha e começar de novo' },
  { id: 'conta', nome: 'Conta', icone: 'sair', sub: 'Sua sessão neste aparelho' },
]

/** Cartão de ação grande (Dados e Conta). */
function CartaoAcao({ icone, titulo, texto, aoClicar, perigo }: { icone: string; titulo: string; texto: string; aoClicar: () => void; perigo?: boolean }) {
  return (
    <button type="button" className={`cfg-acao ${perigo ? 'perigo' : ''}`} onClick={aoClicar}>
      <span className="cfg-acao-icone"><Icone nome={icone} /></span>
      <strong>{titulo}</strong>
      <small>{texto}</small>
      <span className="cfg-acao-seta"><Icone nome="seta" tamanho={16} /></span>
    </button>
  )
}

/** Configurações em tela cheia: menu de seções à esquerda e cartões à direita. Cada mudança vale na hora. */
export function Configuracoes({ perfil, email, categorias, foto, aoMudarFoto, aoMudar, aoRefazer, aoCategorias, aoBackup, aoImportar, aoExtrato, aoOrganizar, aoZerar, aoSair, aoFechar }: {
  perfil: Perfil; email: string; aoMudar: (p: Perfil) => void; aoRefazer: () => void; aoCategorias: () => void
  /** Para mostrar as categorias na seção Categorias. */
  categorias?: Categoria[]
  /** Foto de perfil (data URL) e como trocá-la (null tira a foto). */
  foto?: string | null
  aoMudarFoto?: (f: string | null) => void
  aoBackup: () => void; aoImportar: () => void
  /** Importar extrato do banco e organizar os nomes dos lançamentos. */
  aoExtrato?: () => void; aoOrganizar?: () => void
  /** Abre a confirmação de zerar os dados. */
  aoZerar: () => void; aoSair: () => void
  aoFechar: () => void
}) {
  const [secao, setSecao] = useState<Secao>('perfil')
  const [nome, setNome] = useState(perfil.nome)
  const { preferencia } = useTema()
  const movimento = useMovimento()
  const nav = useRef<HTMLElement>(null)
  const lente = useLente(nav, 'button.ativo', secao)
  const ligar = (m: Modulo, v: boolean) => aoMudar({ ...perfil, modulos: { ...perfil.modulos, [m]: v } })
  const alternarMoeda = (m: string) => {
    const moedas = perfil.moedas.includes(m) ? perfil.moedas.filter((x) => x !== m) : [...perfil.moedas, m]
    aoMudar({ ...perfil, moedas, modulos: { ...perfil.modulos, moedas: moedas.length > 0 } })
  }
  const escolherPrincipal = (moeda: string) => {
    const moedas = perfil.moedas.filter((x) => x !== moeda)
    aoMudar({ ...perfil, moeda, moedas, modulos: { ...perfil.modulos, moedas: perfil.modulos.moedas && moedas.length > 0 } })
  }
  const salvarNome = () => { if (nome.trim() !== perfil.nome) aoMudar({ ...perfil, nome: nome.trim() }) }
  const fechar = () => { salvarNome(); aoFechar() }
  const iniciais = (nome.trim() || email).split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((x) => x[0]?.toUpperCase()).join('')
  const info = SECOES.find((x) => x.id === secao)!
  const trocarTema = (t: PreferenciaTema, e: React.MouseEvent) => definirTema(t, { x: e.clientX, y: e.clientY })

  return (
    <Modal titulo="Configurações" aoFechar={fechar} tamanho="grande">
      <div className="config">
        <aside className="config-lado">
          <div className="config-quem">
            <span className="config-avatar">{foto ? <img src={foto} alt="" /> : iniciais || '?'}</span>
            <span><strong>{nome.trim() || 'Você'}</strong><small>{email}</small></span>
          </div>
          <nav className="config-nav" aria-label="Seções" ref={nav}>
            {lente && <span className="config-lente" aria-hidden="true" style={estiloLente(lente)} />}
            {SECOES.map((x) => (
              <button key={x.id} type="button" className={secao === x.id ? 'ativo' : ''} onClick={() => { salvarNome(); setSecao(x.id) }}>
                <Icone nome={x.icone} tamanho={18} /><span>{x.nome}</span>
              </button>
            ))}
          </nav>
        </aside>

        <div className="config-conteudo" key={secao}>
          <header className="config-cab">
            <h3>{info.nome}</h3>
            <p>{info.sub}</p>
          </header>

          {secao === 'perfil' && (
            <>
              <section className="cfg-cartao cfg-voce">
                <FotoPerfil foto={foto ?? null} iniciais={iniciais} aoMudar={aoMudarFoto} />
                <label className="campo">
                  <span className="campo-rotulo">Como quer ser chamado</span>
                  <input value={nome} onChange={(e) => setNome(e.target.value)} onBlur={salvarNome} placeholder="Seu nome ou apelido" maxLength={40} />
                </label>
              </section>
              <section className="cfg-bloco">
                <h4>Moeda principal <small>todos os totais aparecem nela; o que já foi lançado não é convertido</small></h4>
                <div className="cfg-moedas" role="radiogroup" aria-label="Moeda principal">
                  {MOEDAS.map((m) => (
                    <button key={m.codigo} type="button" role="radio" aria-checked={perfil.moeda === m.codigo}
                      className={`cfg-moeda ${perfil.moeda === m.codigo ? 'ativo' : ''}`} onClick={() => escolherPrincipal(m.codigo)}>
                      <Bandeira moeda={m.codigo} tamanho={34} />
                      <span><strong>{m.codigo}</strong><small>{m.nome}</small></span>
                      <i className="cfg-marca"><Icone nome="check" tamanho={12} /></i>
                    </button>
                  ))}
                </div>
              </section>
              <section className="cfg-bloco">
                <h4>Outras moedas que você usa <small>toque para ligar ou desligar; o painel mostra quanto valem na sua moeda</small></h4>
                <div className="cfg-moedas" role="group" aria-label="Outras moedas">
                  {MOEDAS.filter((x) => x.codigo !== perfil.moeda).map((m) => (
                    <button key={m.codigo} type="button" role="checkbox" aria-checked={perfil.moedas.includes(m.codigo)}
                      className={`cfg-moeda multipla ${perfil.moedas.includes(m.codigo) ? 'ativo' : ''}`} onClick={() => alternarMoeda(m.codigo)}>
                      <Bandeira moeda={m.codigo} tamanho={34} />
                      <span><strong>{m.codigo}</strong><small>{m.nome}</small></span>
                      <i className="cfg-marca"><Icone nome="check" tamanho={12} /></i>
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}

          {secao === 'aparencia' && (
            <>
              <section className="cfg-bloco">
                <h4>Tema</h4>
                <div className="cfg-escolhas tres" role="radiogroup" aria-label="Tema">
                  {([['sistema', 'Automático', 'auto', 'Segue o seu aparelho'], ['claro', 'Claro', 'claro', 'Fundo claro, ótimo de dia'], ['escuro', 'Escuro', 'escuro', 'Descansa os olhos à noite']] as const).map(([id, rotulo, previa, texto]) => (
                    <button key={id} type="button" role="radio" aria-checked={preferencia === id}
                      className={`cfg-escolha ${preferencia === id ? 'ativo' : ''}`} onClick={(e) => trocarTema(id, e)}>
                      <PreviaTema tema={previa} />
                      <span className="cfg-escolha-texto"><strong>{rotulo}</strong><small>{texto}</small></span>
                      <i className="cfg-marca"><Icone nome="check" tamanho={12} /></i>
                    </button>
                  ))}
                </div>
              </section>
              <section className="cfg-bloco">
                <h4>Animações</h4>
                <div className="cfg-escolhas dois" role="radiogroup" aria-label="Animações">
                  {([['completo', 'Completas', 'Blocos que surgem, números que contam e o tema que se espalha'], ['reduzido', 'Reduzidas', 'Tudo aparece direto, sem movimento']] as const).map(([id, rotulo, texto]) => (
                    <button key={id} type="button" role="radio" aria-checked={movimento === id}
                      className={`cfg-escolha ${movimento === id ? 'ativo' : ''}`} onClick={() => definirMovimento(id as Movimento)}>
                      <span className={`previa-movimento ${id}`} aria-hidden="true"><i /><i /><i /><i /><i /></span>
                      <span className="cfg-escolha-texto"><strong>{rotulo}</strong><small>{texto}</small></span>
                      <i className="cfg-marca"><Icone nome="check" tamanho={12} /></i>
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}

          {secao === 'painel' && (
            <>
              <section className="cfg-bloco">
                <h4>Jeito de ver</h4>
                <div className="cfg-escolhas tres" role="radiogroup" aria-label="Jeito de ver">
                  {DETALHES.map((d) => (
                    <button key={d.id} type="button" role="radio" aria-checked={perfil.detalhe === d.id}
                      className={`cfg-escolha ${perfil.detalhe === d.id ? 'ativo' : ''}`} onClick={() => aoMudar({ ...perfil, detalhe: d.id })}>
                      <PreviaDetalhe nivel={d.id} />
                      <span className="cfg-escolha-texto"><strong>{d.nome}</strong><small>{d.descricao}</small></span>
                      <i className="cfg-marca"><Icone nome="check" tamanho={12} /></i>
                    </button>
                  ))}
                </div>
              </section>
              <section className="cfg-bloco">
                <h4>O que aparece no seu painel <small>entradas e saídas estão sempre ligadas: são a base de tudo</small></h4>
                <div className="cfg-modulos">
                  {MODULOS.map((m) => (
                    <div key={m.id} className={`cfg-modulo ${perfil.modulos[m.id] ? 'ligado' : ''}`}>
                      <span className="cfg-modulo-icone"><Icone nome={m.icone} /></span>
                      <Interruptor rotulo={m.nome} ligado={perfil.modulos[m.id]} aoMudar={(v) => ligar(m.id, v)} />
                      <strong>{m.nome}</strong>
                      <small>{m.descricao}</small>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {secao === 'categorias' && (
            <section className="cfg-cartao cfg-categorias">
              <div className="cfg-selos">
                {(categorias ?? []).slice(0, 18).map((c) => (
                  <span key={c.id} className="cfg-selo" title={c.nome}><Selo c={c} tamanho={44} /><small>{c.nome}</small></span>
                ))}
              </div>
              <button type="button" className="btn primario" onClick={aoCategorias}><Icone nome="ajustes" tamanho={16} /> Editar categorias</button>
            </section>
          )}

          {secao === 'dados' && (
            <div className="cfg-acoes">
              <CartaoAcao icone="exportar" titulo="Baixar backup" texto="Um arquivo com todos os seus dados, para guardar com você." aoClicar={aoBackup} />
              {aoExtrato && <CartaoAcao icone="relatorio" titulo="Importar extrato" texto="PDF, CSV, Excel, Word ou OFX do seu banco. Arruma os nomes e mostra tudo antes de gravar." aoClicar={aoExtrato} />}
              {aoOrganizar && <CartaoAcao icone="lapis" titulo="Organizar nomes" texto="Tira CPF, CNPJ, códigos e texto de banco dos nomes dos lançamentos que você já tem." aoClicar={aoOrganizar} />}
              <CartaoAcao icone="importar" titulo="Importar planilha" texto="Traz os meses de uma planilha (.xlsx). Pede confirmação antes." aoClicar={aoImportar} />
              <CartaoAcao icone="lixeira" titulo="Zerar dados" texto="Escolha o que apagar: tudo, entradas, saídas, dívidas, cartões e mais." aoClicar={aoZerar} perigo />
            </div>
          )}

          {secao === 'conta' && (
            <>
              <section className="cfg-cartao cfg-voce">
                <span className="config-avatar grande">{foto ? <img src={foto} alt="" /> : iniciais || '?'}</span>
                <span className="cfg-conta"><small>Você entrou como</small><strong className="config-email">{email || 'sem e-mail'}</strong></span>
              </section>
              <div className="cfg-acoes">
                <CartaoAcao icone="ajustes" titulo="Refazer as perguntas" texto="Responda de novo as perguntas iniciais para reajustar o painel." aoClicar={aoRefazer} />
                <CartaoAcao icone="sair" titulo="Sair" texto="Encerra a sessão neste aparelho." aoClicar={aoSair} />
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

/**
 * Confirmação de zerar os dados. É a única ação que não tem volta, então pede três coisas: escolher e entender o
 * que será apagado, ter a chance de baixar o backup e digitar ZERAR.
 */
export function ZerarDados({ contagem, aoBaixarBackup, aoZerar, aoFechar }: {
  contagem: Partial<Record<ParteZerar, number>>
  aoBaixarBackup: () => Promise<unknown>; aoZerar: (escolha: EscolhaZerar) => Promise<void>; aoFechar: () => void
}) {
  const [escolha, setEscolha] = useState<EscolhaZerar>({})
  const [texto, setTexto] = useState('')
  const [baixou, setBaixou] = useState(false)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const algum = PARTES_ZERAR.some((x) => escolha[x.id])
  const pode = algum && texto.trim().toUpperCase() === 'ZERAR' && !ocupado
  const marcadas = PARTES_ZERAR.filter((x) => x.id !== 'tudo' && escolha[x.id])

  const alternar = (id: ParteZerar) => setEscolha((e) => ({ ...e, [id]: !e[id] }))
  const baixar = async () => {
    setOcupado('Gerando backup…')
    try { await aoBaixarBackup(); setBaixou(true) } catch (e) { setErro(e instanceof Error ? e.message : String(e)) }
    setOcupado(null)
  }
  const zerar = async () => {
    setOcupado('Apagando…')
    setErro(null)
    try { await aoZerar(escolha) } catch (e) {
      setErro(`Não deu para apagar tudo: ${e instanceof Error ? e.message : String(e)}. Tente de novo.`)
      setOcupado(null)
    }
  }
  const quanto = (id: ParteZerar) => (contagem[id] ? ` (${contagem[id]})` : '')

  return (
    <Modal titulo="Zerar dados" aoFechar={() => !ocupado && aoFechar()}>
      <div className="form">
        <p className="zerar-texto">Escolha o que apagar. <b>Não tem como desfazer.</b></p>
        <div className="opcoes">
          {PARTES_ZERAR.map((x) => {
            const ativo = Boolean(escolha[x.id] || (escolha.tudo && x.id !== 'tudo'))
            return (
              <Opcao key={x.id} multipla ativo={ativo} aoClicar={() => !(escolha.tudo && x.id !== 'tudo') && alternar(x.id)}
                titulo={x.nome + (x.id === 'tudo' ? '' : quanto(x.id))} texto={x.texto} />
            )
          })}
        </div>
        <p className="zerar-texto" aria-live="polite">
          {escolha.tudo
            ? <>Vai apagar <b>tudo</b>: lançamentos, dívidas, cartões, contas fixas, metas, saldos, bancos e categorias. As perguntas iniciais aparecem de novo.</>
            : marcadas.length
              ? <>Vai apagar: <b>{marcadas.map((x) => x.nome.toLowerCase()).join(', ')}</b>. O resto fica como está.</>
              : 'Marque o que quer apagar.'}
        </p>
        <button type="button" className="btn" onClick={baixar} disabled={Boolean(ocupado)}>
          <Icone nome="exportar" tamanho={16} /> {baixou ? 'Backup baixado ✓' : 'Baixar backup antes (recomendado)'}
        </button>
        <label className="campo">
          <span className="campo-rotulo">Para confirmar, digite <b>ZERAR</b></span>
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="ZERAR" autoComplete="off" autoCapitalize="characters" />
        </label>
        {erro && <p className="form-erro">{erro}</p>}
        <div className="form-acoes">
          <span className="espaco" />
          <button type="button" className="btn" onClick={aoFechar} disabled={Boolean(ocupado)}>Cancelar</button>
          <button type="button" className="btn perigo-forte" disabled={!pode} onClick={zerar}>{ocupado ?? 'Zerar dados'}</button>
        </div>
      </div>
    </Modal>
  )
}

/** Sugestão tirada do uso ("Começou a investir?"), com aceitar e recusar. */
export function CartaoSugestao({ s, aoAceitar, aoRecusar }: { s: Sugestao; aoAceitar: () => void; aoRecusar: () => void }) {
  return (
    <section className="sugestao" aria-live="polite">
      <span className="sugestao-icone"><Icone nome={s.icone} /></span>
      <div className="sugestao-texto">
        <strong>{s.titulo}</strong>
        <p>{s.texto}</p>
      </div>
      <div className="sugestao-acoes">
        <button className="btn primario" onClick={aoAceitar}>{s.botao}</button>
        <button className="btn" onClick={aoRecusar}>Agora não</button>
      </div>
    </section>
  )
}

/**
 * "Acompanhe mais": cada módulo desligado é um bloco com ícone, que liga com um toque (dá para tirar depois).
 * É elástico: na Início ele cresce para preencher a sobra da coluna, e os blocos crescem junto.
 */
export function CartaoAcompanhar({ perfil, aoLigar, aoPersonalizar }: {
  perfil: Perfil; aoLigar: (m: Modulo) => void; aoPersonalizar: () => void
}) {
  const desligados = MODULOS.filter((m) => !perfil.modulos[m.id] || (m.id === 'moedas' && !perfil.moedas.length))
  return (
    <section className="bloco acompanhar">
      <header className="bloco-cab">
        <h2>{desligados.length ? 'Acompanhe mais' : 'Seu painel'}</h2>
        <button className="link" onClick={aoPersonalizar}><Icone nome="ajustes" tamanho={15} /> Personalizar</button>
      </header>
      <div className="acompanhar-grade">
        {desligados.map((m) => (
          // Para outras moedas falta escolher quais: liga e abre os ajustes já na lista de moedas.
          <button key={m.id} className="acompanhar-item" onClick={() => { aoLigar(m.id); if (m.id === 'moedas') aoPersonalizar() }} title={m.descricao}>
            <span className="acompanhar-icone"><Icone nome={m.icone} /></span>
            <span>{m.nome}</span>
            <i className="acompanhar-mais" aria-hidden="true"><Icone nome="mais" tamanho={12} /></i>
          </button>
        ))}
        {!desligados.length && (
          <button className="acompanhar-item" onClick={aoPersonalizar}>
            <span className="acompanhar-icone"><Icone nome="check" /></span>
            <span>Tudo ligado</span>
          </button>
        )}
      </div>
    </section>
  )
}

/**
 * Avatar grande com a foto (ou as iniciais) e o botão de câmera para trocar. A imagem escolhida é recortada no
 * quadrado do meio e reduzida no próprio aparelho antes de ser guardada.
 */
function FotoPerfil({ foto, iniciais, aoMudar }: { foto: string | null; iniciais: string; aoMudar?: (f: string | null) => void }) {
  const entrada = useRef<HTMLInputElement>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [lendo, setLendo] = useState(false)
  const escolher = async (f: File | undefined) => {
    if (!f || !aoMudar) return
    setErro(null)
    setLendo(true)
    try {
      aoMudar(await reduzirFoto(f))
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setLendo(false)
      if (entrada.current) entrada.current.value = ''
    }
  }
  return (
    <div className="cfg-foto">
      <button type="button" className={`config-avatar grande cfg-foto-botao ${lendo ? 'lendo' : ''}`} onClick={() => entrada.current?.click()}
        disabled={!aoMudar} aria-label={foto ? 'Trocar foto de perfil' : 'Pôr foto de perfil'}>
        {foto ? <img key={foto.slice(-24)} src={foto} alt="" /> : iniciais || '?'}
        <span className="cfg-foto-camera" aria-hidden="true"><Icone nome="camera" tamanho={15} /></span>
      </button>
      <input ref={entrada} type="file" accept="image/*" hidden onChange={(e) => void escolher(e.target.files?.[0])} />
      <span className="cfg-foto-acoes">
        <button type="button" className="link" onClick={() => entrada.current?.click()} disabled={!aoMudar}>{foto ? 'Trocar foto' : 'Pôr foto'}</button>
        {foto && aoMudar && <button type="button" className="link perigo" onClick={() => aoMudar(null)}>Tirar</button>}
      </span>
      {erro && <small className="form-erro">{erro}</small>}
    </div>
  )
}
