#!/usr/bin/env python3
"""Build cloudflare-card/src/glyphs/noto-sans-kr.json: glyph outlines for the city card's fixed vocabulary.

The Worker draws card text as these outlines, so its PNG renderer needs no font file. Run once per vocabulary or
copy change, then commit the JSON. Requires fontTools (pip install fonttools) and Node (for the vocabulary).

The source font is Noto Sans KR from google/fonts (SIL Open Font License 1.1), pinned by commit and SHA-256:

    curl -fL -o NotoSansKR-wght.ttf \\
      https://raw.githubusercontent.com/google/fonts/b38c5c93af322c45f633e17ac440ec1e6c94d489/ofl/notosanskr/NotoSansKR%5Bwght%5D.ttf
    python3 cloudflare-card/scripts/build_glyphs.py --font NotoSansKR-wght.ttf          # writes the JSON
    python3 cloudflare-card/scripts/build_glyphs.py --font NotoSansKR-wght.ttf --check  # compares only

The output is a Modified Version of the font under the OFL: it keeps the copyright line, ships with OFL.txt and does
not use the Reserved Font Name "Source".
"""
import argparse
import hashlib
import json
import pathlib
import subprocess
import sys

import fontTools
from fontTools import subset
from fontTools.pens.basePen import BasePen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'cloudflare-card' / 'src' / 'glyphs' / 'noto-sans-kr.json'
FONT_COMMIT = 'b38c5c93af322c45f633e17ac440ec1e6c94d489'
FONT_SOURCE = f'https://github.com/google/fonts/blob/{FONT_COMMIT}/ofl/notosanskr/NotoSansKR%5Bwght%5D.ttf'
FONT_SHA256 = '194018e6b2b293a7964f037b25c0249ce1418bc9ab3c971060a03aa57861e252'
# The card's text weights (assets/city-card.js): stats and legend 500, houses 600, headings 700, city name 800.
WEIGHTS = (500, 600, 700, 800)
ELLIPSIS = chr(0x2026)


def numbers(values):
    """Join integers the compact SVG way: a minus sign separates numbers without a space."""
    out = ''
    for value in values:
        text = str(value)
        out += text if not out or text.startswith('-') else ' ' + text
    return out


class RelativePathPen(BasePen):
    """SVG path data in whole font units, y pointing down, every command relative."""

    def __init__(self, glyph_set):
        super().__init__(glyph_set)
        self.parts = []
        self.current = (0, 0)
        self.start = (0, 0)

    @staticmethod
    def point(pt):
        return round(pt[0]), -round(pt[1])

    def emit(self, command, points):
        deltas = []
        for x, y in points:
            deltas += [x - self.current[0], y - self.current[1]]
        self.parts.append(command + numbers(deltas))
        self.current = points[-1]

    def _moveTo(self, pt):
        self.emit('m', [self.point(pt)])
        self.start = self.current

    def _lineTo(self, pt):
        self.emit('l', [self.point(pt)])

    def _qCurveToOne(self, pt1, pt2):
        self.emit('q', [self.point(pt1), self.point(pt2)])

    def _curveToOne(self, pt1, pt2, pt3):
        self.emit('c', [self.point(pt1), self.point(pt2), self.point(pt3)])

    def _closePath(self):
        self.parts.append('z')
        self.current = self.start

    def _endPath(self):
        self.current = self.start

    def d(self):
        return ''.join(self.parts)


def vocabulary():
    script = ROOT / 'cloudflare-card' / 'scripts' / 'card-vocabulary.mjs'
    result = subprocess.run(['node', str(script)], cwd=ROOT, check=True, capture_output=True, text=True)
    return json.loads(result.stdout)['chars']


def build(font_path, allow_other_font=False):
    data = pathlib.Path(font_path).read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if digest != FONT_SHA256 and not allow_other_font:
        sys.exit(f'font SHA-256 {digest} is not the pinned {FONT_SHA256}; pass --allow-other-font to use it anyway')
    chars = vocabulary()
    font = TTFont(font_path)
    cmap = font.getBestCmap()
    missing = [char for char in chars if ord(char) not in cmap]
    if missing:
        sys.exit('the font has no glyph for: ' + ' '.join(f'U+{ord(char):04X}' for char in missing))
    names = font['name']
    header = {
        'schema': 'repolis.card-glyphs',
        'version': 1,
        'font': {
            'family': 'Noto Sans KR',
            'version': names.getDebugName(5),
            'copyright': names.getDebugName(0),
            'license': 'SIL Open Font License 1.1 (OFL.txt beside this file)',
            'source': FONT_SOURCE,
            'sha256': digest,
            'modified': 'Outlines of a fixed character set converted to SVG path data at fixed weights; '
                        'U+2026 is drawn as three baseline periods instead of the centered CJK ellipsis.',
        },
        'generator': f'cloudflare-card/scripts/build_glyphs.py (fontTools {fontTools.version})',
        'unitsPerEm': font['head'].unitsPerEm,
        'weights': list(WEIGHTS),
    }

    options = subset.Options()
    options.glyph_names = True
    options.notdef_outline = False
    options.layout_features = []
    options.name_IDs = ['*']
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=[ord(char) for char in chars])
    subsetter.subset(font)

    glyphs = {}
    for weight in WEIGHTS:
        instance = instancer.instantiateVariableFont(font, {'wght': weight}, inplace=False)
        glyph_set = instance.getGlyphSet()
        best = instance.getBestCmap()
        table = {}
        for char in chars:
            pen = RelativePathPen(glyph_set)
            if char == ELLIPSIS:
                # The font's ellipsis is a centered, full-width CJK form; card text cut with '…' is mostly Latin.
                period = best[ord('.')]
                advance = instance['hmtx'][period][0]
                for step in range(3):
                    glyph_set[period].draw(TransformPen(pen, (1, 0, 0, 1, step * advance, 0)))
                table[char] = [3 * advance, pen.d()]
                continue
            name = best[ord(char)]
            glyph_set[name].draw(pen)
            table[char] = [instance['hmtx'][name][0], pen.d()]
        glyphs[str(weight)] = table

    lines = ['{']
    for key, value in header.items():
        lines.append(f'  {json.dumps(key)}: {json.dumps(value, ensure_ascii=False)},')
    lines.append('  "glyphs": {')
    for index, weight in enumerate(WEIGHTS):
        table = glyphs[str(weight)]
        lines.append(f'    "{weight}": {{')
        lines.append(',\n'.join(f'      {json.dumps(char, ensure_ascii=False)}: {json.dumps(table[char])}' for char in chars))
        lines.append('    }' + (',' if index < len(WEIGHTS) - 1 else ''))
    lines.append('  }')
    lines.append('}')
    return '\n'.join(lines) + '\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--font', required=True, help='NotoSansKR[wght].ttf from the pinned google/fonts commit')
    parser.add_argument('--out', default=str(OUT))
    parser.add_argument('--check', action='store_true', help='compare with the existing file instead of writing it')
    parser.add_argument('--allow-other-font', action='store_true')
    args = parser.parse_args()
    text = build(args.font, args.allow_other_font)
    out = pathlib.Path(args.out)
    if args.check:
        same = out.exists() and out.read_text(encoding='utf-8') == text
        print('glyphs up to date' if same else f'{out} differs from a fresh build')
        sys.exit(0 if same else 1)
    out.write_text(text, encoding='utf-8')
    print(f'wrote {out} ({len(text.encode("utf-8"))} bytes)')


if __name__ == '__main__':
    main()
