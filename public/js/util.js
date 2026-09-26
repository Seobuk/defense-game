// 공용 유틸 (DOM 없음)

const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

// 3자리 묶음 단위: K, M, B, T, Qa ... Dc 다음은 aa, ab, ... zz (방치형 관례)
function unit(e) {
  if (e < UNITS.length) return UNITS[e];
  const k = e - UNITS.length;
  return String.fromCharCode(97 + Math.floor(k / 26) % 26) + String.fromCharCode(97 + (k % 26));
}

// 큰 수 표기: 999 / 1.23K / 12.3K / 123K / 1.00M ... 1.00Qa ...
export function fmt(n) {
  n = Number(n);
  if (Number.isNaN(n)) return '0';
  if (n < 0) return '-' + fmt(-n);
  if (n === Infinity) return '∞';
  if (n < 1000) return String(Math.floor(n));
  let e = Math.floor(Math.log10(n) / 3);
  let v = n / 10 ** (e * 3);
  // 부동소수 오차 보정
  if (v >= 1000) { e++; v /= 1000; } else if (v < 1) { e--; v *= 1000; }
  // 내림 표기(가진 골드보다 크게 보이지 않도록)
  const s = v >= 100 ? String(Math.floor(v)) : v >= 10 ? (Math.floor(v * 10) / 10).toFixed(1) : (Math.floor(v * 100) / 100).toFixed(2);
  return s + unit(e);
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;

// 시드 고정 난수 (0 이상 1 미만)
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 정수로 정규화 (신뢰할 수 없는 입력용)
export function toInt(v, lo, hi) {
  v = Math.floor(Number(v));
  return Number.isFinite(v) ? clamp(v, lo, hi) : lo;
}
