/**
 * Início do celular: o topo grande que desliza (o que sobrou no mês, o guardado, as dívidas e os investimentos), as ações
 * redondas, as dicas e os cartões do jeito escolhido (lib/widgets.ts). Os números são os mesmos da Início do computador
 * (lib/useMesDaInicio.ts).
 */
import { useState } from 'react'
import { EntenderMes } from '../../components/EntenderMes'
import { FormBaixa } from '../../components/FormBaixa'
import { FormDivida } from '../../components/Formularios'
import { Modal } from '../../components/ui'
import { Icone } from '../../components/Icone'
import { useAcoesDeLancar } from '../../lib/botaoMais'
import type { SituacaoConta } from '../../lib/contasFixas'
import { fmtValor } from '../../lib/format'
import { totalGuardado } from '../../lib/guardado'
import { tx } from '../../lib/textos'
import { useMesDaInicio } from '../../lib/useMesDaInicio'
import { adicionarCartao, cartoesDaInicio, linhasDaGrade, moverCartao, removerCartao, type ArrumacaoInicio, type IdWidget } from '../../lib/widgets'
import type { Ctx } from '../../pages/contexto'
import type { Tarefa } from '../../lib/paraFazer'
import { BotoesDeAcao, CarrosselDeDicas, HeroDeslizante, type Acao, type Dica, type PaginaDoHero } from '../primitivas'
import { ListaDaFolha } from '../Casca'
import type { Tom } from '../tom'
import { WIDGETS, type Contexto } from '../widgets'
import { FolhaDeCartoes } from '../FolhaDeCartoes'

const NOME_DO_JEITO = { simples: () => tx('Simples'), equilibrado: () => tx('Equilibrado'), detalhado: () => tx('Detalhado') }

