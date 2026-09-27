// 판타지 스킬 14종(Lv1~6) + 원소 융합(합체) 스킬 8종의 런타임 효과 (sim.js가 호출). DOM 없음.
// 성벽 마법사(솔로 = 나 한 명)는 기본 주문(약한 견제) + 주문서의 스킬을 쿨타임대로 자동 시전한다. 주문서 = g.spells(카드 빌드),
// 실제 발동 레벨은 g.book(융합 스킬이 품은 재료 두 스킬은 만렙). 쿨타임 ÷ stats.cdMul(시전 속도), stats.echo 확률로 연속 시전.
// cast/spell 이벤트의 lv = 그 스킬의 레벨(렌더러가 연출 크기를 키운다)
// api = sim.js가 넘겨주는 { damage, killEnemy, damageWall, emit, chainArc, frontMost, spellHit, aimTarget, collabProc }
import {
  WORLD_W, WORLD_H, WALL_Y, mageAt, SPELL_BY_KEY, FUSION_BY_KEY, FUSION_KEYS, FUSION_FX, SPELL_CAST,
  COLLAB_FX, collabOn, collabPow, FRONT_Y, inReach,
} from './config.js';
import { heroBonuses } from './hero.js';

const COOLDOWN = ['fireball', 'lightningStrike', 'iceLance', 'tornado', 'judgment'];
const timers = () => {
  const t = { dragon: 0, echo: {} };
  for (const k of [...COOLDOWN, ...FUSION_KEYS]) t[k] = 0;
  return t;
};

// 스테이지마다 전장 효과·쿨타임만 새로 (주문서 g.spells 는 런 전체 유지 — sim.js 소유)
export function initSpells(g) {
  g.spellFx = { tornadoes: [], lances: [], beams: [], ghosts: [], storms: [], dragon: null, golem: null, frostWard: null };
  g.spellT = timers();     // 렌더러가 judgment 예고·스킬 스택 쿨타임 링에 읽는다
  g._emp = 1;              // 합동 필살 위력(시전 한 번 동안만 2)
}

// 성벽 근처 서리 결계 감속 배율(0~1). 소유하지 않으면 1
export function frostSlowMul(g, e) {
  const lv = g.book.frostWard;
  if (!lv) return 1;
  const p = SPELL_BY_KEY.frostWard.lv[lv - 1];
  return e.y + e.r > WALL_Y - p.r ? 1 - p.slow : 1;
}
const chilled = (g, e) => e.frozen || e.slowT > 0 || e.stunT > 0 || frostSlowMul(g, e) < 1;

// 질풍: P1의 모든 주문 시전 속도 배율(기본 주문 시전 간격 · 쿨타임 스킬 쿨타임 · 드래곤 브레스 주기)
export function spellRateMul(g) {
  const lv = g.book.gale;
  return lv ? 1 + SPELL_BY_KEY.gale.lv[lv - 1].mul : 1;
}

// 저주 낙인: 모든 피해 배율
export function curseMul(g) {
  const lv = g.book.curseMark;
  return lv ? 1 + SPELL_BY_KEY.curseMark.lv[lv - 1].mul : 1;
}

// 돌 골렘이 성벽 대신 흡수. 남은 피해를 반환
export function golemAbsorb(g, dmg) {
  const gl = g.spellFx.golem;
  if (!gl || gl.hp <= 0) return dmg;
  const a = Math.min(gl.hp, dmg);
  gl.hp -= a;
  return dmg - a;
}

const burnOn = (e, amt, t, o) => { e.burn += amt; e.burnT = Math.max(e.burnT, t); e.burnO = o; e.burnSk = true; };

// 주문(기본 주문·스킬, 지속 피해 제외)이 적을 맞췄을 때: 불꽃 마탄 화상 · 연쇄 번개 확률 전이(내 주문서)
export function onSpellHit(g, e, raw, o, api) {
  if (o !== 0) return; // ponytail: 협동 동료(잠듦)는 주문서가 없다
  const s = g.book;
  if (s.flameBullet && !e.dead) {
    const p = SPELL_BY_KEY.flameBullet.lv[s.flameBullet - 1];
    burnOn(e, raw * p.burn, p.dur, o);
  }
  if (s.chainLightning) {
    const p = SPELL_BY_KEY.chainLightning.lv[s.chainLightning - 1];
    if (g.rng() < p.chance) api.chainArc(g, e, raw * p.mul, o, p.n);
  }
}

