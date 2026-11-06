/**
 * O app da Play Store (README → App Android) é este mesmo site, aberto em tela cheia. Dentro dele o Google não deixa levar a
 * pessoa a outro meio de pagamento, como o Stripe (política de pagamentos do Google Play). Por isso, no app, saem o botão de
 * assinar, o de gerenciar a assinatura, o de atualizar o cartão e os preços. O teste grátis continua, e quem já assina entra
 * normalmente. No site, nada muda.
 *
 * Como saber que é o app: ele abre o site em /?app=android (android/app/build.gradle, launchUrl). Até a versão 1.0.0 o app
 * abria em / e o reconhecimento dependia de o navegador informar quem abriu a página (document.referrer =
 * android-app://<pacote>/), o que nem todo navegador faz; essa leitura continua valendo para quem ainda tem a 1.0.0.
 * A marca fica guardada na aba (sessionStorage), porque recarregar ou navegar pode perder essa informação. Não vai para o
 * localStorage: o app divide o armazenamento com o Chrome do celular, e o site aberto no navegador passaria a se achar app.
 * Para ver o modo app no computador: abra o site com ?app=android.
 */
const PACOTE = 'br.com.opuscash.app'
const CHAVE = 'opuscash.app-android'

function detectar(): boolean {
  const abriuPeloApp = document.referrer.startsWith(`android-app://${PACOTE}`)
    || new URLSearchParams(window.location.search).get('app') === 'android'
  try {
    if (abriuPeloApp) sessionStorage.setItem(CHAVE, '1')
    return abriuPeloApp || sessionStorage.getItem(CHAVE) === '1'
  } catch {
    return abriuPeloApp
  }
}

/** Está aberto dentro do app da Play Store: sem venda nem link para pagamento. */
export const noAppAndroid = detectar()
