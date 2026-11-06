"""Gera os ícones e a tela de abertura do app Android a partir do símbolo e do ícone do site.

    python3 scripts/app-android/icones.py

- Ícone adaptável (Android 8+): fundo azul-escuro (#090d18, o mesmo do ícone do site) e o símbolo por cima, dentro da área
  que nenhum formato de recorte (círculo, gota, quadrado arredondado) corta.
- Ícone antigo (Android 7) e redondo: o ícone do site (public/icone-512.png), redimensionado e, no redondo, recortado.
- Abertura no Android 7 a 11 (drawable*/splash.png): o símbolo no centro, no mesmo azul-escuro. Do Android 12 em diante
  quem desenha a abertura é o sistema, com as cores de res/values/styles.xml.
"""
from pathlib import Path

from PIL import Image, ImageDraw

RAIZ = Path(__file__).resolve().parents[2]
RES = RAIZ / 'android' / 'app' / 'src' / 'main' / 'res'
FUNDO = (9, 13, 24, 255)  # #090d18
simbolo = Image.open(RAIZ / 'public' / 'simbolo.webp').convert('RGBA')
icone = Image.open(RAIZ / 'public' / 'icone-512.png').convert('RGBA')

DENSIDADES = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}


def com_simbolo(largura, altura, largura_do_simbolo, fundo):
    tela = Image.new('RGBA', (largura, altura), fundo)
    s = simbolo.resize((largura_do_simbolo, round(largura_do_simbolo * simbolo.height / simbolo.width)), Image.LANCZOS)
    tela.alpha_composite(s, ((largura - s.width) // 2, (altura - s.height) // 2))
    return tela


for nome, d in DENSIDADES.items():
    pasta = RES / f'mipmap-{nome}'
    # camada da frente do ícone adaptável: 108 dp; o símbolo com 48 dp fica folgado na área segura (círculo de 66 dp)
    lado = round(108 * d)
    com_simbolo(lado, lado, round(48 * d), (0, 0, 0, 0)).save(pasta / 'ic_launcher_foreground.png')
    # ícone antigo, 48 dp
    lado = round(48 * d)
    quadrado = icone.resize((lado, lado), Image.LANCZOS)
    quadrado.save(pasta / 'ic_launcher.png')
    mascara = Image.new('L', (lado, lado), 0)
    ImageDraw.Draw(mascara).ellipse((0, 0, lado - 1, lado - 1), fill=255)
    redondo = Image.new('RGBA', (lado, lado), (0, 0, 0, 0))
    redondo.paste(quadrado, (0, 0), mascara)
    redondo.save(pasta / 'ic_launcher_round.png')

# abertura do Android 7 a 11: mesmo tamanho de cada arquivo que o Capacitor gerou; o símbolo com 1/3 do lado menor
for arquivo in RES.glob('drawable*/splash.png'):
    largura, altura = Image.open(arquivo).size
    com_simbolo(largura, altura, round(min(largura, altura) / 3), FUNDO).convert('RGB').save(arquivo)

print('ícones e aberturas gerados em', RES)
