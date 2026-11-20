"""Build the Workzen asset set from the SVG master geometry (workzen-symbol.svg)."""
import json, os, struct, subprocess
from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen
from fontTools.svgLib.path import parse_path

S = '/private/tmp/claude-501/-Volumes-work-disk-Codes-Tracker/c63c7fd8-b7d5-47f2-a031-ede68725c4e2/scratchpad'
OUT = f'{S}/out'
for d in ('svg', 'icons', 'favicon', 'png', 'og'):
    os.makedirs(f'{OUT}/{d}', exist_ok=True)

NAVY, INDIGO, BLUE, TEAL, WHITE = '#101D32', '#3738E8', '#08A8E8', '#19C98B', '#FFFFFF'
ol = json.load(open(f'{S}/outlines.json'))
LOGO_D, LOGO_W = ol['logo']
WORD_D, WORD_W = ol['wordmark']


def bounds(d):
    from fontTools.pens.boundsPen import BoundsPen
    bp = BoundsPen(None)
    parse_path(d, bp)
    return bp.bounds


# ---- symbol geometry (identical to svg/workzen-symbol.svg) -----------------------------------
SW = 49
FAV_SW = 38  # optical size: slimmer ribbons keep the W's counters open at 16-32px
PATHS = [('M53 52 L91 139', 'L'), ('M91 139 L128 72 L165 139', 'M'), ('M165 139 L203 52', 'R')]
GRAD = {'L': (INDIGO, '#245DEB'), 'M': (BLUE, '#087EDB'), 'R': (TEAL, '#0BAA9A')}
# ink bounds of the symbol: stroke half-width 24.5 around the polyline extremes
SYM = (53 - 24.5 - 0, 52 - 24.5, 203 + 24.5, 139 + 24.5)  # x0,y0,x1,y1 (round joins/caps stay inside)
SYM_CX, SYM_CY = (SYM[0] + SYM[2]) / 2, (SYM[1] + SYM[3]) / 2  # 128, 95.5


def defs(p):
    out = '<defs>'
    for k, (a, b) in GRAD.items():
        out += f'<linearGradient id="{p}{k}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{a}"/><stop offset="1" stop-color="{b}"/></linearGradient>'
    return out + '</defs>'


def symbol(p, mode='gradient', sw=SW):
    """mode: gradient | mono | white (strokes only)."""
    g = f'<g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="{sw}"'
    if mode == 'gradient':
        body = ''.join(f'<path d="{d}" stroke="url(#{p}{k})"/>' for d, k in PATHS)
        return g + '>' + body + '</g>'
    col = NAVY if mode == 'mono' else WHITE
    return g + f' stroke="{col}">' + ''.join(f'<path d="{d}"/>' for d, _ in PATHS) + '</g>'


def svg(vb, inner, extra='', title=None, desc=None):
    x, y, w, h = vb
    head = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x:g} {y:g} {w:g} {h:g}"{extra}'
    if title:
        head += ' role="img" aria-labelledby="title' + ('' if not desc else ' desc') + '">'
        head += f'<title id="title">{title}</title>' + (f'<desc id="desc">{desc}</desc>' if desc else '')
    else:
        head += '>'
    return head + inner + '</svg>\n'


def w(path, text):
    open(f'{OUT}/{path}', 'w').write(text)


# ---- masters (original canvases, text converted to outlines) ---------------------------------
logo_inner = lambda sym, fill: f'<g transform="scale(.72)">{sym}</g><path d="{LOGO_D}" fill="{fill}"/>'
w('svg/workzen-logo.svg', svg((0, 0, 760, 192), defs('wzl') + logo_inner(symbol('wzl'), NAVY), title='workzen logo',
                              desc='Abstract blue and teal W symbol beside the workzen wordmark.'))
w('svg/workzen-logo-white.svg', svg((0, 0, 760, 192), logo_inner(symbol('', 'white'), WHITE), title='workzen white logo'))
w('svg/workzen-wordmark.svg', svg((0, 0, 520, 112), f'<path d="{WORD_D}" fill="{NAVY}"/>', title='workzen wordmark'))
w('svg/workzen-symbol.svg', svg((0, 0, 256, 192), defs('wzs') + symbol('wzs'), title='workzen symbol',
                                desc='Three flowing rounded ribbons form an abstract letter W.'))
w('svg/workzen-symbol-mono.svg', svg((0, 0, 256, 192), symbol('', 'mono'), title='workzen symbol'))
w('svg/workzen-symbol-white.svg', svg((0, 0, 256, 192), symbol('', 'white'), title='workzen white symbol'))

