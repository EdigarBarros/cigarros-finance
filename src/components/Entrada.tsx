import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Icone } from './Icone'
import { Marca } from './Marca'
import { tx } from '../lib/textos'

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
    if (error) setAviso({ texto: traduzir(error.message) })
  }

  const esqueci = async (email: string) => {
    setOcupado(true); setAviso(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
    setOcupado(false)
    setAviso(error ? { texto: traduzir(error.message) } : { texto: tx('Se esse e-mail tiver conta, enviamos um link para criar uma senha nova. Olhe também o spam.'), ok: true })
  }

  const reenviar = async (email: string) => {
    setOcupado(true); setAviso(null)
    const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: window.location.origin } })
    setOcupado(false)
    setAviso(error ? { texto: traduzir(error.message) } : { texto: tx('Reenviamos o e-mail de confirmação. Pode levar alguns minutos; olhe também o spam.'), ok: true })
  }

  const cadastrar = async (nome: string, email: string, senha: string) => {
    setOcupado(true); setAviso(null)
    // o nome vai junto e já aparece preenchido na primeira pergunta do painel
    const { data, error } = await supabase.auth.signUp({ email, password: senha, options: { data: nome ? { nome } : undefined, emailRedirectTo: window.location.origin } })
    setOcupado(false)
    if (error) setAviso({ texto: traduzir(error.message) })
    else if (!data.session) setAviso({ texto: tx('Conta criada! Confirme pelo link que chegou no seu e-mail e depois entre.'), ok: true })
  }

  return (
    <div className="en">
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
                <Chamada visivel={!criar} titulo={tx('Bom te ver')} destaque={tx('de novo.')} texto={tx('Seus lançamentos, contas e metas estão do jeitinho que você deixou.')} />
                <Chamada visivel={criar} titulo={tx('Seu dinheiro,')} destaque={tx('do seu jeito.')} texto={tx('Entradas, saídas, cartões, dívidas e metas num lugar só. Só seu.')} />
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
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [recuperar, setRecuperar] = useState(false)
  const naoConfirmado = Boolean(aviso && !aviso.ok && /confirme seu e-mail/i.test(aviso.texto))
  return (
    <form className={`en-form entrar ${ativo ? 'ativo' : ''}`} inert={!ativo} aria-hidden={!ativo}
      onSubmit={(e) => { e.preventDefault(); if (recuperar) aoEsqueci(email); else aoEnviar(email, senha) }}>
      <h1>{recuperar ? tx('Nova senha') : tx('Entrar')}</h1>
      <p className="en-sub">{recuperar ? tx('Digite seu e-mail e enviamos um link para você criar uma senha nova.') : tx('Que bom que voltou. Seu painel está esperando.')}</p>
      <Campo rotulo={tx('E-mail')} icone="email" tipo="email" valor={email} mudar={setEmail} completar="email" />
      {!recuperar && <CampoSenha valor={senha} mudar={setSenha} completar="current-password" />}
      <BotaoEnviar ocupado={ocupado}>{recuperar ? tx('Enviar link') : tx('Entrar')}</BotaoEnviar>
      {aviso && <p className={`en-aviso ${aviso.ok ? 'ok' : ''}`} role="alert">{aviso.texto}</p>}
      {naoConfirmado && email && <button type="button" className="link" onClick={() => aoReenviar(email)} disabled={ocupado}>{tx('Reenviar e-mail de confirmação')}</button>}
      <p className="en-troca">
        <button type="button" className="link" onClick={() => setRecuperar(!recuperar)}>{recuperar ? tx('Voltar para entrar') : tx('Esqueci minha senha')}</button>
      </p>
      <p className="en-troca">{tx('Novo no OpusCash?')} <button type="button" className="link" onClick={aoTrocar}>{tx('Criar conta')}</button></p>
    </form>
  )
}

