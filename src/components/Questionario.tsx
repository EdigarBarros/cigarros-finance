import { useState } from 'react'
import { MOEDAS, infoMoeda } from '../lib/moedas'
import { DETALHES, MODULOS } from '../lib/perfil'
import type { Modulo, Perfil } from '../lib/types'
import { Bandeira } from './Bandeira'
import { FotoPerfil } from './Configuracoes'
import { Icone } from './Icone'
import { Marca } from './Marca'
import { Paisagem, type Cena } from './Paisagem'
import { PreviaDetalhe } from './Previas'
import { tx } from '../lib/textos'

const CENAS: Cena[] = ['montanhas', 'mar', 'cidade', 'floresta', 'dunas', 'montanhas']
const NOMES_PASSOS = [tx('Você'), tx('Sua moeda'), tx('Outras moedas'), tx('Sua vida'), tx('Jeito de ver'), tx('Pronto')]

/**
 * Perguntas do primeiro acesso, em tela cheia: à esquerda a paisagem e os passos, à direita uma pergunta por vez com
 * escolhas visuais (bandeiras, cartões com ícone, miniaturas do painel). São poucas, todas podem ser puladas e cada
 * resposta liga ou desliga uma parte do painel. Tudo pode ser mudado depois em "Configurações".
 */
