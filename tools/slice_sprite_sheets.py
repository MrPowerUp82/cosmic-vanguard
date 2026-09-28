"""Slice the labelled (ChatGPT-style) sprite sheets into the uniform game atlas.

Input:  assets/sprites/<hero>.png and assets/sprites/enemies/<enemy>.png
        (free-form layout: a label box per animation, frames laid out below it).
Output: assets/sprites/processed/<hero>.png and processed/enemies/<enemy>.png —
        a grid of CELL_W x CELL_H cells, one row per animation in ACTIONS order,
        frames left to right.
        assets/sprites/processed/atlas.js — cell size and frame counts, loaded by
        game.js and sprite-viewer.html (window.SPRITE_ATLAS).

How it works:
1. Mask = pixels with alpha >= 245 (the character bodies and label boxes; glow
   and halos are semi-transparent and fall outside it).
2. Label boxes are wide, short, solid rectangles. They are removed from the sheet.
3. Big components are frames; small ones (orbs, sparks, spear tips) attach to
   the nearest frame. Each frame belongs to the label above it on the left.
4. Every visible pixel (glow included) goes to the nearest frame body, so
   overlapping glows are split cleanly instead of bleeding into neighbours.
5. Each frame is placed in its cell with the torso centred horizontally and the
   feet on BASE_Y. Vertical offsets inside an animation are kept (jumps rise).

Run: python tools/slice_sprite_sheets.py [--debug]
"""

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parent.parent
SPRITES = ROOT / 'assets' / 'sprites'
OUT_DIR = SPRITES / 'processed'
MANIFEST = OUT_DIR / 'atlas.js'
DEBUG_DIR = ROOT / 'tools' / 'slice_debug'

CELL_W = 480
CELL_H = 320
BASE_Y = 305  # feet line inside the cell
ACTIONS = ['idle', 'walk', 'attack', 'jump', 'dash', 'hurt', 'special']

HEROES = ['solarion', 'night_talon', 'valoria', 'red_velocity', 'abyss_king', 'emerald_nova']
ENEMIES = ['shadow_trooper', 'pulse_gunner', 'armored_brute', 'rift_assassin', 'void_tyrant']

