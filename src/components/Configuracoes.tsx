import { useState } from 'react'
import type { Sugestao } from '../lib/adaptacao'
import { MOEDAS } from '../lib/moedas'
import { DETALHES, MODULOS } from '../lib/perfil'
import type { Modulo, Perfil } from '../lib/types'
import { PARTES_ZERAR, type EscolhaZerar, type ParteZerar } from '../lib/zerar'
import { Icone } from './Icone'
import { Interruptor, Modal, Opcao } from './ui'

type Secao = 'perfil' | 'painel' | 'categorias' | 'dados' | 'conta'
const SECOES: { id: Secao; nome: string; icone: Parameters<typeof Icone>[0]['nome'] }[] = [
  { id: 'perfil', nome: 'Perfil', icone: 'lista' },
  { id: 'painel', nome: 'Painel', icone: 'ajustes' },
  { id: 'categorias', nome: 'Categorias', icone: 'lista' },
  { id: 'dados', nome: 'Dados', icone: 'exportar' },
  { id: 'conta', nome: 'Conta', icone: 'sair' },
]

function Linha({ icone, titulo, texto, aoClicar }: { icone: Parameters<typeof Icone>[0]['nome']; titulo: string; texto: string; aoClicar: () => void }) {
  return (
    <button type="button" className="ajuste ajuste-botao" onClick={aoClicar}>
      <span className="ajuste-icone"><Icone nome={icone} /></span>
      <span className="ajuste-texto"><strong>{titulo}</strong><small>{texto}</small></span>
      <Icone nome="dir" tamanho={16} />
    </button>
  )
}