export function InicioMovel({ c, aoMudarTom }: { c: Ctx; aoMudarTom: (t: Tom) => void }) {
  const m = useMesDaInicio(c)
  const { v, r } = c
  const [entender, setEntender] = useState(false)
  const [conferir, setConferir] = useState<SituacaoConta | null>(null)
  const [divida, setDivida] = useState<'nova' | null>(null)
  const [maisAcoes, setMaisAcoes] = useState(false)
  const [folhaCartoes, setFolhaCartoes] = useState(false)
  const [arrumando, setArrumando] = useState(false)
  const refAcoes = useAcoesDeLancar<HTMLDivElement>()
  const { ddMes, composicao, situacao, momento, nomeMes } = m

  // ---------- o topo: uma página por resumo (só os dos módulos ligados) ----------
  const paginas: PaginaDoHero[] = []
  const temPrevisao = ddMes.vaiEntrar > 0 || ddMes.vaiSair > 0
  if (momento === 'futuro') {
    paginas.push({
      id: 'sobra', tom: composicao.resultado < 0 ? 'falta' : 'sobra', rotulo: tx('Previsto para {0}', nomeMes),
      valor: fmtValor(composicao.resultado),
      sub: temPrevisao ? tx('Vai entrar {0} · vai sair {1}', fmtValor(ddMes.vaiEntrar), fmtValor(ddMes.vaiSair)) : tx('Nada previsto ainda.'),
      pilula: temPrevisao ? { texto: tx('Entender a conta'), acao: () => setEntender(true) } : undefined,
    })
  } else {
    const resultado = situacao.resultado
    const sobrou = resultado >= 0
    const rotulo = momento === 'atual'
      ? (sobrou ? tx('Sobrou em {0} até hoje', nomeMes) : tx('Faltou em {0} até hoje', nomeMes))
      : (sobrou ? tx('Sobrou em {0}', nomeMes) : tx('Faltou em {0}', nomeMes))
    const sub = c.contaNova
      ? tx('Lance o que entrou e o que saiu e o painel se monta sozinho.')
      : momento === 'atual' && temPrevisao
        ? (composicao.resultado >= 0 ? tx('Deve sobrar {0} no fim do mês', fmtValor(composicao.resultado)) : tx('Pode faltar {0} no fim do mês', fmtValor(-composicao.resultado)))
        : tx('Entrou {0} · saiu {1}', fmtValor(ddMes.entrou), fmtValor(ddMes.saiu))
    paginas.push({
      id: 'sobra', tom: !sobrou || situacao.estado === 'critico' ? 'falta' : 'sobra', rotulo, valor: fmtValor(Math.abs(resultado)), sub,
      pilula: c.contaNova ? undefined : { texto: tx('Entender a conta'), acao: () => setEntender(true) },
    })
  }
  if (v.bancos || v.investimentos || v.moedas) {
    const informado = Object.keys(c.mesEf.caixa).length > 0 || r.investimentos > 0 || Object.keys(c.mesEf.moedas ?? {}).length > 0
    const total = totalGuardado({ v, bancos: c.d.bancos, caixa: c.mesEf.caixa, investimentos: r.investimentos, moedas: c.mesEf.moedas, lista: c.perfil.moedas, taxas: c.taxas })
    const nb = c.d.bancos.length
    paginas.push({
      id: 'guardado', tom: 'guardado', rotulo: v.bancos && nb ? (nb === 1 ? tx('Guardado em 1 banco') : tx('Guardado em {0} bancos', nb)) : tx('Dinheiro guardado'),
      valor: fmtValor(total), sub: informado ? undefined : tx('Ainda não informado'),
      pilula: { texto: informado ? tx('Ver o guardado') : tx('Informar saldos'), acao: () => c.irPara('patrimonio') },
    })
  }
  if (v.dividas) {
    const comSaldo = c.situacao.filter((s) => !s.semCotacao)
    const falta = comSaldo.reduce((t, s) => t + s.restanteHoje, 0)
    const registrado = comSaldo.reduce((t, s) => t + s.restante, 0)
    const inicial = comSaldo.reduce((t, s) => t + s.saldoInicial, 0)
    if (falta > 0) {
      const pago = inicial > 0 ? Math.max(0, Math.min(1, (inicial - registrado) / inicial)) : null
      paginas.push({
        id: 'dividas', tom: 'dividas', rotulo: tx('Falta pagar nas dívidas'), valor: fmtValor(falta),
        sub: pago !== null ? tx('{0}% quitado', Math.round(pago * 100)) : undefined,
        pilula: { texto: tx('Ver dívidas'), acao: () => c.irPara('dividas') },
      })
    }
  }
  if (v.investimentos && c.invest.c.valor > 0) {
    const res = c.invest.c.resultado
    paginas.push({
      id: 'invest', tom: 'invest', rotulo: tx('Seus investimentos'), valor: fmtValor(c.invest.c.valor),
      sub: res >= 0 ? tx('Rendeu {0} até hoje', fmtValor(res)) : tx('Perdeu {0} até hoje', fmtValor(-res)),
      pilula: { texto: tx('Ver carteira'), acao: () => c.irPara('invest') },
    })
  }

  // ---------- as ações ----------
  const acoes: Acao[] = [
    { id: 'gasto', icone: 'desce', rotulo: tx('Gasto'), acao: () => c.novoLancamento('saida'), tour: 'lancar' },
    { id: 'entrada', icone: 'sobe', rotulo: tx('Entrada'), acao: () => c.novoLancamento('entrada') },
    v.contas
      ? { id: 'contas', icone: 'calendario', rotulo: tx('Contas'), acao: () => c.irPara('contas') }
      : { id: 'importar', icone: 'relatorio', rotulo: tx('Importar'), acao: c.importarExtrato },
    { id: 'mais', icone: 'reticencias', rotulo: tx('Mais'), acao: () => setMaisAcoes(true) },
  ]

  // ---------- dicas: o convite para importar e a sugestão do momento ----------
  const dicas: Dica[] = []
  if (c.d.lancs.length < 20 && !c.perfil.dispensadas.includes('importar')) {
    dicas.push({
      id: 'importar', icone: 'relatorio', titulo: tx('Traga seus dados de uma vez'), tour: 'importar',
      texto: tx('Importe o extrato do banco ou uma planilha e o app lança tudo para você.'),
      botao: { texto: tx('Importar extrato'), acao: c.importarExtrato }, aoDispensar: () => c.dispensar('importar'),
    })
  }
  if (c.sugestao) {
    const s = c.sugestao
    dicas.push({ id: s.id, icone: s.icone, titulo: s.titulo, texto: s.texto, botao: { texto: s.botao, acao: () => c.aceitarSugestao(s) }, aoDispensar: () => c.recusarSugestao(s) })
  }

  // ---------- os cartões do jeito escolhido ----------
  const agir = (t: Tarefa) => {
    if (t.origem === 'conta' && t.conta) setConferir(t.conta)
    else t.botao.acao()
  }
  const x: Contexto = { c, m, agir }
  // a arrumação da pessoa (ou o modelo do jeito); o cartão sem nada para mostrar agora some, mas guarda o lugar
  const detalhe = c.perfil.detalhe
  const arrumacao = c.celular?.inicio
  const lista = c.contaNova ? [] : cartoesDaInicio(arrumacao, detalhe)
  const ids = lista.filter((id) => WIDGETS[id].disponivel(x))
  const escondidos = lista.filter((id) => !ids.includes(id))
  // arrumando, um cartão por linha: subir e descer ficam claros
  const linhas = arrumando ? ids.map((id) => ({ tipo: 'grande' as const, ids: [id] as IdWidget[] })) : linhasDaGrade(ids)
  const agora = () => new Date().toISOString()
  const guardar = (a: ArrumacaoInicio | null) => { if (a) c.salvarCelular({ ...c.celular, v: 1, inicio: a }) }
  const adicionar = (id: IdWidget) => {
    guardar(adicionarCartao(arrumacao, detalhe, id, agora()))
    setFolhaCartoes(false)
    // leva até o cartão que acabou de entrar
    window.setTimeout(() => document.querySelector(`[data-cartao="${id}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 350)
  }
  const nomeDoCartao = (id?: string) => c.cartoes.cartoes.find((k) => k.id === id)?.nome ?? ''

  return (
    <div className="pagina inicio-movel">
      <HeroDeslizante paginas={paginas} aoMudar={(p) => aoMudarTom(p.tom)} />
      <BotoesDeAcao acoes={acoes} refAcoes={refAcoes} />
      <CarrosselDeDicas dicas={dicas} />

      {c.contaNova && (
        <section className="widget boas-vindas-movel">
          <img src="/simbolo.webp" alt="" width={64} height={31} />
          <h2>{tx('Tudo pronto para começar')}</h2>
          <p>{tx('Lance o que entrou e o que saiu neste mês e o painel se monta sozinho. Seus dados são só seus: ninguém mais vê o que você lança aqui.')}</p>
        </section>
      )}

      <div className={`widgets-movel ${arrumando ? 'arrumando' : ''}`}>
        {linhas.map((l) => (
          <div key={l.ids.join()} className={`widgets-linha ${l.tipo}`}>
            {l.ids.map((id) => (
              <div key={id} className="widget-celula" data-cartao={id}>
                {arrumando && (
                  <div className="arrumar-barra">
                    <span>{WIDGETS[id].titulo()}</span>
                    <button onClick={() => guardar(moverCartao(arrumacao, detalhe, id, -1, ids, agora()))} disabled={ids[0] === id}
                      aria-label={tx('Subir o cartão {0}', WIDGETS[id].titulo())}><Icone nome="cima" tamanho={20} /></button>
                    <button onClick={() => guardar(moverCartao(arrumacao, detalhe, id, 1, ids, agora()))} disabled={ids[ids.length - 1] === id}
                      aria-label={tx('Descer o cartão {0}', WIDGETS[id].titulo())}><Icone nome="abaixo" tamanho={20} /></button>
                    <button className="tirar" onClick={() => guardar(removerCartao(arrumacao, detalhe, id, agora()))}
                      aria-label={tx('Tirar o cartão {0}', WIDGETS[id].titulo())}><Icone nome="fechar" tamanho={18} /></button>
                  </div>
                )}
                <div inert={arrumando || undefined}><WidgetDaLista id={id} x={x} /></div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {!c.contaNova && (arrumando ? (
        <div className="cartoes-acoes">
          <button className="btn primario" onClick={() => setArrumando(false)}>{tx('Pronto')}</button>
          {arrumacao?.base === detalhe && (
            <button className="link" onClick={() => c.salvarCelular({ v: 1 })}>{tx('Voltar ao modelo {0}', NOME_DO_JEITO[detalhe]())}</button>
          )}
        </div>
      ) : (
        <div className="cartoes-acoes">
          <button className="cartoes-adicionar" onClick={() => setFolhaCartoes(true)}><Icone nome="mais" tamanho={18} /> {tx('Adicionar cartões')}</button>
          {ids.length > 1 && <button className="cartoes-arrumar" onClick={() => setArrumando(true)}><Icone nome="ajustes" tamanho={18} /> {tx('Arrumar')}</button>}
        </div>
      ))}

      {!c.contaNova && (
        <p className="rodape-movel">
          {tx('Jeito {0}', NOME_DO_JEITO[detalhe]())} · <button className="link" onClick={c.personalizar}>{tx('Trocar')}</button>
        </p>
      )}

      {folhaCartoes && (
        <FolhaDeCartoes x={x} naTela={ids} escondidos={escondidos} aoAdicionar={adicionar} aoFechar={() => setFolhaCartoes(false)} />
      )}

      {maisAcoes && (
        <Modal titulo={tx('O que você quer fazer?')} aoFechar={() => setMaisAcoes(false)}>
          <ListaDaFolha aoEscolher={() => setMaisAcoes(false)}>
            <button onClick={c.importarExtrato}><Icone nome="relatorio" /> {tx('Importar extrato')}</button>
            <button onClick={c.importar}><Icone nome="importar" /> {tx('Importar planilha')}</button>
            {v.cartoes && <button onClick={() => c.irPara('cartoes')}><Icone nome="cartao" /> {tx('Compra no cartão')}</button>}
            {v.dividas && <button onClick={() => setDivida('nova')}><Icone nome="divida" /> {tx('Nova dívida')}</button>}
            {v.metas && <button onClick={() => c.irPara('metas')}><Icone nome="meta" /> {tx('Guardar numa meta')}</button>}
            {v.contas && <button onClick={() => c.irPara('contas')}><Icone nome="calendario" /> {tx('Contas do mês')}</button>}
            <button onClick={() => c.irPara('lancamentos')}><Icone nome="lista" /> {tx('Ver lançamentos')}</button>
          </ListaDaFolha>
        </Modal>
      )}
      {entender && (
        <EntenderMes situacao={situacao} composicao={composicao} nomeMes={nomeMes} dias={ddMes.dias} nomeDoCartao={nomeDoCartao} aoFechar={() => setEntender(false)} />
      )}
      {conferir && <FormBaixa c={c} s={conferir} conferir aoFechar={() => setConferir(null)} />}
      {divida && (
        <FormDivida ano={c.ano} mes={c.mes} aoCriar={c.d.addDivida} aoEditar={c.d.updDivida} aoNovoSaldo={c.d.addSaldo}
          aoMudarValor={c.d.ajustarValorDivida} aoMoverInicio={c.d.moverInicioDivida} pagamentos={c.d.pagamentos} aoExcluir={c.d.delDivida}
          perfil={c.perfil} semMoeda={c.d.dividasSemMoeda} semJuros={c.d.dividasSemJuros} aoFechar={() => setDivida(null)} />
      )}
    </div>
  )
}

/** Cada cartão é um componente: o corpo pode ter os seus próprios ganchos sem mexer na ordem dos ganchos da tela. */
function WidgetDaLista({ id, x }: { id: keyof typeof WIDGETS; x: Contexto }) {
  const Corpo = WIDGETS[id].Corpo
  return <Corpo {...x} />
}
