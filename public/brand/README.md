# Brand assets

Every logo the site renders lives in this folder. Nothing else in the app
hardcodes a logo path — the file names below are referenced once, from
`brandAssets` in `src/config/site.ts`, and reach the UI through the `<Logo />`
component in `src/components/layout/logo.tsx`.

**To swap the logo:** replace the files here, keeping the names. If the new
artwork has different pixel dimensions, update the `width`/`height` numbers in
`brandAssets` to match — they are the intrinsic size `next/image` uses to
reserve space, so a stale value shows up as a stretched logo.

## Files

| File | Size | Used for |
| --- | --- | --- |
| `logo-light.png` | 652×160 | Horizontal lock-up, dark ink — navbar and sign-in on the light theme |
| `logo-dark.png` | 652×160 | Horizontal lock-up, light ink — same surfaces on the dark theme |
| `logo-stacked-light.png` | 505×381 | Vertical lock-up with the tagline, dark ink |
| `logo-stacked-dark.png` | 505×381 | Vertical lock-up with the tagline, light ink |
| `mark-light.png` | 197×248 | Mark only, dark-theme-safe ink, for light backgrounds |
| `mark-dark.png` | 197×248 | Mark only, for dark backgrounds |
| `favicon.ico` | 16/32/48/64 | Browser tab — the bare mark, no tile, so it survives 16px |
| `apple-icon.png` | 180×180 | iOS home screen. Full-bleed on purpose: iOS applies its own corner mask and fills transparency with black |
| `icon-192.png` | 192×192 | Android / PWA install icon |
| `icon-512.png` | 512×512 | Android / PWA splash |

Each light/dark pair shares one canvas size, so toggling the theme cannot
shift layout by a pixel.

## Palette

Sampled from the master artwork:

| Role | Hex |
| --- | --- |
| Mark body (light theme) | `#0A1895` |
| Mark head (light theme) | `#413FF1` |
| Mark body (dark theme) | `#4745F7` |
| Leaf | `#7E7CF7` |
| App-icon tile | `#251C7D` |

## Regenerating

The PNGs are cut from the designer's master contact sheet, kept at
`scripts/brand/source-sheet.webp`. To re-cut them all:

```bash
pip install Pillow
python3 scripts/brand/generate.py
```

The script handles the part that isn't a plain crop: the sheet's dark half is
flattened onto its navy panel, so that ink is un-matted back to straight alpha
before being written out.