# Labels in reading order (top-to-bottom, left-to-right): (animation, frames drawn).
# The frame count is what is actually drawn on the sheet, not what the label says.
STANDARD = [('idle', 4), ('walk', 7), ('attack', 4), ('jump', 3), ('dash', 4), ('hurt', 2), ('special', 6)]
LAYOUT = {
    'red_velocity': [('idle', 4), ('walk', 7), ('attack', 4), ('jump', 3), ('dash', 4), ('hurt', 2), ('special', 5)],
    'abyss_king': [('idle', 4), ('walk', 6), ('attack', 4), ('jump', 3), ('dash', 4), ('hurt', 2), ('special', 6)],
    'armored_brute': [('idle', 4), ('walk', 6), ('attack', 4), ('jump', 2), ('hurt', 2), ('special', 6)],
    'pulse_gunner': [('idle', 4), ('walk', 6), ('attack', 4), ('jump', 3), ('hurt', 2), ('special', 5)],
    'shadow_trooper': [('idle', 4), ('walk', 6), ('attack', 4), ('jump', 3), ('hurt', 1), ('special', 6)],
    'rift_assassin': [('idle', 4), ('walk', 6), ('attack', 4), ('jump', 3), ('hurt', 2), ('special', 6)],
    'void_tyrant': [('idle', 4), ('walk', 7), ('attack', 3), ('jump', 3), ('hurt', 2), ('special', 3)],
}
# Sheets whose animation rows touch each other: hand-drawn regions per animation,
# as lists of (x0, y0, x1, y1) rectangles on the source sheet.
REGIONS = {
    'armored_brute': {
        'idle': [(0, 50, 690, 290)], 'walk': [(680, 50, 1672, 290)],
        'attack': [(0, 335, 875, 605)],
        'hurt': [(1300, 395, 1672, 612)],
        # The special frames share one fire trail and the jump draws only 2 frames.
        'jump': {'frames': [[(860, 335, 1045, 535)], [(1045, 380, 1310, 612), (945, 535, 1045, 612)]]},
        'special': {'frames': [[(0, 655, 250, 941)], [(250, 655, 485, 941)], [(485, 655, 740, 941)],
                               [(740, 655, 1030, 941)], [(1030, 655, 1385, 941)], [(1385, 655, 1672, 941)]]},
    },
    'void_tyrant': {
        'idle': [(0, 45, 665, 265)], 'walk': [(665, 45, 1672, 265)],
        'attack': [(0, 300, 985, 612)], 'jump': [(985, 300, 1672, 528)],
        'hurt': [(1100, 570, 1672, 730)],
        # Only 3 special frames are drawn; the wave after them is one big effect.
        'special': {'frames': [[(0, 655, 235, 941)], [(235, 655, 470, 941)], [(470, 655, 700, 941)]]},
    },
    'shadow_trooper': {
        'idle': [(0, 50, 600, 280)], 'walk': [(600, 50, 1672, 280)],
        'attack': [(0, 320, 1030, 560)], 'jump': [(1030, 335, 1672, 590)],
        'hurt': [(380, 560, 640, 690)], 'special': [(0, 722, 1672, 941)],
    },
    'rift_assassin': {
        'idle': [(0, 45, 600, 265)], 'walk': [(600, 45, 1672, 265)],
        'attack': [(0, 310, 1040, 560)], 'jump': [(1040, 300, 1672, 525)],
        'hurt': [(1100, 540, 1672, 700)], 'special': [(0, 620, 1100, 941), (1100, 700, 1672, 941)],
    },
    'pulse_gunner': {
        'idle': [(0, 55, 670, 315)], 'walk': [(670, 55, 1672, 315)],
        'attack': [(0, 370, 1098, 610)], 'jump': [(1098, 368, 1672, 565)],
        'hurt': {'frames': [[(1300, 600, 1470, 795), (1235, 600, 1300, 740)], [(1470, 600, 1672, 795)]]},
        'special': [(0, 730, 1235, 941), (1235, 795, 1672, 941)],
    },
}
# Art that belongs to no frame (erased before slicing): (x0, y0, x1, y1).
EXCLUDE = {
    'void_tyrant': [(700, 650, 1150, 941), (1100, 730, 1672, 941)],  # the unsplittable wave
}
# Thin cuts (x0, y0, x1, y1) that separate art from different frames that touches.
CUTS = {
    'abyss_king': [(1083, 300, 1087, 470)],  # attack trident tip vs. first jump frame
    'solarion': [(560, 699, 720, 702)],      # dash trail vs. the special's solar orb
}
# Label boxes the detector misses (overlapped by art): (y0, x0, y1, x1).
EXTRA_LABELS = {}
# Animations missing from a sheet reuse frames of another one.
FALLBACK = {'dash': 'walk', 'jump': 'attack', 'hurt': 'idle', 'special': 'attack', 'attack': 'idle', 'walk': 'idle'}

ALPHA_SOLID = 245
MAX_GLOW_DIST = 90  # glow farther than this from any body is dropped


def sheet_path(cid):
    return SPRITES / ('enemies' if cid in ENEMIES else '') / f'{cid}.png'


def find_labels(solid, rgb):
    """Label boxes: dark, solid rectangles ~40 px tall and >= 180 px wide.

    An opening with a 28x90 block keeps only thick solid areas, which strips away
    the glow and art touching the box; the dark interior rules out bright beams.
    """
    opened = ndi.binary_opening(solid, structure=np.ones((28, 90), bool))
    lab, _ = ndi.label(opened)
    boxes = []
    for sl in ndi.find_objects(lab):
        y0, y1, x0, x1 = sl[0].start, sl[0].stop, sl[1].start, sl[1].stop
        if not (25 <= y1 - y0 <= 48 and x1 - x0 >= 180):
            continue
        if rgb[y0:y1, x0:x1].mean() > 110:
            continue
        boxes.append((y0, x0, y1, x1))
    return boxes


