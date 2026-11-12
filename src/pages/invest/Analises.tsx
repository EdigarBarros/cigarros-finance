/**
 * Invest → Análises: o retrato da carteira em quatro medidas e as descobertas do analista (lib/invest/descobertas.ts),
 * montadas pelo mesmo compositor do Consultor (lib/composicao.ts) com o gosto próprio do Invest: cada cartão fica no lugar e
 * só muda com motivo, o importante não some, e cada um explica por que está ali.
 *
 * De propósito não há uma "nota" da carteira: uma nota só diria se a carteira é boa ou ruim, e isso depende do objetivo e
 * do risco que cada pessoa aceita, coisa que o app não decide por ela. No lugar, medidas que qualquer um confere.
 */
import type { CSSProperties } from 'react'
import { fmtPct, fmtValor } from '../../lib/format'
import { tx } from '../../lib/textos'
import { Icone } from '../../components/Icone'
import { Faixas, Manchete, useTelaVivaDe, type TemaDaTela } from '../AnaliseTela'
import type { Ctx } from '../contexto'
import { useDescobertas } from './analista'
import { Fatia, type AcoesInvest } from './apoio'

const TEMAS: TemaDaTela[] = [
  { id: 'carteira', icone: 'carteira', nome: () => tx('Carteira') },
  { id: 'risco', icone: 'escudo', nome: () => tx('Concentração') },
  { id: 'renda', icone: 'receber', nome: () => tx('Renda') },
  { id: 'prazos', icone: 'calendario', nome: () => tx('Prazos') },
  { id: 'plano', icone: 'meta', nome: () => tx('Plano') },
  { id: 'dados', icone: 'relatorio', nome: () => tx('Seus dados') },
]

export function Analises({ c, acoes }: { c: Ctx; acoes: AcoesInvest }) {
  const inv = c.invest
  const k = inv.c
  const nivel = c.perfil.detalhe
  const lista = useDescobertas(c)
  const tela = useTelaVivaDe({ lista, gosto: inv.d.gosto, salvar: inv.d.salvarGosto, temas: TEMAS })
  const aoIr = (a: (typeof lista)[number]) => { if (a.porQue?.acao) acoes.ir(a.porQue.acao.ir) }
  const maior = k.abertas[0]
  const diaria = k.porLiquidez.find((f) => f.id === 'diaria')?.fracao ?? 0
  const medidas = [
    { icone: 'carteira', rotulo: tx('Maior ativo'), valor: maior ? maior.participacao : 0, texto: maior ? (maior.ativo.codigo || maior.ativo.nome) : '—', cor: 'var(--an-atencao)' },
    { icone: 'investir', rotulo: tx('Em renda variável'), valor: k.rendaVariavel, texto: fmtValor(k.rendaVariavel * k.valor), cor: 'var(--violeta)' },
    { icone: 'receber', rotulo: tx('Resgate a qualquer hora'), valor: diaria, texto: fmtValor(diaria * k.valor), cor: 'var(--an-bom)' },
    { icone: 'relogio', rotulo: tx('Valores em dia'), valor: k.emDia, texto: k.emDia >= 0.9 ? tx('os números de hoje são confiáveis') : tx('atualize para os números ficarem certos'), cor: 'var(--an-destino)' },
  ]
  const anterior = inv.d.anterior
  return (
    <>
      <Manchete t={tela} aoIr={aoIr} aoExplicar={acoes.explicar} />
      {k.valor > 0 && (
        <section className="cartao inv-medidas">
          <h3><Icone nome="escudo" tamanho={17} /> {tx('O retrato da carteira')}</h3>
          <ul>
            {medidas.map((m) => (
              <li key={m.rotulo} style={{ '--c': m.cor } as CSSProperties}>
                <span className="inv-linha-ic"><Icone nome={m.icone} tamanho={17} /></span>
                <span className="inv-medida-texto"><small>{m.rotulo}</small><Fatia fracao={m.valor} cor={m.cor} /><span>{m.texto}</span></span>
                <b>{fmtPct(m.valor)}</b>
              </li>
            ))}
          </ul>
          {k.emDia < 0.9 && <button className="btn inv-quadro-botao" onClick={() => acoes.atualizarValores()}><Icone nome="relogio" tamanho={15} /> {tx('Atualizar valores')}</button>}
        </section>
      )}
      {!lista.length && (
        <section className="cartao inv-vazio pequeno">
          <h2>{tx('Ainda não há o que analisar')}</h2>
          <p>{tx('As análises aparecem conforme você registra operações e atualiza os valores. Só sai o que os seus números sustentam.')}</p>
        </section>
      )}
      <Faixas t={tela} aoIr={aoIr} aoExplicar={acoes.explicar} nivel={nivel} depois={anterior && (
        <button className="link inv-desfazer" onClick={() => tela.restaurar(anterior)}>
          <Icone nome="desfazer" tamanho={15} /> {tx('Voltar os cartões para a organização de antes')}
        </button>
      )} />
      {inv.indicesFalharam && <p className="inv-nota"><Icone nome="semInternet" tamanho={15} /> {tx('Não deu para atualizar o CDI e a inflação agora: as estimativas e a comparação usam o que já estava guardado.')}</p>}
    </>
  )
}
