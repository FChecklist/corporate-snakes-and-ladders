"""Makes the raster pictures of Corporate Snakes and Ladders from the two SVG sources, with headless Chrome (run: python tools/make-icons.py).

Needs Google Chrome or Chromium on the machine, and Pillow (for the .ico file and the size check).
Sources (edit these, then run this file):
  apps/web/public/favicon.svg   the board mark: ember tile, five board bands, a wooden ladder, an olive snake
  apps/web/public/logo.svg      the wordmark tile with the marbles
Colours: the Ember and Rung scheme in apps/web/public/snakes-scheme.css (ember #9C3D1E for the tile, the board bands for the squares).
Writes into apps/web/public: icon-192.png, icon-512.png, icon-maskable-192.png, icon-maskable-512.png, apple-touch-icon.png,
favicon-32.png, favicon.ico, logo-512.png, og-card.png and img/card.png."""
import os, shutil, subprocess, sys, tempfile
from PIL import Image

PUB = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "web", "public"))
TMP = tempfile.mkdtemp(prefix="snk-icons-")
EMBER = "#9C3D1E"   # --snk-primary

def chrome():
    for name in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser"):
        p = shutil.which(name)
        if p: return p
    sys.exit("Chrome or Chromium is needed to draw the pictures")

def shot(html, out, w, h, transparent=True):
    page = os.path.join(TMP, os.path.basename(out) + ".html")
    with open(page, "w", encoding="utf8") as f: f.write(html)
    args = [chrome(), "--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
            "--allow-file-access-from-files", "--window-size=%d,%d" % (w, h), "--screenshot=" + out]
    if transparent: args.append("--default-background-color=00000000")
    subprocess.run(args + ["file://" + page], capture_output=True, text=True, timeout=120, check=True)
    im = Image.open(out)
    if im.size != (w, h): im.crop((0, 0, w, h)).save(out)

def square(svg, size, bg=None, inset=0):
    box = size - 2 * inset
    style = "margin:0;width:%dpx;height:%dpx;overflow:hidden;%s" % (size, size, ("background:%s;" % bg) if bg else "")
    return '<!doctype html><html><body style="%s"><img src="file://%s" style="position:absolute;left:%dpx;top:%dpx;width:%dpx;height:%dpx"></body></html>' % (style, svg, inset, inset, box, box)

FONTS = ('@font-face{font-family:Fraunces;src:url(file://%s/fonts/Fraunces-normal-500-700.woff2) format("woff2");font-weight:500 700}'
         '@font-face{font-family:Inter;src:url(file://%s/fonts/Inter-normal-400.woff2) format("woff2");font-weight:100 900}') % (PUB, PUB)

OG = '''<!doctype html><html><head><meta charset="utf-8"><style>%s
html,body{margin:0}
body{width:1200px;height:630px;position:relative;overflow:hidden;font-family:Inter,system-ui,sans-serif;
 background:radial-gradient(circle at 92%% 4%%,rgba(255,150,80,.42),transparent 40%%),radial-gradient(circle at 2%% 104%%,rgba(88,112,24,.22),transparent 42%%),linear-gradient(135deg,#FFF4EC 0%%,#FFE3D1 55%%,#FFD2B6 100%%)}
.frame{position:absolute;left:64px;top:64px;right:64px;bottom:64px;border:3px dashed rgba(255,150,80,.85);border-radius:36px}
.icon{position:absolute;left:96px;top:150px;width:296px;height:296px;filter:drop-shadow(0 14px 22px rgba(59,25,13,.30))}
.k{position:absolute;left:386px;top:186px;font-weight:800;font-size:30px;letter-spacing:.42em;color:#6E5A4F}
.h{position:absolute;left:384px;top:236px;margin:0;font-family:Fraunces,Georgia,serif;font-weight:700;font-size:104px;line-height:1.02;letter-spacing:-.01em;color:#3B190D}
.s{position:absolute;left:386px;top:452px;font-weight:700;font-size:33px;color:#4B382D}
.u{position:absolute;left:386px;top:510px;font-weight:800;font-size:29px;letter-spacing:.01em;color:#8A3A10}
</style></head><body><div class="frame"></div><img class="icon" src="file://%s/favicon.svg">
<div class="k">CORPORATE</div><h1 class="h">Snakes and<br>Ladders</h1><div class="s">Online games for company events</div><div class="u">snakes.corporatetambola.com</div></body></html>''' % (FONTS, PUB)

CARD = '''<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0}
body{width:1200px;height:630px;position:relative;overflow:hidden;
 background:radial-gradient(circle at 50%% 46%%,rgba(255,150,80,.20),transparent 52%%),linear-gradient(135deg,#3B190D 0%%,#5E2412 48%%,#8A3519 100%%)}
img{position:absolute;left:342px;top:57px;width:516px;height:516px;filter:drop-shadow(0 18px 30px rgba(15,6,3,.55))}
</style></head><body><img src="file://%s/logo.svg"></body></html>''' % PUB

def main():
    fav, logo = os.path.join(PUB, "favicon.svg"), os.path.join(PUB, "logo.svg")
    for name, size in (("icon-512.png", 512), ("icon-192.png", 192), ("favicon-32.png", 32)):
        shot(square(fav, size), os.path.join(PUB, name), size, size); print("wrote", name)
    for name, size, inset in (("icon-maskable-512.png", 512, 51), ("icon-maskable-192.png", 192, 19), ("apple-touch-icon.png", 180, 0)):  # a full square of ember (the phone rounds it), the mark in the safe middle
        shot(square(fav, size, EMBER, inset), os.path.join(PUB, name), size, size, transparent=False); print("wrote", name)
    ims = []
    for size in (16, 32, 48):
        tmp = os.path.join(TMP, "ico%d.png" % size); shot(square(fav, size), tmp, size, size); ims.append(Image.open(tmp).convert("RGBA"))
    ims[-1].save(os.path.join(PUB, "favicon.ico"), format="ICO", sizes=[(16, 16), (32, 32), (48, 48)], append_images=ims[:-1]); print("wrote favicon.ico")
    shot(square(logo, 512), os.path.join(PUB, "logo-512.png"), 512, 512); print("wrote logo-512.png")
    for name, html in (("og-card.png", OG), (os.path.join("img", "card.png"), CARD)):
        out = os.path.join(PUB, name); shot(html, out, 1200, 630, transparent=False); Image.open(out).convert("RGB").save(out, optimize=True); print("wrote", name)

if __name__ == "__main__":
    main()