// 처치 시: 영혼 수확(골드·회복) · 황혼(저주 처치 회복) · 증기 폭발(화상+둔화 처치 폭발) · 망령 군단(유령 소환)
export function onKill(g, e, o, gold, api) {
  const s = g.book;
  if (s.soulHarvest) {
    const p = SPELL_BY_KEY.soulHarvest.lv[s.soulHarvest - 1];
    const bonus = Math.ceil(gold * p.goldMul);
    for (let i = 0; i < (g.coop ? 2 : 1); i++) g.players[i].gold += bonus; // 솔로 = 나만
    g.wall.hp = Math.min(g.wall.max, g.wall.hp + g.wall.max * p.heal);
  }
  if (g.fusions.includes('twilight') && e.cursed) {
    g.wall.hp = Math.min(g.wall.max, g.wall.hp + g.wall.max * FUSION_FX.twilightHeal);
  }
  if (g.fusions.includes('steamBurst') && e.burnT > 0 && chilled(g, e)) {
    const dmg = pd(g, 0) * FUSION_FX.steamMul, r = 90;
    for (const q of g.enemies) {
      if (q === e || q.dead) continue;
      const dx = q.x - e.x, dy = q.y - e.y, rr = r + q.r;
      if (dx * dx + dy * dy <= rr * rr) api.damage(g, q, dmg, o === 2 ? 0 : o);
    }
    api.emit(g, { type: 'boom', x: e.x, y: e.y, r, kind: 'steam' });
  }
  if (g.fusions.includes('ghostLegion') && g.spellFx.ghosts.length < 40) {
    g.spellFx.ghosts.push({ x: e.x, y: e.y, dmg: pd(g, 0) * FUSION_FX.ghostDmg, tgt: null, life: 0 });
  }
}

// ── 매 프레임 (phase === 'play' 일 때만 호출) ──
export function updateSpells(g, dt, api) {
  const fx = g.spellFx;
  // 쿨타임 주문 로테이션: 주문서의 스킬을 각자 쿨타임대로 + 융합 스킬의 전용 시전
  const s0 = g.book, T = g.spellT;
  for (const key of COOLDOWN) if (s0[key]) tick(g, api, 0, T, key, s0[key], SPELL_BY_KEY[key].lv[s0[key] - 1], dt, CAST[key]);
  for (const key of g.fusions) tick(g, api, 0, T, key, g.spells[key], FUSION_BY_KEY[key].lv[g.spells[key] - 1], dt, FCAST[key]);
  moveLances(g, dt, api, fx);
  moveTornadoes(g, dt, api, fx);
  updateStorms(g, dt, api, fx);
  for (let i = fx.beams.length - 1; i >= 0; i--) if ((fx.beams[i].t -= dt) <= 0) fx.beams.splice(i, 1);
  // 지속형(오라·소환)은 P1 카드 빌드에만
  const s = g.book;
  fx.frostWard = s.frostWard ? { r: SPELL_BY_KEY.frostWard.lv[s.frostWard - 1].r } : null;
  if (s.holyLight) updateHolyLight(g, dt, api);
  if (s.babyDragon) updateDragon(g, dt, api, g.spellT, fx);
  else fx.dragon = null;
  if (s.stoneGolem) updateGolem(g, fx, api);
  else fx.golem = null;
  updateGhosts(g, dt, api, fx);
}

