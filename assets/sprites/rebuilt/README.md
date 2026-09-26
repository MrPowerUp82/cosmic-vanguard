# Rebuilt sprite sheets

Each final PNG is a transparent 1920 × 1680 atlas with 320 × 240 cells. Rows are
`idle`, `walk`, `attack`, `jump`, `dash`, `hurt`, and `special`. Their frame counts
are 4, 6, 4, 3, 4, 2, and 6. The game and `sprite-viewer.html` read this grid.

The source strips contain four separate poses per action. Build an atlas with:

```powershell
python tools/build_sprite_sheet.py assets/sprites/rebuilt/source/armored_brute-sheet.png assets/sprites/rebuilt/armored_brute.png
```

The builder centers each pose, keeps its alpha channel, removes disconnected
pieces crossing a frame boundary, and rejects empty or clipped output cells.
Frames 5–6 of six-frame animations repeat the first two poses until new poses
are drawn.

## Armored Brute generation brief

Generated with the built-in image generation tool, using the original
`assets/sprites/enemies/armored_brute.png` as a visual reference. Every prompt
required the same bald, muscular fighter, graphite segmented armor, glowing
orange seams, oversized gauntlets, gritty arcade illustration, and a genuine
transparent background. Each action was drawn as a horizontal four-pose strip
with complete bodies and clear space between poses:

| Strip | Pose sequence |
| --- | --- |
| `idle` | four subtle breathing poses |
| `walk` | left step, passing pose, right step, passing pose |
| `attack` | ready fist, windup, straight punch, recovery |
| `jump` | crouched takeoff, rising, descending, landing |
| `dash` | forward lean, acceleration, fast dash, braking |
| `hurt` | struck backward, recoil, guard, recovery |
| `special` | energy charge, gathering fire, smash, fading aura |

The prompts prohibited labels, grid lines, extra characters, cropped limbs,
duplicate body parts, and effects crossing into neighboring frames.
