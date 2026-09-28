"""Pack the web sprite sheets into console-sized native atlases."""
from pathlib import Path
import json
import shutil
from statistics import median
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "native" / "assets"
OUT.mkdir(parents=True, exist_ok=True)
PSP = OUT / "psp"
PSP.mkdir(parents=True, exist_ok=True)
source = (ROOT / "assets/sprites/processed/atlas.js").read_text(encoding="utf-8")
atlas = json.loads(source[source.index("{"):source.rindex("}") + 1])
actions = atlas["actions"]
CELL = 144
PSP_CELL = CELL // 2
SOURCE_FOOT = atlas["cellH"] - atlas["footMargin"]
for name, counts in atlas["counts"].items():
    image_path = ROOT / "assets/sprites/processed" / (name + ".png")
    if not image_path.exists():
        image_path = ROOT / "assets/sprites/processed/enemies" / (name + ".png")
    src = Image.open(image_path).convert("RGBA")
    # One scale and one pivot per character. Resizing each pose to its own
    # bounding box made the body shrink whenever a weapon/effect got wider.
    idle_heights = []
    for col in range(counts["idle"]):
        cell = src.crop((col * atlas["cellW"], 0,
                         (col + 1) * atlas["cellW"], atlas["cellH"]))
        bounds = cell.getbbox()
        if bounds:
            idle_heights.append(bounds[3] - bounds[1])
    if not idle_heights:
        raise ValueError(f"{name}: no idle frames to establish sprite scale")
    factor = 58 / median(idle_heights)
    dst = Image.new("RGBA", (7 * CELL, len(actions) * CELL))
    for row, action in enumerate(actions):
        for col in range(counts[action]):
            source_row, source_col = row, col
            if name == "solarion" and action == "special" and col in (2, 3):
                # Use his existing casting poses here; the generated projectile
                # supplies the released blast without the overhead white circles.
                source_row, source_col = actions.index("attack"), col - 1
            cell = src.crop((source_col * atlas["cellW"], source_row * atlas["cellH"],
                             (source_col + 1) * atlas["cellW"], (source_row + 1) * atlas["cellH"]))
            bounds = cell.getbbox()
            if not bounds:
                continue
            size = (max(1, round((bounds[2] - bounds[0]) * factor)),
                    max(1, round((bounds[3] - bounds[1]) * factor)))
            cropped = cell.crop(bounds).resize(size, Image.Resampling.LANCZOS)
            x = col * CELL + round(CELL / 2 + (bounds[0] - atlas["cellW"] / 2) * factor)
            y = row * CELL + round(CELL - 5 + (bounds[1] - SOURCE_FOOT) * factor)
            tile = Image.new("RGBA", (CELL, CELL))
            tile.alpha_composite(cropped, (x - col * CELL, y - row * CELL))
            dst.alpha_composite(tile, (col * CELL, row * CELL))
    dst.save(OUT / (name + ".png"), optimize=True)
    dst.resize((7 * PSP_CELL, len(actions) * PSP_CELL), Image.Resampling.LANCZOS).save(
        PSP / (name + ".png"), optimize=True)

# Keep the order in sync with ProjectileStyle and the web renderer. These are
# the approved generated continuations, not crops from the character sheets.
projectile_visuals = [
    ("solarion", 118, 32),
    ("valoria", 110, 25),
    ("abyss_king", 112, 53),
    ("emerald_nova", 78, 24),
    ("pulse_gunner", 54, 21),
    ("void_tyrant", 76, 33),
]
projectile_cell = (128, 64)
projectile_atlas = Image.new("RGBA", (projectile_cell[0], projectile_cell[1] * len(projectile_visuals)))
for row, (name, width, height) in enumerate(projectile_visuals):
    image = Image.open(ROOT / "assets/sprites/projectiles" / (name + ".png")).convert("RGBA")
    if not image.getchannel("A").getbbox():
        raise ValueError(f"{name}: empty projectile image")
    image = image.resize((width, height), Image.Resampling.LANCZOS)
    x = (projectile_cell[0] - width) // 2
    y = row * projectile_cell[1] + (projectile_cell[1] - height) // 2
    projectile_atlas.alpha_composite(image, (x, y))
projectile_atlas.save(OUT / "projectiles.png", optimize=True)
projectile_atlas.resize((64, 32 * len(projectile_visuals)), Image.Resampling.LANCZOS).save(
    PSP / "projectiles.png", optimize=True)


for key, filename in [("harbor", "neon-harbor"), ("metro", "iron-district"),
                      ("sky", "skyspire"), ("void", "void-gate")]:
    src = Image.open(ROOT / "assets/sprites/scenarios" / (filename + ".png"))
    src.convert("RGB").resize((960, 540), Image.Resampling.LANCZOS).save(
        OUT / (key + ".jpg"), quality=88, optimize=True)
    src.convert("RGB").resize((480, 270), Image.Resampling.LANCZOS).save(
        PSP / (key + ".jpg"), quality=85, optimize=True)

banner = Image.open(ROOT / "assets/banner.png").convert("RGB")
banner.resize((960, 384), Image.Resampling.LANCZOS).save(
    OUT / "title.jpg", quality=90, optimize=True)
psp_banner = banner.resize((480, 192), Image.Resampling.LANCZOS)
psp_banner.save(PSP / "title.jpg", quality=86, optimize=True)
psp_backdrop = Image.new("RGB", (480, 272), "#030713")
psp_backdrop.paste(psp_banner, (0, 40))
psp_backdrop.save(ROOT / "native/platforms/psp/pic1.png")

for font_file in ("DejaVuSans-Bold.ttf", "DejaVu-LICENSE.txt"):
    path = OUT / font_file
    if path.exists() and not (PSP / font_file).exists():
        shutil.copy2(path, PSP / font_file)

print(f"Baked {len(atlas['counts'])} sprite atlases, {len(projectile_visuals)} projectiles, 4 backgrounds and title banner to {OUT}")
