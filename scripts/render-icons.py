"""Render the Taste Agent mark to favicon.ico and PNG app icons.

Mirrors src/app/icon.svg on a 32-unit grid, drawn at high resolution and downsampled.
Usage (from the repo root): python scripts/render-icons.py src/app public
"""
import sys
from PIL import Image, ImageDraw

FOREST = (0x1F, 0x5C, 0x4A, 255)
PAPER = (0xF3, 0xF6, 0xF2, 255)
TONGUE = (0xEF, 0x6F, 0x7E, 255)
GROOVE = (0xC9, 0x4A, 0x5E, 255)


def mark(size: int, rounded: bool = True) -> Image.Image:
    s = size * 8  # supersample
    u = s / 32  # one grid unit
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=8 * u, fill=FOREST)
    else:
        d.rectangle([0, 0, s - 1, s - 1], fill=FOREST)

    # Chat bubble (the agent) with its tail.
    d.rounded_rectangle([6.5 * u, 7.5 * u, 25.5 * u, 21.5 * u], radius=5 * u, fill=PAPER)
    d.polygon([(9.5 * u, 20 * u), (9.5 * u, 25.5 * u), (14.5 * u, 21.4 * u)], fill=PAPER)
    # Smiling mouth: quadratic curve from (10.6, 11.4) via (16, 16.2) to (21.4, 11.4), round ends.
    pts = []
    for i in range(41):
        t = i / 40
        x = (1 - t) ** 2 * 10.6 + 2 * (1 - t) * t * 16 + t**2 * 21.4
        y = (1 - t) ** 2 * 11.4 + 2 * (1 - t) * t * 16.2 + t**2 * 11.4
        pts.append((x * u, y * u))
    w = 1.7 * u
    d.line(pts, fill=FOREST, width=round(w), joint="curve")
    for x, y in (pts[0], pts[-1]):
        d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=FOREST)
    # Tongue (taste): a rounded tab with a centre groove.
    d.rectangle([13.2 * u, 13.3 * u, 18.8 * u, 16 * u], fill=TONGUE)
    d.ellipse([13.2 * u, 13.2 * u, 18.8 * u, 18.8 * u], fill=TONGUE)
    d.line([(16 * u, 14.2 * u), (16 * u, 16.8 * u)], fill=GROOVE, width=round(0.9 * u))

    return img.resize((size, size), Image.LANCZOS)


app_dir, public_dir = sys.argv[1], sys.argv[2]
mark(256).save(f"{app_dir}/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
# iOS applies its own corner mask, so the apple icon is square.
mark(180, rounded=False).save(f"{app_dir}/apple-icon.png")
mark(512).save(f"{public_dir}/logo-512.png")
print("wrote favicon.ico, apple-icon.png, logo-512.png")
