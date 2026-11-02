#!/usr/bin/env python3
"""Art for the Happy Meek mod: her sprite sheets, the flower, and the catalog card art.

    python tools/build_meek_art.py "<folder with the hame*.png frames>" mods/meek

Input: the Party Dash rip from The Spriters Resource ("Playable Umamusume - Happy Meek"): one 64x64 PNG per
frame, named hame<anim>_<nn>[l|r].png(.png). The plain frame is the body; the l / r frames are the
accessory layer for each facing. Output, in the same layout as the game's own runners (16 columns of 64x64):
  meek.png     body + l layer
  meek_r.png   body + r layer (the game mirrors it when she faces right)
  flower.png   Meek's Bloom, drawn here: seed, sprout, bud, three bloom frames, and a pollen mote
  icon.png / banner.png   catalog card art
It prints the anims table that goes into ASSETS in meek.uvmod.js.
"""
import json, math, os, re, sys
from PIL import Image, ImageDraw

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)

# ------------------------------------------------------------------ sprite sheets
frames = {}
for f in os.listdir(src):
    m = re.match(r'hame(\w+?)_(\d+)\.png(?:\.png)?$', f)
    if m:
        frames.setdefault(m.group(1), set()).add(int(m.group(2)))
keys = sorted((k for k in frames if k.isdigit()), key=int) + sorted(k for k in frames if not k.isdigit())   # '001A' goes last, like the game's sheets


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
        cells.append(f'hame{k}_{i:02d}')
