import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Marca } from './Marca'

/** Tela de login. Cada pessoa tem seus próprios dados (protegidos no banco por RLS). */
export function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [criar, setCriar] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setOcupado(true)
    setMsg(null)
    const { data, error } = criar
      ? await supabase.auth.signUp({ email, password: senha })
      : await supabase.auth.signInWithPassword({ email, password: senha })
    setOcupado(false)
    if (error) setMsg(traduzir(error.message))
    else if (criar && !data.session) setMsg('Conta criada! Confirme pelo link que chegou no seu e-mail e depois entre.')
  }

  return (
    <div className="tela-central">
      <form className="cartao login" onSubmit={enviar}>
        <div className="login-marca">
          <Marca grande />
          <p>{criar ? 'Crie sua conta para começar' : 'Entre na sua conta'}</p>
        </div>
        <label>
          E-mail
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>
        <label>
          Senha
          <input
            type="password"
            required
            minLength={6}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete={criar ? 'new-password' : 'current-password'}
          />
        </label>
        <button className="btn gradiente" disabled={ocupado}>{criar ? 'Criar conta' : 'Entrar'}</button>
        {msg && <p className="aviso">{msg}</p>}
        <button type="button" className="link" onClick={() => setCriar(!criar)}>
          {criar ? 'Já tenho conta. Entrar' : 'Ainda não tem conta? Criar conta'}
        </button>
      </form>
    </div>
  )
}

function traduzir(m: string) {
  if (/invalid login/i.test(m)) return 'E-mail ou senha incorretos.'
  if (/email not confirmed/i.test(m)) return 'Confirme seu e-mail pelo link que chegou na caixa de entrada.'
  if (/already registered/i.test(m)) return 'Esse e-mail já tem conta. Toque em "Já tenho conta".'
  if (/signups not allowed/i.test(m)) return 'Cadastro de novas contas está desativado.'
  if (/not authorized|sending confirmation|sending.*email/i.test(m))
    return 'Não foi possível enviar o e-mail de confirmação. Avise o dono do site para liberar o cadastro.'
  if (/rate limit|too many/i.test(m)) return 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.'
  if (/password should be at least/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.'
  if (/invalid.*email|unable to validate email/i.test(m)) return 'Esse e-mail não parece válido.'
  return m
}

export function Configuracao() {
  return (
    <div className="tela-central">
      <div className="cartao login">
        <div className="login-marca">
          <Marca grande />
        </div>
        <h1>Falta conectar o banco de dados</h1>
        <p>
          Defina as variáveis <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> (arquivo <code>.env</code> no
          computador, ou em Environment Variables na Vercel/Netlify) e publique de novo. O passo a passo está no README.
        </p>
      </div>
    </div>
  )
}
