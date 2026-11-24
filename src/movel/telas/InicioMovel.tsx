/**
 * Início do celular: o topo grande que desliza (o que sobrou no mês, o guardado, as dívidas e os investimentos), as ações
 * redondas (Gasto, Entrada, Contas e Cartões, ou "Mais" sem o módulo de cartões), as dicas e os cartões do jeito escolhido
 * (lib/widgets.ts). Os números são os mesmos da Início do computador
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
import { tx } from '../../lib/textos'
import { naHoraDaDividaNova } from '../../lib/naHora'
import { useMesDaInicio } from '../../lib/useMesDaInicio'
import type { Ctx } from '../../pages/contexto'
import type { Tarefa } from '../../lib/paraFazer'
import { BotoesDeAcao, CarrosselDeDicas, HeroDeslizante } from '../primitivas'
import { ListaDaFolha } from '../Casca'
import type { Tom } from '../tom'
import type { Contexto } from '../widgets'
import { GradeDeCartoes } from '../GradeDeCartoes'
import { acoesDaInicio, dicasDaInicio, resumosDaInicio } from '../resumosDaInicio'

export function InicioMovel({ c, aoMudarTom }: { c: Ctx; aoMudarTom: (t: Tom) => void }) {
  const m = useMesDaInicio(c)
  const { v } = c
  const [entender, setEntender] = useState(false)
  const [conferir, setConferir] = useState<SituacaoConta | null>(null)
  const [divida, setDivida] = useState<'nova' | null>(null)
  const [maisAcoes, setMaisAcoes] = useState(false)
  const refAcoes = useAcoesDeLancar<HTMLDivElement>()
  const { ddMes, composicao, situacao, nomeMes } = m

  const paginas = resumosDaInicio(c, m, () => setEntender(true))
  const acoes = acoesDaInicio(c, () => setMaisAcoes(true))
  const dicas = dicasDaInicio(c)
  // conta do mês tocada: abre a conferência (nunca dá baixa direto)
  const agir = (t: Tarefa) => {
    if (t.origem === 'conta' && t.conta) setConferir(t.conta)
    else t.botao.acao()
  }
  const x: Contexto = { c, m, agir }
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

      <GradeDeCartoes x={x} />

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
        <FormDivida ano={c.ano} mes={c.mes} naHora={(p, n, primeira) => naHoraDaDividaNova(c.analise, p, n, primeira)} aoCriar={c.d.addDivida} aoEditar={c.d.updDivida} aoNovoSaldo={c.d.addSaldo}
          aoMudarValor={c.d.ajustarValorDivida} aoMoverInicio={c.d.moverInicioDivida} pagamentos={c.d.pagamentos} aoExcluir={c.d.delDivida}
          perfil={c.perfil} semMoeda={c.d.dividasSemMoeda} semJuros={c.d.dividasSemJuros} semAtraso={c.d.dividasSemAtraso} semCusto={c.d.dividasSemCusto} aoFechar={() => setDivida(null)} />
      )}
    </div>
  )
}
