import { useCallback, useEffect, useState } from 'react'

const CHAVE_LATERAL = 'opuscash.lateral-recolhida'
const CHAVE_ABAS = 'opuscash.abas-ocultas'

function ler(chave: string): boolean | null {
  try {
    const v = localStorage.getItem(chave)
    return v === '1' ? true : v === '0' ? false : null
  } catch { return null }
}
function gravar(chave: string, valor: boolean) {
  try { localStorage.setItem(chave, valor ? '1' : '0') } catch { /* navegador sem armazenamento: vale só nesta visita */ }
}

function useMedia(consulta: string) {
  const [ok, setOk] = useState(() => window.matchMedia(consulta).matches)
  useEffect(() => {
    const mq = window.matchMedia(consulta)
    const aoMudar = () => setOk(mq.matches)
    aoMudar()
    mq.addEventListener('change', aoMudar)
    return () => mq.removeEventListener('change', aoMudar)
  }, [consulta])
  return ok
}

/**
 * Menu do painel que pode ser escondido:
 * - computador e tablet deitado: a lateral vira uma faixa só de ícones (a escolha fica guardada; em tela estreita já começa recolhida);
 * - tablet em pé: a faixa de ícones fica sempre à vista e o menu completo abre por cima do conteúdo, sem ficar guardado;
 * - celular: não tem lateral, o que se esconde é a barra de abas de baixo (a escolha fica guardada).
 */
export function useBarraLateral() {
  const retrato = useMedia('(min-width: 601px) and (max-width: 860px)')
  const celular = useMedia('(max-width: 600px)')
  const estreita = useMedia('(max-width: 1100px)')
  const [recolhidaPref, setRecolhidaPref] = useState<boolean | null>(() => ler(CHAVE_LATERAL))
  const [abasOcultas, setAbasOcultas] = useState<boolean>(() => ler(CHAVE_ABAS) ?? false)
  const [abertaPedida, setAbertaPedida] = useState(false)

  // o menu por cima só existe no tablet em pé
  const aberta = retrato && abertaPedida
  const trilho = retrato ? !aberta : (recolhidaPref ?? estreita)

  const alternarLateral = useCallback(() => {
    if (retrato) { setAbertaPedida(!aberta); return }
    const proxima = !(recolhidaPref ?? estreita)
    setRecolhidaPref(proxima)
    gravar(CHAVE_LATERAL, proxima)
  }, [retrato, aberta, recolhidaPref, estreita])

  const alternarAbas = useCallback(() => {
    setAbasOcultas(!abasOcultas)
    gravar(CHAVE_ABAS, !abasOcultas)
  }, [abasOcultas])

  const fechar = useCallback(() => setAbertaPedida(false), [])

  return { trilho, retrato, celular, aberta, abasOcultas, alternarLateral, alternarAbas, fechar }
}
