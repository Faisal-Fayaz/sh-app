#!/usr/bin/env python3
"""Generate the app's icon family from one geometric definition.

Every asset comes from the same prompt mark so they cannot drift apart, and the
mark stays a few readable numbers rather than an opaque PNG. Run with:

    python3 scripts/generate-assets.py

Supersamples 4x and downsamples with LANCZOS because PIL has no anti-aliased
stroke: drawing the chevron and underscore directly at final size leaves visible
stair-stepping on the diagonals, which is exactly what a home screen icon shows.
"""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"

BG = (0x0B, 0x0E, 0x14)
ACCENT = (0x7F, 0xD1, 0xB9)
WHITE = (0xFF, 0xFF, 0xFF)

SS = 4

# Chevron and underscore in unit coordinates inside a square mark box. The
# chevron is taller than wide, and the underscore sits on the chevron's baseline.
CHEVRON = [(0.00, 0.10), (0.42, 0.50), (0.00, 0.90)]
UNDERSCORE = [(0.55, 0.90), (1.00, 0.90)]
STROKE = 0.10


def _rounded_polyline(draw: ImageDraw.ImageDraw, points, width, fill) -> None:
    """A polyline with round caps and joins.

    `joint="curve"` rounds the interior corner but leaves the two ends square,
    so each vertex also gets a disc. Without the discs the chevron's tips are
    visibly flat where the rest of the stroke is round.
    """
    draw.line(points, fill=fill, width=width, joint="curve")
    radius = width / 2
    for x, y in points:
        draw.ellipse([x - radius, y - radius, x + radius, y + radius], fill=fill)


def render_mark(size: int, color, fraction: float) -> Image.Image:
    """The mark alone on transparency, its box occupying `fraction` of the canvas."""
    canvas = size * SS
    img = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    box = int(canvas * fraction)
    left = (canvas - box) // 2
    top = (canvas - box) // 2

    def point(u: float, v: float) -> tuple[float, float]:
        return (left + u * box, top + v * box)

    width = max(1, int(STROKE * box))
    _rounded_polyline(draw, [point(*p) for p in CHEVRON], width, color)
    _rounded_polyline(draw, [point(*p) for p in UNDERSCORE], width, color)

    return img.resize((size, size), Image.LANCZOS)


def on_background(mark: Image.Image, size: int, background) -> Image.Image:
    base = Image.new("RGB", (size, size), background)
    base.paste(mark, (0, 0), mark)
    return base


def write(img: Image.Image, name: str) -> None:
    path = ASSETS / name
    img.save(path)
    print(f"  {name:38} {img.size[0]}x{img.size[1]}  {path.stat().st_size / 1000:.1f} KB")


def main() -> None:
    print("generating assets:")

    # iOS/legacy launcher icon. Opaque: iOS rejects transparency in app icons.
    write(on_background(render_mark(1024, ACCENT, 0.54), 1024, BG), "icon.png")

    # Android adaptive icon layers. The mark stays inside the central ~66% safe
    # zone, since the launcher masks and parallaxes the foreground.
    write(render_mark(512, ACCENT, 0.60), "android-icon-foreground.png")
    write(Image.new("RGB", (512, 512), BG), "android-icon-background.png")
    write(render_mark(512, WHITE, 0.60), "android-icon-monochrome.png")

    # Splash. Transparent, coloured by the splash background in app.json.
    write(render_mark(1024, ACCENT, 0.42), "splash-icon.png")

    # Web favicon, from the same mark.
    write(on_background(render_mark(64, ACCENT, 0.60), 64, BG), "favicon.png")


if __name__ == "__main__":
    main()
