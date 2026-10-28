"""Render the Taste Agent mark to favicon.ico and PNG app icons.

Mirrors src/app/icon.svg on a 32-unit grid, drawn at high resolution and downsampled.
Usage (from the repo root): python scripts/render-icons.py src/app public
"""
import sys
from PIL import Image, ImageChops, ImageDraw

FOREST = (0x1F, 0x5C, 0x4A, 255)
MARIGOLD = (0xE9, 0xA2, 0x3B, 255)
PAPER = (0xF3, 0xF6, 0xF2, 255)


def mark(size: int, rounded: bool = True) -> Image.Image:
    s = size * 8  # supersample
    u = s / 32  # one grid unit
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=8 * u, fill=FOREST)
    else:
        d.rectangle([0, 0, s - 1, s - 1], fill=FOREST)

    def disc(cx, r):
        m = Image.new("L", (s, s), 0)
        ImageDraw.Draw(m).ellipse([(cx - r) * u, (16 - r) * u, (cx + r) * u, (16 + r) * u], fill=255)
        return m

    # Marigold lens: intersection of the two circles.
    lens = ImageChops.multiply(disc(12.5, 7), disc(19.5, 7))
    img.paste(Image.new("RGBA", (s, s), MARIGOLD), (0, 0), lens)

    # Rings: outer disc minus inner disc, stroke 2.25 centred on r=7.
    for cx in (12.5, 19.5):
        ring = ImageChops.subtract(disc(cx, 7 + 1.125), disc(cx, 7 - 1.125))
        img.paste(Image.new("RGBA", (s, s), PAPER), (0, 0), ring)

    return img.resize((size, size), Image.LANCZOS)


app_dir, public_dir = sys.argv[1], sys.argv[2]
mark(256).save(f"{app_dir}/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
# iOS applies its own corner mask, so the apple icon is square.
mark(180, rounded=False).save(f"{app_dir}/apple-icon.png")
mark(512).save(f"{public_dir}/logo-512.png")
print("wrote favicon.ico, apple-icon.png, logo-512.png")
