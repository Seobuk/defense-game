// 판타지 스킬 14종(Lv1~5) + 원소 융합 8종의 런타임 효과 (sim.js가 호출). DOM 없음.
// 성벽 마법사는 기본 공격이 없다: 카드로 얻은 스킬은 P1의 주문서(g.spells), AI 동료가 익힌 주문은 P2의 주문서(g.allySpells)에
// 들어가 각자 쿨타임대로 자동 시전된다. 쿨타임 ÷ 시전자 stats.cdMul(시전 속도), stats.echo 확률로 연속 시전.
// api = sim.js가 넘겨주는 { damage, killEnemy, damageWall, emit, chainArc, frontMost, spellHit }
import { WORLD_W, WORLD_H, WALL_Y, CANNONS, SPELL_BY_KEY, FUSION_FX, SPELL_CAST } from './config.js';
import { heroBonuses } from './hero.js';

const COOLDOWN = ['fireball', 'lightningStrike', 'iceLance', 'tornado', 'judgment'];
const timers = () => ({ fireball: 0, lightningStrike: 0, iceLance: 0, tornado: 0, judgment: 0, dragon: 0, echo: {} });

// 스테이지마다 전장 효과·쿨타임만 새로 (주문서 g.spells · g.allySpells · g.fusions 는 런 전체 유지 — sim.js 소유)
export function initSpells(g) {
  g.spellFx = { tornadoes: [], lances: [], beams: [], ghosts: [], dragon: null, golem: null, frostWard: null };
  g.spellT = timers();     // P1 (렌더러가 judgment 예고에 읽는다)
  g.allySpellT = timers(); // P2
}

// 성벽 근처 서리 결계 감속 배율(0~1). 소유하지 않으면 1
export function frostSlowMul(g, e) {
  const lv = g.spells.frostWard;
  if (!lv) return 1;
  const p = SPELL_BY_KEY.frostWard.lv[lv - 1];
  return e.y + e.r > WALL_Y - p.r ? 1 - p.slow : 1;
}
const chilled = (g, e) => e.frozen || e.slowT > 0 || frostSlowMul(g, e) < 1;

// 질풍: P1 기본 주문 시전 속도 배율
export function spellRateMul(g) {
  const lv = g.spells.gale;
  return lv ? 1 + SPELL_BY_KEY.gale.lv[lv - 1].mul : 1;
}