// 쿨타임이 다 되면 시전. 합동 필살: 영웅 궁극기 3초 안의 첫 시전은 2배 위력 + 슬로 모션.
// 이 시전이 낸 cast/spell 이벤트에 스킬 레벨 lv를 붙인다(렌더러: Lv1 소박 → Lv6 완전체)
function tick(g, api, o, T, key, lv, p, dt, fn) {
  if ((T[key] -= dt) > 0) return;
  const link = o === 0 && g.linkT > 0;
  if (link) g._emp = COLLAB_FX.linkMul;
  const n0 = g.events.length;
  const cd = fn(g, api, o, p);
  for (let i = n0; i < g.events.length; i++) { const ev = g.events[i]; if (ev.type === 'cast' || ev.type === 'spell') ev.lv = lv; }
  g._emp = 1;
  if (cd == null) { T[key] = 0.3; return; } // 표적 없음: 잠시 뒤 다시
  if (link) {
    g.linkT = 0;
    const h = g.heroUnit;
    api.emit(g, { type: 'linkFinish', spell: key, x: h ? h.x : WORLD_W / 2, y: h ? h.y : WALL_Y / 2 });
    api.emit(g, { type: 'slowmo', ms: 700, scale: 0.3 });
    const first = !g.discovered.has('unison');
    g.discovered.add('unison');
    api.emit(g, { type: 'synergy', key: 'unison', o: 2, first, x: h ? h.x : WORLD_W / 2, y: h ? h.y - 40 : WALL_Y / 2 });
  }
  rearm(g, o, T, key, cd);
}

// 다음 시전까지: 쿨타임 ÷ 시전 속도. 다중 시전 확률에 걸리면 echoDelay 뒤 한 번 더(연속 시전은 한 번만 이어진다)
function rearm(g, o, T, key, cd) {
  const st = g.players[o].stats;
  if (!T.echo[key] && st.echo > 0 && g.rng() < st.echo) { T.echo[key] = true; T[key] = SPELL_CAST.echoDelay; }
  else { T.echo[key] = false; T[key] = cd / (st.cdMul * (o === 0 ? spellRateMul(g) : 1)); }
}

// 스킬 스택 UI(쿨타임 링): 내(P1) 슬롯 스킬 key의 { left, total }(초). 쿨타임이 없는 지속형 스킬이면 null
export function spellCooldown(g, key) {
  const lv = g.spells[key], d = FUSION_BY_KEY[key] || (COOLDOWN.includes(key) && SPELL_BY_KEY[key]);
  if (!lv || !d) return null;
  const total = d.lv[lv - 1].cd / (g.players[0].stats.cdMul * spellRateMul(g));
  return { left: Math.max(0, Math.min(total, g.spellT[key] || 0)), total };
}

// 스킬 피해 기준 = 시전자 마력 × 장비 스킬 피해% × 합동 필살
function pd(g, o) { return g.players[o].stats.dmg * (g.hero ? heroBonuses(g.hero).spellMul : 1) * g._emp; }

// 시전 연출 이벤트(마법진·지팡이 섬광·주문별 시전 동작). 시전 위치 = 성벽 위 마법사(솔로 = 성벽 중앙). support = 영웅이 싸우는 적을 노린 지원 사격
function cast(g, api, o, spell, tx, ty, support = false) {
  const c = mageAt(g, o);
  api.emit(g, { type: 'cast', o, spell, basic: false, x: c.x, y: c.y, tx, ty, support, linked: g._emp > 1 });
}
const isSupport = (g, t) => !!g.heroUnit && g.heroUnit.state !== 'down' && g.heroUnit.fightE === t;

// 스킬 피해: 치명타·쌍둥이·거인 사냥꾼·체인은 sim.js spellHit이 처리(hit 이벤트 o:3, caster = 시전자)
const sHit = (g, api, e, dmg, o, kind, dot = false) => api.spellHit(g, e, dmg, o, kind, true, dot);
const inCircle = (e, x, y, r) => (e.x - x) ** 2 + (e.y - y) ** 2 <= (r + e.r) ** 2;

// 가장 밀집한 무리의 중심 적(없으면 가장 앞선 적)
function densest(g, api, r = 110) {
  let best = null, bn = 0;
  for (const e of g.enemies) {
    if (!inReach(e)) continue; // 사거리(전선 아래)
    let n = 0;
    for (const q of g.enemies) if (!q.dead && (q.x - e.x) ** 2 + (q.y - e.y) ** 2 < r * r) n++;
    if (n > bn || (n === bn && best && e.y > best.y)) { bn = n; best = e; }
  }
  return best || api.frontMost(g);
}

