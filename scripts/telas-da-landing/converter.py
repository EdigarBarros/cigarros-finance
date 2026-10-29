"""Converte as capturas (PNG) para WebP em public/landing. Precisa do Pillow: pip install pillow"""
import os
from PIL import Image

aqui = os.path.dirname(os.path.abspath(__file__))
origem = os.path.join(aqui, 'saida')
destino = os.path.join(aqui, '..', '..', 'public', 'landing')
os.makedirs(destino, exist_ok=True)
total = 0
for nome in sorted(os.listdir(origem)):
    if not nome.endswith('.png'):
        continue
    saida = os.path.join(destino, nome.replace('.png', '.webp'))
    Image.open(os.path.join(origem, nome)).convert('RGB').save(saida, 'WEBP', quality=78, method=6)
    total += os.path.getsize(saida)
    print(nome, os.path.getsize(saida) // 1024, 'KB')
print('total', total // 1024, 'KB')
