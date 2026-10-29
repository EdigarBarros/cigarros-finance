import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { Icone } from './Icone'
import { Marca } from './Marca'

/**
 * Tela de bloqueio que aparece quando o período de teste de 7 dias acaba.
 * Mostra uma animação bonita e oferece opções para efetuar o pagamento ou sair da conta.
 */
export function BloqueioPeriodoTeste({ aoSair }: { aoSair: () => void }) {
  const { t } = useTranslation()
  const [animacaoCompleta, setAnimacaoCompleta] = useState(false)

  useEffect(() => {
    // Ativa a animação após montar o componente
    const timer = setTimeout(() => setAnimacaoCompleta(true), 100)
    return () => clearTimeout(timer)
  }, [])

  const irParaPagamento = async () => {
    window.location.href = '/#pagamento'
  }

  return (
    <div className={`bloqueio-teste ${animacaoCompleta ? 'visivel' : ''}`}>
      <div className="bloqueio-conteudo">
        <div className="bloqueio-icone">
          <Icone nome="cadeado" tamanho={64} />
        </div>

        <h1>{t('bloqueio.titulo')}</h1>
        <p className="bloqueio-sub">{t('bloqueio.subtitulo')}</p>

        <div className="bloqueio-contador">
          <div className="contador-item">
            <span className="contador-numero">7</span>
            <span className="contador-label">{t('bloqueio.diasGratis')}</span>
          </div>
          <div className="contador-separador">→</div>
          <div className="contador-item final">
            <Icone nome="coroa" tamanho={24} />
            <span className="contador-label">{t('bloqueio.premium')}</span>
          </div>
        </div>

        <p className="bloqueio-descricao">
          {t('bloqueio.descricao')}
        </p>

        <div className="bloqueio-acoes">
          <button
            className="btn-primario btn-pagamento"
            onClick={irParaPagamento}
          >
            <Icone nome="cartao" tamanho={18} />
            {t('bloqueio.efetuarPagamento')}
          </button>

          <button
            className="btn-secundario btn-sair"
            onClick={aoSair}
          >
            <Icone nome="sair" tamanho={18} />
            {t('bloqueio.sairConta')}
          </button>
        </div>

        <div className="bloqueio-beneficios">
          <h3>{t('bloqueio.beneficiosTitulo')}</h3>
          <ul>
            <li><Icone nome="check" tamanho={16} /> {t('bloqueio.beneficio1')}</li>
            <li><Icone nome="check" tamanho={16} /> {t('bloqueio.beneficio2')}</li>
            <li><Icone nome="check" tamanho={16} /> {t('bloqueio.beneficio3')}</li>
          </ul>
        </div>
      </div>

      <div className="bloqueio-fundo">
        <div className="particula particula-1"></div>
        <div className="particula particula-2"></div>
        <div className="particula particula-3"></div>
        <div className="particula particula-4"></div>
      </div>
    </div>
  )
}