import { useEffect } from 'react'
import { EMAIL_SUPORTE, RESPONSAVEL, type Documento } from '../lib/legal'
import { Marca } from './Marca'

const ATUALIZADO = '29 de outubro de 2026'
const contato = EMAIL_SUPORTE
  ? <a href={`mailto:${EMAIL_SUPORTE}`}>{EMAIL_SUPORTE}</a>
  : 'o e-mail de suporte indicado no aplicativo'

/** Links dos dois documentos, para rodapés. */
export function LinksLegais() {
  return (
    <span className="legal-links">
      <a href="#/termos">Termos de uso</a> · <a href="#/privacidade">Política de privacidade</a>
      {EMAIL_SUPORTE && <> · <a href={`mailto:${EMAIL_SUPORTE}`}>Suporte</a></>}
    </span>
  )
}

/** Página pública (sem login) com os Termos de uso ou a Política de privacidade. */
export function PaginaLegal({ doc }: { doc: Documento }) {
  useEffect(() => {
    const antes = document.title
    document.title = doc === 'termos' ? 'Termos de uso · OpusCash' : 'Política de privacidade · OpusCash'
    window.scrollTo(0, 0)
    return () => { document.title = antes }
  }, [doc])
  const voltar = () => { window.location.hash = ''; window.history.replaceState(null, '', window.location.pathname) ; window.dispatchEvent(new HashChangeEvent('hashchange')) }

  return (
    <div className="legal">
      <header className="legal-topo">
        <Marca compacta />
        <button className="link" onClick={voltar}>← Voltar ao app</button>
      </header>
      <article className="legal-texto">
        {doc === 'termos' ? <Termos /> : <Privacidade />}
        <p className="legal-fim">Última atualização: {ATUALIZADO}. Dúvidas: {contato}.</p>
        <p className="legal-fim"><LinksLegais /></p>
      </article>
    </div>
  )
}

