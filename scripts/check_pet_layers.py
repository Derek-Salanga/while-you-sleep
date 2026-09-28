"""Scan the layered pets for see-through pixels trapped inside their outlines.

Stacks each species exactly as src/components/SharedPet.tsx does at the
1024px source size and at the shipped @1x/@2x/@3x runtime sizes, then
flood-fills from outside. Anything below ALPHA that the fill cannot reach is
a hole the Home background would show through.

    python3 scripts/check_pet_layers.py        # needs Pillow

Exits non-zero if any hole is found. Checking only the 1024px sources is not
enough: shrinking blends edges, and the cat's rounded head offset changes its
outline alignment at each density.
"""
import sys
from collections import deque
from pathlib import Path

from PIL import Image


ASSETS = Path(__file__).resolve().parent.parent / 'assets'
ALPHA = 200
HEAD_GROUP = ['ear-left', 'ear-right', 'head']
PETS = {
    'cat': {'head_drop': 24},
    'dog': {'head_drop': 0},
}


def composite(files, drop, eyes):
    base = Image.open(files('tail')).convert('RGBA')
    out = Image.new('RGBA', base.size, (0, 0, 0, 0))
    out.alpha_composite(base)
    out.alpha_composite(Image.open(files('body')).convert('RGBA'))
    for name in [*HEAD_GROUP, eyes]:
        out.alpha_composite(Image.open(files(name)).convert('RGBA'), (0, drop))
    return out


def trapped(img):
    width, height = img.size
    alpha = img.getchannel('A').load()
    seen = bytearray(width * height)
    queue = deque()
    for x in range(width):
        queue.extend([(x, 0), (x, height - 1)])
    for y in range(height):
        queue.extend([(0, y), (width - 1, y)])
    while queue:
        x, y = queue.popleft()
        if not (0 <= x < width and 0 <= y < height):
            continue
        i = y * width + x
        if seen[i] or alpha[x, y] >= ALPHA:
            continue
        seen[i] = 1
        queue.extend([(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)])
    return [
        (x, y)
        for y in range(height)
        for x in range(width)
        if alpha[x, y] < ALPHA and not seen[y * width + x]
    ]


def checks_for(species, head_drop):
    pet = ASSETS / species
    yield (
        'source 1024',
        lambda name: pet / f'{species}-{name}.png',
        head_drop,
    )
    # SharedPet renders at up to 260pt. Round the logical offset once, then
    # scale it to the selected density just as React Native does.
    for suffix, scale in [('', 1), ('@2x', 2), ('@3x', 3)]:
        drop = round(260 * head_drop / 1024) * scale
        yield (
            f'runtime{suffix or "@1x"}',
            lambda name, s=suffix: pet / 'runtime' / f'{species}-{name}{s}.png',
            drop,
        )


def main():
    bad = 0
    for species, rig in PETS.items():
        for label, files, drop in checks_for(species, rig['head_drop']):
            for eyes in ['eyes-open', 'eyes-closed']:
                holes = trapped(composite(files, drop, eyes))
                bad += len(holes)
                print(
                    f'{species:4} {label:14} {eyes:11} '
                    f'drop={drop:3}px  trapped<{ALPHA}: {len(holes)}'
                )
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