function FormCriar({ ativo, ocupado, aviso, aoEnviar, aoReenviar, aoTrocar }: PropsForm & { aoEnviar: (nome: string, email: string, senha: string) => void; aoReenviar: (email: string) => void }) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const forca = Math.min(4, (senha.length >= 6 ? 1 : 0) + (senha.length >= 10 ? 1 : 0) + (/\d/.test(senha) ? 1 : 0) + (/[^a-z0-9]/i.test(senha) ? 1 : 0))
  return (
    <form className={`en-form criar ${ativo ? 'ativo' : ''}`} inert={!ativo} aria-hidden={!ativo}
      onSubmit={(e) => { e.preventDefault(); aoEnviar(nome.trim(), email, senha) }}>
      <h1>{tx('Criar conta')}</h1>
      <p className="en-sub">{tx('Leva menos de um minuto.')}</p>
      <Campo rotulo={tx('Como quer ser chamado')} icone="pessoa" valor={nome} mudar={setNome} completar="nickname" obrigatorio={false} />
      <Campo rotulo={tx('E-mail')} icone="email" tipo="email" valor={email} mudar={setEmail} completar="email" />
      <CampoSenha valor={senha} mudar={setSenha} completar="new-password" />
      <div className={`en-forca f${senha ? forca : 0}`} aria-hidden="true">
        <span><i /><i /><i /><i /></span>
        <small>{!senha ? tx('Use 6 caracteres ou mais') : senha.length < 6 ? tx('Faltam {0}', 6 - senha.length) : ['', tx('Senha fraca'), tx('Senha razoável'), tx('Senha boa'), tx('Senha forte')][forca]}</small>
      </div>
      <BotaoEnviar ocupado={ocupado}>{tx('Criar conta')}</BotaoEnviar>
      {aviso && <p className={`en-aviso ${aviso.ok ? 'ok' : ''}`} role="alert">{aviso.texto}</p>}
      {aviso?.ok && email && <button type="button" className="link" onClick={() => aoReenviar(email)} disabled={ocupado}>{tx('Não chegou? Reenviar e-mail')}</button>}
      <p className="en-termos">{tx('Ao criar a conta, você concorda com os')} <a href="#/termos">{tx('Termos de uso')}</a> {tx('e a')} <a href="#/privacidade">{tx('Política de privacidade')}</a>.</p>
      <p className="en-troca">{tx('Já tem conta?')} <button type="button" className="link" onClick={aoTrocar}>{tx('Entrar')}</button></p>
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
    <Campo rotulo={tx('Senha')} icone="olho" tipo={ver ? 'text' : 'password'} valor={valor} mudar={mudar} completar={completar}>
      <button type="button" className="en-icone en-olho" onClick={() => setVer(!ver)} aria-label={ver ? tx('Esconder senha') : tx('Mostrar senha')}>
        <Icone nome={ver ? 'olho-fechado' : 'olho'} tamanho={17} />
      </button>
    </Campo>
  )
}

function BotaoEnviar({ ocupado, children }: { ocupado: boolean; children: React.ReactNode }) {
  return (
    <button className="en-botao" disabled={ocupado}>
      {ocupado ? <span className="en-girando" aria-label={tx('Aguarde')} /> : <>{children} <Icone nome="seta" tamanho={17} /></>}
    </button>
  )
}

function traduzir(m: string) {
  if (/invalid login/i.test(m)) return tx('E-mail ou senha incorretos.')
  if (/email not confirmed/i.test(m)) return tx('Confirme seu e-mail pelo link que chegou na caixa de entrada.')
  if (/already registered/i.test(m)) return tx('Esse e-mail já tem conta. Toque em "Entrar".')
  if (/signups not allowed/i.test(m)) return tx('Cadastro de novas contas está desativado.')
  if (/not authorized|sending confirmation|sending.*email/i.test(m))
    return tx('Não foi possível enviar o e-mail de confirmação. Avise o dono do site para liberar o cadastro.')
  if (/weak|pwned|compromised|easy to guess/i.test(m)) return tx('Essa senha é muito comum ou já vazou em algum site. Escolha outra.')
  if (/same.*password|different from the old/i.test(m)) return tx('A senha nova precisa ser diferente da antiga.')
  if (/rate limit|too many/i.test(m)) return tx('Muitas tentativas seguidas. Espere alguns minutos e tente de novo.')
  if (/password should be at least/i.test(m)) return tx('A senha precisa ter pelo menos 6 caracteres.')
  if (/invalid.*email|unable to validate email/i.test(m)) return tx('Esse e-mail não parece válido.')
  return m
}

export function Configuracao() {
  return (
    <div className="tela-central">
      <div className="cartao login">
        <div className="login-marca">
          <Marca grande />
        </div>
        <h1>{tx('Falta conectar o banco de dados')}</h1>
        <p>
          {tx('Defina as variáveis')} <code>VITE_SUPABASE_URL</code> {tx('e')} <code>VITE_SUPABASE_ANON_KEY</code> (arquivo <code>{tx('.env')}</code> {tx('no computador, ou em Environment Variables na Vercel/Netlify) e publique de novo. O passo a passo está no README.')}
        </p>
      </div>
    </div>
  )
}

/** Tela de nova senha, aberta pelo link que chega no e-mail de "Esqueci minha senha". */
export function NovaSenha({ aoConcluir }: { aoConcluir: () => void }) {
  const [senha, setSenha] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState<Aviso>(null)
  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    setOcupado(true); setAviso(null)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setOcupado(false)
    if (error) setAviso({ texto: traduzir(error.message) })
    else { setAviso({ texto: tx('Senha trocada! Entrando…'), ok: true }); window.setTimeout(aoConcluir, 900) }
  }
  return (
    <div className="en" style={{ display: 'grid' }}>
      <form className="en-form ativo" onSubmit={salvar}>
        <Marca grande />
        <h1>{tx('Criar senha nova')}</h1>
        <p className="en-sub">{tx('Escolha a senha nova da sua conta.')}</p>
        <CampoSenha valor={senha} mudar={setSenha} completar="new-password" />
        <BotaoEnviar ocupado={ocupado}>{tx('Salvar senha')}</BotaoEnviar>
        {aviso && <p className={`en-aviso ${aviso.ok ? 'ok' : ''}`} role="alert">{aviso.texto}</p>}
      </form>
    </div>
  )
}
