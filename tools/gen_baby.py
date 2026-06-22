#!/usr/bin/env python3
"""Generate 16-bit pixel-art baby SVGs from ASCII grids.

Each character maps to a colour (PALETTE). Every non-transparent cell
becomes a 1x1 <rect>; the SVG viewBox is the grid size so it scales
crisply when drawn to the game canvas. Run from the repo root:

    python3 tools/gen_baby.py

Outputs assets/baby_catch.svg, baby_swat.svg, baby_eat.svg.
"""
import os

PALETTE = {
    'o': '#3b2415',  # outline (dark brown)
    'K': '#15131a',  # black hair
    'k': '#3a3550',  # hair highlight
    'S': '#f7c9a1',  # skin
    'H': '#ffe2c4',  # skin highlight
    'd': '#d99c72',  # skin shadow
    'w': '#ffffff',  # eye white
    'B': '#6b4327',  # iris (brown)
    'b': '#41280f',  # iris dark / pupil
    'm': '#9c4646',  # mouth
    'M': '#5e2424',  # open mouth (dark)
    't': '#e58a8a',  # tongue
    'c': '#f0a596',  # cheek blush
    'T': '#ffffff',  # tooth
}

# ---- shared 24x20 head; eyes (rows 8-10) and mouth (rows 12-14) and the
# ---- right-side hands get stamped per expression below. '.' = transparent.
HEAD = [
    "....ooooooooo...........",
    "...oKKKKKKKKKo..........",
    "..oKKKKKKKKKKKo.........",
    "..oKKkKKKKKkKKo.........",
    "..oKKSSSSSSSSKKo........",
    "..oKSSSSSSSSSSKo........",
    "..oSSSSSSSSSSSSo........",
    "..oSSSSSSSSSSSSo........",
    "..oSSSSSSSSSSSSo........",  # 8  eyes stamped here
    "..oSSSSSSSSSSSSo........",  # 9
    "..oSSSSSSSSSSSSo........",  # 10
    "..oSSSSSSSSSSSSo........",  # 11
    "..oSSSSSSSSSSSSo........",  # 12 mouth stamped here
    "..oSSSSSSSSSSSSo........",  # 13
    "..oSSSSSSSSSSSSo........",  # 14
    "..odSSSSSSSSSSdo........",  # 15 chin shading
    "...oddSSSSSSddo.........",  # 16
    "....oodddddoo..........",
    ".......ooooo...........",
    ".......................",
]


def stamp(grid, row, col, text):
    """Overwrite grid[row] starting at col with text."""
    s = grid[row]
    grid[row] = s[:col] + text + s[col + len(text):]


def pad(grid):
    w = max(len(r) for r in grid)
    return [r.ljust(w, '.') for r in grid], w


def build(eyes, mouth, hands):
    g = list(HEAD)
    # eyes: two 3-wide eyes at cols 4-6 and 9-11, rows 8-10
    for i, line in enumerate(eyes):
        stamp(g, 8 + i, 4, line[:3]);  stamp(g, 8 + i, 9, line[3:6])
    # mouth: 6 wide at cols 5-10, rows 12-14
    for i, line in enumerate(mouth):
        stamp(g, 12 + i, 5, line)
    # hands: 6-wide region at cols 16-21, rows 5-15
    for i, line in enumerate(hands):
        stamp(g, 5 + i, 16, line)
    return g


# eyes: 3 cols per eye, 3 rows. White sclera 'w', brown iris 'B'. Use 'S'
# (skin) for the non-eye cells so we never punch transparent holes in the face.
EYES_OPEN = ["wwwwww", "wBwwBw", "SSSSSS"]          # round, alert
EYES_DETERMINED = ["oooooo", "wBwwBw", "SSSSSS"]    # heavy brow, focused (swat)
EYES_SQUINT = ["SoSSoS", "oSooSo", "SSSSSS"]        # ∧ ∧ happy squint (eating)

# mouth: 6 wide, 3 rows (cols 5-10). 'S' keeps the surrounding face solid.
MOUTH_SMALL = ["SSooSS", "SoMMoS", "SSooSS"]        # catch: small open
MOUTH_OPEN = ["oMMMMo", "oMTTMo", "ooMMoo"]         # eating: big happy munch
MOUTH_FLAT = ["SSSSSS", "ommmmo", "SSSSSS"]         # swat: tight line

# hands: 6-wide region at cols 16-21, rows 5-15. Forearms (SS at the region's
# left edge) bridge the small gap to the head so the hands read as attached.
HANDS_OPEN = [   # cupped/open, ready to catch
    "..oo..",
    ".oSSo.",
    "SSSSo.",
    ".oSSo.",
    "..oo..",
    "......",
    "..oo..",
    ".oSSo.",
    "SSSSo.",
    ".oSSo.",
    "..oo..",
]
HANDS_FIST = [   # raised closed fists, ready to swat
    ".oo...",
    "oSSo..",
    "SSSo..",
    "oSSo..",
    ".oo...",
    "......",
    ".oo...",
    "oSSo..",
    "SSSo..",
    "oSSo..",
    ".oo...",
]

SPRITES = {
    'catch': build(EYES_OPEN, MOUTH_SMALL, HANDS_OPEN),
    'swat':  build(EYES_DETERMINED, MOUTH_FLAT, HANDS_FIST),
    'eat':   build(EYES_SQUINT, MOUTH_OPEN, HANDS_OPEN),
}


def to_svg(grid):
    grid, w = pad(grid)
    h = len(grid)
    rects = []
    for y, row in enumerate(grid):
        x = 0
        while x < len(row):
            ch = row[x]
            if ch == '.' or ch not in PALETTE:
                x += 1
                continue
            # merge horizontal run of same colour into one rect
            run = 1
            while x + run < len(row) and row[x + run] == ch:
                run += 1
            rects.append(
                f'<rect x="{x}" y="{y}" width="{run}" height="1" fill="{PALETTE[ch]}"/>')
            x += run
    body = "\n".join(rects)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" '
            f'viewBox="0 0 {w} {h}" shape-rendering="crispEdges">\n{body}\n</svg>\n')


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = os.path.join(root, 'assets')
    os.makedirs(out, exist_ok=True)
    for name, grid in SPRITES.items():
        # sanity: every row equal length
        lens = {len(r) for r in pad(grid)[0]}
        assert len(lens) == 1, (name, lens)
        path = os.path.join(out, f'baby_{name}.svg')
        with open(path, 'w') as f:
            f.write(to_svg(grid))
        print('wrote', path)


if __name__ == '__main__':
    main()
