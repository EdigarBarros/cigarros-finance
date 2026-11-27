import { useState } from 'react'
import type { QualidadeDoMes } from '../cairo'
import { MESES_NOME, noMeioDaFrase } from '../lib/format'
import { tx } from '../lib/textos'
import { Icone } from './Icone'
import './pergunta-do-mes.css'

type Resposta = 'completo' | 'incompleto'

const nomeDoMes = (mes: string) => noMeioDaFrase(MESES_NOME[Number(mes.slice(5, 7)) - 1])

/**
 * "Setembro está todo lançado?": o Cairo (src/cairo/qualidade/meses.ts) não sabe se um mês recente com poucas saídas é gasto
 * que caiu de verdade ou lançamento que faltou, e a resposta muda as médias do Consultor. Mostra o mês mais recente com
 * dúvida; a resposta fica no perfil (`mes-completo:AAAA-MM`) e vale nos dois aparelhos. Dá para desfazer logo depois.
 */
export function PerguntaDoMes({ meses, aoResponder }: { meses: QualidadeDoMes[] | undefined; aoResponder: (mes: string, r: Resposta | null) => void }) {
  const [respondido, setRespondido] = useState<{ mes: string; r: Resposta } | null>(null)
  const q = [...(meses ?? [])].reverse().find((m) => m.pergunta && !m.declarado)
  if (respondido) {
    const nome = nomeDoMes(respondido.mes)
    return (
      <section className="cartao pergunta-mes respondida" aria-live="polite">
        <p>
          <Icone nome="check" tamanho={16} />{' '}
          {respondido.r === 'completo'
            ? tx('Anotado: {0} está todo lançado. Refiz as médias com ele.', nome)
            : tx('Anotado: faltou lançar em {0}. Ele fica fora das médias.', nome)}
        </p>
        <button className="btn" onClick={() => { aoResponder(respondido.mes, null); setRespondido(null) }}>
          <Icone nome="desfazer" tamanho={15} /> {tx('Desfazer')}
        </button>
      </section>
    )
  }
  if (!q || !q.pergunta) return null
  const nome = nomeDoMes(q.mes)
  const p = q.pergunta
  const titulo = p.motivo === 'renda_nao_registrada' ? tx('Entrou dinheiro em {0}?', nome)
    : q.incerto === 'nivel_novo' ? tx('Você está gastando menos?')
      : tx('{0} está todo lançado?', nome[0].toUpperCase() + nome.slice(1))
  const porque = p.motivo === 'renda_nao_registrada'
    ? tx('Em {0} não tem nenhuma entrada lançada, e você tem uma renda fixa. Deixei o mês fora das médias até você me dizer.', nome)
    : q.gastos === 'conta'
      ? (p.saidas === 1
        ? tx('Em {0} você lançou 1 saída; o seu normal é {1}. Contei como gasto que caiu de verdade. Está tudo lançado?', nome, Math.round(p.tipico))
        : tx('Em {0} você lançou {1} saídas; o seu normal é {2}. Contei como gasto que caiu de verdade. Está tudo lançado?', nome, p.saidas, Math.round(p.tipico)))
      : (p.saidas === 0
        ? tx('Em {0} não tem nenhuma saída lançada. Deixei o mês fora das médias até você me dizer.', nome)
        : p.saidas === 1
          ? tx('Em {0} você lançou 1 saída; o seu normal é {1}. Deixei o mês fora das médias até você me dizer.', nome, Math.round(p.tipico))
          : tx('Em {0} você lançou {1} saídas; o seu normal é {2}. Deixei o mês fora das médias até você me dizer.', nome, p.saidas, Math.round(p.tipico)))
  const responder = (r: Resposta) => { aoResponder(q.mes, r); setRespondido({ mes: q.mes, r }) }
  return (
    <section className="cartao pergunta-mes">
      <h3><Icone nome="calendario" tamanho={17} /> {titulo}</h3>
      <p>{porque}</p>
      <div className="pergunta-mes-acoes">
        <button className="btn primario" onClick={() => responder('completo')}>{tx('Está tudo lançado')}</button>
        <button className="btn" onClick={() => responder('incompleto')}>{tx('Faltou lançar')}</button>
      </div>
    </section>
  )
}
