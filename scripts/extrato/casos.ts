/**
 * Exemplos de extrato para os testes do leitor (rodar: `node scripts/extrato/testar.mjs`). Cada caso traz o arquivo e o
 * que tem de sair dele: data, e/s (entrou ou saiu), valor e um pedaço do nome. Os PDFs são escritos como texto com as
 * colunas alinhadas, como aparecem no papel; `pdf()` transforma isso nos pedaços com posição que o pdf.js entrega.
 * Achou um extrato que o leitor erra? Monte um caso parecido aqui (sem dados reais de ninguém) antes de consertar.
 */
import * as XLSX from 'xlsx'
import { deTabela, deTexto, lerCsv, lerExtrato, lerPaginasPdf, type ItemPdf, type LinhaExtrato } from '../../src/lib/extrato'

type Esperado = [data: string, tipo: 'e' | 's', valor: number, nome?: string]
interface Caso { nome: string; ler: () => LinhaExtrato[] | Promise<LinhaExtrato[]>; esperado: Esperado[] }

const ANO = 2026
/** Largura de cada letra no PDF de mentira (fonte de 9 pontos). */
const LETRA = 5

/**
 * Texto com colunas → pedaços de PDF. Páginas separadas por `\f`. Cada trecho separado por dois espaços ou mais vira um
 * pedaço (como a maioria dos PDFs de banco); com `palavras`, cada palavra vira um pedaço (como os PDFs que o pdf.js
 * entrega palavra por palavra).
 */
function pdf(texto: string, { palavras = false, letras = false } = {}): ItemPdf[][] {
  return texto.split('\f').map((pagina) => {
    const itens: ItemPdf[] = []
    pagina.split('\n').forEach((linha, i) => {
      const y = 800 - i * 12
      for (const m of linha.matchAll(letras ? /\S/g : palavras ? /\S+/g : /\S+(?: \S+)*/g)) {
        itens.push({ str: m[0], x: 30 + m.index * LETRA, y, w: m[0].length * LETRA, h: 9 })
      }
    })
    return itens
  })
}
const doPdf = (texto: string, opcoes?: { palavras?: boolean; letras?: boolean }) => () => lerPaginasPdf(pdf(texto, opcoes), ANO).linhas
const doTexto = (texto: string) => () => deTexto(texto.split('\n'), ANO)
const daTabela = (linhas: string[][]) => () => deTabela(linhas, ANO)
/** Como o site lê um arquivo de texto (CSV, TXT, OFX). */
const doArquivo = (nome: string, conteudo: string) => async () => (await lerExtrato(new File([conteudo], nome), ANO)).linhas
const csv = (texto: string) => () => deTabela(lerCsv(texto), ANO)

const BRADESCO_PDF = `Banco Bradesco S/A                                                    08/11/2026 - 21:03
Extrato de: Agência: 1234 | Conta: 56789-0           Movimentação entre: 30/09/2026 e 08/11/2026
Data        Lançamento                        Dcto.        Crédito (R$)     Débito (R$)      Saldo (R$)
30/09/2026  SALDO ANTERIOR                                                                   1.000,00
01/10/2026  TRANSFERENCIA PIX                 1234567                            114,00        886,00
            DES: MATHEUS EWERTON DE AL 01/10
            TRANSFERENCIA PIX                 7654321            120,00                      1.006,00
            REM: BEATRIZ MIRANDA DOS S 01/10
            SALDO INVEST FACIL                                                               1.136,77
02/10/2026  RENTAB.INVEST FACILCRED           0000001              0,02                      1.006,02
            VISA ELECTRON                     2222                                42,79        963,23
            PASTELLOCO 01/10
Os dados acima têm como base as informações disponíveis até este momento.
\fBanco Bradesco S/A                                                    08/11/2026 - 21:03
Data        Lançamento                        Dcto.        Crédito (R$)     Débito (R$)      Saldo (R$)
            PIX QR CODE DINAMICO              3333                                27,90        935,33
            DES: ODE DIN 02/10
03/10/2026  TRANSFERENCIA PIX                 4444             1.600,00                      2.535,33
            REM: JOAO BATISTA DE SOUZA 03/10
            PAGTO ELETRONICO TRIBUTO          5555                                87,17      2.448,16
            Total                                              1.720,02          271,86`
