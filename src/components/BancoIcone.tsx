import { corSobre, estiloDoBanco, iniciaisDoBanco, type EstiloBanco } from '../lib/estiloBanco'

/**
 * Selo de cada banco: um quadradinho na cor da marca com as letras do banco, desenhado em SVG (sem logos de verdade).
 * Reconhece o banco pelo nome do cartão ("Nubank Ultravioleta", "Itaú Platinum") ou do banco ligado a ele; banco
 * desconhecido vira um selo com as iniciais na cor escolhida.
 */
/**
 * Selo do banco. `nome` é o primeiro palpite (nome do cartão); `reserva`, o banco ligado ao cartão; `cor`, a do selo
 * genérico quando nenhum dos dois é um banco conhecido.
 */
export function BancoIcone({ nome, reserva, cor = '#6b7a99', tamanho = 28 }: { nome: string; reserva?: string; cor?: string; tamanho?: number }) {
  const e = estiloDoBanco(nome) ?? (reserva ? estiloDoBanco(reserva) : undefined) ?? ({ fundo: [cor, cor], letra: corSobre(cor), texto: iniciaisDoBanco(nome) } satisfies EstiloBanco)
  const id = `bi-${e.texto}-${e.fundo.join('').replace(/#/g, '')}`
  const fs = e.texto.length === 1 ? 13 : e.texto.length === 2 ? 10.5 : e.texto.length === 3 ? 8.6 : 7.2
  return (
    <svg className="banco-icone" width={tamanho} height={tamanho} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={e.fundo[0]} />
          <stop offset="1" stopColor={e.fundo[1]} />
        </linearGradient>
        <linearGradient id={`${id}-l`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".32" />
          <stop offset=".55" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}-c`}><rect width="24" height="24" rx="7" /></clipPath>
      </defs>
      <rect width="24" height="24" rx="7" fill={`url(#${id})`} />
      {/* faixa de outra cor no pé do selo */}
      {e.detalhe && <rect y="19" width="24" height="5" fill={e.detalhe} clipPath={`url(#${id}-c)`} />}
      <rect width="24" height="24" rx="7" fill={`url(#${id}-l)`} />
      <text x="12" y={e.detalhe ? 11.6 : 12.2} textAnchor="middle" dominantBaseline="central" fontSize={fs} fontWeight="800"
        fontFamily="Montserrat, Inter, system-ui, sans-serif" letterSpacing={e.texto.length > 2 ? '-.04em' : '-.02em'} fill={e.letra}>
        {e.texto}
      </text>
      <rect x=".5" y=".5" width="23" height="23" rx="6.5" fill="none" stroke="rgba(255,255,255,.22)" />
    </svg>
  )
}
