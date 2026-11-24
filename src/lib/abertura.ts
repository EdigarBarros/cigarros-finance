import { useEffect, useSyncExternalStore } from 'react'
import { usuarioDaSessao } from './sessaoDaAba'

/**
 * Tela de abertura (components/Abertura.tsx): uma camada só, por cima de tudo, que entra quando alguma parte do app está
 * carregando e sai com animação quando todas terminam. Cada tela de carregamento "segura" a abertura enquanto está na tela;
 * como elas se sucedem (sessão → assinatura → painel → dados), a camada não pisca entre uma e outra.
 */
let seguras = 0
const ouvintes = new Set<() => void>()
const avisar = () => ouvintes.forEach((f) => f())

export function segurarAbertura() {
  seguras += 1
  avisar()
  let solto = false
  return () => {
    if (solto) return
    solto = true
    seguras -= 1
    avisar()
  }
}

/** Enquanto o componente estiver na tela, a abertura fica. */
export function useSegurarAbertura(ligado = true) {
  useEffect(() => (ligado ? segurarAbertura() : undefined), [ligado])
}

export function useAberturaSegura() {
  return useSyncExternalStore((f) => { ouvintes.add(f); return () => ouvintes.delete(f) }, () => seguras > 0)
}

/** Há uma sessão nesta aba (quem vai cair no painel). Quem só visita a página inicial não vê a abertura. */
export function temSessaoSalva() {
  return Boolean(usuarioDaSessao())
}

/**
 * A abertura está na tela (entrando, girando ou saindo)? Quem anima por JavaScript, quadro a quadro (gráficos, números que
 * contam), espera ela sair: cada quadro desses faz a página redesenhar e mandar tudo de novo para a placa de vídeo, o que
 * roubava quadros da saída da abertura no celular (os "pulinhos"); e escondida atrás dela a animação nem era vista.
 */
let naTela = false
const ouvintesDaTela = new Set<() => void>()

/** Só a abertura (components/Abertura.tsx) chama: avisa quando entra e quando sai de vez. */
export function marcarAberturaNaTela(sim: boolean) {
  if (naTela === sim) return
  naTela = sim
  // e, enquanto ela está na tela, o painel embaixo não faz transições (abertura.css): as cores do topo mudavam devagar
  // atrás dela, e cor não anda na placa de vídeo (a página era repintada a cada quadro da saída)
  document.documentElement.toggleAttribute('data-abertura', sim)
  ouvintesDaTela.forEach((f) => f())
}

/** Roda `f` quando a abertura não estiver na tela (na hora, se ela já não estiver). Devolve como desistir. */
export function depoisDaAbertura(f: () => void): () => void {
  if (!naTela) { f(); return () => {} }
  const ver = () => { if (!naTela) { ouvintesDaTela.delete(ver); f() } }
  ouvintesDaTela.add(ver)
  return () => { ouvintesDaTela.delete(ver) }
}
