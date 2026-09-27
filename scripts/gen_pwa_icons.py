# PWA 아이콘 생성. gen_icons.py의 배경·전경(대마법사 + 영웅)을 그대로 재사용해 APK 런처 아이콘과 통일한다.
# 실행: py -3.12 scripts/gen_pwa_icons.py
# 출력: public/assets/pwa/icon-192.png, icon-512.png(any+maskable 겸용, 이미 안전 영역 안에 그려짐),
#       apple-touch-icon.png(180, 불투명)
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from PIL import Image
from gen_icons import background, foreground

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'pwa')


def main():
    os.makedirs(OUT, exist_ok=True)
    full = Image.alpha_composite(background(), foreground())
    for size, name in ((192, 'icon-192.png'), (512, 'icon-512.png'), (180, 'apple-touch-icon.png')):
        full.resize((size, size), Image.LANCZOS).save(os.path.join(OUT, name))
    print('pwa icons written to', os.path.normpath(OUT))


if __name__ == '__main__':
    main()
