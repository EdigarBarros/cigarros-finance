import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

/*
 * O botão "+" fixo do celular (Painel.tsx) sem cobrir a tela:
 *  - some enquanto os botões "Lançar entrada / Lançar saída" da própria tela estão à vista (o resumo do simples, as
 *    boas-vindas, o "Comece por aqui"): seriam duas ações iguais lado a lado, e o "+" ficava em cima dos valores;
 *  - recolhe enquanto a pessoa rola para baixo (lendo) e volta assim que ela rola para cima ou chega ao topo, como nos apps
 *    de banco. Nada se perde: o "+" está sempre a um gesto, e quando ele some há outro botão de lançar na tela.
 */

const visiveis = new Set<object>()
const ouvintes = new Set<() => void>()
const avisar = () => ouvintes.forEach((f) => f())
/** A barra de abas cobre o pé da tela: botão atrás dela não está "à vista". */
const MARGEM_DA_BARRA = '0px 0px -110px 0px'

/**
 * Para pôr no contêiner dos botões de lançar de uma tela (`ref={useAcoesDeLancar()}`): enquanto eles aparecem, o "+" some.
 */
export function useAcoesDeLancar<T extends HTMLElement>() {
  const [id] = useState(() => ({}))
  const obs = useRef<IntersectionObserver | null>(null)
  return useCallback((el: T | null) => {
    obs.current?.disconnect()
    obs.current = null
    if (visiveis.delete(id)) avisar()
    if (!el || typeof IntersectionObserver === 'undefined') return
    obs.current = new IntersectionObserver(([e]) => {
      const antes = visiveis.has(id)
      if (e.isIntersecting) visiveis.add(id)
      else visiveis.delete(id)
      if (antes !== visiveis.has(id)) avisar()
    }, { rootMargin: MARGEM_DA_BARRA, threshold: 0.5 })
    obs.current.observe(el)
  }, [id])
}

const assinar = (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f) } }
const haAcoesNaTela = () => visiveis.size > 0

/** Há botões de lançar à vista na tela agora. */
export const useAcoesNaTela = () => useSyncExternalStore(assinar, haAcoesNaTela, () => false)

/** Perto do topo o "+" fica sempre à vista. */
const TOPO = 80
/** Rolagens menores que isto (tremida do dedo) não mudam nada. */
const PASSO = 10

/** Recolhido enquanto a pessoa rola para baixo; volta ao rolar para cima ou no topo. Só liga com `ligado` (celular e tablet). */
export function useRecolherAoRolar(ligado: boolean) {
  const [recolhido, setRecolhido] = useState(false)
  useEffect(() => {
    if (!ligado) return
    let ultimo = window.scrollY
    let pedido = 0
    const ver = () => {
      pedido = 0
      const y = window.scrollY
      if (y < TOPO) setRecolhido(false)
      else if (y - ultimo > PASSO) setRecolhido(true)
      else if (ultimo - y > PASSO) setRecolhido(false)
      else return
      ultimo = y
    }
    const rolou = () => { if (!pedido) pedido = requestAnimationFrame(ver) }
    window.addEventListener('scroll', rolou, { passive: true })
    return () => { window.removeEventListener('scroll', rolou); if (pedido) cancelAnimationFrame(pedido) }
  }, [ligado])
  // trocar de página volta ao topo: o "+" aparece de novo
  return ligado && recolhido
}
