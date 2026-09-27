# 런처 아이콘 생성 (절차적 배경 + 게임 스프라이트 전경 icon_fg.png). 실행: py -3.12 scripts/gen_icons.py
# 출력: android/app/src/main/res/mipmap-*/ic_launcher{,_round,_foreground,_background}.png
import math
import os
from PIL import Image, ImageDraw, ImageFilter

S = 1728  # 108dp 캔버스를 크게 그린 뒤 축소(안티앨리어싱)
RES = os.path.join(os.path.dirname(__file__), '..', 'android', 'app', 'src', 'main', 'res')
DENS = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}


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


# 전경 = 게임 스프라이트(대마법사 P1 + 기사 영웅)로 구운 투명 1728px 그림(scripts/icon_fg.png, 적응형 안전 영역 안).
# 다시 굽기: 개발 서버를 켠 뒤 헤드리스 Chrome에서 js/art/units.js magePortraitURL(0,4)·heroPortraitURL('knight',4)을
# 후광·룬 고리·반짝이와 합성해 저장(게임 그림이 바뀌면 같은 방식으로 갱신).
def foreground():
    return Image.open(os.path.join(os.path.dirname(__file__), 'icon_fg.png')).convert('RGBA').resize((S, S), Image.LANCZOS)


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
