"""Quita el fondo blanco (o casi blanco) de una foto de producto y la guarda como PNG transparente.
Sólo se borra el blanco conectado con el borde de la imagen, así que las partes blancas
de la propia consola se conservan. Los bordes se suavizan para que no quede un halo.
    python3 scripts/quitar-fondo-blanco.py entrada.jpg salida.png [--huecos]
--huecos borra también el blanco puro encerrado (p. ej. entre el cable y la consola);
úsalo sólo con consolas oscuras.
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd

src, dst = sys.argv[1], sys.argv[2]
im = np.array(Image.open(src).convert('RGB')).astype(np.int16)
mn, mx = im.min(2), im.max(2)
fondo = (mn > 228) & ((mx - mn) < 18)                    # blanco / gris muy claro sin color
lab, _ = nd.label(fondo)
borde = np.unique(np.r_[lab[0], lab[-1], lab[:, 0], lab[:, -1]])
mask = np.isin(lab, borde[borde > 0])
if '--huecos' in sys.argv:
    puro = (mn > 242) & ((mx - mn) < 10)
    lab2, n2 = nd.label(puro)
    tam = nd.sum(puro, lab2, range(1, n2 + 1))
    mask |= np.isin(lab2, np.nonzero(tam > 150)[0] + 1)
# suavizado del contorno: alfa proporcional a la distancia al fondo (2 px)
dist = nd.distance_transform_edt(~mask)
alfa = np.clip(dist / 2.0, 0, 1)
Image.fromarray(np.dstack([im.astype(np.uint8), (alfa * 255).astype(np.uint8)]), 'RGBA').save(dst)
