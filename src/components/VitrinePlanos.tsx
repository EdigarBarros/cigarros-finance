import { useEffect, useState, type CSSProperties } from 'react'
import { Bandeira } from './Bandeira'
import { Icone } from './Icone'
import { IconeCategoria } from './IconeCategoria'

/**
 * Vitrine da tela de planos: uma janela parada onde pedaços do painel (lançamentos, cartões, contas, metas, moedas, ano) vão
 * passando sozinhos, cada um com uma animaçãozinha, para a pessoa ver o que vai ter dentro. Os dados são de exemplo.
 * Passa a cada 5 s; some o avanço automático com o mouse em cima (ou o foco) e dá para trocar pelos pontinhos.
 */
const DURACAO = 5000

const LANCAMENTOS = [
  { emoji: '🛒', nome: 'Mercado', cat: 'Alimentação', valor: '− R$ 238,40', cor: '#ff9f0a', entrada: false },
  { emoji: '💼', nome: 'Salário', cat: 'Entrada', valor: '+ R$ 5.200,00', cor: '#30d158', entrada: true },
  { emoji: '🚗', nome: 'Uber', cat: 'Transporte', valor: '− R$ 32,90', cor: '#0a84ff', entrada: false },
  { emoji: '🎬', nome: 'Cinema', cat: 'Lazer', valor: '− R$ 64,00', cor: '#bf5af2', entrada: false },
]
const CONTAS = [
  { dia: 5, nome: 'Aluguel', valor: 'R$ 1.800,00' },
  { dia: 10, nome: 'Internet', valor: 'R$ 119,90' },
  { dia: 15, nome: 'Conta de luz', valor: 'R$ 182,40' },
]
const METAS = [
  { nome: 'Viagem', pct: 72, cor: 'var(--caixa)' },
  { nome: 'Reserva', pct: 48, cor: 'var(--entrada)' },
  { nome: 'Notebook', pct: 90, cor: 'var(--violeta)' },
]
const MOEDAS = [
  { moeda: 'USD', nome: 'Dólar', valor: 'R$ 5,42' },
  { moeda: 'EUR', nome: 'Euro', valor: 'R$ 5,88' },
  { moeda: 'GBP', nome: 'Libra', valor: 'R$ 6,95' },
]
const ENTRADAS = [0.62, 0.66, 0.6, 0.7, 0.68, 0.74, 0.72, 0.78, 0.8, 0.86, 0.82, 0.9]
const SAIDAS = [0.55, 0.6, 0.64, 0.58, 0.66, 0.62, 0.7, 0.66, 0.72, 0.76, 0.7, 0.74]
const MESES = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
const ARO = 2 * Math.PI * 42

const i = (n: number) => ({ '--i': n }) as CSSProperties

