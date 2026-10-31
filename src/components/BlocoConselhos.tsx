import { useState } from 'react'
import type { Conselho, Gravidade } from '../lib/conselheiro'
import { Bloco } from './Blocos'
import { Icone } from './Icone'
import { tx } from '../lib/textos'
import './conselhos.css'

/** Quantos aparecem de início no jeito simples (os outros ficam atrás de "Ver mais"). */
const LIMITE_SIMPLES = 2

const SELO: Record<Gravidade, () => string> = {
  urgente: () => tx('Importante'),
  atencao: () => tx('Fique de olho'),
  elogio: () => tx('Parabéns'),
}

/**
 * "Saúde do seu dinheiro": todos os conselhos ativos do conselheiro (lib/conselheiro.ts), cada um com a explicação, um
 * botão para a tela certa e o "Agora não". Os urgentes vêm primeiro (o motor já ordena). Sem conselhos, diz se está tudo
 * em ordem ou se faltam dados. No jeito simples mostra só os 2 primeiros. Veja docs/arquitetura-do-painel.md, seção 4.0.
 */
export function BlocoConselhos({ conselhos, semDados, dispensados, simples, aoIr, aoDispensar }: {
  conselhos: Conselho[]
  /** Poucos meses com entradas e saídas: o conselheiro não tem base para opinar. */
  semDados: boolean
  /** Quantos avisos a pessoa escondeu até o mês que vem. */
  dispensados: number
  simples: boolean
  aoIr: (destino: Conselho['destino']) => void
  aoDispensar: (id: string) => void
}) {
  const [todos, setTodos] = useState(false)
  const recortar = simples && !todos && conselhos.length > LIMITE_SIMPLES
  const visiveis = recortar ? conselhos.slice(0, LIMITE_SIMPLES) : conselhos
  const urgentes = conselhos.filter((c) => c.gravidade === 'urgente').length

  return (
    <Bloco titulo={tx('Saúde do seu dinheiro')} className="conselhos"
      acao={urgentes > 0 && (
        <span className="conselhos-conta">{urgentes === 1 ? tx('1 importante') : tx('{0} importantes', urgentes)}</span>
      )}>
      {conselhos.length > 0 ? (
        <>
          <ul className="conselhos-lista">
            {visiveis.map((c) => (
              <li key={c.id} className={`conselho ${c.gravidade}`}>
                <span className="conselho-icone" aria-hidden="true"><Icone nome={c.icone} tamanho={20} /></span>
                <div className="conselho-texto">
                  <span className="conselho-selo">{SELO[c.gravidade]()}</span>
                  <strong>{c.titulo}</strong>
                  <p>{c.porque}</p>
                </div>
                <div className="conselho-acoes">
                  <button className="btn" onClick={() => aoIr(c.destino)}>{c.botao} <Icone nome="seta" tamanho={15} /></button>
                  <button className="conselho-agora-nao" onClick={() => aoDispensar(c.id)}
                    title={tx('Esconde este aviso até o mês que vem')} aria-label={tx('Agora não: esconde este aviso até o mês que vem')}>
                    {tx('Agora não')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {simples && conselhos.length > LIMITE_SIMPLES && (
            <button className="quadro-ver" onClick={() => setTodos(!todos)}>
              {todos ? tx('Mostrar menos') : tx('Ver todos')}
            </button>
          )}
        </>
      ) : semDados ? (
        <p className="conselhos-vazio">
          <Icone nome="relatorio" tamanho={18} />
          <span>{tx('Lance entradas e saídas de pelo menos 2 meses que já terminaram para receber conselhos sobre o seu dinheiro.')}</span>
        </p>
      ) : (
        <p className="conselhos-vazio ok">
          <Icone nome="check" tamanho={18} />
          <span>
            <b>{tx('Tudo em ordem por aqui.')}</b>
            {dispensados > 0 && <> {tx('Os avisos que você escondeu voltam no mês que vem, se ainda forem verdade.')}</>}
          </span>
        </p>
      )}
      <p className="conselhos-rodape">
        {tx('São orientações gerais, calculadas com o que você lançou. Não são recomendação de investimento.')}
      </p>
    </Bloco>
  )
}