COLS = 16
rows = (len(cells) + COLS - 1) // COLS
L = Image.new('RGBA', (COLS * 64, rows * 64)); R = Image.new('RGBA', (COLS * 64, rows * 64))
for idx, name in enumerate(cells):
    base = load(name)
    xy = ((idx % COLS) * 64, (idx // COLS) * 64)
    for sheet, layer in ((L, 'l'), (R, 'r')):
        c = base.copy()
        acc = load(name + layer)
        if acc is not None:
            c.alpha_composite(acc)
        sheet.paste(c, xy)
L.save(os.path.join(out, 'meek.png'), optimize=True)
R.save(os.path.join(out, 'meek_r.png'), optimize=True)

# ------------------------------------------------------------------ the flower
# Pixel art on the sprites' own grid (the game draws both at 3x), in Meek's colours: white petals with her
# lavender shading and pink tips, a yellow heart, and a soft green stem. Outlines are a darker shade of the
# fill, never black, the way the Party Dash sprites are drawn.
PAL = {
    'W': (255, 255, 255), 'w': (245, 236, 225), 'l': (202, 205, 252), 'O': (134, 151, 175),
    'p': (255, 179, 203), 'P': (231, 158, 168),
    'Y': (255, 230, 113), 'y': (217, 186, 109), 'o': (196, 155, 60),
    'G': (168, 216, 138), 'g': (111, 179, 107), 'K': (63, 122, 85),
    'S': (200, 158, 143), 's': (177, 131, 115), 'X': (130, 90, 80),
}
CW, CH = 24, 32   # flower cell


def outline(grid, inner, color):
    """Add an outline of `color` around the cells whose code is in `inner`."""
    h, w = len(grid), len(grid[0]); add = []
    for y in range(h):
        for x in range(w):
            if grid[y][x] != '.':
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                xx, yy = x + dx, y + dy
                if 0 <= xx < w and 0 <= yy < h and grid[yy][xx] in inner:
                    add.append((x, y)); break
    for x, y in add:
        grid[y][x] = color


def blank():
    return [['.'] * CW for _ in range(CH)]


def stem(grid, top, sway=0, leaves=True):
    """Stem from the bottom row up to `top`, leaning by `sway` px at the top; two leaves."""
    bx = CW // 2
    for y in range(top, CH):
        k = (CH - 1 - y) / max(1, CH - 1 - top)
        x = bx + round(sway * k * k)
        grid[y][x] = 'g'; grid[y][x - 1] = 'G' if y % 3 else 'g'
    if leaves:
        ly = CH - 6
        for i, (dx, dy) in enumerate([(1, 0), (2, -1), (3, -1), (4, -2), (2, 0), (3, 0)]):
            grid[ly + dy][bx + dx] = 'G' if i < 4 else 'g'
        ly = CH - 9
        for i, (dx, dy) in enumerate([(-2, 0), (-3, -1), (-4, -1), (-5, -2), (-3, 0), (-4, 0)]):
            grid[ly + dy][bx + dx] = 'G' if i < 4 else 'g'


def head(grid, cx, cy, open_k=1.0):
    """Five rounded petals around a yellow heart. open_k < 1 makes a half-open flower."""
    for y in range(CH):
        for x in range(CW):
            px, py = x + 0.5 - cx, y + 0.5 - cy
            d = math.hypot(px, py)
            hit = None
            for k in range(5):
                a = math.radians(-90 + 72 * k)
                ux, uy = math.cos(a), math.sin(a)
                c = 4.7 * open_k
                qx, qy = px - ux * c, py - uy * c
                along, across = qx * ux + qy * uy, -qx * uy + qy * ux
                if (along / (3.4 * open_k + 0.3)) ** 2 + (across / 2.35) ** 2 <= 1:
                    hit = (along, k)
                    break
            if hit is not None:
                along, k = hit
                light = (px * -0.6 + py * -0.8) / max(0.1, d)          # lit from the top left
                code = 'W' if light > -0.15 else 'w'
                if along > 1.8 * open_k:
                    code = 'p'                                       # pink tips
                elif light < -0.55 and along > 0:
                    code = 'l'                                       # lavender shade on the far side
                grid[y][x] = code
            if d <= 2.4:
                grid[y][x] = 'o' if d > 1.9 else 'Y' if (px + py) < 0.5 else 'y'
    outline(grid, 'WwlpPoYy', 'O')


def finish(grid):
    outline(grid, 'Gg', 'K')
    im = Image.new('RGBA', (CW, CH))
    for y in range(CH):
        for x in range(CW):
            c = grid[y][x]
            if c != '.':
                im.putpixel((x, y), PAL[c] + (255,))
    return im


cells_f = []
# 0 seed: a little brown seed with a highlight
g = blank()
for (x, y, c) in [(11, 27, 'S'), (12, 27, 'S'), (10, 28, 'S'), (11, 28, 'S'), (12, 28, 's'), (13, 28, 's'), (10, 29, 's'), (11, 29, 's'),
                  (12, 29, 's'), (13, 29, 's'), (11, 30, 's'), (12, 30, 's'), (11, 27, 'w')]:
    g[y][x] = c
outline(g, 'Ssw', 'X'); cells_f.append(finish(g))
# 1 sprout: a short stem with two round leaves
g = blank()
for y in range(24, 32):
    g[y][12] = 'g'; g[y][11] = 'G'
for (x, y) in [(13, 23), (14, 22), (15, 22), (16, 23), (14, 23), (15, 23), (8, 22), (9, 21), (10, 22), (9, 22), (10, 23), (7, 23)]:
    g[y][x] = 'G'
cells_f.append(finish(g))
# 2 bud: closed white bud with pink tip on a stem
g = blank(); stem(g, 18, 0, True)
for y in range(9, 19):
    w2 = [0, 1, 1, 2, 2, 3, 3, 3, 2, 2][y - 9]
    for x in range(12 - w2, 12 + w2 + 1):
        g[y][x] = 'p' if y < 11 else ('W' if x <= 12 else 'w')
for x in (10, 11, 13, 14):
    g[18][x] = 'g'
outline(g, 'WwpP', 'O'); cells_f.append(finish(g))
# 3-5 bloom: centre sway, left, right
for sway in (0, -1, 1):
    g = blank(); stem(g, 16, sway, True)
    head(g, 12 + sway, 9.0, 1.0)
    cells_f.append(finish(g))
# 6 pollen mote (tiny sparkle)
g = blank()
for (x, y, c) in [(12, 14, 'Y'), (11, 15, 'Y'), (12, 15, 'W'), (13, 15, 'Y'), (12, 16, 'Y')]:
    g[y][x] = c
cells_f.append(finish(g))
F = Image.new('RGBA', (CW * len(cells_f), CH))
for i, c in enumerate(cells_f):
    F.paste(c, (i * CW, 0))
F.save(os.path.join(out, 'flower.png'), optimize=True)

# ------------------------------------------------------------------ catalog card art
def frame(sheet, an, i=0):
    idx = anims[an][0] + i
    return sheet.crop(((idx % COLS) * 64, (idx // COLS) * 64, (idx % COLS) * 64 + 64, (idx // COLS) * 64 + 64))


def bbox_crop(im):
    b = im.getbbox(); return im.crop(b) if b else im


def paste_scaled(dst, sp, x, y_bottom, k):
    sp = bbox_crop(sp); sp = sp.resize((sp.width * k, sp.height * k), Image.NEAREST)
    dst.alpha_composite(sp, (int(x - sp.width / 2), int(y_bottom - sp.height)))


idle = frame(L, '100')
face = idle.crop((16, 9, 48, 41))
ic = Image.new('RGBA', (128, 128), (238, 222, 236, 255))
dd = ImageDraw.Draw(ic)
for i in range(0, 128, 16):
    dd.line([(i, 128), (i + 64, 0)], fill=(250, 240, 248, 255), width=6)
ic.alpha_composite(face.resize((120, 120), Image.NEAREST), (4, 6))
ic.save(os.path.join(out, 'icon.png'))

b = Image.new('RGBA', (600, 260))
d = ImageDraw.Draw(b)
for x in range(600 + 260):   # soft lavender to pink
    t = x / 860; c1, c2 = (152, 166, 221), (255, 205, 222)
    d.line([(x, 0), (x - 260, 260)], fill=tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3)) + (255,))
for i, c in enumerate([(255, 255, 255, 70), (255, 230, 113, 110), (202, 205, 252, 150)]):
    x = 340 + i * 46; d.polygon([(x + 94, 0), (x + 140, 0), (x + 46, 260), (x, 260)], fill=c)
d.rectangle([0, 236, 600, 260], fill=(214, 236, 196, 255))
for k, fx in enumerate([40, 100, 545, 585]):   # a row of flowers along the bottom
    fl = cells_f[3 + k % 3]; paste_scaled(b, fl, fx, 250, 3)
paste_scaled(b, frame(L, '920', 3), 200, 250, 3)
paste_scaled(b, frame(L, '701', 3), 340, 220, 3)
paste_scaled(b, frame(L, '510', 1), 460, 250, 3)
b.save(os.path.join(out, 'banner.png'))

print(json.dumps({'anims': anims, 'cols': COLS}, separators=(', ', ': ')))
