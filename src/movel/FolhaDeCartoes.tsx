/**
 * A folha "Adicionar cartões" da Início do celular: os cartões que não estão na tela, cada um com a prévia de verdade
 * (os dados da pessoa, sem dar para tocar dentro). Os pequenos ficam dois por linha e os grandes ocupam a linha.
 * Cartão de módulo desligado aparece com o convite para ligar.
 */
import { Modal } from '../components/ui'
import { Icone } from '../components/Icone'
import { tx } from '../lib/textos'
import { TAMANHO, type IdWidget } from '../lib/widgets'
import { IconeRedondo } from './primitivas'
import { WIDGETS, type Contexto } from './widgets'

const NOME_DO_MODULO = {
  contas: () => tx('Contas do mês'), cartoes: () => tx('Cartões'), dividas: () => tx('Dívidas'), metas: () => tx('Metas'),
  bancos: () => tx('Bancos'), investimentos: () => tx('Investimentos'), moedas: () => tx('Outras moedas'),
}

export function FolhaDeCartoes({ x, naTela, escondidos, aoAdicionar, aoFechar }: {
  x: Contexto
  /** Os que já estão na Início (com algo para mostrar). */
  naTela: IdWidget[]
  /** Os que estão na Início mas sem nada para mostrar agora (aparecem sozinhos quando tiverem). */
  escondidos: IdWidget[]
  aoAdicionar: (id: IdWidget) => void
  aoFechar: () => void
}) {
  const { c } = x
  const fora = (Object.keys(WIDGETS) as IdWidget[]).filter((id) => !naTela.includes(id) && !escondidos.includes(id))
  const pequenos = fora.filter((id) => TAMANHO[id] === 'pequeno')
  const grandes = fora.filter((id) => TAMANHO[id] === 'grande')
  const previa = (id: IdWidget) => {
    const w = WIDGETS[id]
    const desligado = w.modulo && !c.perfil.modulos[w.modulo]
    const tem = !desligado && w.disponivel(x)
    const adicionar = () => {
      if (desligado && w.modulo) c.ligarModulo(w.modulo)
      aoAdicionar(id)
    }
    return (
      <div key={id} className={`previa-cartao ${TAMANHO[id]}`}>
        {tem ? (
          <div className="previa-cartao-corpo" inert><w.Corpo {...x} /></div>
        ) : (
          <div className="previa-cartao-corpo previa-cartao-vazia" inert>
            <IconeRedondo icone={w.icone} cor="var(--destaque)" tamanho={40} />
            <b>{w.titulo()}</b>
            <span>{w.descricao()}</span>
            <small>{desligado && w.modulo ? tx('Ao adicionar, liga {0}', NOME_DO_MODULO[w.modulo]()) : tx('Aparece quando houver dados no mês')}</small>
          </div>
        )}
        <button className="previa-cartao-botao" onClick={adicionar} aria-label={tx('Adicionar o cartão {0}', w.titulo())}>
          <span aria-hidden="true"><Icone nome="mais" tamanho={18} /></span>
        </button>
      </div>
    )
  }
  return (
    <Modal titulo={tx('Adicionar cartões')} aoFechar={aoFechar} tamanho="grande">
      {!fora.length && <p className="folha-nota">{tx('Todos os cartões já estão na sua Início.')}</p>}
      {pequenos.length > 0 && <div className="previas-grade">{pequenos.map(previa)}</div>}
      {grandes.length > 0 && <div className="previas-lista">{grandes.map(previa)}</div>}
      {escondidos.length > 0 && (
        <p className="folha-nota">
          {tx('Já estão na sua Início e aparecem quando tiverem o que mostrar: {0}.', escondidos.map((id) => WIDGETS[id].titulo()).join(', '))}
        </p>
      )}
    </Modal>
  )
}