const BRADESCO_ESPERADO: Esperado[] = [
  ['2026-10-01', 's', 114, 'Matheus'], ['2026-10-01', 'e', 120, 'Beatriz'], ['2026-10-02', 'e', 0.02, 'Rentab'],
  ['2026-10-02', 's', 42.79, 'Pastelloco'], ['2026-10-02', 's', 27.9, 'Ode Din'], ['2026-10-03', 'e', 1600, 'Joao Batista'],
  ['2026-10-03', 's', 87.17, 'Tributo'],
]

export const CASOS: Caso[] = [
  // ---------- PDF ----------
  { nome: 'bradesco pdf', ler: doPdf(BRADESCO_PDF), esperado: BRADESCO_ESPERADO },
  { nome: 'bradesco pdf palavra por palavra', ler: doPdf(BRADESCO_PDF, { palavras: true }), esperado: BRADESCO_ESPERADO },
  { nome: 'bradesco pdf letra por letra', ler: doPdf(BRADESCO_PDF, { letras: true }), esperado: BRADESCO_ESPERADO },
  {
    nome: 'nubank conta pdf (total de entradas e de saídas por dia)',
    ler: doPdf(`Nu Pagamentos S.A. - Instituição de Pagamento        CNPJ 18.236.120/0001-58
EDIGAR TESTE                                     Agência 0001   Conta 1234567-8
Movimentações
01 OUT 2026   Total de entradas                                                    + 120,00
              Transferência recebida pelo Pix BEATRIZ MIRANDA - •••.654.321-•• - NU PAGAMENTOS - IP     120,00
              Total de saídas                                                      - 114,00
              Transferência enviada pelo Pix MATHEUS EWERTON - •••.123.456-•• - BCO BRADESCO S.A.      114,00
02 OUT 2026   Total de saídas                                                       - 42,79
              Compra no débito PASTELLOCO                                                           42,79
              Saldo do dia                                                                         963,21`),
    esperado: [['2026-10-01', 's', 114, 'Matheus'], ['2026-10-01', 'e', 120, 'Beatriz'], ['2026-10-02', 's', 42.79, 'Pastelloco']],
  },
  {
    nome: 'inter pdf (dia com saldo em cima, mais novo primeiro)',
    ler: doPdf(`Banco Inter S.A.   Extrato
Período: 01/10/2026 a 02/10/2026
2 de Outubro de 2026   Saldo do dia: R$ 963,21
Compra no débito: "PASTELLOCO"                                   -R$ 42,79       R$ 963,21
1 de Outubro de 2026   Saldo do dia: R$ 1.006,00
Pix recebido: "Cp :00000000-BEATRIZ MIRANDA"                       R$ 120,00     R$ 1.006,00
Pix enviado: "Cp :60746948-MATHEUS EWERTON"                       -R$ 114,00       R$ 886,00`),
    esperado: [['2026-10-01', 's', 114, 'Matheus'], ['2026-10-01', 'e', 120, 'Beatriz'], ['2026-10-02', 's', 42.79, 'Pastelloco']],
  },
  {
    nome: 'fatura de cartão em pdf (compras sem sinal)',
    ler: async () => {
      const linhas = await doPdf(`Olá, Edigar. Esta é a sua fatura de novembro
Data de vencimento: 10 NOV 2026          Total a pagar R$ 561,69
Limite total R$ 5.000,00
TRANSAÇÕES DE 01 OUT A 31 OUT
01 OUT     Pastelloco                                      R$ 42,79
02 OUT     Uber *Trip                                      R$ 18,90
05 OUT     Pagamento em 05 OUT                            -R$ 500,00
06 OUT     Estorno Loja X                                  -R$ 20,00`)()
      return linhas.filter((l) => !l.pagamentoDaFatura)
    },
    esperado: [['2026-10-01', 's', 42.79, 'Pastelloco'], ['2026-10-02', 's', 18.9, 'Uber'], ['2026-10-06', 'e', 20, 'Loja']],
  },
  {
    nome: 'pdf com coluna a menos na segunda página e preço no meio do nome',
    ler: doPdf(`Data        Histórico                       Docto      Crédito        Débito         Saldo
30/09/2026  SALDO ANTERIOR                                                          1.000,00
01/10/2026  COMPRA PARC 2/3 R$ 50,00 LOJA   000001                      50,00         950,00
\fData        Histórico                                  Crédito        Débito         Saldo
02/10/2026  PIX RECEBIDO BEATRIZ                         120,00                     1.070,00`),
    esperado: [['2026-10-01', 's', 50, 'Loja'], ['2026-10-02', 'e', 120, 'Beatriz']],
  },
  {
    nome: 'itau pdf (valor com sinal e saldo do dia)',
    ler: doPdf(`Itaú Unibanco S.A.    extrato conta corrente
data        lançamentos                                  valor (R$)        saldo (R$)
30/09       SALDO ANTERIOR                                                   1.000,00
01/10       PIX TRANSF MATHEUS01/10                         -114,00
01/10       PIX TRANSF BEATRIZ01/10                          120,00
01/10       SALDO DO DIA                                                     1.006,00
02/10       REND PAGO APLIC AUT MAIS                           0,02
02/10       COMPRA CARTAO PASTELLOCO                          -42,79
02/10       SALDO DO DIA                                                       963,23`),
    esperado: [['2026-10-01', 's', 114, 'Matheus'], ['2026-10-01', 'e', 120, 'Beatriz'], ['2026-10-02', 'e', 0.02], ['2026-10-02', 's', 42.79, 'Pastelloco']],
  },
  {
    nome: 'itau pdf sem sinal (só o saldo diz)',
    ler: doPdf(`data        lançamentos                                  valor (R$)        saldo (R$)
30/09       SALDO ANTERIOR                                                   1.000,00
01/10       PIX TRANSF MATHEUS01/10                          114,00            886,00
01/10       PIX TRANSF BEATRIZ01/10                          120,00          1.006,00
02/10       PASTELLOCO                                        42,79            963,21`),
    esperado: [['2026-10-01', 's', 114, 'Matheus'], ['2026-10-01', 'e', 120, 'Beatriz'], ['2026-10-02', 's', 42.79, 'Pastelloco']],
  },
  {
    nome: 'banco do brasil pdf (D e C, nome na linha de baixo)',
    ler: doPdf(`Dt. balancete  Dt. movimento  Ag. origem  Lote   Histórico                   Documento        Valor R$          Saldo
30/09/2026                                         Saldo Anterior                                                 1.000,00 C
01/10/2026                    0000        14397    Pix - Enviado               100101           114,00 D
                                                   01/10 10:12 Matheus Ewerton
01/10/2026                    0000        14397    Pix - Recebido              100102           120,00 C       1.006,00 C
                                                   01/10 11:00 Beatriz Miranda
02/10/2026                    0000        13105    Compra com Cartão           200201            42,79 D         963,21 C
                                                   01/10 13:22 PASTELLOCO`),
    esperado: [['2026-10-01', 's', 114, 'Matheus'], ['2026-10-01', 'e', 120, 'Beatriz'], ['2026-10-02', 's', 42.79, 'Pastelloco']],
  },
  {
    nome: 'caixa pdf (D e C no valor e no saldo)',
    ler: doPdf(`Data Mov.   Nr. Doc.   Histórico                      Valor              Saldo
30/09/2026  000000     SALDO ANTERIOR                 0,00 C        1.000,00 C
01/10/2026  011234     PIX ENV MATHEUS              114,00 D          886,00 C
01/10/2026  011235     PIX REC BEATRIZ              120,00 C        1.006,00 C
02/10/2026  020001     COMPRA ELO PASTELLOCO         42,79 D          963,21 C`),
    esperado: [['2026-10-01', 's', 114, 'Matheus'], ['2026-10-01', 'e', 120, 'Beatriz'], ['2026-10-02', 's', 42.79, 'Pastelloco']],
  },
  {
    nome: 'santander pdf (crédito e débito)',
    ler: doPdf(`Data        Descrição                       Docto     Situação   Crédito (R$)   Débito (R$)     Saldo (R$)
01/10/2026  PIX ENVIADO MATHEUS EWERTON     000001                               -114,00          886,00
01/10/2026  PIX RECEBIDO BEATRIZ            000002                  120,00                      1.006,00
02/10/2026  COMPRA CARTAO DEB PASTELLOCO    000003                                -42,79          963,21`),
    esperado: [['2026-10-01', 's', 114, 'Matheus'], ['2026-10-01', 'e', 120, 'Beatriz'], ['2026-10-02', 's', 42.79, 'Pastelloco']],
  },
  {
    nome: 'pdf crédito e débito sem saldo nem pista no nome',
    ler: doPdf(`Data        Histórico                          Crédito        Débito
01/10/2026  MATHEUS EWERTON                                         114,00
01/10/2026  BEATRIZ MIRANDA                      120,00
02/10/2026  PASTELLOCO                                               42,79`),
    esperado: [['2026-10-01', 's', 114, 'Matheus'], ['2026-10-01', 'e', 120, 'Beatriz'], ['2026-10-02', 's', 42.79, 'Pastelloco']],
  },
  {
    nome: 'pdf em inglês (date, description, debit, credit, balance)',
    ler: doPdf(`Date          Description                     Debit         Credit        Balance
10/01/2026    Opening balance                                                1,000.00
10/01/2026    COFFEE SHOP                       4.50                           995.50
10/02/2026    SALARY ACME INC                                 2,000.00       2,995.50`),
    esperado: [['2026-10-01', 's', 4.5, 'Coffee'], ['2026-10-02', 'e', 2000, 'Acme']],
  },

  // ---------- texto (TXT, Word, PDF que não dá para ler pelas colunas) ----------
  {
    nome: 'texto: saldo só no fim do dia',
    ler: doTexto(`01/10/2026  PIX RECEBIDO FULANO  500,00
01/10/2026  SALDO DO DIA  500,00
02/10/2026  COMPRA MERCADO X  80,00
02/10/2026  TED JOAO  1.000,00
02/10/2026  SALDO DO DIA  1.420,00`),
    esperado: [['2026-10-01', 'e', 500, 'Fulano'], ['2026-10-02', 's', 80, 'Mercado'], ['2026-10-02', 'e', 1000, 'Joao']],
  },
  {
    nome: 'texto: do mais novo para o mais antigo',
    ler: doTexto(`05/10/2026  PIX JOSE  50,00  950,00
04/10/2026  PIX MARIA  200,00  1.000,00
03/10/2026  PIX ANA  300,00  800,00
02/10/2026  SALDO ANTERIOR  1.100,00`),
    esperado: [['2026-10-03', 's', 300, 'Ana'], ['2026-10-04', 'e', 200, 'Maria'], ['2026-10-05', 's', 50, 'Jose']],
  },
  {
    nome: 'texto: data e nome numa linha, valor na outra',
    ler: doTexto(`15/10/2026 PIX RECEBIDO
MARIA SOUZA R$ 1.200,00
16/10/2026 COMPRA MERCADO -45,90`),
    esperado: [['2026-10-15', 'e', 1200, 'Maria'], ['2026-10-16', 's', 45.9, 'Mercado']],
  },
  {
    nome: 'texto: sinal escrito e saldo',
    ler: doTexto(`01/10/2026 Saldo anterior 100,00
02/10/2026 Pix Fulano -30,00 70,00
03/10/2026 Pix Ciclano +50,00 120,00`),
    esperado: [['2026-10-02', 's', 30, 'Fulano'], ['2026-10-03', 'e', 50, 'Ciclano']],
  },
  {
    nome: 'texto: dia por extenso como título',
    ler: doTexto(`Quarta, 15 de outubro
Pix enviado JOSE 30,00
Quinta, 16 de outubro
Pix recebido ANA 70,00`),
    esperado: [['2026-10-15', 's', 30, 'Jose'], ['2026-10-16', 'e', 70, 'Ana']],
  },

  // ---------- CSV e planilhas ----------
  {
    nome: 'nubank conta csv',
    ler: doArquivo('NU_123_01OUT2026_31OUT2026.csv', `Data,Valor,Identificador,Descrição
01/10/2026,-114.00,6514a1b2-0000-4000-8000-000000000001,Transferência enviada pelo Pix - MATHEUS EWERTON - •••.123.456-•• - BCO BRADESCO S.A.
01/10/2026,120.00,6514a1b2-0000-4000-8000-000000000002,Transferência recebida pelo Pix - BEATRIZ MIRANDA - •••.654.321-•• - NU PAGAMENTOS
02/10/2026,-42.79,6514a1b2-0000-4000-8000-000000000003,Compra no débito - PASTELLOCO`),
    esperado: [['2026-10-01', 's', 114, 'Matheus'], ['2026-10-01', 'e', 120, 'Beatriz'], ['2026-10-02', 's', 42.79, 'Pastelloco']],
  },
  {
    nome: 'nubank conta csv (boleto efetuado)',
    ler: doArquivo('NU_123_01OUT2026_31OUT2026.csv', `Data,Valor,Identificador,Descrição
05/10/2026,-187.40,6514a1b2-0000-4000-8000-000000000011,Pagamento de boleto efetuado - ENEL
06/10/2026,-203.15,6514a1b2-0000-4000-8000-000000000012,Pagamento de boleto efetuado - ENEL DISTRIBUICAO SAO PAULO
07/10/2026,-99.90,6514a1b2-0000-4000-8000-000000000013,Pagamento de boleto efetuado - VIVO FIBRA
08/10/2026,-350.00,6514a1b2-0000-4000-8000-000000000014,Pagamento de boleto efetuado - CONDOMINIO RESIDENCIAL AURORA
09/10/2026,-60.00,6514a1b2-0000-4000-8000-000000000015,Pagamento de boleto efetuado`),
    esperado: [['2026-10-05', 's', 187.4, 'Enel'], ['2026-10-06', 's', 203.15, 'Enel'], ['2026-10-07', 's', 99.9, 'Vivo'],
      ['2026-10-08', 's', 350, 'Condominio Residencial Aurora'], ['2026-10-09', 's', 60, 'Boleto']],
  },
  {
    nome: 'nubank cartão csv (compra positiva)',
    ler: doArquivo('nubank-2026-10.csv', `date,category,title,amount
2026-10-01,restaurante,Pastelloco,42.79
2026-10-02,transporte,Uber *Trip,18.90
2026-10-05,,Pagamento recebido,-500.00`),
    esperado: [['2026-10-01', 's', 42.79, 'Pastelloco'], ['2026-10-02', 's', 18.9, 'Uber'], ['2026-10-05', 'e', 500]],
  },
  {
    nome: 'inter csv (cabeçalho depois de umas linhas)',
    ler: doArquivo('Extrato-01-10-2026-a-31-10-2026.csv', `Extrato Conta Corrente
Conta ;12345678
Período ;01/10/2026 a 31/10/2026
Saldo ;1.000,00

Data Lançamento;Histórico;Descrição;Valor;Saldo
01/10/2026;Pix enviado ;MATHEUS EWERTON;-114,00;886,00
01/10/2026;Pix recebido;BEATRIZ MIRANDA;120,00;1.006,00
02/10/2026;Compra no débito;PASTELLOCO;-42,79;963,21`),
    esperado: [['2026-10-01', 's', 114, 'Matheus'], ['2026-10-01', 'e', 120, 'Beatriz'], ['2026-10-02', 's', 42.79, 'Pastelloco']],
  },
  {
    nome: 'c6 csv (entrada e saída em colunas)',
    ler: doArquivo('extrato-c6.csv', `Data Lançamento,Data Contábil,Título,Descrição,Entrada(R$),Saída(R$),Saldo do Dia(R$)
01/10/2026,01/10/2026,Pix enviado para MATHEUS EWERTON,PIX ENVIADO,0.00,114.00,886.00
01/10/2026,01/10/2026,Pix recebido de BEATRIZ MIRANDA,PIX RECEBIDO,120.00,0.00,1006.00
02/10/2026,02/10/2026,PASTELLOCO,COMPRA DEBITO,0.00,42.79,963.21`),
    esperado: [['2026-10-01', 's', 114, 'Matheus'], ['2026-10-01', 'e', 120, 'Beatriz'], ['2026-10-02', 's', 42.79, 'Pastelloco']],
  },
  {
    nome: 'mercado pago csv',
    ler: doArquivo('account_statement.csv', `INITIAL_BALANCE;CREDITS;DEBITS;FINAL_BALANCE
1.000,00;120,00;-156,79;963,21

RELEASE_DATE;TRANSACTION_TYPE;REFERENCE_ID;TRANSACTION_NET_AMOUNT;PARTIAL_BALANCE
01-10-2026;Transferência Pix enviada MATHEUS EWERTON;81234567890;-114,00;886,00
01-10-2026;Transferência Pix recebida BEATRIZ MIRANDA;81234567891;120,00;1.006,00
02-10-2026;Pagamento PASTELLOCO;81234567892;-42,79;963,21`),
    esperado: [['2026-10-01', 's', 114, 'Matheus'], ['2026-10-01', 'e', 120, 'Beatriz'], ['2026-10-02', 's', 42.79, 'Pastelloco']],
  },
  {
    nome: 'csv sem cabeçalho com sinal',
    ler: csv(`01/10/2026;PIX ENVIADO MATHEUS;-114,00;886,00
01/10/2026;PIX RECEBIDO BEATRIZ;120,00;1.006,00
02/10/2026;PASTELLOCO;-42,79;963,21`),
    esperado: [['2026-10-01', 's', 114, 'Matheus'], ['2026-10-01', 'e', 120, 'Beatriz'], ['2026-10-02', 's', 42.79, 'Pastelloco']],
  },
  {
    nome: 'csv sem cabeçalho, sem sinal, com saldo',
    ler: csv(`01/10/2026;MATHEUS EWERTON;114,00;886,00
01/10/2026;BEATRIZ MIRANDA;120,00;1.006,00
02/10/2026;PASTELLOCO;42,79;963,21
03/10/2026;FULANO;10,00;973,21`),
    esperado: [['2026-10-01', 's', 114, 'Matheus'], ['2026-10-01', 'e', 120, 'Beatriz'], ['2026-10-02', 's', 42.79, 'Pastelloco'], ['2026-10-03', 'e', 10, 'Fulano']],
  },
  {
    nome: 'csv sem cabeçalho, crédito e débito separados',
    ler: csv(`01/10/2026;MATHEUS EWERTON;;114,00;886,00
01/10/2026;BEATRIZ MIRANDA;120,00;;1.006,00
02/10/2026;PASTELLOCO;;42,79;963,21`),
    esperado: [['2026-10-01', 's', 114, 'Matheus'], ['2026-10-01', 'e', 120, 'Beatriz'], ['2026-10-02', 's', 42.79, 'Pastelloco']],
  },
  {
    nome: 'csv sem cabeçalho com coluna C/D',
    ler: csv(`01/10/2026;MATHEUS EWERTON;114,00;D
01/10/2026;BEATRIZ MIRANDA;120,00;C
02/10/2026;PASTELLOCO;42,79;D`),
    esperado: [['2026-10-01', 's', 114, 'Matheus'], ['2026-10-01', 'e', 120, 'Beatriz'], ['2026-10-02', 's', 42.79, 'Pastelloco']],
  },
  {
    nome: 'csv em inglês (data por extenso)',
    ler: csv(`Date,Description,Amount,Balance
"Oct 1, 2026",Coffee Shop,-4.50,995.50
"Oct 2, 2026",Salary ACME,"2,000.00","2,995.50"`),
    esperado: [['2026-10-01', 's', 4.5, 'Coffee'], ['2026-10-02', 'e', 2000, 'Acme']],
  },
  {
    nome: 'csv em espanhol',
    ler: csv(`Fecha;Concepto;Importe;Saldo
01/10/2026;Transferencia a MATHEUS;-114,00;886,00
01/10/2026;Transferencia de BEATRIZ;120,00;1.006,00`),
    esperado: [['2026-10-01', 's', 114, 'Matheus'], ['2026-10-01', 'e', 120, 'Beatriz']],
  },
  {
    nome: 'csv com data ano/mês/dia',
    ler: csv(`Data;Descrição;Valor
2026/10/01;MATHEUS EWERTON;-114,00
2026/10/02;PASTELLOCO;-42,79`),
    esperado: [['2026-10-01', 's', 114, 'Matheus'], ['2026-10-02', 's', 42.79, 'Pastelloco']],
  },
  {
    nome: 'planilha bradesco (nome na linha de baixo, data só no primeiro do dia)',
    ler: daTabela([
      ['Data', 'Lançamento', 'Dcto.', 'Crédito (R$)', 'Débito (R$)', 'Saldo (R$)'],
      ['30/09/2026', 'SALDO ANTERIOR', '', '', '', '1.000,00'],
      ['01/10/2026', 'TRANSFERENCIA PIX', '1234567', '', '114,00', '886,00'],
      ['', 'DES: MATHEUS EWERTON DE AL 01/10', '', '', '', ''],
      ['', 'TRANSFERENCIA PIX', '7654321', '120,00', '', '1.006,00'],
      ['', 'REM: BEATRIZ MIRANDA DOS S 01/10', '', '', '', ''],
      ['02/10/2026', 'VISA ELECTRON PASTELLOCO', '2222', '', '42,79', '963,21'],
      ['', 'Total', '', '120,00', '156,79', ''],
    ]),
    esperado: [['2026-10-01', 's', 114, 'Matheus'], ['2026-10-01', 'e', 120, 'Beatriz'], ['2026-10-02', 's', 42.79, 'Pastelloco']],
  },
  {
    nome: 'planilha com números do Excel (sem cabeçalho, sinal no número)',
    ler: daTabela([
      ['2026-10-01', 'MATHEUS EWERTON', '-114', '886'],
      ['2026-10-01', 'BEATRIZ MIRANDA', '120', '1006'],
      ['2026-10-02', 'PASTELLOCO', '-42.79', '963.21'],
    ]),
    esperado: [['2026-10-01', 's', 114, 'Matheus'], ['2026-10-01', 'e', 120, 'Beatriz'], ['2026-10-02', 's', 42.79, 'Pastelloco']],
  },
  {
    nome: 'csv com título separado por vírgula antes da tabela com ponto e vírgula',
    ler: doArquivo('extrato.csv', `Extrato da conta, período de 01/10/2026 a 31/10/2026
Data;Descrição;Valor
01/10/2026;MATHEUS EWERTON;-114,00
02/10/2026;PASTELLOCO;-42,79`),
    esperado: [['2026-10-01', 's', 114, 'Matheus'], ['2026-10-02', 's', 42.79, 'Pastelloco']],
  },
  {
    nome: 'excel com várias abas (o extrato não é a aba mais comprida)',
    ler: async () => {
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Categoria', 'Meta'], ...Array.from({ length: 40 }, (_, i) => [`Categoria ${i}`, i * 10])]), 'Resumo')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ['Data', 'Histórico', 'Valor'],
        [new Date(2026, 9, 1), 'PIX ENVIADO MATHEUS EWERTON', -114],
        [new Date(2026, 9, 2), 'PASTELLOCO', -42.79],
      ]), 'Extrato')
      const dados = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
      return (await lerExtrato(new File([dados], 'extrato.xlsx'), ANO)).linhas
    },
    esperado: [['2026-10-01', 's', 114, 'Matheus'], ['2026-10-02', 's', 42.79, 'Pastelloco']],
  },
  {
    nome: 'ofx',
    ler: doArquivo('extrato.ofx', `OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261001120000[-3:BRT]<TRNAMT>-114.00<FITID>1<MEMO>PIX ENVIADO MATHEUS EWERTON</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261001130000[-3:BRT]<TRNAMT>120.00<FITID>2<MEMO>PIX RECEBIDO BEATRIZ MIRANDA</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`),
    esperado: [['2026-10-01', 's', 114, 'Matheus'], ['2026-10-01', 'e', 120, 'Beatriz']],
  },
]

