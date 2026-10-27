import { useState } from 'react'
import { MOEDAS, infoMoeda } from '../lib/moedas'
import { DETALHES, MODULOS } from '../lib/perfil'
import type { Modulo, Perfil } from '../lib/types'
import { Icone } from './Icone'
import { Marca } from './Marca'
import { Opcao, Progresso } from './ui'

const PRINCIPAIS = ['BRL', 'USD', 'EUR', 'GBP', 'ARS', 'AOA']

/**
 * Perguntas do primeiro acesso. São poucas, todas podem ser puladas, e cada resposta liga ou desliga
 * uma parte do painel. Tudo pode ser mudado depois em "Personalizar painel".
 */
export function Questionario({ inicial, aoConcluir, aoCancelar }: {
  inicial: Perfil; aoConcluir: (p: Perfil) => void
  /** Quando a pessoa refaz as perguntas pelos ajustes, dá para sair sem mudar nada. */
  aoCancelar?: () => void
}) {
  const [p, setP] = useState(inicial)
  const [passo, setPasso] = useState(0)
  const nome = p.nome.trim()

  const alternarModulo = (m: Modulo) => setP({ ...p, modulos: { ...p.modulos, [m]: !p.modulos[m] } })
  const alternarMoeda = (m: string) => {
    const moedas = p.moedas.includes(m) ? p.moedas.filter((x) => x !== m) : [...p.moedas, m]
    setP({ ...p, moedas, modulos: { ...p.modulos, moedas: moedas.length > 0 } })
  }
  const escolherPrincipal = (m: string) => {
    const moedas = p.moedas.filter((x) => x !== m)
    setP({ ...p, moeda: m, moedas, modulos: { ...p.modulos, moedas: moedas.length > 0 } })
  }

  const passos = [
    {
      titulo: 'Vamos montar o seu painel',
      sub: 'São 4 perguntas rápidas para mostrar só o que faz sentido para você. Dá para mudar tudo depois.',
      corpo: (
        <label className="campo">
          <span className="campo-rotulo">Como você quer ser chamado? <small>(opcional)</small></span>
          <input autoFocus value={p.nome} onChange={(e) => setP({ ...p, nome: e.target.value })} placeholder="Seu nome ou apelido" maxLength={40} />
        </label>
      ),
    },
    {
      titulo: 'Qual moeda você usa no dia a dia?',
      sub: 'Todos os totais vão aparecer nela.',
      corpo: (
        <>
          <div className="opcoes grade">
            {PRINCIPAIS.map((m) => {
              const i = infoMoeda(m)
              return <Opcao key={m} ativo={p.moeda === m} aoClicar={() => escolherPrincipal(m)} icone={i.bandeira} titulo={i.nome} texto={m} />
            })}
          </div>
          <label className="campo">
            <span className="campo-rotulo">Outra moeda</span>
            <select value={PRINCIPAIS.includes(p.moeda) ? '' : p.moeda} onChange={(e) => e.target.value && escolherPrincipal(e.target.value)}>
              <option value="">Escolher…</option>
              {MOEDAS.filter((m) => !PRINCIPAIS.includes(m.codigo)).map((m) => (
                <option key={m.codigo} value={m.codigo}>{m.bandeira} {m.nome} ({m.codigo})</option>
              ))}
            </select>
          </label>
        </>
      ),
    },
    {
      titulo: 'Você também tem dinheiro em outra moeda?',
      sub: 'Por exemplo, dólar guardado, euro de uma viagem ou salário pago em outra moeda.',
      corpo: (
        <>
          <div className="opcoes">
            <Opcao ativo={p.moedas.length === 0} aoClicar={() => setP({ ...p, moedas: [], modulos: { ...p.modulos, moedas: false } })}
              icone={infoMoeda(p.moeda).bandeira} titulo={`Não, só ${infoMoeda(p.moeda).nome.toLowerCase()}`} />
          </div>
          <span className="campo-rotulo">Sim, uso também:</span>
          <div className="chips">
            {MOEDAS.filter((m) => m.codigo !== p.moeda).map((m) => (
              <button key={m.codigo} type="button" className={`chip ${p.moedas.includes(m.codigo) ? 'ativo' : ''}`} onClick={() => alternarMoeda(m.codigo)}>
                {m.bandeira}&nbsp;{m.nome}
              </button>
            ))}
          </div>
        </>
      ),
    },
    {
      titulo: 'O que faz parte da sua vida hoje?',
      sub: 'Marque o que for do seu jeito. Se nada disso, pode continuar: entradas e saídas já vêm sempre.',
      corpo: (
        <div className="opcoes">
          {MODULOS.filter((m) => m.id !== 'moedas').map((m) => (
            <Opcao key={m.id} multipla ativo={p.modulos[m.id]} aoClicar={() => alternarModulo(m.id)} icone={m.icone} titulo={m.pergunta} texto={m.descricao} />
          ))}
        </div>
      ),
    },
    {
      titulo: 'Quanto detalhe você quer ver?',
      sub: 'Dica: comece pelo simples. O app avisa quando valer a pena mostrar mais.',
      corpo: (
        <div className="opcoes">
          {DETALHES.map((d) => (
            <Opcao key={d.id} ativo={p.detalhe === d.id} aoClicar={() => setP({ ...p, detalhe: d.id })} titulo={d.nome} texto={d.descricao} />
          ))}
        </div>
      ),
    },
    {
      titulo: nome ? `Tudo pronto, ${nome}!` : 'Tudo pronto!',
      sub: 'Seu painel vai mostrar:',
      corpo: (
        <>
          <ul className="resumo-perfil">
            <li><Icone nome="check" tamanho={16} /> Entradas, saídas e quanto sobrou no mês, em {infoMoeda(p.moeda).nome.toLowerCase()}</li>
            {MODULOS.filter((m) => p.modulos[m.id] && (m.id !== 'moedas' || p.moedas.length)).map((m) => (
              <li key={m.id}>
                <Icone nome="check" tamanho={16} /> {m.nome}
                {m.id === 'moedas' && ` (${p.moedas.map((x) => infoMoeda(x).nome.toLowerCase()).join(', ')})`}
              </li>
            ))}
            <li><Icone nome="check" tamanho={16} /> Jeito {DETALHES.find((d) => d.id === p.detalhe)!.nome.toLowerCase()} de ver</li>
          </ul>
          <p className="questionario-nota">
            Sua vida mudou? Começou a investir, fez uma dívida, abriu outra conta? É só tocar em <b>Personalizar painel</b>.
            O app também vai sugerindo conforme você usa.
          </p>
        </>
      ),
    },
  ]

  const ultimo = passo === passos.length - 1
  const atual = passos[passo]
  const concluir = () => aoConcluir({ ...p, nome, onboarding_em: new Date().toISOString() })

  return (
    <div className="tela-central">
      <form className="cartao questionario" onSubmit={(e) => { e.preventDefault(); if (ultimo) concluir(); else setPasso(passo + 1) }}>
        <header className="questionario-topo">
          <Marca compacta />
          <Progresso valor={passo + 1} total={passos.length} cor="var(--destaque)" />
          {aoCancelar ? (
            <button type="button" className="link" onClick={aoCancelar}>Cancelar</button>
          ) : !ultimo && (
            <button type="button" className="link" onClick={() => setPasso(passos.length - 1)}>Pular</button>
          )}
        </header>
        <div className="questionario-passo" key={passo}>
          <h1>{atual.titulo}</h1>
          <p className="sub">{atual.sub}</p>
          <div className="questionario-corpo">{atual.corpo}</div>
        </div>
        <footer className="form-acoes">
          {passo > 0 && <button type="button" className="btn" onClick={() => setPasso(passo - 1)}><Icone nome="esq" tamanho={16} /> Voltar</button>}
          <span className="espaco" />
          <button type="submit" className="btn primario">{ultimo ? 'Abrir meu painel' : passo === 0 ? 'Começar' : 'Continuar'}</button>
        </footer>
      </form>
    </div>
  )
}
