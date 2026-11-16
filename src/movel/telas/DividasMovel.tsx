/**
 * Dívidas no celular: o topo desliza entre o que você deve e o que te devem (no lugar das abas "Eu devo / Me devem"), com
 * quando tudo acaba e o atrasado. Ações: pagar (ou receber) a próxima e adicionar. Embaixo: cada dívida com quanto falta e
 * quanto já foi pago (tocar abre a ficha, com o calendário das parcelas e o "Conferi com o banco"), quanto sai nos próximos
 * meses, o que entra todo mês (lado "Me devem") e as quitadas no mês. Os números saem de `resumoDasDividas`
 * (lib/dividas.ts), os mesmos da tela do computador.
 */
import { useState } from 'react'
import { FormBaixa } from '../../components/FormBaixa'
import { FormDivida } from '../../components/Formularios'
import { Colunas } from '../../components/Vitrine'
import type { SituacaoConta } from '../../lib/contasFixas'
import { resumoDasDividas, tomarLadoDividas, type SituacaoDivida } from '../../lib/dividas'
import { fmtConta, fraseDaSituacao } from '../../lib/contasFixas'
import { fmtDataCurta, fmtMesAno, fmtValor, MESES_CURTO, noMeioDaFrase } from '../../lib/format'
import { fmtCurto } from '../../lib/visuais'
import { tx } from '../../lib/textos'
import { corDe, Ficha, VazioLado } from '../../pages/Dividas'
import type { Ctx } from '../../pages/contexto'
import { BotoesDeAcao, CartaoWidget, HeroDeslizante, IconeRedondo, LinhaDeLista, type Acao, type PaginaDoHero } from '../primitivas'
import type { Tom } from '../tom'

type Lado = 'devo' | 'me_devem'

