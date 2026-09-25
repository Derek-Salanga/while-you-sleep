"""Scan the layered cat for see-through pixels trapped inside its outline.

Stacks the layers exactly as src/components/SharedPet.tsx does -- head, ears
and eyes lowered by 24/1024 of the canvas, rounded to a device pixel -- at
the sizes the app ships (@1x/@2x/@3x runtime files) and at the 1024 source,
then flood-fills from outside. Anything below ALPHA that the fill can't
reach is a hole the Home background would show through.

    python3 scripts/check_cat_layers.py        # needs Pillow

Exits non-zero if any hole is found. Checking only the 1024 source is not
enough: shrinking blends edges and the rounded drop shifts the head's
outline relative to the body's, which is how @3x kept holes the source
didn't have.
"""
import sys
from collections import deque
from pathlib import Path

from PIL import Image

CAT = Path(__file__).resolve().parent.parent / 'assets' / 'cat'
ALPHA = 200
HEAD_GROUP = ['ear-left', 'ear-right', 'head', 'eyes-open']


def composite(files, drop):
    base = Image.open(files('tail')).convert('RGBA')
    out = Image.new('RGBA', base.size, (0, 0, 0, 0))
    out.alpha_composite(base)
    out.alpha_composite(Image.open(files('body')).convert('RGBA'))
    for name in HEAD_GROUP:
        out.alpha_composite(Image.open(files(name)).convert('RGBA'), (0, drop))
    return out


def trapped(img):
    w, h = img.size
    a = img.getchannel('A').load()
    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        q.extend([(x, 0), (x, h - 1)])
    for y in range(h):
        q.extend([(0, y), (w - 1, y)])
    while q:
        x, y = q.popleft()
        if not (0 <= x < w and 0 <= y < h):
            continue
        i = y * w + x
        if seen[i] or a[x, y] >= ALPHA:
            continue
        seen[i] = 1
        q.extend([(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)])
    return [(x, y) for y in range(h) for x in range(w)
            if a[x, y] < ALPHA and not seen[y * w + x]]


def main():
    bad = 0
    checks = [('source 1024', lambda n: CAT / f'cat-{n}.png', 24)]
    # SharedPet renders at up to 260pt: drop = round(260*24/1024) pt, in px.
    for suffix, scale in [('', 1), ('@2x', 2), ('@3x', 3)]:
        drop = round(260 * 24 / 1024) * scale
        checks.append((f'runtime{suffix or "@1x"}',
                       lambda n, s=suffix: CAT / 'runtime' / f'cat-{n}{s}.png',
                       drop))
    for label, files, drop in checks:
        holes = trapped(composite(files, drop))
        bad += len(holes)
        print(f'{label:14} drop={drop:3}px  trapped<{ALPHA}: {len(holes)}')
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
