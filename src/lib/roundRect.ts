/*
 * Retângulo arredondado no canvas (`roundRect`) para navegadores que ainda não têm: Safari antes do 16 e o WebView de
 * Android antigo (o app). Sem isto, os gráficos quebravam com "c.roundRect is not a function". Só entra quando falta: onde
 * o navegador já tem, vale o dele. Os raios seguem a regra do navegador (1 a 4 valores, como o border-radius).
 */
type Raio = number | DOMPointInit

function arredondado(this: CanvasPath, x: number, y: number, w: number, h: number, raios: Raio | Raio[] = 0) {
  const r = (Array.isArray(raios) ? raios : [raios]).map((v) => (typeof v === 'number' ? v : (v.x ?? 0)))
  const [ce, cd, bd, be] = r.length === 1 ? [r[0], r[0], r[0], r[0]]
    : r.length === 2 ? [r[0], r[1], r[0], r[1]]
      : r.length === 3 ? [r[0], r[1], r[2], r[1]]
        : [r[0], r[1], r[2], r[3]]
  if (w < 0) { x += w; w = -w }
  if (h < 0) { y += h; h = -h }
  // raios maiores que o lado encolhem juntos, como no navegador
  const k = Math.min(1, w / Math.max(ce + cd, be + bd, 1e-9), h / Math.max(ce + be, cd + bd, 1e-9))
  const [a, b, c, d] = [ce * k, cd * k, bd * k, be * k]
  this.moveTo(x + a, y)
  this.lineTo(x + w - b, y); this.arcTo(x + w, y, x + w, y + b, b)
  this.lineTo(x + w, y + h - c); this.arcTo(x + w, y + h, x + w - c, y + h, c)
  this.lineTo(x + d, y + h); this.arcTo(x, y + h, x, y + h - d, d)
  this.lineTo(x, y + a); this.arcTo(x, y, x + a, y, a)
  this.closePath()
}

export function completarRoundRect() {
  const alvos = [
    typeof CanvasRenderingContext2D !== 'undefined' ? CanvasRenderingContext2D : null,
    typeof OffscreenCanvasRenderingContext2D !== 'undefined' ? OffscreenCanvasRenderingContext2D : null,
    typeof Path2D !== 'undefined' ? Path2D : null,
  ]
  for (const alvo of alvos) {
    const p = alvo?.prototype as { roundRect?: unknown } | undefined
    if (p && typeof p.roundRect !== 'function') p.roundRect = arredondado
  }
}