// 저주 낙인: 모든 피해 배율
export function curseMul(g) {
  const lv = g.spells.curseMark;
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

// 기본 주문이 적을 맞췄을 때: 불꽃 마탄 화상(P1) · 연쇄 번개 확률 전이(주문서에 있는 마법사)
export function onBasicHit(g, e, raw, o, api) {
  const s = o === 0 ? g.spells : g.allySpells;
  if (s.flameBullet && !e.dead) {
    const p = SPELL_BY_KEY.flameBullet.lv[s.flameBullet - 1];
    e.burn += raw * p.burn;
    e.burnT = Math.max(e.burnT, p.dur);
    e.burnO = o;
  }
  if (s.chainLightning) {
    const p = SPELL_BY_KEY.chainLightning.lv[s.chainLightning - 1];
    if (g.rng() < p.chance) api.chainArc(g, e, raw * p.mul, o, p.n);
  }
}

// 처치 시: 영혼 수확(골드·회복) · 황혼(저주 처치 회복) · 증기 폭발(화상+둔화 처치 폭발) · 망령 군단(유령 소환)
export function onKill(g, e, o, gold, api) {
  const s = g.spells;
  if (s.soulHarvest) {
    const p = SPELL_BY_KEY.soulHarvest.lv[s.soulHarvest - 1];
    const bonus = Math.ceil(gold * p.goldMul);
    for (const pl of g.players) pl.gold += bonus;
    g.wall.hp = Math.min(g.wall.max, g.wall.hp + g.wall.max * p.heal);
  }
  if (g.fusions.includes('twilight') && e.cursed) {
    g.wall.hp = Math.min(g.wall.max, g.wall.hp + g.wall.max * FUSION_FX.twilightHeal);
  }
  if (g.fusions.includes('steamBurst') && e.burnT > 0 && chilled(g, e)) {
    const dmg = g.players[0].stats.dmg * FUSION_FX.steamMul, r = 90;
    for (const q of g.enemies) {
      if (q === e || q.dead) continue;
      const dx = q.x - e.x, dy = q.y - e.y, rr = r + q.r;
      if (dx * dx + dy * dy <= rr * rr) api.damage(g, q, dmg, o);
    }
    api.emit(g, { type: 'boom', x: e.x, y: e.y, r, kind: 'steam' });
  }
  if (g.fusions.includes('ghostLegion')) {
    g.spellFx.ghosts.push({ x: e.x, y: e.y, dmg: g.players[0].stats.dmg * FUSION_FX.ghostDmg, tgt: null, life: 0 });
  }
}

// ── 매 프레임 (phase === 'play' 일 때만 호출) ──
export function updateSpells(g, dt, api) {
  const fx = g.spellFx;
  // 쿨타임 주문 로테이션: 마법사마다 자기 주문서를 각자 쿨타임대로
  for (const [o, s, T] of [[0, g.spells, g.spellT], [1, g.allySpells, g.allySpellT]]) {
    for (const key of COOLDOWN) {
      if (!s[key] || (T[key] -= dt) > 0) continue;
      const cd = CAST[key](g, api, o, SPELL_BY_KEY[key].lv[s[key] - 1]);
      if (cd == null) { T[key] = 0.3; continue; } // 표적 없음: 잠시 뒤 다시
      rearm(g, o, T, key, cd);
    }
  }
  moveLances(g, dt, api, fx);
  moveTornadoes(g, dt, api, fx);
  for (let i = fx.beams.length - 1; i >= 0; i--) if ((fx.beams[i].t -= dt) <= 0) fx.beams.splice(i, 1);
  // 지속형(오라·소환)은 P1 카드 빌드에만
  const s = g.spells;
  fx.frostWard = s.frostWard ? { r: SPELL_BY_KEY.frostWard.lv[s.frostWard - 1].r } : null;
  if (s.holyLight) updateHolyLight(g, dt);
  if (s.babyDragon) updateDragon(g, dt, api, g.spellT, fx);
  else fx.dragon = null;
  if (s.stoneGolem) updateGolem(g, fx);
  else fx.golem = null;
  updateGhosts(g, dt, api, fx);
}

// 다음 시전까지: 쿨타임 ÷ 시전 속도. 다중 시전 확률에 걸리면 echoDelay 뒤 한 번 더(연속 시전은 한 번만 이어진다)
function rearm(g, o, T, key, cd) {
  const st = g.players[o].stats;
  if (!T.echo[key] && st.echo > 0 && g.rng() < st.echo) { T.echo[key] = true; T[key] = SPELL_CAST.echoDelay; }
  else { T.echo[key] = false; T[key] = cd / st.cdMul; }
}

function pd(g, o) { return g.players[o].stats.dmg * (g.hero ? heroBonuses(g.hero).spellMul : 1); }

// 시전 연출 이벤트(마법진·지팡이 섬광·주문별 시전 동작). 시전 위치 = 성벽 위 마법사
function cast(g, api, o, spell, tx, ty) {
  const c = CANNONS[o];
  api.emit(g, { type: 'cast', o, spell, basic: false, x: c.x, y: c.y, tx, ty });
}

// 스킬 피해: 치명타·쌍둥이·거인 사냥꾼·체인은 sim.js spellHit이 처리(hit 이벤트 o:3, caster = 시전자)
const sHit = (g, api, e, dmg, o, kind, dot = false) => api.spellHit(g, e, dmg, o, kind, true, dot);

// 각 쿨타임 주문의 1회 시전. 쿨타임(초)을 반환, 표적이 없으면 null
const CAST = {
  fireball(g, api, o, p) {
    const tgt = api.frontMost(g);
    if (!tgt) return null;
    cast(g, api, o, 'fireball', tgt.x, tgt.y);
    const dmg = pd(g, o) * p.mul, r = p.r, hit = [];
    for (const e of g.enemies) {
      if (e.dead) continue;
      const dx = e.x - tgt.x, dy = e.y - tgt.y;
      if (dx * dx + dy * dy <= (r + e.r) * (r + e.r)) { sHit(g, api, e, dmg, o, 'fire'); hit.push(e); }
    }
    api.emit(g, { type: 'spell', key: 'fireball', o, x: tgt.x, y: tgt.y, r });
    if (o === 0 && g.fusions.includes('plasma') && hit.length) api.chainArc(g, hit[0], dmg * FUSION_FX.plasmaMul, 0, 3);
    return p.cd;
  },
  lightningStrike(g, api, o, p) {
    const alive = g.enemies.filter(e => !e.dead);
    if (!alive.length) return null;
    const fus = o === 0 ? g.fusions : [];
    const picked = [];
    for (let tries = 0; picked.length < p.n && tries < p.n * 5 && picked.length < alive.length; tries++) {
      const e = alive[Math.floor(g.rng() * alive.length)];
      if (!picked.includes(e)) picked.push(e);
    }
    cast(g, api, o, 'lightningStrike', picked[0].x, picked[0].y);
    for (const e of picked) {
      let dmg = pd(g, o) * p.mul;
      if (fus.includes('superconduct') && chilled(g, e)) dmg *= FUSION_FX.superconduct;
      sHit(g, api, e, dmg, o, 'lightning');
      api.emit(g, { type: 'spell', key: 'lightningStrike', o, x: e.x, y: e.y });
    }
    const stormEye = fus.includes('stormEye') && g.spellFx.tornadoes.length > 0;
    return stormEye ? p.cd / FUSION_FX.stormEyeMul : p.cd;
  },
  iceLance(g, api, o, p) {
    const tgt = api.frontMost(g);
    if (!tgt) return null;
    const c = CANNONS[o], a = Math.atan2(tgt.y - c.y, tgt.x - c.x);
    cast(g, api, o, 'iceLance', tgt.x, tgt.y);
    g.spellFx.lances.push({ x: c.x, y: c.y, vx: Math.cos(a) * 1000, vy: Math.sin(a) * 1000, dmg: pd(g, o) * p.mul, hit: [], life: 0, o });
    api.emit(g, { type: 'spell', key: 'iceLance', o, x: c.x, y: c.y });
    return p.cd;
  },
  tornado(g, api, o, p) {
    const x = 60 + g.rng() * (WORLD_W - 120);
    cast(g, api, o, 'tornado', x, WALL_Y - 40);
    g.spellFx.tornadoes.push({ x, y: WALL_Y - 40, r: p.r, t: 0, mul: p.mul, spd: p.spd, o });
    api.emit(g, { type: 'spell', key: 'tornado', o, x, y: WALL_Y - 40 });
    return p.cd;
  },
  judgment(g, api, o, p) {
    const tgt = api.frontMost(g);
    if (!tgt) return null;
    cast(g, api, o, 'judgment', tgt.x, tgt.y);
    const dmg = pd(g, o) * p.mul, twilight = o === 0 && g.fusions.includes('twilight');
    for (const e of g.enemies) {
      if (e.dead || Math.abs(e.x - tgt.x) > p.w / 2 + e.r) continue;
      sHit(g, api, e, dmg, o, 'holy');
      if (twilight && !e.dead) e.cursed = true;
    }
    g.spellFx.beams.push({ x: tgt.x, w: p.w, t: 0.25 });
    api.emit(g, { type: 'spell', key: 'judgment', o, x: tgt.x, w: p.w });
    return p.cd;
  },
};

function moveLances(g, dt, api, fx) {
  for (let i = fx.lances.length - 1; i >= 0; i--) {
    const l = fx.lances[i];
    l.x += l.vx * dt; l.y += l.vy * dt; l.life += dt;
    let gone = l.life > 1.6 || l.x < -30 || l.x > WORLD_W + 30 || l.y < -60 || l.y > WORLD_H;
    if (!gone) for (const e of g.enemies) {
      if (e.dead || l.hit.includes(e.id)) continue;
      const rr = e.r + 6;
      if ((l.x - e.x) ** 2 + (l.y - e.y) ** 2 <= rr * rr) {
        sHit(g, api, e, l.dmg, l.o, 'frost');
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
    const tn = fx.tornadoes[i], hot = blaze && tn.o === 0;
    tn.y -= tn.spd * dt;
    tn.t += dt;
    if (hot) tn.r += FUSION_FX.blazeGrow * dt;
    if (tn.y < -40 || tn.t > 6) { fx.tornadoes.splice(i, 1); continue; }
    const dmg = pd(g, tn.o) * tn.mul * dt;
    for (const e of g.enemies) {
      if (e.dead) continue;
      const dx = e.x - tn.x, dy = e.y - tn.y, rr = tn.r + e.r;
      if (dx * dx + dy * dy > rr * rr) continue;
      sHit(g, api, e, dmg, tn.o, hot ? 'fire' : 'wind', true);
      if (g.berserk === 1) e.y = Math.max(0, e.y - 60 * dt); // 밀어냄: 성벽에서 먼 쪽(위)으로(광폭화 중엔 무시)
      if (hot) { e.burn += dmg * FUSION_FX.blazeBurn; e.burnT = Math.max(e.burnT, 1.5); e.burnO = 0; }
    }
  }
}

function updateHolyLight(g, dt) {
  const p = SPELL_BY_KEY.holyLight.lv[g.spells.holyLight - 1];
  g.wall.hp = Math.min(g.wall.max, g.wall.hp + g.wall.max * p.rate * dt);
}

// 새끼 드래곤(소환): 브레스 주기도 시전 속도로 짧아진다
function updateDragon(g, dt, api, T, fx) {
  const p = SPELL_BY_KEY.babyDragon.lv[g.spells.babyDragon - 1];
  let d = fx.dragon;
  if (!d) d = fx.dragon = { x: WORLD_W / 2, y: 140, vx: 120, angle: 0, breathT: 0 };
  d.x += d.vx * dt;
  if (d.x < 90) { d.x = 90; d.vx = 120; } else if (d.x > WORLD_W - 90) { d.x = WORLD_W - 90; d.vx = -120; }
  d.angle = d.vx > 0 ? 0 : Math.PI;
  if (d.breathT > 0) {
    d.breathT -= dt;
    const dmg = pd(g, 0) * p.mul * dt, guard = g.fusions.includes('guardianDragon');
    for (const e of g.enemies) {
      if (e.dead || Math.abs(e.x - d.x) > 70 || e.y < d.y) continue;
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
    T.dragon = p.cd / g.players[0].stats.cdMul;
    d.breathT = p.breathT;
    api.emit(g, { type: 'spell', key: 'babyDragon', o: 0, x: d.x, y: d.y });
  }
}

function updateGolem(g, fx) {
  const p = SPELL_BY_KEY.stoneGolem.lv[g.spells.stoneGolem - 1];
  const maxHp = g.wall.max * p.hpMul;
  if (!fx.golem) fx.golem = { x: WORLD_W / 2, y: WALL_Y - 70, hp: maxHp, maxHp };
  else { fx.golem.maxHp = maxHp; fx.golem.hp = Math.min(fx.golem.hp, maxHp); }
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
      for (const e of g.enemies) { if (e.dead) continue; const d = (e.x - q.x) ** 2 + (e.y - q.y) ** 2; if (d < bd) { bd = d; t = e; } }
      q.tgt = t;
    }
    if (!t) { if (q.life > 3) gh.splice(i, 1); continue; }
    const dx = t.x - q.x, dy = t.y - q.y, d = Math.hypot(dx, dy) || 1, spd = FUSION_FX.ghostSpeed;
    q.x += dx / d * spd * dt; q.y += dy / d * spd * dt;
    if (d < t.r + 10) { sHit(g, api, t, q.dmg, 0, 'dark'); gh.splice(i, 1); continue; }
    if (q.life > 4) gh.splice(i, 1);
  }
}
