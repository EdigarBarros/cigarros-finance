import { useState } from 'react'
import { avisar } from '../lib/avisos'
import { adicionarConta, esquecerConta, MAX_CONTAS, trocarPara, useContasSalvas, type ContaSalva } from '../lib/contas'
import { tx } from '../lib/textos'
import { Icone } from './Icone'
import { Marca } from './Marca'
import './contas-salvas.css'

const nomeDe = (c: ContaSalva) => c.nome?.trim() || c.email.split('@')[0]
const iniciaisDe = (c: ContaSalva) => nomeDe(c).split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase() ?? '').join('')

function Avatar({ conta }: { conta: ContaSalva }) {
  return <span className="avatar" aria-hidden="true">{conta.foto ? <img src={conta.foto} alt="" /> : iniciaisDe(conta) || '?'}</span>
}

/** Uma linha da lista: abrir a conta (ou entrar de novo, se a sessão venceu) e o "x" para tirá-la deste aparelho. */
function LinhaDaConta({ conta, ocupada, aoAbrir, aoTirar }: {
  conta: ContaSalva; ocupada: boolean; aoAbrir: () => void; aoTirar: () => void
}) {
  return (
    <div className="cs-linha">
      <button type="button" className="cs-abrir" onClick={aoAbrir} disabled={ocupada}>
        <Avatar conta={conta} />
        <span className="cs-texto">
          <b translate="no">{nomeDe(conta)}</b>
          <small translate="no">{conta.email}</small>
          {conta.precisaEntrar && <small className="cs-venceu">{tx('Entre de novo com a senha')}</small>}
        </span>
        {ocupada && <span className="en-girando" aria-label={tx('Aguarde')} />}
      </button>
      <button type="button" className="cs-tirar" aria-label={tx('Tirar {0} deste aparelho', conta.email)} title={tx('Tirar deste aparelho')}
        onClick={(e) => { e.stopPropagation(); aoTirar() }}>
        <Icone nome="fechar" tamanho={16} />
      </button>
    </div>
  )
}

/** Abre a conta; se a sessão dela venceu, leva ao login com o e-mail já preenchido. */
async function abrir(c: ContaSalva, aoErro: (m: string) => void) {
  if (c.precisaEntrar) { adicionarConta(c.email); return }
  const r = await trocarPara(c.id)
  if (r === 'precisa-entrar') adicionarConta(c.email)
  else if (r === 'sem-internet') aoErro(tx('Sem internet. Confira sua conexão e tente de novo.'))
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
          aoAbrir={() => { setOcupada(c.id); void abrir(c, (m) => avisar(m)).finally(() => setOcupada(null)) }}
          aoTirar={() => void esquecerConta(c.id)} />
      ))}
      {contas.length < MAX_CONTAS && (
        <button type="button" className="cs-adicionar" onClick={() => adicionarConta()}>
          <Icone nome="mais" /> {tx('Adicionar outra conta')}
        </button>
      )}
    </div>
  )
}

/** Sem conta aberta, mas com contas lembradas: escolher com qual entrar (como no Google), ou entrar com outra. */
export function EscolherConta({ aoOutra }: { aoOutra: () => void }) {
  const contas = useContasSalvas()
  const [ocupada, setOcupada] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  return (
    <div className="tela-central escolher-conta">
      <div className="cartao login">
        <div className="login-marca"><Marca grande /></div>
        <h1>{tx('Escolha uma conta')}</h1>
        <p className="escolher-sub">{tx('Contas que já entraram neste aparelho.')}</p>
        <div className="cs-lista">
          {contas.map((c) => (
            <LinhaDaConta key={c.id} conta={c} ocupada={ocupada === c.id}
              aoAbrir={() => { setErro(null); setOcupada(c.id); void abrir(c, setErro).finally(() => setOcupada(null)) }}
              aoTirar={() => void esquecerConta(c.id)} />
          ))}
          <button type="button" className="cs-adicionar" onClick={aoOutra}>
            <Icone nome="pessoa" /> {tx('Usar outra conta')}
          </button>
        </div>
        {erro && <p className="en-aviso" role="alert">{erro}</p>}
      </div>
    </div>
  )
}
