const CAMINHOS: Record<string, string> = {
  inicio: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  lista: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  divida: 'M3 6h18v12H3zM3 10h18M7 15h4',
  carteira: 'M4 7h15a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12v3M16 13.5h.01',
  ano: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  mais: 'M12 5v14M5 12h14',
  esq: 'M15 18l-6-6 6-6',
  dir: 'M9 18l6-6-6-6',
  sobe: 'M12 19V5M5 12l7-7 7 7',
  desce: 'M12 5v14M19 12l-7 7-7-7',
  busca: 'M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14zM21 21l-4.3-4.3',
  fechar: 'M18 6L6 18M6 6l12 12',
  importar: 'M12 3v12M7 10l5 5 5-5M4 21h16',
  exportar: 'M12 15V3M7 8l5-5 5 5M4 21h16',
  sair: 'M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3',
  copiar: 'M9 9h11v11H9zM5 15H4V4h11v1',
  check: 'M5 12l5 5 9-10',
  menu: 'M4 6h16M4 12h16M4 18h16',
}

export function Icone({ nome, tamanho = 20 }: { nome: keyof typeof CAMINHOS | string; tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={CAMINHOS[nome]} />
    </svg>
  )
}
