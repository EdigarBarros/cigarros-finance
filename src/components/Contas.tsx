import { useState } from 'react'
import { avisar } from '../lib/avisos'
import { abrir, iniciaisDe, nomeDe } from '../lib/abrirConta'
import { adicionarConta, MAX_CONTAS, pedeSenha, useContasSalvas, type ContaSalva } from '../lib/contas'
import { tx } from '../lib/textos'
import { Icone } from './Icone'
import './contas-salvas.css'

function Avatar({ conta }: { conta: ContaSalva }) {
  return <span className="avatar" aria-hidden="true">{conta.foto ? <img src={conta.foto} alt="" /> : iniciaisDe(conta) || '?'}</span>
}

/**
 * Uma linha da lista: abrir a conta (ou entrar com a senha, se ela pede). Tirar a conta do aparelho é só pelo "Gerenciar
 * contas" da tela de perfis (components/EscolherConta.tsx).
 */
function LinhaDaConta({ conta, ocupada, aoAbrir }: { conta: ContaSalva; ocupada: boolean; aoAbrir: () => void }) {
  return (
    <div className="cs-linha">
      <button type="button" className="cs-abrir" onClick={aoAbrir} disabled={ocupada}>
        <Avatar conta={conta} />
        <span className="cs-texto">
          <b translate="no">{nomeDe(conta)}</b>
          <small translate="no">{conta.email}</small>
          {pedeSenha(conta) && <small className="cs-venceu">{tx('Entre de novo com a senha')}</small>}
        </span>
        {ocupada && <span className="en-girando" aria-label={tx('Aguarde')} />}
      </button>
    </div>
  )
}

/**
 * No menu da conta (PC e celular): as outras contas lembradas neste aparelho, para trocar com um toque, e "Adicionar outra
 * conta". A conta aberta não aparece aqui: ela já está no topo do menu.
 */
export function ContasNoMenu({ userId }: { userId: string }) {
  const contas = useContasSalvas()
  const [ocupada, setOcupada] = useState<string | null>(null)
  const outras = contas.filter((c) => c.id !== userId)
  return (
    <div className="cs-lista" onClick={(e) => { if (!(e.target as HTMLElement).closest('.cs-adicionar')) e.stopPropagation() }}>
      {outras.length > 0 && <span className="cs-titulo">{tx('Trocar de conta')}</span>}
      {outras.map((c) => (
        <LinhaDaConta key={c.id} conta={c} ocupada={ocupada === c.id}
          aoAbrir={() => { setOcupada(c.id); void abrir(c, (m) => avisar(m)).finally(() => setOcupada(null)) }} />
      ))}
      {contas.length < MAX_CONTAS && (
        <button type="button" className="cs-adicionar" onClick={() => adicionarConta()}>
          <Icone nome="mais" /> {tx('Adicionar outra conta')}
        </button>
      )}
    </div>
  )
}
