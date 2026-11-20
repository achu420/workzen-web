"""Outline the 'workzen' wordmark: Inter (OFL) @ wght 700, shaped with HarfBuzz (kerning), as SVG path data."""
import json, sys
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
import uharfbuzz as hb

S = '/private/tmp/claude-501/-Volumes-work-disk-Codes-Tracker/c63c7fd8-b7d5-47f2-a031-ede68725c4e2/scratchpad'
font = TTFont(f'{S}/Inter-V.ttf')
bold = instancer.instantiateVariableFont(font, {'wght': 700, 'opsz': 14} if 'opsz' in [a.axisTag for a in font['fvar'].axes] else {'wght': 700})
bold.save(f'{S}/Inter-700.ttf')
font = TTFont(f'{S}/Inter-700.ttf')
gs = font.getGlyphSet()
upem = font['head'].unitsPerEm
order = font.getGlyphOrder()

blob = hb.Blob.from_file_path(f'{S}/Inter-700.ttf')
face = hb.Face(blob); hbfont = hb.Font(face)
buf = hb.Buffer(); buf.add_str('workzen'); buf.guess_segment_properties()
hb.shape(hbfont, buf, {'kern': True, 'liga': False})


def outline(size, x0, baseline, letter_spacing):
    """Return (path_d, advance_width) for the text at font-size `size`."""
    scale = size / upem
    x = x0
    pen = SVGPathPen(gs, ntos=lambda v: f'{v:.2f}'.rstrip('0').rstrip('.'))
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        name = order[info.codepoint]
        tp = TransformPen(pen, (scale, 0, 0, -scale, x + pos.x_offset * scale, baseline - pos.y_offset * scale))
        gs[name].draw(tp)
        x += pos.x_advance * scale + letter_spacing
    return pen.getCommands(), x - x0


if __name__ == '__main__':
    out = {}
    # (size, x, baseline, letter-spacing) exactly as in the supplied SVGs
    out['logo'] = outline(112, 205, 137, -6)
    out['wordmark'] = outline(88, 4, 82, -5)
    out['upem'] = upem
    out['metrics'] = {k: font['OS/2'].__dict__.get(k) for k in ('sxHeight', 'sCapHeight')}
    json.dump(out, open(f'{S}/outlines.json', 'w'))
    print('logo width', round(out['logo'][1], 1), 'wordmark width', round(out['wordmark'][1], 1))