// 각 쿨타임 주문의 1회 시전. 쿨타임(초)을 반환, 표적이 없으면 null
const CAST = {
  fireball(g, api, o, p) {
    // 모루와 망치(기사 협공): 기사가 싸우는 무리를 먼저 노린다
    const anvil = o === 0 && collabOn(g, 'anvil');
    const tgt = anvil ? api.aimTarget(g) : api.frontMost(g);
    if (!tgt) return null;
    cast(g, api, o, 'fireball', tgt.x, tgt.y, anvil && isSupport(g, tgt));
    const dmg = pd(g, o) * p.mul, r = p.r * (g._emp > 1 ? 1.3 : 1), hit = [];
    for (const e of g.enemies) {
      if (!e.dead && inCircle(e, tgt.x, tgt.y, r)) { sHit(g, api, e, dmg, o, 'fire'); hit.push(e); }
    }
    api.emit(g, { type: 'spell', key: 'fireball', o, x: tgt.x, y: tgt.y, r });
    if (o === 0 && g.fusions.includes('plasma') && hit.length) api.chainArc(g, hit[0], dmg * FUSION_FX.plasmaMul, 0, 3);
    return p.cd;
  },
  lightningStrike(g, api, o, p) {
    const alive = g.enemies.filter(inReach);
    if (!alive.length) return null;
    const fus = o === 0 ? g.fusions : [];
    const first = api.aimTarget(g); // 지원 사격: 첫 줄기는 영웅이 싸우는 적에게
    const picked = first ? [first] : [];
    for (let tries = 0; picked.length < p.n && tries < p.n * 5 && picked.length < alive.length; tries++) {
      const e = alive[Math.floor(g.rng() * alive.length)];
      if (!picked.includes(e)) picked.push(e);
    }
    cast(g, api, o, 'lightningStrike', picked[0].x, picked[0].y, isSupport(g, picked[0]));
    for (const e of picked) {
      let dmg = pd(g, o) * p.mul;
      if (fus.includes('superconduct') && chilled(g, e)) dmg *= FUSION_FX.superconduct;
      sHit(g, api, e, dmg, o, 'lightning');
      api.emit(g, { type: 'spell', key: 'lightningStrike', o, x: e.x, y: e.y });
    }
    const stormEye = fus.includes('stormEye') && (g.spellFx.tornadoes.length > 0 || g.spellFx.storms.length > 0);
    return stormEye ? p.cd / FUSION_FX.stormEyeMul : p.cd;
  },
  iceLance(g, api, o, p) {
    const tgt = api.aimTarget(g); // 지원 사격
    if (!tgt) return null;
    const c = mageAt(g, o), a = Math.atan2(tgt.y - c.y, tgt.x - c.x);
    cast(g, api, o, 'iceLance', tgt.x, tgt.y, isSupport(g, tgt));
    g.spellFx.lances.push({ x: c.x, y: c.y, vx: Math.cos(a) * 1000, vy: Math.sin(a) * 1000, dmg: pd(g, o) * p.mul, hit: [], life: 0, o });
    api.emit(g, { type: 'spell', key: 'iceLance', o, x: c.x, y: c.y });
    return p.cd;
  },
  tornado(g, api, o, p) {
    const x = 60 + g.rng() * (WORLD_W - 120);
    cast(g, api, o, 'tornado', x, WALL_Y - 40);
    g.spellFx.tornadoes.push({ x, y: WALL_Y - 40, r: p.r, t: 0, mul: p.mul * g._emp, spd: p.spd, o, life: 6, fire: false });
    api.emit(g, { type: 'spell', key: 'tornado', o, x, y: WALL_Y - 40 });
    return p.cd;
  },
  judgment(g, api, o, p) {
    const tgt = api.aimTarget(g); // 지원 사격
    if (!tgt) return null;
    cast(g, api, o, 'judgment', tgt.x, tgt.y, isSupport(g, tgt));
    const holy = o === 0 && collabOn(g, 'holyAssault'), pow = collabPow(g);
    const dmg = pd(g, o) * p.mul * (holy ? 1 + COLLAB_FX.holyAmp * pow : 1), twilight = o === 0 && g.fusions.includes('twilight');
    for (const e of g.enemies) {
      if (e.dead || Math.abs(e.x - tgt.x) > p.w / 2 + e.r) continue;
      sHit(g, api, e, dmg, o, 'holy');
      if (twilight && !e.dead) e.cursed = true;
    }
    g.spellFx.beams.push({ x: tgt.x, w: p.w, t: 0.25 });
    api.emit(g, { type: 'spell', key: 'judgment', o, x: tgt.x, w: p.w });
    const h = g.heroUnit;
    if (holy && h && h.state !== 'down') { // 성광 협공: 광선이 영웅을 치유
      h.hp = Math.min(h.maxHp, h.hp + h.maxHp * COLLAB_FX.holyHeal * pow);
      api.collabProc(g, 'holyAssault', h.x, h.y);
    }
    return p.cd;
  },
};