export function DividasMovel({ c, aoMudarTom }: { c: Ctx; aoMudarTom: (t: Tom, cor?: string) => void }) {
  const [lado, setLado] = useState<Lado>(tomarLadoDividas)
  const [editando, setEditando] = useState<SituacaoDivida | 'nova' | null>(null)
  const [aberta, setAberta] = useState<string | null>(null)
  const [conferirConta, setConferirConta] = useState<SituacaoConta | null>(null)
  const recebe = lado === 'me_devem'
  const devo = resumoDasDividas(c.situacao, c.diaRef)
  const receber = resumoDasDividas(c.aReceber, c.diaRef)
  const r = recebe ? receber : devo
  const lista = recebe ? c.aReceber : c.situacao
  const aberto = r.comCal.find((x) => x.s.divida.id === aberta)
  const nivel = c.perfil.detalhe
  const contasEntrada = c.situacoesContas.filter((s) => s.conta.tipo === 'entrada' && s.estado !== 'fora')
  const primeira = r.itens.find((x) => x.s.restante > 0)
  const atrasadaDevo = devo.itens.find((x) => (x.cal?.atrasadas.length ?? 0) > 0)

  // ---------- topo: o que você deve → o que te devem ----------
  const quando = (fim: [number, number] | null) => (fim ? fmtMesAno(fim[0], fim[1]) : null)
  const paginas: PaginaDoHero[] = [{
    id: 'devo', tom: devo.emAtraso > 0 ? 'falta' : devo.falta > 0 ? 'dividas' : 'sobra', rotulo: tx('Você deve no total'), valor: fmtValor(devo.falta),
    sub: devo.falta <= 0 ? tx('Sem dívidas. 🎉') : devo.emAtraso > 0 ? tx('{0} atrasado', fmtValor(devo.emAtraso))
      : quando(devo.fim) ? tx('Sem dívidas em {0}', quando(devo.fim)!) : tx('{0}% quitado', Math.round(devo.pct * 100)),
    pilula: atrasadaDevo ? { texto: tx('Pagar o atrasado'), acao: () => c.pagarDivida(atrasadaDevo.s) } : undefined,
  }]
  if (!c.d.dividasSemExtras) {
    paginas.push({
      id: 'me_devem', tom: 'sobra', rotulo: tx('Falta receber'), valor: fmtValor(receber.falta),
      sub: !c.aReceber.length ? tx('Ninguém te deve nada registrado.') : receber.falta <= 0 ? tx('Tudo recebido. 🎉')
        : receber.emAtraso > 0 ? tx('{0} já venceu', fmtValor(receber.emAtraso)) : quando(receber.fim) ? tx('Tudo recebido em {0}', quando(receber.fim)!) : undefined,
    })
  }

  const acoes: Acao[] = [
    ...(primeira ? [{ id: 'pagar', icone: recebe ? 'receber' : 'check', rotulo: recebe ? tx('Receber') : tx('Pagar'), acao: () => c.pagarDivida(primeira.s) }] : []),
    { id: 'nova', icone: 'mais', rotulo: recebe ? tx('Alguém me deve') : tx('Nova dívida'), acao: () => setEditando('nova') },
  ]

  const linha = (x: (typeof r.itens)[number] | (typeof r.comCal)[number], estado?: string) => {
    const { s, cal } = x
    const pago = s.saldoInicial > 0 ? Math.max(0, Math.min(1, (s.saldoInicial - s.restante) / s.saldoInicial)) : undefined
    const atrasada = (cal?.atrasadas.length ?? 0) > 0
    const sub = [
      estado,
      cal?.proxima && s.restante > 0 ? tx('próxima {0} · {1}', fmtDataCurta(cal.proxima.vencimento), fmtValor(cal.proxima.falta)) : null,
      recebe && s.divida.pessoa ? s.divida.descricao : null,
    ].filter(Boolean).join(' · ')
    return (
      <LinhaDeLista key={s.divida.id} icone={<IconeRedondo icone={recebe ? 'receber' : 'divida'} cor={corDe(s)} />}
        titulo={recebe && s.divida.pessoa ? s.divida.pessoa : s.divida.descricao} sub={sub}
        progresso={pago !== undefined ? { parte: pago, cor: recebe ? 'var(--entrada)' : 'var(--divida)' } : undefined}
        valor={fmtValor(s.restanteHoje)} valorSub={s.restante > 0 ? (recebe ? tx('falta receber') : tx('falta')) : tx('Quitada')}
        tomValor={atrasada ? 'alerta' : recebe ? 'entrada' : undefined}
        aoTocar={() => setAberta(s.divida.id)} />
    )
  }

  return (
    <div className="pagina dividas-movel">
      <HeroDeslizante paginas={paginas} inicial={recebe ? 1 : 0}
        aoMudar={(p) => { aoMudarTom(p.tom); if (p.id !== lado) setLado(p.id as Lado) }} />
      <BotoesDeAcao acoes={acoes} />

      <div className="widgets-movel">
        {!lista.length ? <VazioLado recebe={recebe} aoNova={() => setEditando('nova')} /> : (
          <>
            {r.itens.length > 0 && (
              <CartaoWidget titulo={recebe ? tx('Cada valor a receber') : tx('Cada dívida')}>
                {r.itens.map((x) => linha(x, x.estado.texto))}
              </CartaoWidget>
            )}
            {nivel !== 'simples' && r.falta > 0 && r.projecao.some((v) => v.valor > 0) && (
              <CartaoWidget titulo={recebe ? tx('Quanto entra nos próximos meses') : tx('Quanto sai nos próximos meses')}>
                <div className="colunas-movel">
                  <Colunas cor={recebe ? 'var(--entrada)' : 'var(--divida)'} altura={110} formato={fmtCurto}
                    itens={r.projecao.map((v, i) => ({ rotulo: noMeioDaFrase(MESES_CURTO[v.mes - 1]).slice(0, 3), valor: v.valor, destaque: i === 0, titulo: `${fmtMesAno(v.ano, v.mes)}: ${fmtValor(v.valor)}` }))} />
                </div>
                {r.porMes > 0 && <p className="widget-nota">{recebe ? tx('Entra por mês: {0}', fmtValor(r.porMes)) : tx('Parcelas por mês: {0}', fmtValor(r.porMes))}</p>}
              </CartaoWidget>
            )}
          </>
        )}

        {recebe && (
          <CartaoWidget titulo={tx('Recebe todo mês')} aoAbrir={() => { if (!c.v.contas) c.ligarModulo('contas'); c.irPara('contas') }}>
            {c.v.contas && contasEntrada.length ? contasEntrada.map((s) => (
              <LinhaDeLista key={s.conta.id} icone={<IconeRedondo icone="calendario" cor="var(--entrada)" />}
                titulo={s.conta.descricao} sub={fraseDaSituacao(s)} valor={fmtConta(s)} tomValor="entrada"
                valorSub={s.estado === 'paga' ? tx('recebido') : undefined}
                aoTocar={() => (s.baixa ? c.editarLancamento(s.baixa) : setConferirConta(s))} />
            )) : (
              <p className="widget-vazio">{tx('Aluguel, mesada ou qualquer valor que cai todo mês fica em Contas do mês, como recebimento: o app lembra o dia e você dá baixa com “Recebi”.')}</p>
            )}
          </CartaoWidget>
        )}

        {r.quitadas.length > 0 && (
          <CartaoWidget titulo={recebe ? tx('Recebidas neste mês') : tx('Quitadas neste mês')}>
            {r.quitadas.map((x) => linha(x))}
          </CartaoWidget>
        )}
      </div>

      {aberto && (
        <Ficha c={c} s={aberto.s} cal={aberto.cal} recebe={recebe} conferir={false} aoFechar={() => setAberta(null)}
          aoEditar={() => { setAberta(null); setEditando(aberto.s) }} />
      )}
      {conferirConta && <FormBaixa c={c} s={conferirConta} conferir aoFechar={() => setConferirConta(null)} />}
      {editando && (
        <FormDivida ano={c.ano} mes={c.mes} situacao={editando === 'nova' ? undefined : editando} sentidoInicial={lado}
          semExtras={c.d.dividasSemExtras} perfil={c.perfil} semMoeda={c.d.dividasSemMoeda} semJuros={c.d.dividasSemJuros} semAtraso={c.d.dividasSemAtraso}
          aoCriar={async (d) => { if (d.sentido && d.sentido !== lado) setLado(d.sentido); return c.d.addDivida(d) }}
          aoEditar={c.d.updDivida} aoNovoSaldo={c.d.addSaldo} aoMudarValor={c.d.ajustarValorDivida} aoMoverInicio={c.d.moverInicioDivida}
          pagamentos={c.d.pagamentos} aoExcluir={c.d.delDivida} aoFechar={() => setEditando(null)} />
      )}
    </div>
  )
}