# ---- tight in-app logos --------------------------------------------------------------------
tb = bounds(LOGO_D)  # text ink bounds in master coordinates
x0 = SYM[0] * .72
x1 = tb[2]
y0 = min(SYM[1] * .72, tb[1])
y1 = max(SYM[3] * .72, tb[3])
pad = 0.5
TIGHT = (x0 - pad, y0 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad)
w('icons/workzen-logo.svg', svg(TIGHT, defs('wzl') + f'<g transform="scale(.72)">{symbol("wzl")}</g><path d="{LOGO_D}" fill="currentColor"/>',
                                ' fill="none"'))
side = SYM[2] - SYM[0]  # square viewBox centred on the symbol so it keeps the old mark's footprint
w('icons/workzen-symbol.svg', svg((SYM[0], SYM_CY - side / 2, side, side), defs('wzs') + symbol('wzs'), ' fill="none"'))

# ---- favicons / app icons --------------------------------------------------------------------
def tile(size, bg, rx, fill_ratio, p, sw=SW):
    """Square tile `size` with the gradient symbol scaled so its width is fill_ratio of the tile."""
    k = size * fill_ratio / side
    tx, ty = size / 2 - SYM_CX * k, size / 2 - SYM_CY * k
    rect = f'<rect width="{size}" height="{size}" rx="{rx}" fill="{bg}"/>' if bg else ''
    return defs(p) + rect + f'<g transform="translate({tx:.3f} {ty:.3f}) scale({k:.5f})">{symbol(p, 'gradient', sw)}</g>'


# adaptive: transparent mark on light browser chrome, navy tile in dark mode (Chrome/Firefox honour the media query in SVG icons)
_k = lambda ratio: 64 * ratio / side
_g = lambda ratio, bg: (f'<rect width="64" height="64" rx="14" fill="{bg}"/>' if bg else '') + \
    f'<g transform="translate({32 - SYM_CX * _k(ratio):.3f} {32 - SYM_CY * _k(ratio):.3f}) scale({_k(ratio):.5f})">{symbol("wzf", "gradient", FAV_SW)}</g>'
w('favicon/favicon.svg', svg((0, 0, 64, 64),
    '<style>.d{display:none}@media (prefers-color-scheme:dark){.l{display:none}.d{display:inline}}</style>' + defs('wzf') +
    f'<g class="l">{_g(.96, None)}</g><g class="d">{_g(.82, NAVY)}</g>'))
w('favicon/favicon-light.svg', svg((0, 0, 64, 64), tile(64, WHITE, 14, .82, 'wzf', FAV_SW)))
w('favicon/favicon-dark.svg', svg((0, 0, 64, 64), tile(64, NAVY, 14, .82, 'wzf', FAV_SW)))
w('favicon/app-icon.svg', svg((0, 0, 1024, 1024), tile(1024, WHITE, 230, .62, 'wza'), title='workzen app icon'))
w('favicon/app-icon-dark.svg', svg((0, 0, 1024, 1024), tile(1024, NAVY, 230, .62, 'wza'), title='workzen app icon (dark)'))
# opaque, square-cornered: iOS / Android apply their own mask
w('favicon/apple-touch-icon.svg', svg((0, 0, 180, 180), tile(180, WHITE, 0, .66, 'wzt')))

# ---- Open Graph (1200x630) ----------------------------------------------------------------
def og(bg, text_fill, p):
    tw, th = TIGHT[2], TIGHT[3]
    k = 760 / tw  # logo ~760px wide on a 1200px card
    tx, ty = (1200 - tw * k) / 2 - TIGHT[0] * k, (630 - th * k) / 2 - TIGHT[1] * k
    return (defs(p) + f'<rect width="1200" height="630" fill="{bg}"/>'
            f'<g transform="translate({tx:.2f} {ty:.2f}) scale({k:.4f})"><g transform="scale(.72)">{symbol(p)}</g>'
            f'<path d="{LOGO_D}" fill="{text_fill}"/></g>')


w('og/og-image.svg', svg((0, 0, 1200, 630), og(WHITE, NAVY, 'wzo'), title='workzen'))
w('og/og-image-dark.svg', svg((0, 0, 1200, 630), og(NAVY, WHITE, 'wzo'), title='workzen'))

json.dump({'tight': TIGHT, 'logo_text_bounds': tb}, open(f'{OUT}/meta.json', 'w'))
print('tight viewBox', [round(v, 2) for v in TIGHT], 'aspect', round(TIGHT[2] / TIGHT[3], 3))