// 융합(합체) 스킬 전용 시전 — 재료 두 스킬의 효과(g.book)에 더해진다. spell{key: 융합 키, shape}
const FCAST = {
  blazeTornado(g, api, o, p) { // 밀집한 무리에 제자리 불꽃 회오리
    const t = densest(g, api);
    if (!t) return null;
    cast(g, api, 0, 'blazeTornado', t.x, t.y);
    g.spellFx.tornadoes.push({ x: t.x, y: t.y, r: p.r, t: 0, mul: p.mul * g._emp, spd: 0, o: 0, life: FUSION_FX.firestormLife, fire: true });
    api.emit(g, { type: 'spell', key: 'blazeTornado', shape: 'firestorm', o: 0, x: t.x, y: t.y, r: p.r });
    return p.cd;
  },
  superconduct(g, api, o, p) { // 얼음 번개 n줄기: 둔화 + 짧은 빙결, 차가운 적 2배
    const alive = g.enemies.filter(inReach).sort((a, b) => b.y - a.y).slice(0, p.n);
    if (!alive.length) return null;
    cast(g, api, 0, 'superconduct', alive[0].x, alive[0].y);
    for (const e of alive) {
      sHit(g, api, e, pd(g, 0) * p.mul * (chilled(g, e) ? FUSION_FX.superconduct : 1), 0, 'lightning');
      if (!e.dead) { e.slowT = Math.max(e.slowT, 2); if (!e.named) e.stunT = Math.max(e.stunT || 0, 0.5); }
    }
    api.emit(g, { type: 'spell', key: 'superconduct', shape: 'thunderFrost', o: 0, x: alive[0].x, y: alive[0].y, pts: alive.map(e => [e.x, e.y]) });
    return p.cd;
  },
  steamBurst(g, api, o, p) { // 증기 폭발: 광역 + 화상 + 둔화
    const t = densest(g, api);
    if (!t) return null;
    cast(g, api, 0, 'steamBurst', t.x, t.y);
    const dmg = pd(g, 0) * p.mul, x = t.x, y = t.y;
    for (const e of g.enemies) {
      if (e.dead || !inCircle(e, x, y, p.r)) continue;
      sHit(g, api, e, dmg, 0, 'fire');
      if (!e.dead) { burnOn(e, dmg * 0.3, 2, 0); e.slowT = Math.max(e.slowT, 1.5); }
    }
    api.emit(g, { type: 'spell', key: 'steamBurst', shape: 'steamNova', o: 0, x, y, r: p.r });
    return p.cd;
  },
  stormEye(g, api, o, p) { // 머무는 폭풍: 끌어당기며 벼락
    const t = densest(g, api, 150);
    if (!t) return null;
    cast(g, api, 0, 'stormEye', t.x, t.y);
    g.spellFx.storms.push({ x: t.x, y: t.y, r: p.r, t: 0, life: FUSION_FX.stormLife, zapT: 0, dmg: pd(g, 0) * p.mul });
    api.emit(g, { type: 'spell', key: 'stormEye', shape: 'stormEye', o: 0, x: t.x, y: t.y, r: p.r });
    return p.cd;
  },
  twilight(g, api, o, p) { // 황혼의 광선: 넓은 세로 광선 + 저주
    const t = api.aimTarget(g);
    if (!t) return null;
    cast(g, api, 0, 'twilight', t.x, t.y, isSupport(g, t));
    const dmg = pd(g, 0) * p.mul;
    for (const e of g.enemies) {
      if (e.dead || Math.abs(e.x - t.x) > p.w / 2 + e.r) continue;
      sHit(g, api, e, dmg, 0, 'dark');
      if (!e.dead) e.cursed = true;
    }
    g.spellFx.beams.push({ x: t.x, w: p.w, t: 0.35, kind: 'twilight' });
    api.emit(g, { type: 'spell', key: 'twilight', shape: 'eclipse', o: 0, x: t.x, w: p.w });
    return p.cd;
  },
  plasma(g, api, o, p) { // 플라즈마 구체: 폭발 + 번개 n갈래
    const t = api.aimTarget(g);
    if (!t) return null;
    cast(g, api, 0, 'plasma', t.x, t.y, isSupport(g, t));
    const dmg = pd(g, 0) * p.mul, x = t.x, y = t.y;
    for (const e of g.enemies) if (!e.dead && inCircle(e, x, y, p.r)) sHit(g, api, e, dmg, 0, 'lightning');
    const c = g.enemies.find(e => !e.dead && inCircle(e, x, y, p.r * 1.5));
    if (c) api.chainArc(g, c, dmg * 0.6, 0, p.n);
    api.emit(g, { type: 'spell', key: 'plasma', shape: 'plasmaOrb', o: 0, x, y, r: p.r });
    return p.cd;
  },
  ghostLegion(g, api, o, p) { // 망령의 문: 유령 n마리
    if (!g.enemies.some(inReach)) return null;
    const x = 120 + g.rng() * (WORLD_W - 240), y = WALL_Y - 60;
    cast(g, api, 0, 'ghostLegion', x, y);
    for (let k = 0; k < p.n; k++) g.spellFx.ghosts.push({ x: x + (k - p.n / 2) * 18, y, dmg: pd(g, 0) * p.mul, tgt: null, life: 0 });
    api.emit(g, { type: 'spell', key: 'ghostLegion', shape: 'ghostWave', o: 0, x, y, n: p.n });
    return p.cd;
  },
  guardianDragon(g, api, o, p) { // 수호룡 강하: 가로 띠 전체 + 성벽 치유
    const t = densest(g, api, 140);
    if (!t) return null;
    cast(g, api, 0, 'guardianDragon', t.x, t.y);
    const dmg = pd(g, 0) * p.mul, y = t.y;
    for (const e of g.enemies) if (!e.dead && Math.abs(e.y - y) <= 70 + e.r) sHit(g, api, e, dmg, 0, 'fire');
    g.wall.hp = Math.min(g.wall.max, g.wall.hp + g.wall.max * p.heal);
    const gl = g.spellFx.golem;
    if (gl) gl.hp = Math.min(gl.maxHp, gl.hp + gl.maxHp * p.heal);
    api.emit(g, { type: 'spell', key: 'guardianDragon', shape: 'dragonDive', o: 0, x: t.x, y, w: 140 });
    return p.cd;
  },
};