function Termos() {
  return (
    <>
      <h1>Termos de uso</h1>
      <p>Estes termos valem para quem usa o OpusCash, aplicativo de controle de finanças pessoais oferecido por {RESPONSAVEL}. Ao criar uma conta ou assinar, você concorda com eles.</p>

      <h2>1. O que é o OpusCash</h2>
      <p>É uma ferramenta para você registrar entradas, saídas, cartões, dívidas, metas e outros dados financeiros e acompanhar sua situação. O OpusCash <strong>não é consultoria financeira, contábil, jurídica ou de investimentos</strong>: os números e as sugestões do app são calculados a partir do que você mesmo informa e servem de apoio, não de garantia. As decisões financeiras são suas.</p>

      <h2>2. Sua conta</h2>
      <p>Você precisa ter 18 anos ou mais (ou ser autorizado por responsável legal), informar um e-mail válido e manter sua senha em segredo. Você responde pelo que acontece na sua conta. Se achar que alguém acessou sem permissão, avise pelo suporte e troque a senha.</p>

      <h2>3. Teste grátis, assinatura e cobrança</h2>
      <ul>
        <li><strong>Teste grátis:</strong> contas novas têm 7 dias grátis, uma vez por pessoa e por cartão. É preciso cadastrar um cartão para começar. Se o mesmo cartão já tiver sido usado no teste de outra conta, o teste não é concedido e a cobrança começa na hora.</li>
        <li><strong>Cobrança automática:</strong> se você não cancelar até o fim dos 7 dias, a assinatura começa e o cartão é cobrado todo mês, de forma recorrente, até você cancelar.</li>
        <li><strong>Preço:</strong> R$ 9,99 por mês. Para quem paga em outra moeda, o valor é o equivalente definido para ela e mostrado na página de pagamento, <strong>antes</strong> de você confirmar. Impostos e tarifas do seu banco ou operadora de cartão, quando houver, não estão incluídos.</li>
        <li><strong>Pagamento:</strong> é processado pelo Stripe. O OpusCash não recebe nem guarda o número do seu cartão.</li>
        <li><strong>Mudança de preço:</strong> podemos alterar o valor para cobranças futuras, avisando você com antecedência razoável. Se não concordar, é só cancelar antes da renovação.</li>
        <li><strong>Falha na cobrança:</strong> se o pagamento não for aprovado, o Stripe tenta cobrar de novo por alguns dias e você segue com acesso, com um aviso para atualizar o cartão. Se as tentativas falharem, o acesso ao painel é bloqueado até a regularização.</li>
      </ul>

      <h2>4. Como cancelar</h2>
      <p>Você cancela quando quiser em <strong>Configurações → Conta → Gerenciar assinatura</strong>, sem multa e sem precisar falar com ninguém. Cancelando durante o teste grátis, nada é cobrado. Cancelando depois, você continua usando até o fim do período já pago e não há nova cobrança.</p>

      <h2>5. Reembolso</h2>
      <p>Se você contratou pela internet no Brasil, pode desistir em até 7 dias corridos da primeira cobrança e receber o valor de volta (direito de arrependimento do Código de Defesa do Consumidor). Para pedir, escreva para {contato}. Fora desse prazo não fazemos reembolso proporcional de períodos já iniciados, salvo quando a lei exigir ou em caso de falha nossa.</p>

      <h2>6. Seus dados</h2>
      <p>Os lançamentos e demais informações que você registra são seus. Você pode exportar um backup (Excel), apagar seus dados e excluir a conta inteira dentro do app quando quiser (Configurações → Conta → Excluir minha conta). Como tratamos dados pessoais está na <a href="#/privacidade">Política de privacidade</a>.</p>
      <p>Se a assinatura terminar ou for cancelada, o acesso fica bloqueado, mas seus dados continuam guardados para você poder voltar. Para levar seus dados, faça o backup enquanto tiver acesso, ou peça ajuda ao suporte. Contas sem assinatura e sem uso por muito tempo podem ser apagadas, sempre com aviso prévio por e-mail.</p>

      <h2>7. Uso adequado</h2>
      <p>Você não pode usar o app para atividades ilegais, tentar burlar a cobrança ou o bloqueio de acesso, acessar contas de outras pessoas, sobrecarregar ou atacar o sistema, nem copiar ou revender o serviço. Podemos suspender contas que violem isto.</p>

      <h2>8. Disponibilidade e responsabilidade</h2>
      <p>Trabalhamos para o serviço funcionar bem, mas ele pode ficar indisponível por manutenção ou por falhas de terceiros (hospedagem, pagamento, internet). Cotações de moedas vêm de fontes externas e podem ter atraso ou diferença em relação à do seu banco. Na máxima extensão permitida pela lei, não respondemos por perdas indiretas decorrentes do uso do app, e nossa responsabilidade total fica limitada ao valor que você pagou nos últimos 12 meses. Nada aqui retira direitos que a lei do consumidor garante a você.</p>

      <h2>9. Mudanças nestes termos</h2>
      <p>Podemos atualizar estes termos. Mudanças importantes serão avisadas no app ou por e-mail. Continuar usando depois do aviso significa que você aceita a nova versão.</p>

      <h2>10. Lei e contato</h2>
      <p>Estes termos seguem as leis do Brasil. Para consumidores, vale o foro do seu domicílio. Dúvidas, reclamações e pedidos: {contato}.</p>
    </>
  )
}

