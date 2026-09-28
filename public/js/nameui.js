// 4차 닉네임 입력 창(#m-name) — 첫 시작 때 필수(닫기·뒤로 가기·Esc 불가), 설정 '닉네임 변경'에서 재사용.
// 규칙·추천은 save.js(checkName · randomName). 이름은 textContent·value로만 다룬다(HTML 끼어들기 없음)
import { checkName, randomName, NAME_MAX } from './save.js';
import { magePortraitURL } from './art/units.js';

export function createNameUI(root, { openModal, closeModal, isOpen }) {
  const $ = id => root.querySelector('#' + id);
  const m = $('m-name'), form = $('nm-form'), input = $('nm-input'), err = $('nm-err'), count = $('nm-count');
  let required = false, done = null, composing = false;

  // 폰 키보드가 올라오면 보이는 영역(visualViewport) 안에서 가운데 — 창이 키보드 뒤로 숨지 않게
  const vv = globalThis.visualViewport;
  function fitKeyboard() {
    if (!vv || m.hidden) return;
    const r = root.getBoundingClientRect();
    const top = Math.max(0, vv.offsetTop - r.top), bottom = Math.max(0, r.bottom - (vv.offsetTop + vv.height));
    m.style.setProperty('--kb-top', top + 'px');
    m.style.setProperty('--kb-bottom', bottom + 'px');
    m.classList.toggle('kb', bottom > 80);
  }
  vv?.addEventListener('resize', fitKeyboard);
  vv?.addEventListener('scroll', fitKeyboard);

  // 입력 중 바로 옆 안내(한글 조합 중 'ㅎ' 같은 낱자는 조합이 끝난 뒤 판단)
  function validate(show = true) {
    const r = checkName(input.value);
    count.textContent = `${[...r.name].length}/${NAME_MAX}`;
    count.classList.toggle('over', [...r.name].length > NAME_MAX);
    const msg = !r.ok && show && r.name ? r.error : '';
    err.textContent = msg;
    input.setAttribute('aria-invalid', String(!!msg));
    return r;
  }
  input.addEventListener('compositionstart', () => { composing = true; });
  input.addEventListener('compositionend', () => { composing = false; validate(); });
  input.addEventListener('input', e => validate(!(composing || e.isComposing)));
  input.addEventListener('focus', () => setTimeout(fitKeyboard, 250));

  $('nm-dice').addEventListener('click', () => {
    input.value = randomName();
    validate();
    const d = $('nm-dice').firstElementChild;
    d.classList.remove('roll'); void d.offsetWidth; d.classList.add('roll');
    input.focus({ preventScroll: true });
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const r = validate();
    if (!r.ok) {
      err.textContent = r.error; // 빈 칸으로 누르면 '이름을 적어 주세요'
      input.setAttribute('aria-invalid', 'true');
      const b = $('nm-ok');
      b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
      input.focus({ preventScroll: true });
      return;
    }
    input.blur();
    const cb = done;
    done = null; required = false;
    closeModal('m-name');
    cb?.(r.name);
  });
  // 배경 탭: 필수일 땐 무시, 변경일 땐 닫기
  m.addEventListener('click', e => { if (e.target === m && !required) closeModal('m-name'); });

  let portrait = false;
  // opts: { required, current } · onDone(name) — 확인했을 때만 부른다
  function ask({ required: req = false, current = '' } = {}, onDone) {
    if (!portrait) { portrait = true; try { $('nm-por').src = magePortraitURL(0, 3, 240); } catch { /* 초상 없이 */ } }
    required = !!req;
    done = onDone;
    input.value = current || '';
    $('nm-x').hidden = required;
    $('nm-lead').textContent = required ? '성벽을 지킬 대마법사예요. 이름은 설정에서 언제든 바꿀 수 있어요.' : '새 이름을 적어 주세요.';
    $('nm-ok').textContent = required ? '이 이름으로 시작' : '바꾸기';
    $('nm-h').textContent = required ? '대마법사의 이름을 지어 주세요' : '대마법사의 이름 바꾸기';
    validate(false);
    err.textContent = '';
    openModal('m-name');
    fitKeyboard();
  }
  // 뒤로 가기·Esc: 필수면 삼키고, 변경이면 닫는다
  function handleBack() {
    if (!required) closeModal('m-name');
    return true;
  }
  return { ask, handleBack, isOpen: () => isOpen('m-name'), isRequired: () => required && isOpen('m-name') };
}
