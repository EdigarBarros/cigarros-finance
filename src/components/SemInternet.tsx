import { useState } from 'react'
import { useSemInternet } from '../lib/conexao'
import { Icone } from './Icone'
import { Marca } from './Marca'
import { tx } from '../lib/textos'

/**
 * No lugar do painel quando ele não consegue abrir: sem internet, ou o servidor não respondeu. Antes ficava a tela de
 * carregando para sempre, sem explicar nada. Assim que a conexão volta, o painel abre sozinho (lib/assinatura.ts tenta
 * de novo na hora); o botão é para quem não quer esperar.
 */
export function TelaSemInternet({ aoTentar }: { aoTentar: () => Promise<unknown> }) {
  const semInternet = useSemInternet()
  const [tentando, setTentando] = useState(false)
  const tentar = async () => {
    setTentando(true)
    await aoTentar()
    setTentando(false)
  }
  return (
    <main className="sem-internet">
      <div className="sem-internet-caixa" role="alert">
        <Marca />
        <span className="sem-internet-icone" aria-hidden="true"><Icone nome="semInternet" tamanho={30} /></span>
        <h1>{semInternet ? tx('Você está sem internet') : tx('Não foi possível acessar o painel')}</h1>
        <p>
          {semInternet
            ? tx('Não foi possível acessar o painel. Assim que a conexão voltar, ele abre sozinho. Seus lançamentos continuam guardados.')
            : tx('Confira sua internet. Assim que der, o painel abre sozinho. Seus lançamentos continuam guardados.')}
        </p>
        <button className="btn gradiente" onClick={() => void tentar()} disabled={tentando}>
          {tentando ? tx('Tentando…') : tx('Tentar de novo')}
        </button>
      </div>
    </main>
  )
}

/** Faixa no topo do painel quando a internet cai com ele aberto. */
export function FaixaSemInternet() {
  const semInternet = useSemInternet()
  if (!semInternet) return null
  return (
    <div className="alerta faixa-sem-internet" role="status">
      <span><Icone nome="semInternet" tamanho={18} /> <b>{tx('Você está sem internet.')}</b> {tx('Dá para ver o que já estava carregado, mas nada é salvo até a conexão voltar.')}</span>
    </div>
  )
}
