// 게임 아이콘 (public/assets/icons/*.svg, 48 그리드 · --ink 외곽 · 2톤 + 광택 — docs/ART.md §8)
// DOM: icon('coin') → <img class="k-ico"> 문자열. 캔버스: iconImage('coin') → 로드된 HTMLImageElement(없으면 null, 다음 프레임에 다시)
// 이모지 대신 이것만 쓴다. 새 아이콘은 SVG 파일을 추가하고 ICONS 에 이름을 넣는다.
export const ICONS = [
  'coin', 'gem', 'atk', 'rate', 'crit', 'multi', 'wall', 'wall-broken', 'meteor', 'freeze', 'auto', 'speed', 'menu', 'close', 'check',
  'settings', 'codex', 'shop', 'hero', 'bag', 'lock', 'partner', 'new', 'chest', 'reroll', 'trophy',
  'el-fire', 'el-lightning', 'el-frost', 'el-wind', 'el-holy', 'el-dark', 'el-summon',
];
const BASE = 'assets/icons/';
export const iconUrl = name => BASE + name + '.svg';

// <img> 문자열 (innerHTML 용). cls 로 크기(--ico)·기울임(tilt) 지정
export function icon(name, cls = '') {
  return `<img class="k-ico${cls ? ' ' + cls : ''}" src="${iconUrl(name)}" alt="" aria-hidden="true" draggable="false">`;
}

// 캔버스용: 처음 부르면 로드를 시작하고 null, 로드되면 이미지를 돌려준다
const imgs = new Map();
export function iconImage(name) {
  let im = imgs.get(name);
  if (!im) {
    im = new Image();
    im.decoding = 'async';
    im.src = iconUrl(name);
    imgs.set(name, im);
  }
  return im.complete && im.naturalWidth > 0 ? im : null;
}
