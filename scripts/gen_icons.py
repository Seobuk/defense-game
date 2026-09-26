# 런처 아이콘 절차적 생성 (성벽 + 대포 + 동전). 실행: py -3.12 scripts/gen_icons.py
# 출력: android/app/src/main/res/mipmap-*/ic_launcher{,_round,_foreground,_background}.png
import math
import os
from PIL import Image, ImageDraw, ImageFilter

S = 1728  # 108dp 캔버스를 크게 그린 뒤 축소(안티앨리어싱)
RES = os.path.join(os.path.dirname(__file__), '..', 'android', 'app', 'src', 'main', 'res')
DENS = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
OUTLINE = (28, 22, 44, 255)


def p(x, y):
    return (x * S, y * S)


def box(x0, y0, x1, y1):
    return [x0 * S, y0 * S, x1 * S, y1 * S]


def background():
    img = Image.new('RGBA', (S, S))
    d = ImageDraw.Draw(img)
    top, bot = (44, 26, 110), (255, 96, 64)
    for y in range(S):
        t = y / S
        d.line([(0, y), (S, y)], fill=tuple(int(a + (b - a) * t) for a, b in zip(top, bot)) + (255,))
    # 중앙에서 퍼지는 햇살
    rays = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rays)
    cx, cy = p(0.5, 0.52)
    for i in range(16):
        a0 = i * math.tau / 16
        a1 = a0 + math.tau / 32
        rd.polygon([(cx, cy), (cx + math.cos(a0) * S, cy + math.sin(a0) * S),
                    (cx + math.cos(a1) * S, cy + math.sin(a1) * S)], fill=(255, 230, 150, 38))
    glow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse(box(0.22, 0.2, 0.78, 0.76), fill=(255, 210, 120, 110))
    glow = glow.filter(ImageFilter.GaussianBlur(S * 0.08))
    return Image.alpha_composite(Image.alpha_composite(img, rays), glow)


def coin(d, cx, cy, r):
    d.ellipse(box(cx - r, cy - r, cx + r, cy + r), fill=(255, 196, 40), outline=OUTLINE, width=int(S * 0.012))
    d.ellipse(box(cx - r * 0.62, cy - r * 0.62, cx + r * 0.62, cy + r * 0.62), outline=(200, 120, 10), width=int(S * 0.008))
    d.ellipse(box(cx - r * 0.55, cy - r * 0.7, cx - r * 0.15, cy - r * 0.35), fill=(255, 245, 190))


def star(d, cx, cy, r0, r1, n, fill):
    pts = []
    for i in range(n * 2):
        a = i * math.pi / n - math.pi / 2
        r = r1 if i % 2 == 0 else r0
        pts.append(p(cx + math.cos(a) * r, cy + math.sin(a) * r))
    d.polygon(pts, fill=fill)


