import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { Icone } from './Icone'
import { Marca } from './Marca'
import { SeletorIdioma } from './SeletorIdioma'

type Modo = 'entrar' | 'criar'
type Aviso = { texto: string; ok?: boolean } | null

/**
 * Tela de entrada, ocupando a tela toda. Dividida em dois: de um lado o formulário, do outro o painel da marca. Ao trocar entre
 * "Entrar" e "Criar conta", uma lâmina diagonal varre a tela e leva o painel (com a logo) para o outro lado (as bordas do recorte
 * são propriedades CSS animadas; veja .en-lamina). No celular o painel fica em cima; ao trocar, ele desce como uma cortina diagonal,
 * cobre a tela levando a logo junto, o formulário troca por baixo e a cortina sobe de volta inclinada para o outro lado.
 * Cada pessoa tem seus próprios dados (protegidos no banco por RLS).
 */
export function Login({ inicial = 'entrar' }: { inicial?: Modo }) {
  const { t } = useTranslation()
  const [modo, setModo] = useState<Modo>(inicial)
  const [aviso, setAviso] = useState<Aviso>(null)
  const [ocupado, setOcupado] = useState(false)
  const [trocou, setTrocou] = useState(false) // a cortina do celular só corre depois da primeira troca, não ao abrir a tela
  const criar = modo === 'criar'

  const trocar = (m: Modo) => { setModo(m); setAviso(null); setTrocou(true) }

  const entrar = async (email: string, senha: string) => {
    setOcupado(true); setAviso(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    setOcupado(false)
    if (error) setAviso({ texto: traduzir(error.message, t) })
  }

  const esqueci = async (email: string) => {
    setOcupado(true); setAviso(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
    setOcupado(false)
    setAviso(error ? { texto: traduzir(error.message, t) } : { texto: t('login.esqueciSucesso'), ok: true })
  }

  const reenviar = async (email: string) => {
    setOcupado(true); setAviso(null)
    const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: window.location.origin } })
    setOcupado(false)
    setAviso(error ? { texto: traduzir(error.message, t) } : { texto: t('login.reenviarSucesso'), ok: true })
  }

  const cadastrar = async (nome: string, email: string, senha: string) => {
    setOcupado(true); setAviso(null)
    // o nome vai junto e já aparece preenchido na primeira pergunta do painel
    const { data, error } = await supabase.auth.signUp({ email, password: senha, options: { data: nome ? { nome } : undefined, emailRedirectTo: window.location.origin } })
    setOcupado(false)
    if (error) setAviso({ texto: traduzir(error.message, t) })
    else if (!data.session) setAviso({ texto: t('login.contaCriada'), ok: true })
  }

  const [mostrarIdiomas, setMostrarIdiomas] = useState(false)

  return (
    <div className="en">
      <button
        className="en-idioma-botao"
        onClick={() => setMostrarIdiomas(!mostrarIdiomas)}
        aria-label={t('idiomas.selecionar')}
        title={t('idiomas.selecionar')}
      >
        <Icone nome="globo" tamanho={20} />
      </button>
      {mostrarIdiomas && (
        <div className="en-idioma-menu">
          <SeletorIdioma aoFechar={() => setMostrarIdiomas(false)} />
        </div>
      )}
      <div className={`en-cartao ${modo} ${trocou ? 'trocou' : ''}`}>
        <FormEntrar ativo={!criar} ocupado={ocupado} aviso={!criar ? aviso : null} aoEnviar={entrar} aoEsqueci={esqueci} aoReenviar={reenviar} aoTrocar={() => trocar('criar')} />
        <FormCriar ativo={criar} ocupado={ocupado} aviso={criar ? aviso : null} aoEnviar={cadastrar} aoReenviar={reenviar} aoTrocar={() => trocar('entrar')} />

        <div className="en-lamina" aria-hidden="true">
          <i className="en-fio" />
          <div className="en-painel">
            <span className="en-brilho" />
            <div className="en-vitrine">
              <div className="en-logo">
                <i className="en-orbita" /><i className="en-orbita" /><i className="en-orbita" />
                <Marca grande />
              </div>
              <div className="en-frases">
                <Chamada visivel={!criar} titulo={t('login.bomVer')} destaque={t('login.deNovo')} texto={t('login.textoEntrar')} />
                <Chamada visivel={criar} titulo={t('login.seuDinheiro')} destaque={t('login.doSeuJeito')} texto={t('login.textoCriar')} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Chamada({ visivel, titulo, destaque, texto }: { visivel: boolean; titulo: string; destaque: string; texto: string }) {
  return (
    <div className={`en-chamada ${visivel ? 'visivel' : ''}`}>
      <h2>{titulo} <em>{destaque}</em></h2>
      <p>{texto}</p>
    </div>
  )
}

type PropsForm = { ativo: boolean; ocupado: boolean; aviso: Aviso; aoTrocar: () => void }

function FormEntrar({ ativo, ocupado, aviso, aoEnviar, aoEsqueci, aoReenviar, aoTrocar }: PropsForm & {
  aoEnviar: (email: string, senha: string) => void; aoEsqueci: (email: string) => void; aoReenviar: (email: string) => void
}) {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [recuperar, setRecuperar] = useState(false)
  const naoConfirmado = Boolean(aviso && !aviso.ok && /confirme seu e-mail/i.test(aviso.texto))
  return (
    <form className={`en-form entrar ${ativo ? 'ativo' : ''}`} inert={!ativo} aria-hidden={!ativo}
      onSubmit={(e) => { e.preventDefault(); if (recuperar) aoEsqueci(email); else aoEnviar(email, senha) }}>
      <h1>{recuperar ? t('login.novaSenha') : t('login.entrar')}</h1>
      <p className="en-sub">{recuperar ? t('login.esqueciSub') : t('login.entrarSub')}</p>
      <Campo rotulo={t('login.email')} icone="email" tipo="email" valor={email} mudar={setEmail} completar="email" />
      {!recuperar && <CampoSenha valor={senha} mudar={setSenha} completar="current-password" />}
      <BotaoEnviar ocupado={ocupado}>{recuperar ? t('login.enviarLink') : t('login.entrar')}</BotaoEnviar>
      {aviso && <p className={`en-aviso ${aviso.ok ? 'ok' : ''}`} role="alert">{aviso.texto}</p>}
      {naoConfirmado && email && <button type="button" className="link" onClick={() => aoReenviar(email)} disabled={ocupado}>{t('login.reenviarConfirmacao')}</button>}
      <p className="en-troca">
        <button type="button" className="link" onClick={() => setRecuperar(!recuperar)}>{recuperar ? t('login.voltarEntrar') : t('login.esqueciSenha')}</button>
      </p>
      <p className="en-troca">{t('login.novoAqui')} <button type="button" className="link" onClick={aoTrocar}>{t('login.criarConta')}</button></p>
    </form>
  )
}

function FormCriar({ ativo, ocupado, aviso, aoEnviar, aoReenviar, aoTrocar }: PropsForm & { aoEnviar: (nome: string, email: string, senha: string) => void; aoReenviar: (email: string) => void }) {
  const { t } = useTranslation()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const forca = Math.min(4, (senha.length >= 6 ? 1 : 0) + (senha.length >= 10 ? 1 : 0) + (/\d/.test(senha) ? 1 : 0) + (/[^a-z0-9]/i.test(senha) ? 1 : 0))
  return (
    <form className={`en-form criar ${ativo ? 'ativo' : ''}`} inert={!ativo} aria-hidden={!ativo}
      onSubmit={(e) => { e.preventDefault(); aoEnviar(nome.trim(), email, senha) }}>
      <h1>{t('login.criarConta')}</h1>
      <p className="en-sub">{t('login.criarSub')}</p>
      <Campo rotulo={t('login.comoChamar')} icone="pessoa" valor={nome} mudar={setNome} completar="nickname" obrigatorio={false} />
      <Campo rotulo={t('login.email')} icone="email" tipo="email" valor={email} mudar={setEmail} completar="email" />
      <CampoSenha valor={senha} mudar={setSenha} completar="new-password" />
      <div className={`en-forca f${senha ? forca : 0}`} aria-hidden="true">
        <span><i /><i /><i /><i /></span>
        <small>{!senha ? t('login.senhaDica') : senha.length < 6 ? t('login.senhaFalta', { falta: 6 - senha.length }) : ['', t('login.senhaFraca'), t('login.senhaRazoavel'), t('login.senhaBoa'), t('login.senhaForte')][forca]}</small>
      </div>
      <BotaoEnviar ocupado={ocupado}>{t('login.criarConta')}</BotaoEnviar>
      {aviso && <p className={`en-aviso ${aviso.ok ? 'ok' : ''}`} role="alert">{aviso.texto}</p>}
      {aviso?.ok && email && <button type="button" className="link" onClick={() => aoReenviar(email)} disabled={ocupado}>{t('login.reenviarEmail')}</button>}
      <p className="en-termos">{t('login.termos')} <a href="#/termos">{t('login.termosUso')}</a> {t('login.e')} <a href="#/privacidade">{t('login.politicaPrivacidade')}</a>.</p>
      <p className="en-troca">{t('login.jaTemConta')} <button type="button" className="link" onClick={aoTrocar}>{t('login.entrar')}</button></p>
    </form>
  )
}

/** Campo com linha embaixo: o rótulo começa dentro e sobe ao focar ou preencher. */
function Campo({ rotulo, icone, tipo = 'text', valor, mudar, completar, obrigatorio = true, children }: {
  rotulo: string; icone: string; tipo?: string; valor: string; mudar: (v: string) => void; completar: string; obrigatorio?: boolean
  children?: React.ReactNode
}) {
  return (
    <label className="en-campo">
      <input type={tipo} placeholder=" " required={obrigatorio} minLength={tipo === 'password' ? 6 : undefined}
        value={valor} onChange={(e) => mudar(e.target.value)} autoComplete={completar} />
      <span className="en-rotulo">{rotulo}</span>
      {children ?? <span className="en-icone"><Icone nome={icone} tamanho={17} /></span>}
      <i className="en-linha" />
    </label>
  )
}

function CampoSenha({ valor, mudar, completar }: { valor: string; mudar: (v: string) => void; completar: string }) {
  const [ver, setVer] = useState(false)
  return (
    <Campo rotulo="Senha" icone="olho" tipo={ver ? 'text' : 'password'} valor={valor} mudar={mudar} completar={completar}>
      <button type="button" className="en-icone en-olho" onClick={() => setVer(!ver)} aria-label={ver ? 'Esconder senha' : 'Mostrar senha'}>
        <Icone nome={ver ? 'olho-fechado' : 'olho'} tamanho={17} />
      </button>
    </Campo>
  )
}

function BotaoEnviar({ ocupado, children }: { ocupado: boolean; children: React.ReactNode }) {
  return (
    <button className="en-botao" disabled={ocupado}>
      {ocupado ? <span className="en-girando" aria-label="Aguarde" /> : <>{children} <Icone nome="seta" tamanho={17} /></>}
    </button>
  )
}

function traduzir(m: string, t: (key: string) => string) {
  if (/invalid login/i.test(m)) return t('login.erros.invalidLogin')
  if (/email not confirmed/i.test(m)) return t('login.erros.emailNaoConfirmado')
  if (/already registered/i.test(m)) return t('login.erros.jaRegistrado')
  if (/signups not allowed/i.test(m)) return t('login.erros.cadastroDesativado')
  if (/not authorized|sending confirmation|sending.*email/i.test(m))
    return t('login.erros.envioEmail')
  if (/weak|pwned|compromised|easy to guess/i.test(m)) return t('login.erros.senhaFraca')
  if (/same.*password|different from the old/i.test(m)) return t('login.erros.senhaIgual')
  if (/rate limit|too many/i.test(m)) return t('login.erros.muitasTentativas')
  if (/password should be at least/i.test(m)) return t('login.erros.senhaCurta')
  if (/invalid.*email|unable to validate email/i.test(m)) return t('login.erros.emailInvalido')
  return m
}

export function Configuracao() {
  const { t } = useTranslation()
  return (
    <div className="tela-central">
      <div className="cartao login">
        <div className="login-marca">
          <Marca grande />
        </div>
        <h1>{t('config.faltaBanco')}</h1>
        <p>
          {t('config.definaVariaveis')} <code>VITE_SUPABASE_URL</code> {t('config.e')} <code>VITE_SUPABASE_ANON_KEY</code> ({t('config.arquivoEnv')} <code>.env</code> {t('config.noComputador')}, {t('config.ouEm')} Environment Variables {t('config.naVercel')}) {t('config.ePubliqueNovo')}. {t('config.passoAPassoReadme')}
        </p>
      </div>
    </div>
  )
}

/** Tela de nova senha, aberta pelo link que chega no e-mail de "Esqueci minha senha". */
export function NovaSenha({ aoConcluir }: { aoConcluir: () => void }) {
  const { t } = useTranslation()
  const [senha, setSenha] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState<Aviso>(null)
  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    setOcupado(true); setAviso(null)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setOcupado(false)
    if (error) setAviso({ texto: traduzir(error.message, t) })
    else { setAviso({ texto: t('login.senhaTrocada'), ok: true }); window.setTimeout(aoConcluir, 900) }
  }
  return (
    <div className="en" style={{ display: 'grid' }}>
      <form className="en-form ativo" onSubmit={salvar}>
        <Marca grande />
        <h1>{t('login.novaSenhaTitulo')}</h1>
        <p className="en-sub">{t('login.novaSenhaSub')}</p>
        <CampoSenha valor={senha} mudar={setSenha} completar="new-password" />
        <BotaoEnviar ocupado={ocupado}>{t('login.salvarSenha')}</BotaoEnviar>
        {aviso && <p className={`en-aviso ${aviso.ok ? 'ok' : ''}`} role="alert">{aviso.texto}</p>}
      </form>
    </div>
  )
}