/** Configurações: perfil, painel, categorias, dados e conta. Cada mudança vale na hora, sem botão de salvar. */
export function Configuracoes({ perfil, email, aoMudar, aoRefazer, aoCategorias, aoBackup, aoImportar, aoZerar, aoSair, aoFechar }: {
  perfil: Perfil; email: string; aoMudar: (p: Perfil) => void; aoRefazer: () => void; aoCategorias: () => void
  aoBackup: () => void; aoImportar: () => void
  /** Abre a confirmação de zerar os dados. */
  aoZerar: () => void; aoSair: () => void
  aoFechar: () => void
}) {
  const [secao, setSecao] = useState<Secao>('perfil')
  const [nome, setNome] = useState(perfil.nome)
  const ligar = (m: Modulo, v: boolean) => aoMudar({ ...perfil, modulos: { ...perfil.modulos, [m]: v } })
  const alternarMoeda = (m: string) => {
    const moedas = perfil.moedas.includes(m) ? perfil.moedas.filter((x) => x !== m) : [...perfil.moedas, m]
    aoMudar({ ...perfil, moedas, modulos: { ...perfil.modulos, moedas: moedas.length > 0 } })
  }
  const salvarNome = () => { if (nome.trim() !== perfil.nome) aoMudar({ ...perfil, nome: nome.trim() }) }
  const fechar = () => { salvarNome(); aoFechar() }

  return (
    <Modal titulo="Configurações" aoFechar={fechar} tamanho="grande">
      <div className="config">
        <nav className="config-nav" aria-label="Seções">
          {SECOES.map((x) => (
            <button key={x.id} type="button" className={secao === x.id ? 'ativo' : ''} onClick={() => { salvarNome(); setSecao(x.id) }}>
              <Icone nome={x.icone} tamanho={18} /><span>{x.nome}</span>
            </button>
          ))}
        </nav>
        <div className="config-conteudo form">
          {secao === 'perfil' && (
            <>
              <h3>Perfil</h3>
              <label className="campo">
                <span className="campo-rotulo">Como quer ser chamado</span>
                <input value={nome} onChange={(e) => setNome(e.target.value)} onBlur={salvarNome} placeholder="Seu nome ou apelido" maxLength={40} />
              </label>
              <label className="campo">
                <span className="campo-rotulo">Moeda principal</span>
                <select value={perfil.moeda} onChange={(e) => {
                  const moeda = e.target.value
                  const moedas = perfil.moedas.filter((x) => x !== moeda)
                  aoMudar({ ...perfil, moeda, moedas, modulos: { ...perfil.modulos, moedas: perfil.modulos.moedas && moedas.length > 0 } })
                }}>
                  {MOEDAS.map((m) => <option key={m.codigo} value={m.codigo}>{m.bandeira} {m.nome} ({m.codigo})</option>)}
                </select>
                <span className="campo-ajuda">Os totais passam a aparecer nela. Valores já lançados não são convertidos.</span>
              </label>
              <div className="campo">
                <span className="campo-rotulo">Outras moedas que você usa</span>
                <div className="chips">
                  {MOEDAS.filter((x) => x.codigo !== perfil.moeda).map((x) => (
                    <button key={x.codigo} type="button" className={`chip ${perfil.moedas.includes(x.codigo) ? 'ativo' : ''}`} onClick={() => alternarMoeda(x.codigo)}>
                      {x.bandeira}&nbsp;{x.nome}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {secao === 'painel' && (
            <>
              <h3>Painel</h3>
              <section className="campo">
                <span className="campo-rotulo">O que aparece no seu painel</span>
                <div className="lista-ajustes">
                  <div className="ajuste fixo">
                    <span className="ajuste-icone"><Icone nome="lista" /></span>
                    <span className="ajuste-texto"><strong>Entradas e saídas</strong><small>Sempre ligado: é a base de tudo.</small></span>
                  </div>
                  {MODULOS.map((m) => (
                    <div key={m.id} className="ajuste-grupo">
                      <div className="ajuste">
                        <span className="ajuste-icone"><Icone nome={m.icone} /></span>
                        <span className="ajuste-texto"><strong>{m.nome}</strong><small>{m.descricao}</small></span>
                        <Interruptor rotulo={m.nome} ligado={perfil.modulos[m.id]} aoMudar={(v) => ligar(m.id, v)} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              <section className="campo">
                <span className="campo-rotulo">Jeito de ver</span>
                <div className="opcoes">
                  {DETALHES.map((d) => (
                    <Opcao key={d.id} ativo={perfil.detalhe === d.id} aoClicar={() => aoMudar({ ...perfil, detalhe: d.id })} titulo={d.nome} texto={d.descricao} />
                  ))}
                </div>
              </section>
            </>
          )}

          {secao === 'categorias' && (
            <>
              <h3>Categorias</h3>
              <Linha icone="lista" titulo="Editar categorias" texto="Crie as suas, renomeie, troque emoji e cor." aoClicar={aoCategorias} />
            </>
          )}

          {secao === 'dados' && (
            <>
              <h3>Dados</h3>
              <Linha icone="exportar" titulo="Baixar backup" texto="Um arquivo com todos os seus dados, para guardar com você." aoClicar={aoBackup} />
              <Linha icone="importar" titulo="Importar planilha" texto="Traz os meses de uma planilha (.xlsx). Pede confirmação antes." aoClicar={aoImportar} />
              <section className="campo zona-cuidado">
                <span className="campo-rotulo">Começar de novo</span>
                <Linha icone="lixeira" titulo="Zerar dados" texto="Escolha o que apagar: tudo, entradas, saídas, dívidas, cartões e mais. Pede confirmação." aoClicar={aoZerar} />
              </section>
            </>
          )}

          {secao === 'conta' && (
            <>
              <h3>Conta</h3>
              <div className="campo">
                <span className="campo-rotulo">Você entrou como</span>
                <strong className="config-email">{email || 'sem e-mail'}</strong>
              </div>
              <Linha icone="ajustes" titulo="Refazer as perguntas" texto="Responda de novo as perguntas iniciais para reajustar o painel." aoClicar={aoRefazer} />
              <Linha icone="sair" titulo="Sair" texto="Encerra a sessão neste aparelho." aoClicar={aoSair} />
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

/** "Quer acompanhar mais coisas?": liga um módulo com um toque, sem precisar achar os ajustes. */
export function AdicionarAoPainel({ perfil, aoLigar, aoPersonalizar }: {
  perfil: Perfil; aoLigar: (m: Modulo) => void; aoPersonalizar: () => void
}) {
  const desligados = MODULOS.filter((m) => !perfil.modulos[m.id] || (m.id === 'moedas' && !perfil.moedas.length))
  return (
    <section className="adicionar">
      <div>
        <strong>{desligados.length ? 'Quer acompanhar mais coisas?' : 'Seu painel mostra tudo'}</strong>
        <p>{desligados.length ? 'Toque para adicionar ao painel. Dá para tirar depois.' : 'Mostre ou esconda partes do painel quando quiser.'}</p>
      </div>
      <div className="chips">
        {desligados.map((m) => (
          // Para outras moedas falta escolher quais: liga e abre os ajustes já na lista de moedas.
          <button key={m.id} className="chip novo" onClick={() => { aoLigar(m.id); if (m.id === 'moedas') aoPersonalizar() }}>
            <Icone nome="mais" tamanho={14} />&nbsp;{m.nome}
          </button>
        ))}
        <button className="chip" onClick={aoPersonalizar}><Icone nome="ajustes" tamanho={14} />&nbsp;Configurações</button>
      </div>
    </section>
  )
}