def foreground():
    # 적응형 아이콘 안전 영역(가운데 66/108) 안에 주요 그림을 둔다
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    ow = int(S * 0.014)

    # 성벽 (총안 + 돌 블록)
    top, bottom, left, right = 0.6, 0.8, 0.22, 0.78
    merlon_h, n = 0.07, 5
    mw = (right - left) / (n * 2 - 1)
    stone, dark = (150, 160, 184), (104, 112, 138)
    for i in range(n):
        x = left + i * 2 * mw
        d.rectangle(box(x, top - merlon_h, x + mw, top + 0.01), fill=stone, outline=OUTLINE, width=ow)
    d.rectangle(box(left, top, right, bottom), fill=stone, outline=OUTLINE, width=ow)
    rows = 3
    rh = (bottom - top) / rows
    for r in range(1, rows):
        y = top + r * rh
        d.line([p(left + 0.01, y), p(right - 0.01, y)], fill=dark, width=int(S * 0.009))
    for r in range(rows):
        off = (r % 2) * 0.055
        x = left + 0.055 + off
        while x < right - 0.02:
            d.line([p(x, top + r * rh + 0.006), p(x, top + (r + 1) * rh - 0.006)], fill=dark, width=int(S * 0.009))
            x += 0.11
    d.rectangle(box(left + 0.01, top + 0.012, right - 0.01, top + 0.03), fill=(196, 206, 226))
    # 성문
    d.chord(box(0.44, 0.69, 0.56, 0.83), 180, 360, fill=(70, 44, 36), outline=OUTLINE, width=ow)
    d.rectangle(box(0.44, 0.75, 0.56, 0.8), fill=(70, 44, 36))
    d.line([p(0.44, 0.8), p(0.56, 0.8)], fill=OUTLINE, width=ow)

    # 포구 섬광 (포신 뒤)
    bx, by = 0.655, 0.36
    star(d, bx, by, 0.05, 0.12, 9, (255, 120, 40, 255))
    star(d, bx, by, 0.03, 0.075, 9, (255, 236, 120, 255))

    # 대포: 오른쪽 위를 향한 포신
    ang = math.radians(-42)
    ox, oy = 0.5, 0.56
    L, W = 0.2, 0.052
    ux, uy = math.cos(ang), math.sin(ang)
    nx, ny = -uy, ux
    barrel = [p(ox + nx * W, oy + ny * W), p(ox + ux * L + nx * W * 0.8, oy + uy * L + ny * W * 0.8),
              p(ox + ux * L - nx * W * 0.8, oy + uy * L - ny * W * 0.8), p(ox - nx * W, oy - ny * W)]
    d.polygon(barrel, fill=(58, 62, 80), outline=OUTLINE, width=ow)
    for t in (0.35, 0.92):  # 포신 띠
        cx, cy = ox + ux * L * t, oy + uy * L * t
        w = W * (1.08 - 0.2 * t)
        d.line([p(cx + nx * w, cy + ny * w), p(cx - nx * w, cy - ny * w)], fill=(255, 196, 40), width=int(S * 0.02))
    d.line([p(ox + nx * W * 0.5, oy + ny * W * 0.5), p(ox + ux * L * 0.9 + nx * W * 0.4, oy + uy * L * 0.9 + ny * W * 0.4)],
           fill=(120, 128, 156), width=int(S * 0.012))
    d.ellipse(box(0.435, 0.5, 0.565, 0.63), fill=(58, 62, 80), outline=OUTLINE, width=ow)
    d.ellipse(box(0.47, 0.535, 0.53, 0.595), fill=(255, 196, 40), outline=OUTLINE, width=int(S * 0.008))

    # 쏟아지는 동전
    for cx, cy, r in ((0.3, 0.33, 0.058), (0.4, 0.23, 0.046), (0.76, 0.52, 0.05), (0.27, 0.5, 0.04)):
        coin(d, cx, cy, r)
    star(d, 0.53, 0.2, 0.008, 0.03, 4, (255, 255, 255, 255))
    star(d, 0.8, 0.3, 0.007, 0.025, 4, (255, 255, 255, 255))

    # 전체 그림자 살짝
    shadow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    shadow.paste((0, 0, 0, 90), (0, int(S * 0.012)), img)
    shadow = shadow.filter(ImageFilter.GaussianBlur(S * 0.01))
    return Image.alpha_composite(shadow, img)


def masked(img, radius_frac):
    m = Image.new('L', img.size, 0)
    w = img.size[0]
    if radius_frac >= 0.5:
        ImageDraw.Draw(m).ellipse([0, 0, w - 1, w - 1], fill=255)
    else:
        ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, w - 1], radius=w * radius_frac, fill=255)
    out = Image.new('RGBA', img.size, (0, 0, 0, 0))
    out.paste(img, (0, 0), m)
    return out


def main():
    bg, fg = background(), foreground()
    full = Image.alpha_composite(bg, fg)
    # 레거시 아이콘은 적응형 아이콘이 보여주는 가운데 72/108 영역
    c = S * (1 - 72 / 108) / 2
    legacy = full.crop((int(c), int(c), int(S - c), int(S - c)))
    for name, k in DENS.items():
        d = os.path.join(RES, 'mipmap-' + name)
        os.makedirs(d, exist_ok=True)
        a, l = round(108 * k), round(48 * k)
        fg.resize((a, a), Image.LANCZOS).save(os.path.join(d, 'ic_launcher_foreground.png'))
        bg.resize((a, a), Image.LANCZOS).save(os.path.join(d, 'ic_launcher_background.png'))
        masked(legacy.resize((l, l), Image.LANCZOS), 0.2).save(os.path.join(d, 'ic_launcher.png'))
        masked(legacy.resize((l, l), Image.LANCZOS), 0.5).save(os.path.join(d, 'ic_launcher_round.png'))
    print('icons written to', os.path.normpath(RES))


if __name__ == '__main__':
    main()
