/**
 * Os cartões da Início (lib/widgets.ts), com "Adicionar cartões", "Arrumar" e o rodapé do jeito de ver. O celular e o
 * computador usam a mesma lista e a mesma arrumação (guardada em perfis.celular): o que a pessoa arruma num aparece no
 * outro. Muda só a grade: no celular, uma coluna com os pequenos em pares; no computador, linhas de 12 colunas
 * (`linhasDoComputador`).
 */
import { useState, type CSSProperties } from 'react'
import { Icone } from '../components/Icone'
import { tx } from '../lib/textos'
import {
  adicionarCartao, cartoesDaInicio, linhasDaGrade, linhasDoComputador, moverCartao, removerCartao, type ArrumacaoInicio, type IdWidget,
} from '../lib/widgets'
import { FolhaDeCartoes } from './FolhaDeCartoes'
import { WIDGETS, type Contexto } from './widgets'

const NOME_DO_JEITO = { simples: () => tx('Simples'), equilibrado: () => tx('Equilibrado'), detalhado: () => tx('Detalhado') }

export function GradeDeCartoes({ x, computador = false }: { x: Contexto; computador?: boolean }) {
  const { c } = x
  const [folha, setFolha] = useState(false)
  const [arrumando, setArrumando] = useState(false)
  // a arrumação da pessoa (ou o modelo do jeito); o cartão sem nada para mostrar agora some, mas guarda o lugar
  const detalhe = c.perfil.detalhe
  const arrumacao = c.celular?.inicio
  const lista = c.contaNova ? [] : cartoesDaInicio(arrumacao, detalhe)
  const ids = lista.filter((id) => WIDGETS[id].disponivel(x))
  const escondidos = lista.filter((id) => !ids.includes(id))
  const agora = () => new Date().toISOString()
  const guardar = (a: ArrumacaoInicio | null) => { if (a) c.salvarCelular({ ...c.celular, v: 1, inicio: a }) }
  const adicionar = (id: IdWidget) => {
    guardar(adicionarCartao(arrumacao, detalhe, id, agora()))
    setFolha(false)
    // leva até o cartão que acabou de entrar
    window.setTimeout(() => document.querySelector(`[data-cartao="${id}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 350)
  }

  const celula = (id: IdWidget, estilo?: CSSProperties) => (
    <div key={id} className="widget-celula" data-cartao={id} style={estilo}>
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
  )

  let grade
  if (computador) {
    // linhas de 12 colunas, cada cartão com a sua largura; os da mesma linha ficam da mesma altura
    grade = (
      <div className={`widgets-pc ${arrumando ? 'arrumando' : ''}`}>
        {linhasDoComputador(ids).flatMap((l) => l.map(({ id, colunas }) => celula(id, { gridColumn: `span ${colunas}` })))}
      </div>
    )
  } else {
    // arrumando, um cartão por linha: subir e descer ficam claros
    const linhas = arrumando ? ids.map((id) => ({ tipo: 'grande' as const, ids: [id] as IdWidget[] })) : linhasDaGrade(ids)
    grade = (
      <div className={`widgets-movel ${arrumando ? 'arrumando' : ''}`}>
        {linhas.map((l) => <div key={l.ids.join()} className={`widgets-linha ${l.tipo}`}>{l.ids.map((id) => celula(id))}</div>)}
      </div>
    )
  }

  return (
    <>
      {grade}

      {!c.contaNova && (arrumando ? (
        <div className="cartoes-acoes">
          <button className="btn primario" onClick={() => setArrumando(false)}>{tx('Pronto')}</button>
          {arrumacao?.base === detalhe && (
            <button className="link" onClick={() => c.salvarCelular({ v: 1 })}>{tx('Voltar ao modelo {0}', NOME_DO_JEITO[detalhe]())}</button>
          )}
        </div>
      ) : (
        <div className="cartoes-acoes">
          <button className="cartoes-adicionar" onClick={() => setFolha(true)}><Icone nome="mais" tamanho={18} /> {tx('Adicionar cartões')}</button>
          {ids.length > 1 && <button className="cartoes-arrumar" onClick={() => setArrumando(true)}><Icone nome="ajustes" tamanho={18} /> {tx('Arrumar')}</button>}
        </div>
      ))}

      {!c.contaNova && (
        <p className="rodape-movel">
          {tx('Jeito {0}', NOME_DO_JEITO[detalhe]())} · <button className="link" onClick={c.personalizar}>{tx('Trocar')}</button>
        </p>
      )}

      {folha && <FolhaDeCartoes x={x} naTela={ids} escondidos={escondidos} aoAdicionar={adicionar} aoFechar={() => setFolha(false)} />}
    </>
  )
}

/** Cada cartão é um componente: o corpo pode ter os seus próprios ganchos sem mexer na ordem dos ganchos da tela. */
function WidgetDaLista({ id, x }: { id: IdWidget; x: Contexto }) {
  const Corpo = WIDGETS[id].Corpo
  return <Corpo {...x} />
}
