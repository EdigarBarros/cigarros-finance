import { useTranslation } from 'react-i18next'

export function SeletorIdioma() {
  const { i18n, t } = useTranslation()

  const idiomas = [
    { codigo: 'pt-BR', nome: t('idiomas.portugues') },
    { codigo: 'en-US', nome: t('idiomas.ingles') },
    { codigo: 'es-ES', nome: t('idiomas.espanhol') },
  ]

  return (
    <select
      className="seletor-idioma"
      value={i18n.language}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
      aria-label={t('idiomas.selecionar')}
    >
      {idiomas.map((idioma) => (
        <option key={idioma.codigo} value={idioma.codigo}>
          {idioma.nome}
        </option>
      ))}
    </select>
  )
}