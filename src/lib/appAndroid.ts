/**
 * O app Android (README → App Android) é feito com o Capacitor: o código deste site vai dentro do APK (pasta android/) e
 * conversa direto com o Supabase, sem abrir o site. Ele é montado com `npm run app`, que gera o código no modo `app`.
 *
 * Dentro do app o Google não deixa levar a pessoa a outro meio de pagamento, como o Stripe (política de pagamentos do
 * Google Play). Por isso, no app, saem o botão de assinar, o de gerenciar a assinatura, o de atualizar o cartão e os preços,
 * e ele abre direto no login (sem a página de propaganda). O teste grátis continua, e quem já assina entra normalmente.
 * No site, nada muda.
 *
 * As versões 1.0.x do app eram o site aberto pelo Chrome (Trusted Web Activity), reconhecidas por ?app=android no endereço
 * ou pelo document.referrer; essa leitura fica enquanto houver aparelho com elas. A marca vai para a aba (sessionStorage):
 * o Chrome divide o localStorage com o site aberto no navegador, que passaria a se achar app.
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

/** É o app Android de verdade (Capacitor): o código roda de dentro do APK, em https://localhost. */
export const noAppNativo = import.meta.env.MODE === 'app'

/** Está aberto dentro do app da Play Store: sem venda nem link para pagamento. */
export const noAppAndroid = noAppNativo || detectar()

/**
 * Endereço do site, para os links que saem por e-mail (confirmar a conta, criar senha nova). No app a página é
 * https://localhost, que não existe fora do aparelho: o link abre no site, e a pessoa depois entra no app.
 */
export const ENDERECO_DO_SITE = noAppNativo ? 'https://www.opuscash.com.br' : window.location.origin
