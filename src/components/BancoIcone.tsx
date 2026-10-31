import { corSobre, estiloDoBanco, iniciaisDoBanco, type EstiloBanco } from '../lib/estiloBanco'
import { logoDoBanco } from '../lib/logosBancos'

/**
 * Selo de cada banco: um quadradinho na cor da marca com o símbolo do banco (ou as letras, quando o app ainda não tem
 * o símbolo dele). Reconhece o banco pelo nome do cartão ("Nubank Ultravioleta", "Itaú Platinum") ou do banco ligado
 * a ele; banco desconhecido vira um selo com as iniciais na cor escolhida.
 */
/**
 * Selo do banco. `nome` é o primeiro palpite (nome do cartão); `reserva`, o banco ligado ao cartão; `cor`, a do selo
 * genérico quando nenhum dos dois é um banco conhecido.
 */
export function BancoIcone({ nome, reserva, cor = '#6b7a99', tamanho = 28 }: { nome: string; reserva?: string; cor?: string; tamanho?: number }) {
  const e = estiloDoBanco(nome) ?? (reserva ? estiloDoBanco(reserva) : undefined) ?? ({ fundo: [cor, cor], letra: corSobre(cor), texto: iniciaisDoBanco(nome) } satisfies EstiloBanco)
  const logo = e.chave ? logoDoBanco(e.chave) : undefined
  const fundo = logo?.fundo ?? e.fundo
  const id = `bi-${(e.chave ?? e.texto).replace(/[^a-z0-9]/gi, '')}-${fundo.join('').replace(/#/g, '')}`
  const fs = e.texto.length === 1 ? 13 : e.texto.length === 2 ? 10.5 : e.texto.length === 3 ? 8.6 : 7.2
  const m = logo?.margem ?? 4.5
  return (
    <svg className="banco-icone" width={tamanho} height={tamanho} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={fundo[0]} />
          <stop offset="1" stopColor={fundo[1]} />
        </linearGradient>
        <linearGradient id={`${id}-l`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".32" />
          <stop offset=".55" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}-c`}><rect width="24" height="24" rx="7" /></clipPath>
      </defs>
      {logo?.modo === 'icone' ? (
        // o arquivo já é o ícone do app: preenche o selo inteiro
        <g clipPath={`url(#${id}-c)`}>
          <svg width="24" height="24" viewBox={logo.viewBox} preserveAspectRatio="xMidYMid slice" dangerouslySetInnerHTML={{ __html: logo.corpo }} />
        </g>
      ) : (
        <>
          <rect width="24" height="24" rx="7" fill={`url(#${id})`} />
          {/* faixa de outra cor no pé do selo */}
          {!logo && e.detalhe && <rect y="19" width="24" height="5" fill={e.detalhe} clipPath={`url(#${id}-c)`} />}
          <rect width="24" height="24" rx="7" fill={`url(#${id}-l)`} />
          {logo ? (
            <svg className={logo.modo === 'branco' ? 'bi-branco' : undefined} x={m} y={m} width={24 - 2 * m} height={24 - 2 * m}
              viewBox={logo.viewBox} dangerouslySetInnerHTML={{ __html: logo.corpo }} />
          ) : (
            <text x="12" y={e.detalhe ? 11.6 : 12.2} textAnchor="middle" dominantBaseline="central" fontSize={fs} fontWeight="800"
              fontFamily="Montserrat, Inter, system-ui, sans-serif" letterSpacing={e.texto.length > 2 ? '-.04em' : '-.02em'} fill={e.letra}>
              {e.texto}
            </text>
          )}
        </>
      )}
      <rect x=".5" y=".5" width="23" height="23" rx="6.5" fill="none" stroke="rgba(255,255,255,.22)" />
    </svg>
  )
}
