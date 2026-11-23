"""Generate Android launcher icons and splash screens from tools/icon-1024.png.
Usage: python tools/android_icons.py   (run after `npx cap add android`; needs Pillow)"""
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, 'app', 'android', 'app', 'src', 'main', 'res')
src = Image.open(os.path.join(ROOT, 'tools', 'icon-1024.png')).convert('RGBA')
BG = (255, 249, 181, 255)  # the icon's soft yellow
DENS = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}

for d, k in DENS.items():
    folder = os.path.join(RES, f'mipmap-{d}')
    os.makedirs(folder, exist_ok=True)
    legacy = round(48 * k)
    src.resize((legacy, legacy), Image.LANCZOS).save(os.path.join(folder, 'ic_launcher.png'))
    # round legacy icon: circle mask over the icon on its yellow background
    sq = Image.new('RGBA', (legacy, legacy), BG)
    sq.alpha_composite(src.resize((legacy, legacy), Image.LANCZOS))
    mask = Image.new('L', (legacy * 4, legacy * 4), 0)
    from PIL import ImageDraw
    ImageDraw.Draw(mask).ellipse((0, 0, legacy * 4 - 1, legacy * 4 - 1), fill=255)
    rnd = Image.new('RGBA', (legacy, legacy), (0, 0, 0, 0))
    rnd.paste(sq, (0, 0), mask.resize((legacy, legacy), Image.LANCZOS))
    rnd.save(os.path.join(folder, 'ic_launcher_round.png'))
    # adaptive foreground: 108dp canvas, artwork inside the 66dp safe zone (+ a little)
    fg = round(108 * k)
    art = round(fg * 0.70)
    canvas = Image.new('RGBA', (fg, fg), (0, 0, 0, 0))
    canvas.alpha_composite(src.resize((art, art), Image.LANCZOS), ((fg - art) // 2, (fg - art) // 2))
    canvas.save(os.path.join(folder, 'ic_launcher_foreground.png'))

with open(os.path.join(RES, 'values', 'ic_launcher_background.xml'), 'w', encoding='utf-8') as f:
    f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#FFF9B5</color>\n</resources>\n')

# splash screens: icon centered on the app's warm off-white
for name in os.listdir(RES):
    p = os.path.join(RES, name, 'splash.png')
    if os.path.exists(p):
        w, h = Image.open(p).size
        s = Image.new('RGBA', (w, h), (250, 249, 245, 255))
        side = round(min(w, h) * 0.32)
        s.alpha_composite(src.resize((side, side), Image.LANCZOS), ((w - side) // 2, (h - side) // 2))
        s.convert('RGB').save(p)
print('icons + splash written')
