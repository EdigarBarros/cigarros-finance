import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { coresDe, iniciaisDe, nomeDe } from '../lib/abrirConta'
import { ENDERECO_DO_SITE } from '../lib/appAndroid'
import { entrarComSenha, esperarAntesDeRecarregar, type ContaSalva } from '../lib/contas'
import { supabase } from '../lib/supabase'
import { semMovimento } from '../lib/tema'
import { tx } from '../lib/textos'
import { FundoOpus } from '../pages/FundoOpus'
import { ChaveManter, MANTER_PADRAO } from './Entrada'
import { Icone } from './Icone'
import { Marca } from './Marca'
import './senha-da-conta.css'

/** A foto da conta (ou as iniciais numa cor fixa dela): na tela de perfis e aqui. */
export function FotoDaConta({ conta }: { conta: ContaSalva }) {
  return conta.foto ? <img src={conta.foto} alt="" /> : <b aria-hidden="true">{iniciaisDe(conta) || '?'}</b>
}

type Estado = 'digitando' | 'conferindo' | 'errou' | 'certo'
/** Quantas letras enchem o anel em volta da foto (a senha mínima do cadastro). */
const ENCHE = 8

function motivo(m: string) {
  if (/failed to fetch|load failed|networkerror|network request failed/i.test(m)) return tx('Sem internet. Confira sua conexão e tente de novo.')
  if (/invalid login/i.test(m)) return tx('Senha incorreta. Tente de novo.')
  if (/email not confirmed/i.test(m)) return tx('Confirme seu e-mail pelo link que chegou na caixa de entrada.')
  return tx('Não deu para entrar agora. Tente de novo em instantes.')
}

/**
 * Ao tocar num perfil, a pessoa confirma a senha da conta no meio da
 * tela, com o e-mail já escolhido e as peças do OpusCash vagando em 3D no fundo. A foto tem um anel que enche conforme a
 * pessoa digita; senha errada faz o cartão tremer e o anel ficar vermelho; certa, o anel fecha verde, o cartão vem para perto
 * e a página recarrega na conta (com a abertura). "Manter conectado" escolhe se ela fica aberta no aparelho.
 */
export function SenhaDaConta({ conta, aoVoltar }: { conta: ContaSalva; aoVoltar: () => void }) {
  const [senha, setSenha] = useState('')
  const [ver, setVer] = useState(false)
  const [manter, setManter] = useState(MANTER_PADRAO)
  const [estado, setEstado] = useState<Estado>('digitando')
  const [aviso, setAviso] = useState<{ texto: string; ok?: boolean } | null>(null)
  const [tremidas, setTremidas] = useState(0)
  const campo = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') aoVoltar() }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [aoVoltar])

  const entrar = async (e: FormEvent) => {
    e.preventDefault()
    if (!senha || estado === 'conferindo' || estado === 'certo') return
    setEstado('conferindo'); setAviso(null)
    // a página recarrega quando a conta entra (lib/contas.ts): antes, o anel fecha verde e o cartão vem para perto
    let soltar = () => {}
    esperarAntesDeRecarregar(new Promise<void>((r) => { soltar = r }))
    // senha certa: o anel fecha verde enquanto a sessão vai para o lugar dela; a página recarrega quando ele termina
    const certo = () => { setEstado('certo'); window.setTimeout(soltar, semMovimento() ? 0 : 1100) }
    const erro = await entrarComSenha(conta.email, senha, manter, certo)
    if (erro) {
      soltar()
      setEstado('errou'); setAviso({ texto: motivo(erro) }); setTremidas((n) => n + 1); setSenha('')
      campo.current?.focus()
    }
  }

  const esqueci = async () => {
    setAviso(null)
    const { error } = await supabase.auth.resetPasswordForEmail(conta.email, { redirectTo: ENDERECO_DO_SITE })
    setAviso(error ? { texto: motivo(error.message) } : { texto: tx('Enviamos um link para {0} criar uma senha nova. Olhe também o spam.', conta.email), ok: true })
  }

  const progresso = estado === 'certo' ? 1 : Math.min(1, senha.length / ENCHE)
  const primeiro = nomeDe(conta).split(/\s+/)[0]
  const ocupado = estado === 'conferindo' || estado === 'certo'
  return (
    <div className={`sc sc-${estado}`}>
      <FundoOpus onde="topo" mouse />
      <div className="sc-veu" aria-hidden="true" />
      <header className="sc-topo">
        <button type="button" className="sc-voltar" onClick={aoVoltar}><Icone nome="esq" tamanho={18} /> {tx('Voltar')}</button>
        <Marca />
      </header>
      <form key={tremidas} className={`sc-cartao ${tremidas ? 'tremeu' : ''}`} style={{ '--p': progresso } as CSSProperties} onSubmit={(e) => void entrar(e)}>
        <div className="sc-palco">
          <svg className="sc-aro" viewBox="0 0 120 120" aria-hidden="true">
            <circle className="sc-aro-trilho" cx="60" cy="60" r="56" />
            <circle className="sc-aro-valor" cx="60" cy="60" r="56" pathLength={1} />
          </svg>
          {senha.length > 0 && <i key={senha.length} className="sc-pulso" aria-hidden="true" />}
          <span className="pf-foto sc-foto" style={coresDe(conta.id)}><FotoDaConta conta={conta} /></span>
          <span className="sc-ok" aria-hidden="true"><Icone nome="check" tamanho={22} /></span>
        </div>
        <h1>{tx('Olá, {0}', primeiro)}</h1>
        <p className="sc-email" translate="no">{conta.email}</p>
        <input type="email" name="email" autoComplete="username" value={conta.email} readOnly hidden />
        <label className="sc-campo">
          <Icone nome="escudo" tamanho={18} />
          <input ref={campo} type={ver ? 'text' : 'password'} value={senha} autoFocus autoComplete="current-password" disabled={ocupado}
            placeholder={tx('Senha desta conta')} aria-label={tx('Senha')} aria-invalid={estado === 'errou'}
            onChange={(e) => { setSenha(e.target.value); if (estado === 'errou') setEstado('digitando') }} />
          <button type="button" className="sc-olho" onClick={() => setVer(!ver)} aria-label={ver ? tx('Esconder senha') : tx('Mostrar senha')}>
            <Icone nome={ver ? 'olho-fechado' : 'olho'} tamanho={18} />
          </button>
          <i className="sc-linha" aria-hidden="true" />
        </label>
        <ChaveManter ligada={manter} mudar={setManter} />
        <button className="sc-entrar" disabled={!senha || ocupado}>
          {estado === 'conferindo' ? <span className="en-girando" aria-label={tx('Aguarde')} />
            : estado === 'certo' ? <><Icone nome="check" tamanho={18} /> {tx('Tudo certo')}</>
            : <>{tx('Entrar')} <Icone nome="seta" tamanho={17} /></>}
        </button>
        {aviso && <p className={`en-aviso ${aviso.ok ? 'ok' : ''}`} role="alert">{aviso.texto}</p>}
        <button type="button" className="link sc-esqueci" onClick={() => void esqueci()} disabled={ocupado}>{tx('Esqueci minha senha')}</button>
      </form>
    </div>
  )
}
