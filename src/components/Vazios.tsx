import { fmtValor, MESES_CURTO } from '../lib/format'
import { Icone } from './Icone'

/**
 * Ilustrações animadas das telas que ainda não têm nada (uma por tela, como as de Cartões, Contas do mês e Metas). São só
 * enfeite: ficam escondidas dos leitores de tela e acompanham o tema. Cada uma entra em cascata e depois fica respirando.
 */

/** Lançamentos: linhas de um extrato que entram uma a uma, com o "+" pulsando. */
export function CenaLancamentos() {
  const linhas = [
    { tipo: 'entrada', valor: fmtValor(3500), a: '58%', b: '36%' },
    { tipo: 'saida', valor: fmtValor(86.9), a: '46%', b: '62%' },
    { tipo: 'saida', valor: fmtValor(24), a: '64%', b: '30%' },
  ] as const
  return (
    <div className="vz-cena vz-lanc" aria-hidden="true">
      {linhas.map((l, i) => (
        <div key={i} className={`vz-linha ${l.tipo}`} style={{ '--i': i } as React.CSSProperties}>
          <span className="vz-linha-icone"><Icone nome={l.tipo === 'entrada' ? 'receber' : 'enviar'} tamanho={16} /></span>
          <span className="vz-linha-texto"><b style={{ width: l.a }} /><i style={{ width: l.b }} /></span>
          <span className="vz-linha-valor">{l.tipo === 'entrada' ? '+' : '−'} {l.valor}</span>
        </div>
      ))}
      <span className="vz-mais"><Icone nome="mais" tamanho={22} /></span>
    </div>
  )
}

/** Dívidas: parcelas com a barra de progresso enchendo e a última com o carimbo de quitada. */
export function CenaDividas({ recebe = false }: { recebe?: boolean }) {
  const itens = [{ p: 0.7, n: '8/12' }, { p: 0.4, n: '5/12' }, { p: 1, n: '12/12' }]
  return (
    <div className={`vz-cena vz-div ${recebe ? 'recebe' : ''}`} aria-hidden="true">
      {itens.map((x, i) => (
        <div key={i} className={`vz-parcela ${x.p === 1 ? 'quitada' : ''}`} style={{ '--i': i, '--p': x.p } as React.CSSProperties}>
          <span className="vz-parcela-topo"><b style={{ width: `${44 + i * 8}%` }} /><small>{x.n}</small></span>
          <span className="vz-parcela-trilho"><i /></span>
          {x.p === 1 && <span className="vz-carimbo">{recebe ? 'recebido' : 'quitada'}</span>}
        </div>
      ))}
    </div>
  )
}

/** Dinheiro guardado: moedas caindo num cofre. */
export function CenaCofre() {
  return (
    <div className="vz-cena vz-cofre" aria-hidden="true">
      <span className="vz-moeda" style={{ '--x': '-26px', '--d': '0s' } as React.CSSProperties}>$</span>
      <span className="vz-moeda" style={{ '--x': '4px', '--d': '.8s' } as React.CSSProperties}>$</span>
      <span className="vz-moeda" style={{ '--x': '30px', '--d': '1.6s' } as React.CSSProperties}>$</span>
      <span className="vz-cofre-corpo"><Icone nome="cofre" tamanho={64} /></span>
      <span className="vz-cofre-sombra" />
    </div>
  )
}

/** Resumo do ano: as barras dos 12 meses crescem uma depois da outra e a linha de tendência se desenha. */
export function CenaAno() {
  const alturas = [30, 42, 36, 58, 50, 70, 62, 82, 74, 92, 80, 100]
  // viewBox em pixels do desenho (460×150): a linha passa um pouco acima do topo de cada barra
  const pontos = alturas.map((h, i) => `${(4 + (i + 0.5) * (452 / 12)).toFixed(1)},${(150 - (h / 100) * 150 - 8).toFixed(1)}`).join(' ')
  return (
    <div className="vz-cena vz-ano" aria-hidden="true">
      <div className="vz-barras">
        {alturas.map((h, i) => (
          <span key={i} className="vz-barra" style={{ '--h': `${h}%`, '--i': i } as React.CSSProperties}><i /></span>
        ))}
        <svg className="vz-tendencia" viewBox="0 0 460 150" preserveAspectRatio="none">
          <polyline points={pontos} pathLength={1} />
        </svg>
      </div>
      <div className="vz-meses">{MESES_CURTO.map((m) => <small key={m}>{m.slice(0, 1)}</small>)}</div>
    </div>
  )
}