const TELAS = [
  {
    chave: 'lancamentos', aba: 'Lançamentos', titulo: 'Lançamentos e categorias',
    texto: 'Anote cada entrada e saída em segundos e veja para onde vai o seu dinheiro.',
    corpo: (
      <ul className="pv-lista compacta">
        {LANCAMENTOS.map((l, n) => (
          <li key={l.nome} style={i(n)}>
            <span className="pv-cat" style={{ '--c': l.cor } as CSSProperties}><IconeCategoria emoji={l.emoji} tamanho={19} /></span>
            <span className="pv-nome"><strong>{l.nome}</strong><small>{l.cat}</small></span>
            <b className={l.entrada ? 'pv-entrada' : 'pv-saida'}>{l.valor}</b>
          </li>
        ))}
      </ul>
    ),
  },
  {
    chave: 'cartoes', aba: 'Cartões', titulo: 'Cartões e faturas',
    texto: 'Fatura, parcelas e limite de cada cartão, com o vencimento no dia certo.',
    corpo: (
      <div className="pv-cartoes">
        <div className="pv-cartao">
          <span className="pv-cartao-nome"><b>nu</b> Nubank</span>
          <i className="pv-chip" />
          <small>fatura de outubro</small>
          <strong>R$ 780,00</strong>
          <span className="pv-cartao-rodape">vence dia 10 <b>CRÉDITO</b></span>
          <i className="pv-brilho" />
        </div>
        <div className="pv-limite">
          <span>Limite usado</span><span>livre R$ 4.520,00</span>
        </div>
        <div className="pv-trilha"><i /></div>
      </div>
    ),
  },
  {
    chave: 'contas', aba: 'Contas', titulo: 'Dívidas e contas do mês',
    texto: 'Aluguel, luz, internet e dívidas num lugar só. Toque em “Paguei” e pronto.',
    corpo: (
      <div className="pv-contas">
        <ul className="pv-lista compacta">
          {CONTAS.map((c, n) => (
            <li key={c.nome} style={i(n)}>
              <span className="pv-dia">{c.dia}<small>OUT</small></span>
              <span className="pv-nome"><strong>{c.nome}</strong></span>
              <b>{c.valor}</b>
              <i className="pv-check"><Icone nome="check" tamanho={14} /></i>
            </li>
          ))}
        </ul>
        <div className="pv-divida">
          <span><Icone nome="divida" tamanho={16} /> Financiamento</span>
          <small>8 de 24 parcelas pagas</small>
          <div className="pv-trilha"><i /></div>
        </div>
      </div>
    ),
  },
  {
    chave: 'metas', aba: 'Metas', titulo: 'Metas que enchem',
    texto: 'Crie cofrinhos para cada sonho e acompanhe quanto já guardou.',
    corpo: (
      <div className="pv-metas">
        {METAS.map((m, n) => (
          <div key={m.nome} className="pv-meta" style={{ ...i(n), '--c': m.cor } as CSSProperties}>
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <circle cx="50" cy="50" r="42" className="fundo" />
              <circle cx="50" cy="50" r="42" className="cheio" style={{ '--alvo': ARO * (1 - m.pct / 100) } as CSSProperties} strokeDasharray={ARO} />
            </svg>
            <b>{m.pct}%</b>
            <strong>{m.nome}</strong>
          </div>
        ))}
      </div>
    ),
  },
  {
    chave: 'moedas', aba: 'Moedas', titulo: 'Qualquer moeda, com a cotação do dia',
    texto: 'Lance em dólar, euro ou a moeda que quiser. O app converte pela cotação do dia.',
    corpo: (
      <div className="pv-moedas">
        <ul className="pv-lista compacta">
          {MOEDAS.map((m, n) => (
            <li key={m.moeda} style={i(n)}>
              <Bandeira moeda={m.moeda} tamanho={30} />
              <span className="pv-nome"><strong>{m.nome}</strong><small>cotação do dia</small></span>
              <b>{m.valor}</b>
            </li>
          ))}
        </ul>
        <div className="pv-conversao" style={i(3)}>
          <span>US$ 120,00</span><Icone nome="seta" tamanho={15} /><strong>R$ 650,40</strong>
        </div>
      </div>
    ),
  },
  {
    chave: 'ano', aba: 'Ano', titulo: 'O ano inteiro num gráfico',
    texto: 'Veja mês a mês quanto entrou, quanto saiu e como você está evoluindo.',
    corpo: (
      <div className="pv-ano">
        <div className="pv-legenda"><span><i className="e" /> Entrou</span><span><i className="s" /> Saiu</span></div>
        <div className="pv-barras">
          {MESES.map((m, n) => (
            <div key={n} className="pv-mes" style={i(n)}>
              <div><i className="e" style={{ height: `${ENTRADAS[n] * 100}%` }} /><i className="s" style={{ height: `${SAIDAS[n] * 100}%` }} /></div>
              <small>{m}</small>
            </div>
          ))}
        </div>
      </div>
    ),
  },
]

export function VitrinePlanos() {
  const [atual, setAtual] = useState(0)
  const [pausado, setPausado] = useState(false)

  useEffect(() => {
    if (pausado) return
    const t = window.setTimeout(() => setAtual((a) => (a + 1) % TELAS.length), DURACAO)
    return () => window.clearTimeout(t)
  }, [atual, pausado])

  const tela = TELAS[atual]
  return (
    <div className={`pv ${pausado ? 'pausado' : ''}`} style={{ '--dur': `${DURACAO}ms` } as CSSProperties} onMouseEnter={() => setPausado(true)} onMouseLeave={() => setPausado(false)} onFocus={() => setPausado(true)} onBlur={() => setPausado(false)}>
      <div className="pv-janela">
        <div className="pv-barra">
          <span className="pv-pontos"><i /><i /><i /></span>
          <span className="pv-aba"><Icone nome="inicio" tamanho={13} />OpusCash · {tela.aba}</span>
          <span className="pv-exemplo">dados de exemplo</span>
        </div>
        <div className="pv-palco">
          {TELAS.map((t, n) => (
            <div key={t.chave} className={`pv-tela ${n === atual ? 'ativa' : ''}`} aria-hidden={n !== atual}>{t.corpo}</div>
          ))}
        </div>
      </div>
      <div className="pv-legenda-tela" aria-live="polite" key={tela.chave}>
        <strong>{tela.titulo}</strong>
        <p>{tela.texto}</p>
      </div>
      <div className="pv-passos" role="tablist" aria-label="Telas do OpusCash">
        {TELAS.map((t, n) => (
          <button key={t.chave} role="tab" aria-selected={n === atual} aria-label={t.titulo} className={n === atual ? 'ativo' : ''} onClick={() => setAtual(n)}>
            <i />
          </button>
        ))}
      </div>
    </div>
  )
}
