#!/usr/bin/env python3
"""Regenerate every asset in public/brand/ from the master logo sheet.

The sheet (source-sheet.webp) is the designer's export: a 2x3 contact sheet
with the light-theme lock-ups on the left half and the dark-theme ones on the
right. The left half already ships with a transparent background; the right
half is flattened onto the dark panel, so its ink has to be un-matted before
it can sit on anything other than that exact navy.

Usage:  python3 scripts/brand/generate.py   (needs Pillow)
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SHEET = Path(__file__).resolve().parent / "source-sheet.webp"
OUT = ROOT / "public" / "brand"

# Where each lock-up sits on the sheet, as (left, top, right, bottom) search
# windows. They are generous on purpose — the exact bounds are found by
# trimming to the ink inside each window.
REGIONS = {
    "logo-light":         (110, 500, 800, 690),
    "logo-dark":          (990, 500, 1690, 690),
    "logo-stacked-light": (180, 30, 720, 440),
    "logo-stacked-dark":  (1060, 30, 1610, 440),
    "mark-light":         (330, 30, 570, 300),
    "mark-dark":          (1210, 30, 1450, 300),
}
DARK_HALF_X = 887  # first column of the flattened dark panel

# Sampled off the sheet; also documented in public/brand/README.md.
TILE_BG = (37, 28, 125)  # the app-icon tile behind the mark


def unmatte(img):
    """Recover straight alpha for ink that was flattened onto a solid panel.

    The panel colour is read from the crop's own border so the sheet's slight
    vertical gradient doesn't bias the result. Anything more than ~10% away
    from that colour is treated as solid ink; the narrow ramp below that is
    the anti-aliased edge, which gets a partial alpha and is un-premultiplied
    back to its true colour so it doesn't keep a dark fringe.
    """
    w, h = img.size
    px = img.convert("RGB").load()
    border = [px[x, y] for x in range(w) for y in (0, h - 1)]
    border += [px[x, y] for y in range(h) for x in (0, w - 1)]
    border.sort(key=sum)
    bg = border[len(border) // 2]

    out = Image.new("RGBA", (w, h))
    op = out.load()
    lo, hi = 0.02 * 255, 0.10 * 255
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            d = max(abs(r - bg[0]), abs(g - bg[1]), abs(b - bg[2]))
            if d <= lo:
                continue
            a = 1.0 if d >= hi else (d - lo) / (hi - lo)
            if a >= 0.999:
                op[x, y] = (r, g, b, 255)
            else:
                op[x, y] = (
                    min(255, max(0, round(bg[0] + (r - bg[0]) / a))),
                    min(255, max(0, round(bg[1] + (g - bg[1]) / a))),
                    min(255, max(0, round(bg[2] + (b - bg[2]) / a))),
                    round(a * 255),
                )
    return out


def clean_alpha(img, floor=25, solid=235):
    """Drop the sheet's faint haze and snap near-solid ink to fully opaque.

    The sheet's own export tops out around alpha 250 and carries a soft glow
    around the mark; left alone the glow survives trimming and pads the dark
    lock-ups a few pixels wider than their light twins.
    """
    r, g, b, a = img.split()
    a = a.point(lambda v: 0 if v < floor else (255 if v >= solid else v))
    return Image.merge("RGBA", (r, g, b, a))


def trim(img, pad=2):
    box = img.split()[3].point(lambda v: 255 if v > 8 else 0).getbbox()
    if box is None:
        raise SystemExit("no ink found in region")
    l, t, r, b = box
    return img.crop((max(0, l - pad), max(0, t - pad), min(img.width, r + pad), min(img.height, b + pad)))


def pad_to(img, size):
    """Centre `img` on a transparent canvas of exactly `size`."""
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    canvas.alpha_composite(img, ((size[0] - img.width) // 2, (size[1] - img.height) // 2))
    return canvas


def match_pair(light, dark):
    """Give a light/dark pair one shared canvas so swapping themes can't nudge
    the layout.

    The designer drew the dark mark a hair larger than the light one, so the
    dark crop is scaled to fit the light crop's box (aspect preserved) and both
    are then padded to the same size. Sizing in CSS stays a single number.
    """
    box = light.size
    r = min(box[0] / dark.width, box[1] / dark.height)
    if r < 1:
        dark = dark.resize((max(1, round(dark.width * r)), max(1, round(dark.height * r))), Image.LANCZOS)
    return pad_to(light, box), pad_to(dark, box)


def rounded_tile(size, mark, radius_ratio=0.225, inset_ratio=0.19):
    """The app-icon lock-up: the mark centred on a rounded brand tile."""
    scale = 4  # supersample, then downsample — keeps the corner radius smooth
    big = size * scale
    tile = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    mask = Image.new("L", (big, big), 0)
    from PIL import ImageDraw

    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, big - 1, big - 1), radius=int(big * radius_ratio), fill=255
    )
    tile.paste(Image.new("RGBA", (big, big), TILE_BG + (255,)), mask=mask)

    inner = int(big * (1 - 2 * inset_ratio))
    m = mark.copy()
    m.thumbnail((inner, inner), Image.LANCZOS)
    tile.alpha_composite(m, ((big - m.width) // 2, (big - m.height) // 2))
    return tile.resize((size, size), Image.LANCZOS)


def main():
    sheet = Image.open(SHEET).convert("RGBA")
    OUT.mkdir(parents=True, exist_ok=True)

    crops = {}
    for name, box in REGIONS.items():
        crop = sheet.crop(box)
        crop = unmatte(crop) if box[0] >= DARK_HALF_X else crop
        crops[name] = trim(clean_alpha(crop))

    marks = {}
    for stem in ("logo", "logo-stacked", "mark"):
        light, dark = match_pair(crops[f"{stem}-light"], crops[f"{stem}-dark"])
        for suffix, img in (("light", light), ("dark", dark)):
            img.save(OUT / f"{stem}-{suffix}.png", optimize=True)
            print(f"{stem}-{suffix}.png  {img.width}x{img.height}")
        marks[f"{stem}-light"], marks[f"{stem}-dark"] = light, dark

    # Favicon: the mark alone, on transparency. At 16px a tile would turn to
    # mush, so the glyph gets the whole canvas.
    fav = marks["mark-dark"]
    sizes = [(16, 16), (32, 32), (48, 48), (64, 64)]
    frames = []
    for s in sizes:
        f = Image.new("RGBA", s, (0, 0, 0, 0))
        m = fav.copy()
        m.thumbnail(s, Image.LANCZOS)
        f.alpha_composite(m, ((s[0] - m.width) // 2, (s[1] - m.height) // 2))
        frames.append(f)
    frames[-1].save(OUT / "favicon.ico", format="ICO", sizes=sizes, append_images=frames[:-1])
    print("favicon.ico  " + ", ".join(f"{w}x{h}" for w, h in sizes))

    # Installable-app and iOS icons: the mark on the brand tile.
    for size, fname, radius in (
        # iOS applies its own corner mask and fills transparent pixels with
        # black, so the Apple icon is full-bleed.
        (180, "apple-icon.png", 0.0),
        (192, "icon-192.png", 0.225),
        (512, "icon-512.png", 0.225),
    ):
        rounded_tile(size, marks["mark-dark"], radius_ratio=radius).save(OUT / fname, optimize=True)
        print(f"{fname}  {size}x{size}")


if __name__ == "__main__":
    main()
