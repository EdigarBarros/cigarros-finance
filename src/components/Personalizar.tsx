import { useState } from 'react'
import type { Sugestao } from '../lib/adaptacao'
import { MOEDAS } from '../lib/moedas'
import { DETALHES, MODULOS } from '../lib/perfil'
import type { Modulo, Perfil } from '../lib/types'
import { Icone } from './Icone'
import { Interruptor, Modal, Opcao } from './ui'

/** Ajustes do painel. Cada mudança vale na hora, sem botão de salvar. */
export function Personalizar({ perfil, aoMudar, aoRefazer, aoCategorias, aoZerar, aoFechar }: {
  perfil: Perfil; aoMudar: (p: Perfil) => void; aoRefazer: () => void; aoCategorias: () => void
  /** Abre a confirmação de zerar os dados. */
  aoZerar: () => void
  aoFechar: () => void
}) {
  const [nome, setNome] = useState(perfil.nome)
  const ligar = (m: Modulo, v: boolean) => aoMudar({ ...perfil, modulos: { ...perfil.modulos, [m]: v } })
  const alternarMoeda = (m: string) => {
    const moedas = perfil.moedas.includes(m) ? perfil.moedas.filter((x) => x !== m) : [...perfil.moedas, m]
    aoMudar({ ...perfil, moedas, modulos: { ...perfil.modulos, moedas: moedas.length > 0 } })
  }

  return (
    <Modal titulo="Personalizar painel" aoFechar={aoFechar}>
      <div className="form personalizar">
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
                {m.id === 'moedas' && perfil.modulos.moedas && (
                  <div className="ajuste-extra">
                    <span className="campo-ajuda">{perfil.moedas.length ? 'Moedas que você usa:' : 'Escolha quais moedas você usa:'}</span>
                    <div className="chips">
                      {MOEDAS.filter((x) => x.codigo !== perfil.moeda).map((x) => (
                        <button key={x.codigo} type="button" className={`chip ${perfil.moedas.includes(x.codigo) ? 'ativo' : ''}`} onClick={() => alternarMoeda(x.codigo)}>
                          {x.bandeira}&nbsp;{x.nome}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
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

        <section className="campo">
          <span className="campo-rotulo">Categorias</span>
          <button type="button" className="ajuste ajuste-botao" onClick={aoCategorias}>
            <span className="ajuste-icone"><Icone nome="lista" /></span>
            <span className="ajuste-texto"><strong>Editar categorias</strong><small>Crie as suas, renomeie, troque emoji e cor.</small></span>
            <Icone nome="dir" tamanho={16} />
          </button>
        </section>

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

        <label className="campo">
          <span className="campo-rotulo">Como quer ser chamado</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} onBlur={() => nome.trim() !== perfil.nome && aoMudar({ ...perfil, nome: nome.trim() })}
            placeholder="Seu nome ou apelido" maxLength={40} />
        </label>

        <section className="campo zona-cuidado">
          <span className="campo-rotulo">Começar de novo</span>
          <button type="button" className="ajuste ajuste-botao" onClick={aoZerar}>
            <span className="ajuste-icone"><Icone nome="lixeira" /></span>
            <span className="ajuste-texto"><strong>Zerar meus dados</strong><small>Apaga os lançamentos e deixa o painel em branco. Pede confirmação antes.</small></span>
            <Icone nome="dir" tamanho={16} />
          </button>
        </section>

        <div className="form-acoes">
          <button type="button" className="btn" onClick={aoRefazer}>Refazer as perguntas</button>
          <span className="espaco" />
          <button type="button" className="btn primario" onClick={() => { if (nome.trim() !== perfil.nome) aoMudar({ ...perfil, nome: nome.trim() }); aoFechar() }}>Pronto</button>
        </div>
      </div>
    </Modal>
  )
}

/**
 * Confirmação de zerar os dados. É a única ação que não tem volta, então pede três coisas: entender o que
 * será apagado, ter a chance de baixar o backup e digitar ZERAR.
 */
export function ZerarDados({ aoBaixarBackup, aoZerar, aoFechar }: {
  aoBaixarBackup: () => Promise<unknown>; aoZerar: (tudo: boolean) => Promise<void>; aoFechar: () => void
}) {
  const [tudo, setTudo] = useState(false)
  const [texto, setTexto] = useState('')
  const [baixou, setBaixou] = useState(false)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const pode = texto.trim().toUpperCase() === 'ZERAR' && !ocupado

  const baixar = async () => {
    setOcupado('Gerando backup…')
    try { await aoBaixarBackup(); setBaixou(true) } catch (e) { setErro(e instanceof Error ? e.message : String(e)) }
    setOcupado(null)
  }
  const zerar = async () => {
    setOcupado('Apagando…')
    setErro(null)
    try { await aoZerar(tudo) } catch (e) {
      setErro(`Não deu para apagar tudo: ${e instanceof Error ? e.message : String(e)}. Tente de novo.`)
      setOcupado(null)
    }
  }

  return (
    <Modal titulo="Zerar meus dados" aoFechar={() => !ocupado && aoFechar()}>
      <div className="form">
        <p className="zerar-texto">
          Isto apaga <b>todos os lançamentos</b>, dívidas, contas do mês, cartões, metas e os saldos guardados de cada mês.
          O painel volta a ficar em branco. <b>Não tem como desfazer.</b>
        </p>
        <div className="opcoes">
          <Opcao ativo={!tudo} aoClicar={() => setTudo(false)} titulo="Manter minhas configurações"
            texto="Categorias, bancos e o jeito do painel continuam como estão." />
          <Opcao ativo={tudo} aoClicar={() => setTudo(true)} titulo="Apagar tudo, como uma conta nova"
            texto="Categorias voltam às padrão, os bancos somem e as perguntas iniciais aparecem de novo." />
        </div>
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
          <button type="button" className="btn perigo-forte" disabled={!pode} onClick={zerar}>{ocupado ?? 'Zerar meus dados'}</button>
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
        <button className="chip" onClick={aoPersonalizar}><Icone nome="ajustes" tamanho={14} />&nbsp;Personalizar painel</button>
      </div>
    </section>
  )
}