def find_parts(solid, label_mask):
    lab, _ = ndi.label(ndi.binary_opening(solid & ~label_mask, iterations=1))
    parts = []
    for i, sl in enumerate(ndi.find_objects(lab), start=1):
        if sl is None:
            continue
        area = int((lab[sl] == i).sum())
        if area >= 60:
            parts.append({'id': i, 'box': (sl[0].start, sl[1].start, sl[0].stop, sl[1].stop), 'area': area})
    return lab, parts


def reading_order(boxes):
    """Sort label boxes top-to-bottom, then left-to-right within a visual row."""
    boxes = sorted(boxes)
    rows, row_y = [], None
    for b in boxes:
        if row_y is None or b[0] - row_y > 25:
            rows.append([])
            row_y = b[0]
        rows[-1].append(b)
    return [b for row in rows for b in sorted(row, key=lambda b: b[1])]


def owner_label(labels, cx, cy, slack=0):
    """Label for a frame centred at (cx, cy): the lowest label above it that starts left of it."""
    best = None
    for idx, (y0, x0, y1, x1) in enumerate(labels):
        if y1 > cy or x0 > cx + slack:
            continue
        if best is None or idx > best:
            best = idx
    return best


def split_merged(lab, bodies, layout):
    """Split components holding several touching frames (shared glow/effects).

    While a label has fewer bodies than frames drawn, cut its widest body at the
    thinnest column, searching at least half a typical frame width from each edge.
    """
    widths = sorted(b['box'][3] - b['box'][1] for b in bodies)
    typical = widths[len(widths) // 2]
    next_id = lab.max() + 1
    for li, (_, expected) in enumerate(layout):
        while True:
            mine = [b for b in bodies if b['label'] == li]
            if not mine or len(mine) >= expected:
                break
            b = max(mine, key=lambda b: b['box'][3] - b['box'][1])
            y0, x0, y1, x1 = b['box']
            siblings = sorted(o['box'][3] - o['box'][1] for o in mine if o is not b)
            ref = min(siblings[len(siblings) // 2], typical) if len(siblings) >= 2 else typical
            if x1 - x0 < ref * 1.4:
                break
            region = lab[y0:y1, x0:x1] == b['id']
            cols = np.convolve(region.sum(0), np.ones(9) / 9, mode='same')
            lo, hi = int(ref * 0.5), (x1 - x0) - int(ref * 0.5)
            if hi <= lo:
                break
            cut = lo + int(np.argmin(cols[lo:hi]))
            right = np.zeros_like(region)
            right[:, cut:] = region[:, cut:]
            lab[y0:y1, x0:x1][right] = next_id
            for part_id, part in ((b['id'], region & ~right), (next_id, right)):
                ys, xs = np.nonzero(part)
                bodies.append({'id': part_id, 'label': li, 'area': int(part.sum()),
                               'box': (y0 + ys.min(), x0 + xs.min(), y0 + ys.max() + 1, x0 + xs.max() + 1)})
            bodies.remove(b)
            next_id += 1

    # Too many bodies: the smallest is a loose effect; fold it into its nearest neighbour.
    for li, (_, expected) in enumerate(layout):
        while True:
            mine = [b for b in bodies if b['label'] == li]
            if len(mine) <= expected:
                break
            b = min(mine, key=lambda b: b['area'])
            cx = (b['box'][1] + b['box'][3]) / 2
            host = min((o for o in mine if o is not b), key=lambda o: abs((o['box'][1] + o['box'][3]) / 2 - cx))
            lab[lab == b['id']] = host['id']
            host['area'] += b['area']
            host['box'] = (min(host['box'][0], b['box'][0]), min(host['box'][1], b['box'][1]),
                           max(host['box'][2], b['box'][2]), max(host['box'][3], b['box'][3]))
            bodies.remove(b)
    return bodies


def box_gap(a, b):
    """Distance between two (y0, x0, y1, x1) boxes, 0 when they overlap."""
    dy = max(a[0] - b[2], b[0] - a[2], 0)
    dx = max(a[1] - b[3], b[1] - a[3], 0)
    return (dx * dx + dy * dy) ** 0.5


def rect_mask(shape, rects):
    mask = np.zeros(shape, bool)
    for x0, y0, x1, y1 in rects:
        mask[y0:y1, x0:x1] = True
    return mask


def region_parts(solid, regions, order, layout):
    """Components inside hand-drawn animation regions (sheets where rows touch)."""
    lab = np.zeros(solid.shape, np.int32)
    bodies, small = [], []
    for name, rects in regions.items():
        if isinstance(rects, dict):  # explicit frame boxes
            for frame_rects in rects['frames']:
                mask = rect_mask(solid.shape, frame_rects)
                pid = lab.max() + 1
                lab[solid & mask] = pid
                ys, xs = np.nonzero(solid & mask)
                bodies.append({'id': pid, 'area': len(ys), 'label': order.index(name), 'clip': mask,
                               'box': (ys.min(), xs.min(), ys.max() + 1, xs.max() + 1)})
            continue
        mask = np.zeros(solid.shape, bool)
        for x0, y0, x1, y1 in rects:
            mask[y0:y1, x0:x1] = True
        sub, _ = ndi.label(ndi.binary_opening(solid & mask, iterations=1))
        offset = lab.max()
        lab[sub > 0] = sub[sub > 0] + offset
        parts = []
        for i, sl in enumerate(ndi.find_objects(sub), start=1):
            if sl is None:
                continue
            pid = i + offset
            area = int((sub[sl] == i).sum())
            if area >= 60:
                parts.append({'id': pid, 'area': area, 'label': order.index(name),
                              'box': (sl[0].start, sl[1].start, sl[0].stop, sl[1].stop)})
        expected = dict(layout)[name]
        ref = sorted((p['area'] for p in parts), reverse=True)[:expected]
        cut = ref[len(ref) // 2] * 0.25
        bodies += [p for p in parts if p['area'] >= cut]
        small += [p for p in parts if p['area'] < cut]
    return lab, bodies, small


def slice_sheet(cid, debug=False):
    img = Image.open(sheet_path(cid)).convert('RGBA')
    px = np.array(img)
    alpha = px[:, :, 3]
    solid = alpha >= ALPHA_SOLID
    solid &= ~rect_mask(solid.shape, CUTS.get(cid, []))
    labels = reading_order(find_labels(solid, px[:, :, :3]) + EXTRA_LABELS.get(cid, []))
    layout = LAYOUT.get(cid, STANDARD)
    order = [name for name, _ in layout]
    if len(labels) != len(order):
        raise SystemExit(f'{cid}: found {len(labels)} labels, expected {len(order)}: {labels}')

    # Wipe label boxes (plus their border) from the sheet.
    label_mask = np.zeros(alpha.shape, bool)
    for y0, x0, y1, x1 in labels:
        label_mask[max(0, y0 - 14):y1 + 14, max(0, x0 - 14):x1 + 14] = True
    label_mask |= rect_mask(alpha.shape, EXCLUDE.get(cid, []))
    if cid in REGIONS:
        lab, bodies, small = region_parts(solid & ~label_mask, REGIONS[cid], order, layout)
    else:
        lab, parts = find_parts(solid, label_mask)
        big_area = max(p['area'] for p in parts)
        bodies = [p for p in parts if p['area'] >= big_area * 0.12]
        small = [p for p in parts if p['area'] < big_area * 0.12]
        for b in bodies:
            y0, x0, y1, x1 = b['box']
            b['label'] = owner_label(labels, (x0 + x1) / 2, (y0 + y1) / 2, slack=80)
        # A piece much smaller than its row's frames is an effect, not a frame.
        for b in list(bodies):
            peers = [o['area'] for o in bodies if o['label'] == b['label']]
            if b['area'] < 0.3 * max(peers):
                bodies.remove(b)
                small.append(b)
        for p in small:  # judged by the bottom edge: orbs float above their frame
            y0, x0, y1, x1 = p['box']
            p['label'] = owner_label(labels, (x0 + x1) / 2, y1)
    bodies = split_merged(lab, bodies, layout)

    # Frame id map: each body component is a frame; small parts join the nearest body.
    frame_of = np.zeros(lab.max() + 1, np.int32)
    for n, b in enumerate(bodies, start=1):
        frame_of[b['id']] = n
    body_map = frame_of[lab] * (lab > 0)
    dist, (iy, ix) = ndi.distance_transform_edt(body_map == 0, return_indices=True)
    for p in small:
        y0, x0, y1, x1 = p['box']
        cy, cx = (y0 + y1) // 2, (x0 + x1) // 2
        # Stay within the part's own animation so effects never jump to the next row.
        mine = [n for n, b in enumerate(bodies, start=1) if b['label'] == p['label']]
        if mine:
            n = min(mine, key=lambda n: box_gap(bodies[n - 1]['box'], p['box']))
            if box_gap(bodies[n - 1]['box'], p['box']) < MAX_GLOW_DIST:
                frame_of[p['id']] = n
        elif dist[cy, cx] < MAX_GLOW_DIST:
            frame_of[p['id']] = body_map[iy[cy, cx], ix[cy, cx]]
    solid_map = frame_of[lab] * (lab > 0)

    # Every visible pixel goes to the nearest frame body.
    dist, (iy, ix) = ndi.distance_transform_edt(solid_map == 0, return_indices=True)
    pixel_frame = solid_map[iy, ix]
    pixel_frame[(alpha == 0) | label_mask | (dist > MAX_GLOW_DIST)] = 0
    for n, b in enumerate(bodies, start=1):
        if 'clip' in b:  # explicit frame boxes are hard limits
            pixel_frame[(pixel_frame == n) & ~b['clip']] = 0

    # Group frames by animation.
    anims = {name: [] for name in ACTIONS}
    for n, b in enumerate(bodies, start=1):
        if b['label'] is None:
            print(f'  ! {cid}: frame at {b["box"]} has no label, skipped')
            continue
        anims[order[b['label']]].append(n)
    for name in anims:
        anims[name].sort(key=lambda n: bodies[n - 1]['box'][1])

    frames = {}
    for n in range(1, len(bodies) + 1):
        solid = solid_map == n
        ys, xs = np.nonzero(pixel_frame == n)
        if len(ys) == 0:
            continue
        sy, sx = np.nonzero(solid)
        top, bottom = sy.min(), sy.max()
        # Torso: the band 20%-55% down the body, ignores weapons/beams at the extremes.
        band = (sy > top + (bottom - top) * 0.2) & (sy < top + (bottom - top) * 0.55)
        anchor_x = int(np.median(sx[band] if band.any() else sx))
        box = (ys.min(), xs.min(), ys.max() + 1, xs.max() + 1)
        crop = px[box[0]:box[2], box[1]:box[3]].copy()
        crop[pixel_frame[box[0]:box[2], box[1]:box[3]] != n] = 0
        crop[crop[:, :, 3] < 12] = 0  # faint haze left over from background removal
        vy, vx = np.nonzero(crop[:, :, 3] >= 64)
        visible = (box[0] + vy.min(), box[1] + vx.min(), box[0] + vy.max() + 1, box[1] + vx.max() + 1)
        frames[n] = {'img': Image.fromarray(crop), 'box': box, 'visible': visible,
                     'anchor_x': anchor_x, 'feet': int(bottom)}

    return anims, frames, labels, bodies


def build(cid, debug=False):
    anims, frames, labels, bodies = slice_sheet(cid, debug)
    for name in ACTIONS:
        if not anims[name]:
            src = FALLBACK[name]
            while not anims[src]:
                src = FALLBACK[src]
            anims[name] = list(anims[src])
            print(f'  {cid}: no "{name}" frames, reusing "{src}"')

    cols = max(len(v) for v in anims.values())
    atlas = Image.new('RGBA', (cols * CELL_W, len(ACTIONS) * CELL_H))
    clipped = []
    for row, name in enumerate(ACTIONS):
        ids = anims[name]
        ground = max(frames[n]['feet'] for n in ids)
        for col, n in enumerate(ids):
            f = frames[n]
            y0, x0, y1, x1 = f['box']
            vy0, vx0, vy1, vx1 = f['visible']
            dx = col * CELL_W + CELL_W // 2 - f['anchor_x']
            dy = row * CELL_H + BASE_Y - ground
            cell = Image.new('RGBA', (CELL_W, CELL_H))
            cell.paste(f['img'], (x0 + dx - col * CELL_W, y0 + dy - row * CELL_H))
            atlas.alpha_composite(cell, (col * CELL_W, row * CELL_H))
            lost = (vx0 + dx < col * CELL_W, vx1 + dx > (col + 1) * CELL_W,
                    vy0 + dy < row * CELL_H, vy1 + dy > (row + 1) * CELL_H)
            if any(lost):
                clipped.append(f'{name}[{col}]')

    out = OUT_DIR / ('enemies' if cid in ENEMIES else '') / f'{cid}.png'
    out.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(out, optimize=True)
    counts = {name: len(anims[name]) for name in ACTIONS}
    print(f'{cid}: {counts}' + (f'  clipped: {", ".join(clipped)}' if clipped else ''))

    if debug:
        DEBUG_DIR.mkdir(exist_ok=True)
        dbg = Image.open(sheet_path(cid)).convert('RGBA')
        bg = Image.new('RGBA', dbg.size, (40, 40, 48, 255))
        bg.alpha_composite(dbg)
        d = ImageDraw.Draw(bg)
        for y0, x0, y1, x1 in labels:
            d.rectangle((x0, y0, x1, y1), outline=(0, 160, 255), width=3)
        for name in ACTIONS:
            for i, n in enumerate(anims[name]):
                y0, x0, y1, x1 = frames[n]['box']
                d.rectangle((x0, y0, x1, y1), outline=(0, 255, 0), width=2)
                d.text((x0 + 4, y0 + 4), f'{name} {i}', fill=(255, 255, 255))
        bg.save(DEBUG_DIR / f'{cid}-detect.png')
        grid = Image.new('RGBA', atlas.size, (40, 40, 48, 255))
        grid.alpha_composite(atlas)
        d = ImageDraw.Draw(grid)
        for r in range(len(ACTIONS)):
            d.line((0, r * CELL_H + BASE_Y, atlas.width, r * CELL_H + BASE_Y), fill=(255, 0, 255))
            for c in range(cols + 1):
                d.rectangle((c * CELL_W, r * CELL_H, (c + 1) * CELL_W - 1, (r + 1) * CELL_H - 1), outline=(90, 90, 110))
        grid.save(DEBUG_DIR / f'{cid}-atlas.png')
    return counts


def main():
    debug = '--debug' in sys.argv
    only = [a for a in sys.argv[1:] if not a.startswith('--')]
    counts = {}
    if MANIFEST.exists():  # keep counts of sheets not rebuilt this run
        text = MANIFEST.read_text(encoding='utf-8')
        counts = json.loads(text[text.index('{'):text.rindex('}') + 1])['counts']
    for cid in HEROES + ENEMIES:
        if only and cid not in only:
            continue
        counts[cid] = build(cid, debug)
    data = {'cellW': CELL_W, 'cellH': CELL_H, 'footMargin': CELL_H - BASE_Y,
            'actions': ACTIONS, 'counts': counts}
    MANIFEST.write_text('// Generated by tools/slice_sprite_sheets.py — do not edit.\n'
                        f'window.SPRITE_ATLAS = {json.dumps(data, indent=2)};\n', encoding='utf-8')


if __name__ == '__main__':
    main()