export function Questionario({ inicial, foto, aoMudarFoto, aoConcluir, aoCancelar }: {
  inicial: Perfil
  /** `importar`: a pessoa pediu para já abrir a importação de extrato ao entrar no painel. */
  aoConcluir: (p: Perfil, importar?: boolean) => void
  /** Foto de perfil (opcional), escolhida logo no primeiro passo. */
  foto?: string | null
  aoMudarFoto?: (f: string | null) => void
  /** Quando a pessoa refaz as perguntas pelos ajustes, dá para sair sem mudar nada. */
  aoCancelar?: () => void
}) {
  const [p, setP] = useState(inicial)
  const [passo, setPasso] = useState(0)
  const [voltando, setVoltando] = useState(false)
  const nome = p.nome.trim()
  const iniciais = nome.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]?.toUpperCase()).join('')

  const alternarModulo = (m: Modulo) => setP({ ...p, modulos: { ...p.modulos, [m]: !p.modulos[m] } })
  const alternarMoeda = (m: string) => {
    const moedas = p.moedas.includes(m) ? p.moedas.filter((x) => x !== m) : [...p.moedas, m]
    setP({ ...p, moedas, modulos: { ...p.modulos, moedas: moedas.length > 0 } })
  }
  const escolherPrincipal = (m: string) => {
    const moedas = p.moedas.filter((x) => x !== m)
    setP({ ...p, moeda: m, moedas, modulos: { ...p.modulos, moedas: moedas.length > 0 } })
  }
  const ligados = MODULOS.filter((m) => p.modulos[m.id] && (m.id !== 'moedas' || p.moedas.length))

  const passos = [
    {
      titulo: tx('Vamos montar o seu painel'),
      sub: tx('São poucas perguntas para mostrar só o que faz sentido para você. Dá para mudar tudo depois.'),
      corpo: (
        <div className="qz-voce">
          <div className="qz-foto">
            <FotoPerfil foto={foto ?? null} iniciais={iniciais} aoMudar={aoMudarFoto} />
            <small>{tx('Foto de perfil')} <span>(opcional)</span></small>
          </div>
          <label className="campo">
            <span className="campo-rotulo">{tx('Como você quer ser chamado?')} <small>(opcional)</small></span>
            <input className="qz-input-grande" autoFocus value={p.nome} onChange={(e) => setP({ ...p, nome: e.target.value })} placeholder={tx('Seu nome ou apelido')} maxLength={40} />
          </label>
        </div>
      ),
    },
    {
      titulo: tx('Qual moeda você usa no dia a dia?'),
      sub: tx('Todos os totais vão aparecer nela.'),
      corpo: (
        <div className="cfg-moedas qz-moedas" role="radiogroup" aria-label={tx('Moeda principal')}>
          {MOEDAS.map((m, i) => (
            <button key={m.codigo} type="button" role="radio" aria-checked={p.moeda === m.codigo} style={{ animationDelay: `${i * 18}ms` }}
              className={`cfg-moeda ${p.moeda === m.codigo ? 'ativo' : ''}`} onClick={() => escolherPrincipal(m.codigo)}>
              <Bandeira moeda={m.codigo} tamanho={34} />
              <span><strong>{m.codigo}</strong><small>{m.nome}</small></span>
              <i className="cfg-marca"><Icone nome="check" tamanho={12} /></i>
            </button>
          ))}
        </div>
      ),
    },
    {
      titulo: tx('Você também tem dinheiro em outra moeda?'),
      sub: tx('Dólar guardado, euro de uma viagem, salário em outra moeda… Toque em quantas quiser.'),
      corpo: (
        <>
          <button type="button" className={`qz-nao ${p.moedas.length === 0 ? 'ativo' : ''}`}
            onClick={() => setP({ ...p, moedas: [], modulos: { ...p.modulos, moedas: false } })}>
            <Bandeira moeda={p.moeda} tamanho={30} />
            <span><strong>{tx('Não, só {0}', infoMoeda(p.moeda).nome.toLowerCase())}</strong><small>{tx('pode ligar depois')}</small></span>
            <i className="cfg-marca"><Icone nome="check" tamanho={12} /></i>
          </button>
          <div className="cfg-moedas qz-moedas" role="group" aria-label={tx('Outras moedas')}>
            {MOEDAS.filter((m) => m.codigo !== p.moeda).map((m, i) => (
              <button key={m.codigo} type="button" role="checkbox" aria-checked={p.moedas.includes(m.codigo)} style={{ animationDelay: `${i * 18}ms` }}
                className={`cfg-moeda multipla ${p.moedas.includes(m.codigo) ? 'ativo' : ''}`} onClick={() => alternarMoeda(m.codigo)}>
                <Bandeira moeda={m.codigo} tamanho={34} />
                <span><strong>{m.codigo}</strong><small>{m.nome}</small></span>
                <i className="cfg-marca"><Icone nome="check" tamanho={12} /></i>
              </button>
            ))}
          </div>
        </>
      ),
    },
    {
      titulo: tx('O que faz parte da sua vida hoje?'),
      sub: tx('Toque no que for do seu jeito. Entradas e saídas já vêm sempre.'),
      corpo: (
        <div className="qz-modulos">
          {MODULOS.filter((m) => m.id !== 'moedas').map((m, i) => (
            <button key={m.id} type="button" role="checkbox" aria-checked={p.modulos[m.id]} style={{ animationDelay: `${i * 40}ms` }}
              className={`qz-modulo ${p.modulos[m.id] ? 'ativo' : ''}`} onClick={() => alternarModulo(m.id)}>
              <span className="qz-modulo-icone"><Icone nome={m.icone} tamanho={22} /></span>
              <strong>{m.pergunta}</strong>
              <small>{m.descricao}</small>
              <i className="cfg-marca"><Icone nome="check" tamanho={12} /></i>
            </button>
          ))}
        </div>
      ),
    },
    {
      titulo: tx('Quanto detalhe você quer ver?'),
      sub: tx('Dica: comece pelo simples. O app avisa quando valer a pena mostrar mais.'),
      corpo: (
        <div className="cfg-escolhas tres" role="radiogroup" aria-label={tx('Jeito de ver')}>
          {DETALHES.map((d) => (
            <button key={d.id} type="button" role="radio" aria-checked={p.detalhe === d.id}
              className={`cfg-escolha ${p.detalhe === d.id ? 'ativo' : ''}`} onClick={() => setP({ ...p, detalhe: d.id })}>
              <PreviaDetalhe nivel={d.id} />
              <span className="cfg-escolha-texto"><strong>{d.nome}</strong><small>{d.descricao}</small></span>
              <i className="cfg-marca"><Icone nome="check" tamanho={12} /></i>
            </button>
          ))}
        </div>
      ),
    },
    {
      titulo: nome ? tx('Tudo pronto, {0}!', nome) : tx('Tudo pronto!'),
      sub: tx('Seu painel vai mostrar:'),
      corpo: (
        <>
          <span className="qz-pronto" aria-hidden="true"><Icone nome="check" tamanho={40} /></span>
          <div className="qz-resumo">
            <span className="qz-resumo-item" style={{ animationDelay: '0ms' }}>
              <Bandeira moeda={p.moeda} tamanho={22} /> {tx('Entradas e saídas em {0}', infoMoeda(p.moeda).nome.toLowerCase())}
            </span>
            {ligados.map((m, i) => (
              <span key={m.id} className="qz-resumo-item" style={{ animationDelay: `${(i + 1) * 70}ms` }}>
                <Icone nome={m.icone} tamanho={18} /> {m.nome}
                {m.id === 'moedas' && ` (${p.moedas.join(', ')})`}
              </span>
            ))}
            <span className="qz-resumo-item" style={{ animationDelay: `${(ligados.length + 1) * 70}ms` }}>
              <Icone nome="ajustes" tamanho={18} /> {tx('Jeito {0}', DETALHES.find((d) => d.id === p.detalhe)!.nome.toLowerCase())}
            </span>
          </div>
          <p className="questionario-nota">
            {tx('Sua vida mudou? Começou a investir, fez uma dívida, abriu outra conta? É só ir em')} <b>{tx('Configurações')}</b>{tx('. O app também vai sugerindo conforme você usa.')}
          </p>
        </>
      ),
    },
  ]

  const ultimo = passo === passos.length - 1
  const atual = passos[passo]
  const concluir = (importar = false) => aoConcluir({ ...p, nome, onboarding_em: new Date().toISOString() }, importar)
  const ir = (n: number) => { setVoltando(n < passo); setPasso(n) }

  return (
    <div className="qz">
      <aside className="qz-lado">
        <Marca />
        <div className="qz-cena" key={`cena-${passo}`}><Paisagem cena={CENAS[passo]} /></div>
        <ol className="qz-passos">
          {NOMES_PASSOS.map((n, i) => (
            <li key={n} className={i === passo ? 'atual' : i < passo ? 'feito' : ''}>
              <button type="button" onClick={() => i < passo && ir(i)} disabled={i > passo}>
                <span className="qz-passo-n">{i < passo ? <Icone nome="check" tamanho={13} /> : i + 1}</span>{n}
              </button>
            </li>
          ))}
        </ol>
        <p className="qz-lado-nota"><Icone nome="ideia" tamanho={15} /> {tx('Tudo pode ser mudado depois em Configurações.')}</p>
      </aside>

      <main className="qz-principal">
        <header className="qz-topo">
          <span className="qz-marca-cel"><Marca compacta /></span>
          <span className="qz-barra" aria-hidden="true"><i style={{ width: `${((passo + 1) / passos.length) * 100}%` }} /></span>
          {aoCancelar
            ? <button type="button" className="link" onClick={aoCancelar}>{tx('Cancelar')}</button>
            : !ultimo && <button type="button" className="link" onClick={() => ir(passos.length - 1)}>{tx('Pular')}</button>}
        </header>
        <form className="qz-form" onSubmit={(e) => { e.preventDefault(); if (ultimo) concluir(); else ir(passo + 1) }}>
          <div className={`qz-passo ${voltando ? 'volta' : ''}`} key={passo}>
            <span className="qz-etapa">{tx('Passo {0} de {1}', passo + 1, passos.length)}</span>
            <h1>{atual.titulo}</h1>
            <p className="sub">{atual.sub}</p>
            <div className="qz-corpo">{atual.corpo}</div>
          </div>
          <footer className="qz-acoes">
            {passo > 0 && <button type="button" className="btn" onClick={() => ir(passo - 1)}><Icone nome="esq" tamanho={16} /> {tx('Voltar')}</button>}
            <span className="espaco" />
            {ultimo && <button type="button" className="btn qz-importar" onClick={() => concluir(true)}><Icone nome="relatorio" tamanho={16} /> {tx('Abrir e importar meu extrato')}</button>}
            <button type="submit" className="btn primario qz-continuar">
              {ultimo ? tx('Abrir meu painel') : passo === 0 ? tx('Começar') : tx('Continuar')} <Icone nome="seta" tamanho={16} />
            </button>
          </footer>
        </form>
      </main>
    </div>
  )
}