const fmt = (l: { data: string; tipo: string; valor: number; descricao: string }) =>
  `${l.data} ${l.tipo === 'entrada' || l.tipo === 'e' ? 'entrou' : 'saiu  '} ${l.valor.toFixed(2).padStart(9)}  ${l.descricao}`

/** Roda os casos; com `filtro`, mostra o que foi lido nos casos cujo nome tem o filtro. Devolve quantos falharam. */
export async function rodar(filtro?: string): Promise<number> {
  let falhas = 0
  for (const c of CASOS) {
    if (filtro && !c.nome.includes(filtro)) continue
    let lidas: LinhaExtrato[]
    try { lidas = await c.ler() } catch (e) { lidas = []; console.log(`✗ ${c.nome}: erro ${e instanceof Error ? e.stack : e}`) }
    const ordenar = <T extends { data: string; valor: number }>(xs: T[]) => [...xs].sort((a, b) => a.data.localeCompare(b.data) || a.valor - b.valor)
    const a = ordenar(lidas)
    const b = ordenar(c.esperado.map(([data, tipo, valor, nome]) => ({ data, tipo, valor, nome })))
    const erros: string[] = []
    if (a.length !== b.length) erros.push(`leu ${a.length} lançamentos, esperava ${b.length}`)
    b.forEach((e, i) => {
      const l = a[i]
      const tipo = e.tipo === 'e' ? 'entrada' : 'saida'
      if (!l || l.data !== e.data || l.tipo !== tipo || Math.abs(l.valor - e.valor) > 0.001 || (e.nome && !l.descricao.toLowerCase().includes(e.nome.toLowerCase()))) {
        erros.push(`esperava ${fmt({ ...e, descricao: e.nome ?? '' })}\n      leu     ${l ? fmt(l) : '(nada)'}`)
      }
    })
    if (erros.length) falhas++
    if (erros.length || filtro) {
      console.log(`${erros.length ? '✗' : '✓'} ${c.nome}`)
      for (const e of erros) console.log(`    ${e}`)
      if (filtro) for (const l of lidas) console.log(`      · ${fmt(l)}${l.revisar ? `  [${l.revisar}]` : ''}`)
    }
  }
  const total = CASOS.filter((c) => !filtro || c.nome.includes(filtro)).length
  console.log(`\n${total - falhas} de ${total} casos certos`)
  return falhas
}
