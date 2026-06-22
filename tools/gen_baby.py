#!/usr/bin/env python3
"""Generate cute 16-bit pixel-art baby SVGs.

The face is a true circle (rasterised from a radius), with a small black
hair patch, big brown eyes and blush cheeks. Three expressions are emitted:
catch / swat / eat. Run from the repo root:

    python3 tools/gen_baby.py
"""
import math
import os

PALETTE = {
    'o': '#3b2415',  # outline (dark brown)
    'K': '#15131a',  # black hair
    'k': '#322e40',  # hair highlight
    'S': '#f8cda4',  # skin
    'H': '#ffe6cb',  # skin highlight
    'd': '#e3a87d',  # skin shadow
    'w': '#ffffff',  # eye white / sparkle
    'B': '#5a3415',  # iris (brown)
    'm': '#b65a5a',  # mouth
    'M': '#7a2f2f',  # open mouth (dark)
    't': '#e58a8a',  # tongue
    'c': '#f7a9a0',  # cheek blush
    'T': '#ffffff',  # tooth
}

# ---- grid + head geometry -------------------------------------------------
W, H = 30, 22
CX, CY, R = 9.5, 10.7, 8.6        # head center & radius (a perfect circle)


def blank():
    return [['.'] * W for _ in range(H)]


def put(g, x, y, ch):
    if 0 <= y < H and 0 <= x < W:
        g[y][x] = ch


def head(g):
    """Filled skin circle with a 1px outline ring + light shading."""
    for y in range(H):
        for x in range(W):
            d = math.hypot((x + 0.5) - CX, (y + 0.5) - CY)
            if d <= R - 0.5:
                g[y][x] = 'S'
            elif d <= R + 0.5:
                g[y][x] = 'o'
    # soft shading: highlight upper-left, shadow lower band
    for y in range(H):
        for x in range(W):
            if g[y][x] != 'S':
                continue
            dx, dy = (x + 0.5) - CX, (y + 0.5) - CY
            d = math.hypot(dx, dy)
            if dy > R * 0.45 and d > R - 2.2:
                g[y][x] = 'd'
            elif dx < -R * 0.2 and dy < -R * 0.2 and d > R - 2.4:
                g[y][x] = 'H'


def hair(g):
    """A small black hair patch on the crown (less hair) + a little curl."""
    for y in range(H):
        for x in range(W):
            if g[y][x] not in ('S', 'H'):
                continue
            dx, dy = (x + 0.5) - CX, (y + 0.5) - CY
            d = math.hypot(dx, dy)
            # only the top cap, near the rim -> a fringe, leaving forehead bare
            if dy < -R * 0.62 and d > R - 3.0:
                g[y][x] = 'K'
    # a cute little curl hooking up at the very top
    cx = int(CX)
    put(g, cx, 2, 'K')
    put(g, cx, 1, 'K')
    put(g, cx + 1, 1, 'K')
    put(g, cx + 1, 2, 'k')


def eye(g, x, y, kind):
    """Cute eye anchored at top-left (x,y)."""
    if kind == 'open':                 # big round brown eye + white sparkle
        for j in range(3):
            for i in range(2):
                put(g, x + i, y + j, 'B')
        put(g, x, y, 'w')              # sparkle
    elif kind == 'angry':              # lowered eye + slanted brow (swat)
        for j in range(2):
            for i in range(2):
                put(g, x + i, y + 1 + j, 'B')
        put(g, x, y + 1, 'w')
        put(g, x, y, 'o'); put(g, x + 1, y - 0, 'o'); put(g, x + 2, y - 1, 'o')
    elif kind == 'happy':              # closed smiling eye (∪) for eating
        put(g, x, y, 'o'); put(g, x + 3, y, 'o')
        put(g, x + 1, y + 1, 'o'); put(g, x + 2, y + 1, 'o')
    elif kind == 'yuck':               # inverted arc (∩) — scrunched disgust
        put(g, x + 1, y,     'o'); put(g, x + 2, y,     'o')
        put(g, x,     y + 1, 'o'); put(g, x + 3, y + 1, 'o')


def cheeks(g, y):
    put(g, int(CX) - 6, y, 'c'); put(g, int(CX) - 5, y, 'c')
    put(g, int(CX) + 4, y, 'c'); put(g, int(CX) + 5, y, 'c')


def mouth(g, kind):
    cx = int(CX)
    if kind == 'small':                # tiny open mouth
        put(g, cx - 1, 14, 'o'); put(g, cx, 14, 'o')
        put(g, cx - 1, 15, 'M'); put(g, cx, 15, 'M')
    elif kind == 'flat':               # tight concentrating line
        for i in range(-2, 3):
            put(g, cx + i, 15, 'm')
        put(g, cx - 3, 15, 'o'); put(g, cx + 2 + 1, 15, 'o')
    elif kind == 'open':               # big happy munch with a tooth
        for j, row in enumerate(["oMMMo", "MMTMM", "oMtMo"]):
            for i, ch in enumerate(row):
                if ch != '.':
                    put(g, cx - 2 + i, 13 + j, ch)
    elif kind == 'tongue':             # grimace + tongue poking out
        put(g, cx - 2, 14, 'o'); put(g, cx + 1, 14, 'o')  # corners
        put(g, cx - 1, 14, 't'); put(g, cx,     14, 't')   # tongue top
        put(g, cx - 1, 15, 't'); put(g, cx,     15, 't')   # tongue mid
        put(g, cx,     16, 't')                             # tongue tip


def hands(g, kind):
    """Two hands to the right of the head. Forearms bridge to the face."""
    base = 20
    if kind == 'open':
        rows = ["..oo..", ".oSSo.", "SSdSo.", ".oSSo.", "..oo.."]
        ytop, ybot = 5, 12
    else:  # fists (swat) — raised, knuckle shading
        rows = [".oo..", "oSSo.", "SSdo.", "oSSo.", ".oo.."]
        ytop, ybot = 4, 11
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch != '.':
                put(g, base + i, ytop + j, ch)
                put(g, base + i, ybot + j, ch)


def build(eye_kind, mouth_kind, hands_kind, blush=True):
    g = blank()
    head(g)
    hair(g)
    # big eyes, symmetric around center
    eye(g, int(CX) - 5, 8, eye_kind)
    eye(g, int(CX) + 3, 8, eye_kind)
    if blush:
        cheeks(g, 12)
    mouth(g, mouth_kind)
    if hands_kind:                      # hands only drawn for the blocking pose
        hands(g, hands_kind)
    return g


SPRITES = {
    'catch': build('open',  'small',  None),
    'swat':  build('angry', 'flat',   'fist', blush=False),
    'eat':   build('happy', 'open',   None),
    'yuck':  build('yuck',  'tongue', None,   blush=False),
}


def to_svg(grid):
    rects = []
    for y, row in enumerate(grid):
        x = 0
        while x < W:
            ch = row[x]
            if ch == '.' or ch not in PALETTE:
                x += 1
                continue
            run = 1
            while x + run < W and row[x + run] == ch:
                run += 1
            rects.append(
                f'<rect x="{x}" y="{y}" width="{run}" height="1" fill="{PALETTE[ch]}"/>')
            x += run
    body = "\n".join(rects)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" '
            f'viewBox="0 0 {W} {H}" shape-rendering="crispEdges">\n{body}\n</svg>\n')


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = os.path.join(root, 'assets')
    os.makedirs(out, exist_ok=True)
    for name, grid in SPRITES.items():
        path = os.path.join(out, f'baby_{name}.svg')
        with open(path, 'w') as f:
            f.write(to_svg(grid))
        print('wrote', path)


if __name__ == '__main__':
    main()