function Privacidade() {
  return (
    <>
      <h1>Política de privacidade</h1>
      <p>Aqui explicamos quais dados do OpusCash coletamos, para quê, com quem compartilhamos e quais são seus direitos, conforme a Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018). O controlador dos dados é {RESPONSAVEL}.</p>

      <h2>1. Quais dados tratamos</h2>
      <ul>
        <li><strong>Conta:</strong> e-mail, senha (guardada de forma criptografada, nunca em texto) e o nome que você informar.</li>
        <li><strong>O que você registra:</strong> lançamentos, categorias, bancos, cartões, dívidas, metas, contas do mês, saldos guardados e preferências, além da foto de perfil, se você colocar. Tudo isso é informado por você e pode incluir dados financeiros sensíveis para você; por isso o acesso é restrito à sua conta.</li>
        <li><strong>Assinatura:</strong> situação do plano (teste, ativa, cancelada), datas e moeda. Os dados do cartão e de cobrança ficam com o Stripe; nós não vemos nem guardamos o número do cartão. Guardamos apenas uma identificação irreversível do cartão (fingerprint, calculada pelo Stripe) para impedir que o mesmo cartão receba o teste grátis mais de uma vez; ela não permite descobrir o número.</li>
        <li><strong>Dados técnicos:</strong> o navegador guarda no seu aparelho algumas preferências (tema, última cotação). Quando uma tela do app falha, registramos a mensagem de erro, a tela em que ocorreu e o seu identificador de conta, para consertar o problema (sem os valores dos seus lançamentos). Não usamos cookies de publicidade nem rastreadores de terceiros.</li>
      </ul>

      <h2>2. Para que usamos</h2>
      <ul>
        <li>Fazer o aplicativo funcionar e guardar seus dados (execução do contrato).</li>
        <li>Cobrar a assinatura, controlar teste e acesso, e emitir comprovantes (execução do contrato e obrigações legais).</li>
        <li>Responder seus pedidos de suporte e avisar sobre mudanças importantes.</li>
        <li>Manter a segurança, corrigir erros e prevenir fraudes e abusos, como o uso repetido do teste grátis (legítimo interesse).</li>
      </ul>
      <p>Não vendemos seus dados nem os usamos para publicidade. Não lemos seus lançamentos, exceto, com sua autorização, para resolver um problema de suporte.</p>

      <h2>3. Com quem compartilhamos</h2>
      <ul>
        <li><strong>Supabase:</strong> banco de dados e login, onde seus dados ficam guardados.</li>
        <li><strong>Stripe:</strong> processa pagamentos e assinaturas. Recebe seu e-mail e os dados de pagamento que você informa na página dele.</li>
        <li><strong>Hospedagem do site (Vercel):</strong> entrega o aplicativo ao seu navegador.</li>
        <li><strong>Serviços de cotação de moedas:</strong> o app consulta cotações públicas; só os códigos das moedas vão na consulta, nenhum dado seu.</li>
      </ul>
      <p>Também podemos compartilhar dados quando a lei ou uma ordem de autoridade exigir.</p>

      <h2>4. Transferência internacional</h2>
      <p>Esses fornecedores podem tratar dados em outros países. Escolhemos serviços com medidas de segurança adequadas e contratos de proteção de dados. Usuários de outros países, como a Argentina, também têm os direitos da legislação local de proteção de dados pessoais.</p>

      <h2>5. Por quanto tempo guardamos</h2>
      <p>Seus dados ficam enquanto sua conta existir. Você pode excluir a conta a qualquer momento dentro do app: o login e todos os seus dados são apagados na hora e a assinatura é cancelada. Fica apenas o que a lei nos obrigue a guardar (por exemplo, registros de cobrança no Stripe) e a identificação irreversível do cartão usada contra repetição do teste grátis. Contas sem assinatura e sem uso por muito tempo podem ser apagadas, com aviso prévio por e-mail.</p>

      <h2>6. Seus direitos</h2>
      <p>Você pode pedir: confirmação de que tratamos seus dados, acesso, correção, anonimização ou eliminação, portabilidade, informações sobre compartilhamento e a revogação de consentimentos. Dentro do app você já consegue <strong>exportar um backup</strong> dos seus dados, <strong>apagá-los</strong> e <strong>excluir a conta</strong> (Configurações). Para qualquer pedido, escreva para {contato}. Também é possível reclamar à Autoridade Nacional de Proteção de Dados (ANPD).</p>

      <h2>7. Segurança</h2>
      <p>Cada conta só enxerga os próprios dados (isolamento por usuário no banco), a comunicação é criptografada e as senhas são guardadas de forma segura. Nenhum sistema é infalível: se houver um incidente que possa afetar você, avisaremos como a lei determina.</p>

      <h2>8. Crianças</h2>
      <p>O OpusCash não é voltado a menores de 18 anos.</p>

      <h2>9. Mudanças nesta política</h2>
      <p>Podemos atualizar este texto. Mudanças importantes serão avisadas no app ou por e-mail, e a data de atualização aparece no fim da página.</p>

      <h2>10. Contato</h2>
      <p>Dúvidas e pedidos sobre seus dados: {contato}.</p>
    </>
  )
}
