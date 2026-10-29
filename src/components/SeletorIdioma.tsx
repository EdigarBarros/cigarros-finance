import { useTranslation } from 'react-i18next'

export function SeletorIdioma({ aoFechar }: { aoFechar?: () => void }) {
  const { i18n, t } = useTranslation()

  const idiomas = [
    { codigo: 'pt-BR', nome: t('idiomas.portugues'), bandeira: '🇧🇷' },
    { codigo: 'en-US', nome: t('idiomas.ingles'), bandeira: '🇺🇸' },
    { codigo: 'es-ES', nome: t('idiomas.espanhol'), bandeira: '🇪🇸' },
  ]

  const trocarIdioma = (codigo: string) => {
    i18n.changeLanguage(codigo)
    aoFechar?.()
  }

  return (
    <div className="seletor-idioma-lista">
      {idiomas.map((idioma) => (
        <button
          key={idioma.codigo}
          className={`idioma-opcao ${i18n.language === idioma.codigo ? 'ativo' : ''}`}
          onClick={() => trocarIdioma(idioma.codigo)}
        >
          <span className="bandeira">{idioma.bandeira}</span>
          <span>{idioma.nome}</span>
        </button>
      ))}
    </div>
  )
}