function moveLances(g, dt, api, fx) {
  const ecoAmp = 1 + (collabOn(g, 'frostEcho') ? COLLAB_FX.frostEcho * collabPow(g) : 0)
    + (collabOn(g, 'frostBastion') ? COLLAB_FX.frostBastion * collabPow(g) : 0);
  for (let i = fx.lances.length - 1; i >= 0; i--) {
    const l = fx.lances[i];
    l.x += l.vx * dt; l.y += l.vy * dt; l.life += dt;
    let gone = l.life > 1.6 || l.x < -30 || l.x > WORLD_W + 30 || l.y < -60 || l.y > WORLD_H;
    if (!gone) for (const e of g.enemies) {
      if (e.dead || l.hit.includes(e.id)) continue;
      const rr = e.r + 6;
      if ((l.x - e.x) ** 2 + (l.y - e.y) ** 2 <= rr * rr) {
        const amp = l.o === 0 && ecoAmp > 1 && chilled(g, e); // 서리 메아리·서리 방벽: 차가운 적에게 얼음 창 강화
        sHit(g, api, e, l.dmg * (amp ? ecoAmp : 1), l.o, 'frost');
        if (amp) api.collabProc(g, collabOn(g, 'frostEcho') ? 'frostEcho' : 'frostBastion', e.x, e.y);
        l.hit.push(e.id);
        if (l.hit.length >= 5) { gone = true; break; }
      }
    }
    if (gone) fx.lances.splice(i, 1);
  }
}

