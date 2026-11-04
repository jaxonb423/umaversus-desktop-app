#!/usr/bin/env python3
"""Art for the Still in Love mod: her sprite sheets and the catalog card art.

    python tools/build_sil_art.py "<folder with the stil*.png frames>" mods/sil

Input: the Party Dash rip from The Spriters Resource ("Playable Umamusume - Still in Love"): one 64x64 PNG per
frame, named stil<anim>_<nn>[l|r|s].png(.png). The plain frame is the body; the l / r frames are the
accessory layer for each facing (s is a shadow layer the game doesn't use). Output, in the same layout as the
game's own runners (16 columns of 64x64):
  sil.png     body + l layer
  sil_r.png   body + r layer (the game mirrors it when she faces right)
  icon.png / banner.png   catalog card art
Everything else she shows (hearts, the Lovestruck meter, crowns) is drawn in code by the mod.
It prints the anims table that goes into ASSETS in sil.uvmod.js.
"""
import json, math, os, re, sys
from PIL import Image, ImageDraw

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)

frames = {}
for f in os.listdir(src):
    m = re.match(r'stil(\w+?)_(\d+)\.png(?:\.png)?$', f)
    if m:
        frames.setdefault(m.group(1), set()).add(int(m.group(2)))
keys = sorted((k for k in frames if k.isdigit()), key=int) + sorted(k for k in frames if not k.isdigit())


def load(name):
    for ext in ('.png.png', '.png'):
        p = os.path.join(src, name + ext)
        if os.path.isfile(p):
            return Image.open(p).convert('RGBA')
    return None


anims, cells = {}, []
for k in keys:
    n = max(frames[k]) + 1
    anims[k] = [len(cells), n]
    for i in range(n):
        cells.append(f'stil{k}_{i:02d}')
COLS = 16
rows = (len(cells) + COLS - 1) // COLS
L = Image.new('RGBA', (COLS * 64, rows * 64)); R = Image.new('RGBA', (COLS * 64, rows * 64))
for idx, name in enumerate(cells):
    base = load(name) or Image.new('RGBA', (64, 64))
    xy = ((idx % COLS) * 64, (idx // COLS) * 64)
    for sheet, layer in ((L, 'l'), (R, 'r')):
        c = base.copy()
        acc = load(name + layer)
        if acc is not None:
            c.alpha_composite(acc)
        sheet.paste(c, xy)
L.save(os.path.join(out, 'sil.png'), optimize=True)
R.save(os.path.join(out, 'sil_r.png'), optimize=True)


# ------------------------------------------------------------------ catalog card art
def frame(sheet, an, i=0):
    idx = anims[an][0] + i
    return sheet.crop(((idx % COLS) * 64, (idx // COLS) * 64, (idx % COLS) * 64 + 64, (idx // COLS) * 64 + 64))


def bbox_crop(im):
    b = im.getbbox(); return im.crop(b) if b else im


def paste_scaled(dst, sp, x, y_bottom, k):
    sp = bbox_crop(sp); sp = sp.resize((sp.width * k, sp.height * k), Image.NEAREST)
    dst.alpha_composite(sp, (int(x - sp.width / 2), int(y_bottom - sp.height)))


def heart(d, cx, cy, r, fill, outline=None):
    pts = []
    for i in range(48):
        t = i / 48 * 2 * math.pi
        x = 16 * math.sin(t) ** 3
        y = -(13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t))
        pts.append((cx + x * r / 16, cy + y * r / 16))
    d.polygon(pts, fill=fill, outline=outline)


idle = frame(L, '100')
face = idle.crop((16, 9, 48, 41))
ic = Image.new('RGBA', (128, 128), (250, 222, 230, 255))
dd = ImageDraw.Draw(ic)
for i, (x, y) in enumerate([(18, 20), (108, 26), (22, 104), (104, 100)]):
    heart(dd, x, y, 10, (255, 120, 160, 255))
ic.alpha_composite(face.resize((120, 120), Image.NEAREST), (4, 6))
ic.save(os.path.join(out, 'icon.png'))

b = Image.new('RGBA', (600, 260))
d = ImageDraw.Draw(b)
for x in range(600 + 260):   # deep red to rose
    t = x / 860; c1, c2 = (150, 28, 52), (255, 178, 200)
    d.line([(x, 0), (x - 260, 260)], fill=tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3)) + (255,))
for i, c in enumerate([(255, 255, 255, 70), (255, 214, 120, 110), (255, 120, 160, 150)]):
    x = 330 + i * 46; d.polygon([(x + 94, 0), (x + 140, 0), (x + 46, 260), (x, 260)], fill=c)
for k in range(14):   # floating hearts
    x, y = 30 + (k * 83) % 560, 20 + (k * 47) % 150
    heart(d, x, y, 7 + (k % 3) * 3, (255, 235, 242, 170))
for k in range(3):    # the three tiaras
    cx, cy = 470 + k * 38, 40
    d.polygon([(cx - 14, cy + 10), (cx - 14, cy - 4), (cx - 7, cy + 3), (cx, cy - 10), (cx + 7, cy + 3), (cx + 14, cy - 4), (cx + 14, cy + 10)], fill=(255, 214, 90, 255), outline=(170, 110, 30, 255))
paste_scaled(b, frame(L, '210', 1), 190, 250, 3)
paste_scaled(b, frame(L, '203', 0), 330, 235, 3)
paste_scaled(b, frame(L, '600', 4), 460, 250, 3)
b.save(os.path.join(out, 'banner.png'))

print(json.dumps({'anims': anims, 'cols': COLS}, separators=(', ', ': ')))
