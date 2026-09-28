"""Trim and resize the generated projectile art for the web renderer."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1] / "assets" / "sprites" / "projectiles"
PROJECTILES = ("solarion", "valoria", "abyss_king", "emerald_nova", "pulse_gunner", "void_tyrant")
OUTPUT_WIDTH = 256


def main():
    for name in PROJECTILES:
        image = Image.open(ROOT / "source" / f"{name}.png").convert("RGBA")
        alpha = image.getchannel("A").point(lambda value: 0 if value < 8 else value)
        image.putalpha(alpha)
        bounds = alpha.getbbox()
        if bounds is None:
            raise ValueError(f"Generated image has no visible pixels: {name}")
        left, top, right, bottom = bounds
        image = image.crop(
            (max(0, left - 12), max(0, top - 12), min(image.width, right + 12), min(image.height, bottom + 12))
        )
        height = round(image.height * OUTPUT_WIDTH / image.width)
        image = image.resize((OUTPUT_WIDTH, height), Image.Resampling.LANCZOS)
        image.save(ROOT / f"{name}.png", optimize=True)
        print(f"{name}: {image.width}x{image.height}")


if __name__ == "__main__":
    main()