function moveTornadoes(g, dt, api, fx) {
  const blaze = g.fusions.includes('blazeTornado');
  for (let i = fx.tornadoes.length - 1; i >= 0; i--) {
    const tn = fx.tornadoes[i], hot = tn.fire || (blaze && tn.o === 0);
    tn.y -= tn.spd * dt;
    tn.t += dt;
    if (hot) tn.r += FUSION_FX.blazeGrow * dt;
    if (tn.y < FRONT_Y - 40 || tn.t > tn.life) { fx.tornadoes.splice(i, 1); continue; } // 전선 위(접근로)까지는 안 올라간다
    const dmg = g.players[tn.o].stats.dmg * (g.hero ? heroBonuses(g.hero).spellMul : 1) * tn.mul * dt;
    for (const e of g.enemies) {
      if (e.dead) continue;
      const dx = e.x - tn.x, dy = e.y - tn.y, rr = tn.r + e.r;
      if (dx * dx + dy * dy > rr * rr) continue;
      sHit(g, api, e, dmg, tn.o, hot ? 'fire' : 'wind', true);
      if (g.berserk === 1) e.y = Math.max(Math.min(e.y, FRONT_Y), e.y - 60 * dt); // 밀어냄: 성벽에서 먼 쪽(위)으로 — 전선 위로는 안 밀림(광폭화 중엔 무시)
      if (hot && !e.dead) burnOn(e, dmg * FUSION_FX.blazeBurn, 1.5, 0);
    }
  }
}

// 폭풍의 눈(합체 시전): 머무는 동안 적을 중심으로 끌어당기고 stormZap초마다 안쪽 적 하나에 벼락
function updateStorms(g, dt, api, fx) {
  for (let i = fx.storms.length - 1; i >= 0; i--) {
    const s = fx.storms[i];
    s.t += dt;
    if (s.t > s.life) { fx.storms.splice(i, 1); continue; }
    const inside = g.enemies.filter(e => !e.dead && inCircle(e, s.x, s.y, s.r));
    if (g.berserk === 1) for (const e of inside) {
      const dx = s.x - e.x, dy = s.y - e.y, d = Math.hypot(dx, dy) || 1;
      if (!e.isBoss && d > 12) { e.x += dx / d * FUSION_FX.stormPull * dt; e.y += dy / d * FUSION_FX.stormPull * dt; }
    }
    if ((s.zapT -= dt) > 0 || !inside.length) continue;
    s.zapT = FUSION_FX.stormZap;
    const e = inside[Math.floor(g.rng() * inside.length)];
    sHit(g, api, e, s.dmg * (chilled(g, e) && g.fusions.includes('superconduct') ? FUSION_FX.superconduct : 1), 0, 'lightning');
    api.emit(g, { type: 'spell', key: 'lightningStrike', o: 0, x: e.x, y: e.y, storm: true, lv: g.spells.stormEye || 1 });
  }
}

function updateHolyLight(g, dt, api) {
  const p = SPELL_BY_KEY.holyLight.lv[g.book.holyLight - 1];
  g.wall.hp = Math.min(g.wall.max, g.wall.hp + g.wall.max * p.rate * dt);
  const h = g.heroUnit;
  if (collabOn(g, 'holyAssault') && h && h.state !== 'down' && h.hp < h.maxHp) { // 성광 협공: 수호의 빛이 영웅도 치유
    h.hp = Math.min(h.maxHp, h.hp + h.maxHp * p.rate * 2 * dt);
    api.collabProc(g, 'holyAssault', h.x, h.y);
  }
}

