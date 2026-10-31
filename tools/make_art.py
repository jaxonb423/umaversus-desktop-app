#!/usr/bin/env python3
"""Card art for the catalog: mods/<id>/icon.png (128x128) and banner.png (600x260), cut from each mod's own sprites."""
import base64, io, json, re, sys
from PIL import Image, ImageDraw

def frame(sheet, idx, cols, cw=64, ch=64):
    x, y = (idx % cols) * cw, (idx // cols) * ch
    return sheet.crop((x, y, x + cw, y + ch))

def bbox_crop(im):
    b = im.getbbox(); return im.crop(b) if b else im

def gradient(w, h, c1, c2):
    g = Image.new('RGBA', (w, h)); d = ImageDraw.Draw(g)
    for x in range(w + h):
        t = x / (w + h); col = tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3)) + (255,)
        d.line([(x, 0), (x - h, h)], fill=col)
    return g

def stripes(img, cols, x0, w):
    d = ImageDraw.Draw(img); h = img.height
    for i, c in enumerate(cols):
        x = x0 + i * w; d.polygon([(x + h * .36, 0), (x + w + h * .36, 0), (x + w, h), (x, h)], fill=c)

def paste_scaled(dst, sp, x, y_bottom, k):
    sp = bbox_crop(sp); sp = sp.resize((sp.width * k, sp.height * k), Image.NEAREST)
    dst.alpha_composite(sp, (int(x - sp.width / 2), int(y_bottom - sp.height)))

def icon_from(face, bg):
    ic = Image.new('RGBA', (128, 128), bg)
    f = face.resize((120, 120), Image.NEAREST); ic.alpha_composite(f, (4, 6)); return ic

root = sys.argv[1]
# ---------------- fuku
anims = json.load(open(f'{root}/mods/fuku/anims.json'))['anims'] if False else None
S = Image.open(f'{root}/mods/fuku/fuku.png').convert('RGBA')
A = {"100": [0, 4], "162": [55, 6], "600": [171, 8], "930": [293, 6], "520": [153, 3]}
idle = frame(S, A['100'][0], 16)
face = idle.crop((16, 9, 48, 41))
icon_from(face, (138, 92, 200, 255)).save(f'{root}/mods/fuku/icon.png')
b = gradient(600, 260, (74, 40, 128), (246, 195, 67)); stripes(b, [(255, 255, 255, 60), (246, 195, 67, 120), (138, 92, 200, 140)], 330, 46)
for k, (an, fi, x) in enumerate([('930', 3, 190), ('162', 2, 330), ('600', 5, 470)]):
    paste_scaled(b, frame(S, A[an][0] + fi, 16), x, 250, 3)
d = ImageDraw.Draw(b)
for i in range(18):   # paper slips (omikuji)
    x, y = 40 + (i * 97) % 540, 20 + (i * 53) % 90
    d.rectangle([x, y, x + 10, y + 28], fill=(255, 250, 235, 200), outline=(200, 40, 40, 220))
b.save(f'{root}/mods/fuku/banner.png')

# ---------------- nixon (sprite sheet is inside the mod file as a data URL)
src = open(f'{root}/mods/nixon/nixon.uvmod.js', encoding='utf-8').read()
m = re.search(r'const ASSETS = \{\\"nixon\\": (\{.*?\})\, "', src)
j = re.search(r'"img":"data:image/png;base64,([A-Za-z0-9+/=]+)"', src.replace('\\"', '"'))
meta = re.search(r'"anims":(\{[^}]*\}),"cols":(\d+),"cw":(\d+),"ch":(\d+)', src.replace('\\"', '"'))
N = Image.open(io.BytesIO(base64.b64decode(j.group(1)))).convert('RGBA')
an = json.loads(meta.group(1)); cols, cw, ch = int(meta.group(2)), int(meta.group(3)), int(meta.group(4))
first = sorted(an.items(), key=lambda kv: kv[1][0])
idle_key = next((k for k in an if 'idle' in k.lower()), first[0][0])
nf = frame(N, an[idle_key][0], cols, cw, ch)
face = N.crop(((an[idle_key][0] % cols) * cw + 88, (an[idle_key][0] // cols) * ch + 139, (an[idle_key][0] % cols) * cw + 118, (an[idle_key][0] // cols) * ch + 169))
icon_from(face, (178, 34, 52, 255)).save(f'{root}/mods/nixon/icon.png')
b = Image.new('RGBA', (600, 260), (20, 30, 80, 255)); d = ImageDraw.Draw(b)
for i in range(7): d.rectangle([0, i * 38, 600, i * 38 + 19], fill=(178, 34, 52, 255) if i % 2 == 0 else (240, 240, 240, 255))
d.rectangle([0, 0, 230, 136], fill=(20, 40, 110, 255))
for r in range(4):
    for c in range(6): x, y = 18 + c * 36, 16 + r * 30; d.polygon([(x, y + 6), (x + 6, y + 6), (x + 8, y), (x + 10, y + 6), (x + 16, y + 6), (x + 11, y + 10), (x + 13, y + 16), (x + 8, y + 12), (x + 3, y + 16), (x + 5, y + 10)], fill=(255, 255, 255, 255))
nb = bbox_crop(nf); k = max(1, int(230 / max(1, nb.height)))
paste_scaled(b, nf, 420, 255, min(k, 3))
b.save(f'{root}/mods/nixon/banner.png')
print('art ok; nixon idle anim =', idle_key, 'cell', cw, ch)
