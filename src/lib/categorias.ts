import type { Categoria, Lancamento, Tipo } from './types'

/**
 * Sem a migração 5 o app continua com as 4 categorias antigas (coluna "categoria").
 * Os ids são os próprios valores antigos, para gravar de volta na mesma coluna.
 */
export const CATEGORIAS_ANTIGAS: Categoria[] = [
  { id: 'alimentacao', tipo: 'saida', nome: 'Alimentação', icone: '🍽️', cor: '#ff9f0a', papel: null, ordem: 1 },
  { id: 'transporte', tipo: 'saida', nome: 'Transporte', icone: '🚗', cor: '#0a84ff', papel: null, ordem: 2 },
  { id: 'divida', tipo: 'saida', nome: 'Dívidas', icone: '💳', cor: '#ffd60a', papel: 'divida', ordem: 3 },
  { id: 'outros', tipo: 'saida', nome: 'Outros', icone: '📦', cor: '#636366', papel: null, ordem: 4 },
  { id: 'entrada', tipo: 'entrada', nome: 'Entrada', icone: '💰', cor: '#30d158', papel: null, ordem: 1 },
]

export const SEM_CATEGORIA = { nome: 'Sem categoria', icone: '·', cor: '#55555f' }

/** Categoria de um lançamento (undefined = sem categoria). */
export function categoriaDe(l: Lancamento, cats: Categoria[], antigas: boolean): Categoria | undefined {
  if (antigas) return cats.find((c) => c.id === (l.tipo === 'entrada' ? 'entrada' : l.categoria ?? 'outros'))
  return l.categoria_id ? cats.find((c) => c.id === l.categoria_id) : undefined
}

export const ordenar = (cats: Categoria[]) => [...cats].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome))
export const doTipo = (cats: Categoria[], tipo: Tipo) => ordenar(cats.filter((c) => c.tipo === tipo))

const normal = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/**
 * Palavras que já dizem a categoria, para quem ainda não tem histórico: "iFood" → Alimentação.
 * Só vale se a pessoa tiver uma categoria com esse nome.
 */
const PISTAS: [RegExp, string][] = [
  [/ifood|rappi|restaurante|lanche|lanchonete|pizza|hamburg|mercado|supermercado|padaria|acougue|hortifruti|feira|cafe\b|almoco|jantar|delivery|atacad/, 'alimentação'],
  [/aluguel|condominio|\bluz\b|energia|enel|cemig|copel|\bagua\b|sabesp|\bgas\b|internet|iptu|reforma|faxina|diarista/, 'moradia'],
  [/uber|\b99\b|taxi|onibus|metro|gasolina|combustivel|posto|estacionamento|pedagio|ipva|oficina|mecanico|bilhete unico/, 'transporte'],
  [/farmacia|drogaria|remedio|medico|consulta|exame|dentista|plano de saude|hospital|psicolog|terapia|academia|smartfit/, 'saúde'],
  [/escola|faculdade|curso|mensalidade|livro|udemy|alura|material escolar/, 'educação'],
  [/cinema|show|\bbar\b|balada|viagem|hotel|airbnb|passagem|ingresso|jogo|steam|playstation|xbox/, 'lazer'],
  [/netflix|spotify|prime video|amazon prime|disney|hbo|\bmax\b|youtube premium|deezer|globoplay|icloud|google one|chatgpt|assinatura/, 'assinaturas'],
  [/shopee|mercado livre|amazon|magalu|shein|roupa|sapato|tenis|loja/, 'compras'],
  [/cabelo|barbearia|salao|manicure|cosmetico|perfume|estetica/, 'cuidados pessoais'],
  [/\bpet\b|petshop|racao|veterinari|vacina do/, 'pets'],
  [/imposto|darf|\bdas\b|taxa|tarifa|anuidade|multa|irpf/, 'impostos e taxas'],
  [/parcela|prestacao|emprestimo|financiamento|consignado|acordo|fatura/, 'dívidas e parcelas'],
  [/salario|holerite|pagamento mensal|adiantamento|13o|decimo terceiro|ferias/, 'salário'],
  [/freela|freelance|bico|\bextra\b|comissao|uber driver|corrida/, 'renda extra'],
  [/venda|vendi|olx|enjoei/, 'vendas'],
  [/rendimento|juros|dividendo|cdb|tesouro|poupanca/, 'rendimentos'],
  [/presente|mesada|ajuda|doacao/, 'presentes e ajuda'],
]

export function categoriaPelaDescricao(descricao: string, tipo: Tipo, cats: Categoria[]): Categoria | undefined {
  const texto = normal(descricao)
  if (!texto.trim()) return undefined
  const minhas = cats.filter((c) => c.tipo === tipo)
  for (const [re, nome] of PISTAS) {
    if (!re.test(texto)) continue
    const c = minhas.find((x) => normal(x.nome) === normal(nome))
    if (c) return c
  }
  return undefined
}

/** Fatias do "para onde foi o dinheiro": as maiores categorias e o resto junto em "Outras". */
export function fatiasDeGastos(gastos: Record<string, number>, cats: Categoria[], limite = 6) {
  const fatias = Object.entries(gastos)
    .filter(([, v]) => v > 0)
    .map(([id, valor]) => {
      const c = cats.find((x) => x.id === id) ?? SEM_CATEGORIA
      return { id, nome: c.nome, icone: c.icone, cor: c.cor, valor }
    })
    .sort((a, b) => b.valor - a.valor)
  if (fatias.length <= limite) return fatias
  const resto = fatias.slice(limite - 1).reduce((a, f) => a + f.valor, 0)
  return [...fatias.slice(0, limite - 1), { id: 'outras', nome: 'Outras', icone: '…', cor: '#48484a', valor: resto }]
}

/** Emojis e cores para escolher ao criar ou editar uma categoria. */
export const ICONES = [
  '🍽️', '🛒', '🍔', '☕', '🏠', '💡', '🚗', '⛽', '🚌', '✈️', '💊', '🏥', '📚', '🎓', '🎉', '🎮', '🎬', '📺', '🎵', '🛍️',
  '👕', '💇', '🐾', '👶', '🎁', '🧾', '💳', '🏦', '💼', '🧑‍💻', '📈', '💰', '🏷️', '🔧', '📱', '💻', '⚽', '🏋️', '❤️', '📦',
]
export const CORES = [
  '#ff9f0a', '#ffd60a', '#30d158', '#63e6e2', '#64d2ff', '#0a84ff', '#5e5ce6', '#bf5af2',
  '#ff79c6', '#ff375f', '#ff6b6b', '#a2845e', '#8e8e93', '#636366',
]
