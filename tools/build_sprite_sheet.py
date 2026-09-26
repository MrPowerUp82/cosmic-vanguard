"""Build the game's 320 x 240 grid from seven transparent animation strips.

An optional 4 x 7 sheet supplies any missing animation rows.
Usage: python tools/build_sprite_sheet.py SOURCE_SHEET OUTPUT
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image


FRAMES = (
    (0, 1, 2, 3),
    (0, 1, 2, 3, 2, 1),
    (0, 1, 2, 3),
    (0, 1, 2),
    (0, 1, 2, 3),
    (0, 1),
    (0, 1, 2, 2, 3, 3),
)
ACTIONS = ("idle", "walk", "attack", "jump", "dash", "hurt", "special")
CELL_WIDTH = 320
CELL_HEIGHT = 240


def quiet_boundaries(projection: np.ndarray, sections: int) -> list[int]:
    """Place cuts in the transparent gutters, allowing uneven generated rows."""
    length = len(projection)
    smooth = np.convolve(projection, np.ones(9) / 9, mode="same")
    cuts = [0]
    pitch = length / sections
    for part in range(1, sections):
        expected = part * pitch
        low = max(cuts[-1] + round(pitch * .45), round(expected - pitch * .45))
        high = min(length - round(pitch * .4), round(expected + pitch * .45))
        if low >= high:
            low, high = round(expected - pitch * .2), round(expected + pitch * .2)
        candidates = np.arange(low, high)
        scores = smooth[low:high] + abs(candidates - expected) * .025
        cuts.append(int(candidates[np.argmin(scores)]))
    cuts.append(length)
    return cuts


def generated_grid(source: Image.Image, character: str) -> list[list[tuple[int, int, int, int]]]:
    mask = np.asarray(source.getchannel("A")) > 20
    rows = quiet_boundaries(mask.sum(axis=1), 7)
    cells = []
    for row in range(7):
        y0, y1 = rows[row:row + 2]
        ncols = 3 if character == "red_velocity" and row < 4 else 4
        projection = mask[y0:y1].sum(axis=0)
        active = np.flatnonzero(projection)
        if len(active) == 0:
            raise ValueError(f"Empty generated row: {character} {ACTIONS[row]}")
        # The 3-pose Red Velocity rows have generous empty sides.
        if ncols == 3:
            left = max(0, int(active[0]) - 30)
            right = min(source.width, int(active[-1]) + 31)
        else:
            left, right = 0, source.width
        cuts = quiet_boundaries(projection[left:right], ncols)
        cuts = [left + cut for cut in cuts]
        cells.append([(cuts[col], y0, cuts[col + 1], y1) for col in range(ncols)])
    return cells


def keep_largest_component(crop: Image.Image) -> Image.Image:
    """Remove pieces from neighboring frames that cross a cell boundary."""
    width, height = crop.size
    alpha = crop.getchannel("A").tobytes()
    seen = bytearray(len(alpha))
    largest = []

    for start, opacity in enumerate(alpha):
        if not opacity or seen[start]:
            continue
        seen[start] = 1
        component = [start]
        head = 0
        while head < len(component):
            pixel = component[head]
            head += 1
            x, y = pixel % width, pixel // width
            for ny in range(max(0, y - 1), min(height, y + 2)):
                for nx in range(max(0, x - 1), min(width, x + 2)):
                    neighbor = ny * width + nx
                    if alpha[neighbor] and not seen[neighbor]:
                        seen[neighbor] = 1
                        component.append(neighbor)
        if len(component) > len(largest):
            largest = component

    clean_alpha = bytearray(len(alpha))
    for pixel in largest:
        clean_alpha[pixel] = alpha[pixel]
    crop.putalpha(Image.frombytes("L", (width, height), bytes(clean_alpha)))
    return crop


def build(source_path: Path, target_path: Path) -> None:
    source = Image.open(source_path).convert("RGBA") if source_path.exists() else None
    source_cells = generated_grid(source, source_path.stem.removesuffix("-sheet")) if source else None
    atlas = Image.new("RGBA", (CELL_WIDTH * 6, CELL_HEIGHT * 7))

    character = source_path.stem.removesuffix("-sheet")
    for row, frames in enumerate(FRAMES):
        strip_path = source_path.with_name(f"{character}-{ACTIONS[row]}-strip.png")
        strip = Image.open(strip_path).convert("RGBA") if strip_path.exists() else None
        for dest_col, source_col in enumerate(frames):
            if strip:
                crop = strip.crop((
                    round(source_col * strip.width / 4), 0,
                    round((source_col + 1) * strip.width / 4), strip.height,
                ))
                crop = keep_largest_component(crop)
                crop = crop.crop(crop.getchannel("A").getbbox())
            else:
                if source is None:
                    raise FileNotFoundError(f"Missing {strip_path} and {source_path}")
                cells = source_cells[row]
                if len(cells) == 3:
                    source_col = (0, 1, 2, 1)[source_col]
                crop = source.crop(cells[source_col])
                crop = keep_largest_component(crop)
                crop = crop.crop(crop.getchannel("A").getbbox())
            ratio = min(1, (CELL_WIDTH - 16) / crop.width, (CELL_HEIGHT - 8) / crop.height)
            if ratio < 1:
                crop = crop.resize((round(crop.width * ratio), round(crop.height * ratio)), Image.Resampling.LANCZOS)
            x = dest_col * CELL_WIDTH + (CELL_WIDTH - crop.width) // 2
            y = row * CELL_HEIGHT + CELL_HEIGHT - crop.height - 4
            atlas.alpha_composite(crop, (x, y))

    for row, frames in enumerate(FRAMES):
        for col in range(len(frames)):
            box = atlas.crop((col * CELL_WIDTH, row * CELL_HEIGHT,
                              (col + 1) * CELL_WIDTH, (row + 1) * CELL_HEIGHT)).getchannel("A").getbbox()
            if not box or min(box[0], box[1], CELL_WIDTH - box[2], CELL_HEIGHT - box[3]) < 3:
                raise ValueError(f"Empty or clipped frame: {ACTIONS[row]} {col + 1}: {box}")

    target_path.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(target_path, optimize=True)
    print(f"{target_path}: {atlas.width} x {atlas.height}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Usage: python tools/build_sprite_sheet.py INPUT OUTPUT")
    build(Path(sys.argv[1]), Path(sys.argv[2]))
