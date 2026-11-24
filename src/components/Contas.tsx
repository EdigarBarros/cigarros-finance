import { iniciaisDe, nomeDe } from '../lib/abrirConta'
import { adicionarConta, MAX_CONTAS, useContasSalvas, type ContaSalva } from '../lib/contas'
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
function LinhaDaConta({ conta, aoAbrir }: { conta: ContaSalva; aoAbrir: () => void }) {
  return (
    <div className="cs-linha">
      <button type="button" className="cs-abrir" onClick={aoAbrir}>
        <Avatar conta={conta} />
        <span className="cs-texto">
          <b translate="no">{nomeDe(conta)}</b>
          <small translate="no">{conta.email}</small>
          <small className="cs-venceu">{tx('Entre de novo com a senha')}</small>
        </span>
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
  const outras = contas.filter((c) => c.id !== userId)
  return (
    <div className="cs-lista" onClick={(e) => { if (!(e.target as HTMLElement).closest('.cs-adicionar')) e.stopPropagation() }}>
      {outras.length > 0 && <span className="cs-titulo">{tx('Trocar de conta')}</span>}
      {outras.map((c) => (
        <LinhaDaConta key={c.id} conta={c} aoAbrir={() => adicionarConta(c.email)} />
      ))}
      {contas.length < MAX_CONTAS && (
        <button type="button" className="cs-adicionar" onClick={() => adicionarConta()}>
          <Icone nome="mais" /> {tx('Adicionar outra conta')}
        </button>
      )}
    </div>
  )
}
