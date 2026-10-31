"""
Limpa um SVG de logotipo de banco para entrar no app (src/assets/bancos/), que o desenha dentro do selo
(components/BancoIcone). Fica só o desenho: formas, cores e transformações. Sai todo o resto (scripts, links,
imagens, textos, metadados do editor, estilos). Uso: python3 -I scripts/logos/limpar.py entrada.svg saida.svg [viewBox]
"""
import re
import sys
import xml.etree.ElementTree as ET

FORMAS = {'path', 'g', 'rect', 'circle', 'ellipse', 'polygon', 'polyline'}
ATRIBUTOS = {'d', 'fill', 'fill-rule', 'clip-rule', 'fill-opacity', 'opacity', 'transform', 'points',
             'x', 'y', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r'}
COR = re.compile(r'^(#[0-9a-fA-F]{3,8}|none|currentColor|[a-z]+)$')
NUMEROS = re.compile(r'^[-0-9.,eE\s]+$')
TRANSFORMACAO = re.compile(r'^((matrix|translate|scale|rotate|skewX|skewY)\([-0-9.,eE\s]*\)\s*)+$')


def sem_ns(tag):
    return tag.rsplit('}', 1)[-1]


def estilo_para_atributos(el, classes):
    """fill:..., fill-rule:... vindos de style="" ou de <style> .classe {} viram atributos."""
    texto = el.get('style', '') + ';' + ';'.join(classes.get(c, '') for c in el.get('class', '').split())
    for parte in texto.split(';'):
        if ':' in parte:
            k, v = (x.strip() for x in parte.split(':', 1))
            if k in ('fill', 'fill-rule', 'fill-opacity', 'opacity') and k not in el.attrib:
                el.set(k, v)


def valido(k, v):
    if k in ('fill',):
        return bool(COR.match(v)) and not v.startswith('url')
    if k == 'transform':
        return bool(TRANSFORMACAO.match(v))
    if k in ('fill-rule', 'clip-rule'):
        return v in ('evenodd', 'nonzero')
    if k == 'd':
        return bool(re.match(r'^[MmZzLlHhVvCcSsQqTtAa0-9.,eE\s-]+$', v))
    return bool(NUMEROS.match(v))


def limpar(el, classes):
    saida = ET.Element(sem_ns(el.tag))
    estilo_para_atributos(el, classes)
    for k, v in el.attrib.items():
        k = sem_ns(k)
        if k in ATRIBUTOS and valido(k, v.strip()):
            saida.set(k, v.strip())
    for filho in el:
        if sem_ns(filho.tag) in FORMAS:
            saida.append(limpar(filho, classes))
    return saida


def principal(entrada, destino, caixa=None):
    raiz = ET.parse(entrada).getroot()
    classes = {}
    for st in raiz.iter():
        if sem_ns(st.tag) == 'style' and st.text:
            for nome, corpo in re.findall(r'\.([\w-]+)\s*\{([^}]*)\}', st.text):
                classes[nome] = corpo
    vb = caixa or raiz.get('viewBox') or f"0 0 {raiz.get('width', '24').rstrip('px')} {raiz.get('height', '24').rstrip('px')}"
    novo = ET.Element('svg', {'xmlns': 'http://www.w3.org/2000/svg', 'viewBox': vb})
    for filho in raiz:
        if sem_ns(filho.tag) in FORMAS:
            novo.append(limpar(filho, classes))
    texto = ET.tostring(novo, encoding='unicode').replace('ns0:', '').replace(':ns0', '')
    if re.search(r'<(script|image|use|foreignObject|a)\b|javascript:|href', texto, re.I):
        sys.exit(f'{entrada}: sobrou algo que não é desenho')
    open(destino, 'w', encoding='utf-8').write(texto + '\n')


if __name__ == '__main__':
    principal(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
