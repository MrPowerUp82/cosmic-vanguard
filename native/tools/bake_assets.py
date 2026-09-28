"""Pack the web sprite sheets into console-sized native atlases."""
from pathlib import Path
import json
import shutil
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "native" / "assets"
OUT.mkdir(parents=True, exist_ok=True)
PSP = OUT / "psp"
PSP.mkdir(parents=True, exist_ok=True)
source = (ROOT / "assets/sprites/processed/atlas.js").read_text(encoding="utf-8")
atlas = json.loads(source[source.index("{"):source.rindex("}") + 1])
actions = atlas["actions"]
for name, counts in atlas["counts"].items():
    image_path = ROOT / "assets/sprites/processed" / (name + ".png")
    if not image_path.exists():
        image_path = ROOT / "assets/sprites/processed/enemies" / (name + ".png")
    src = Image.open(image_path).convert("RGBA")
    dst = Image.new("RGBA", (448, 448))
    for row, action in enumerate(actions):
        for col in range(counts[action]):
            cell = src.crop((col * atlas["cellW"], row * atlas["cellH"],
                             (col + 1) * atlas["cellW"], (row + 1) * atlas["cellH"]))
            bounds = cell.getbbox()
            if not bounds:
                continue
            cropped = cell.crop(bounds)
            factor = min(60 / cropped.width, 60 / cropped.height)
            size = (max(1, round(cropped.width * factor)), max(1, round(cropped.height * factor)))
            cropped = cropped.resize(size, Image.Resampling.LANCZOS)
            dst.alpha_composite(cropped, (col * 64 + (64 - size[0]) // 2,
                                          row * 64 + 63 - size[1]))
    dst.save(OUT / (name + ".png"), optimize=True)
    dst.resize((224, 224), Image.Resampling.LANCZOS).save(PSP / (name + ".png"), optimize=True)

for key, filename in [("harbor", "neon-harbor"), ("metro", "iron-district"),
                      ("sky", "skyspire"), ("void", "void-gate")]:
    src = Image.open(ROOT / "assets/sprites/scenarios" / (filename + ".png"))
    src.convert("RGB").resize((960, 540), Image.Resampling.LANCZOS).save(
        OUT / (key + ".jpg"), quality=88, optimize=True)
    src.convert("RGB").resize((480, 270), Image.Resampling.LANCZOS).save(
        PSP / (key + ".jpg"), quality=85, optimize=True)

for font_file in ("DejaVuSans-Bold.ttf", "DejaVu-LICENSE.txt"):
    path = OUT / font_file
    if path.exists() and not (PSP / font_file).exists():
        shutil.copy2(path, PSP / font_file)

print(f"Baked {len(atlas['counts'])} sprite atlases and 4 backgrounds to {OUT}")