// 새끼 드래곤(소환): 브레스 주기도 시전 속도로 짧아진다
function updateDragon(g, dt, api, T, fx) {
  const p = SPELL_BY_KEY.babyDragon.lv[g.book.babyDragon - 1];
  let d = fx.dragon;
  if (!d) d = fx.dragon = { x: WORLD_W / 2, y: 140, vx: 120, angle: 0, breathT: 0 };
  d.x += d.vx * dt;
  if (d.x < 90) { d.x = 90; d.vx = 120; } else if (d.x > WORLD_W - 90) { d.x = WORLD_W - 90; d.vx = -120; }
  d.angle = d.vx > 0 ? 0 : Math.PI;
  if (d.breathT > 0) {
    d.breathT -= dt;
    const dmg = pd(g, 0) * p.mul * dt, guard = g.fusions.includes('guardianDragon');
    for (const e of g.enemies) {
      if (!inReach(e) || Math.abs(e.x - d.x) > 70 || e.y < d.y) continue;
      sHit(g, api, e, dmg, 0, 'fire', true);
    }
    if (guard) {
      g.wall.hp = Math.min(g.wall.max, g.wall.hp + g.wall.max * FUSION_FX.guardHeal * dt);
      if (fx.golem) fx.golem.hp = Math.min(fx.golem.maxHp, fx.golem.hp + fx.golem.maxHp * FUSION_FX.guardHeal * dt);
    }
    return;
  }
  T.dragon -= dt;
  if (T.dragon <= 0) {
    T.dragon = p.cd / (g.players[0].stats.cdMul * spellRateMul(g));
    d.breathT = p.breathT;
    api.emit(g, { type: 'spell', key: 'babyDragon', o: 0, x: d.x, y: d.y, lv: g.book.babyDragon });
  }
}

// 돌 골렘: 철벽 전선(기사) +50% · 수호 성벽(성직자) +40% 최대 체력
function updateGolem(g, fx, api) {
  const p = SPELL_BY_KEY.stoneGolem.lv[g.book.stoneGolem - 1], pow = collabPow(g);
  const bonus = (collabOn(g, 'ironLine') ? COLLAB_FX.ironGolem * pow : 0) + (collabOn(g, 'sanctuary') ? COLLAB_FX.sanctuary * pow : 0);
  const maxHp = g.wall.max * p.hpMul * (1 + bonus);
  if (!fx.golem) {
    fx.golem = { x: WORLD_W / 2, y: WALL_Y - 70, hp: maxHp, maxHp };
    for (const k of ['ironLine', 'sanctuary']) if (collabOn(g, k)) api.collabProc(g, k, fx.golem.x, fx.golem.y); // 협공으로 커진 골렘
  } else { fx.golem.maxHp = maxHp; fx.golem.hp = Math.min(fx.golem.hp, maxHp); }
}

function updateGhosts(g, dt, api, fx) {
  const gh = fx.ghosts;
  for (let i = gh.length - 1; i >= 0; i--) {
    const q = gh[i];
    q.life += dt;
    let t = q.tgt;
    if (!t || t.dead) {
      t = null;
      let bd = Infinity;
      for (const e of g.enemies) { if (!inReach(e)) continue; const d = (e.x - q.x) ** 2 + (e.y - q.y) ** 2; if (d < bd) { bd = d; t = e; } }
      q.tgt = t;
    }
    if (!t) { if (q.life > 3) gh.splice(i, 1); continue; }
    const dx = t.x - q.x, dy = t.y - q.y, d = Math.hypot(dx, dy) || 1, spd = FUSION_FX.ghostSpeed;
    q.x += dx / d * spd * dt; q.y += dy / d * spd * dt;
    if (d < t.r + 10) { sHit(g, api, t, q.dmg, 0, 'dark'); gh.splice(i, 1); continue; }
    if (q.life > 4) gh.splice(i, 1);
  }
}
