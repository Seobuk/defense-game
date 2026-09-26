// 판타지 스킬 14종 + 원소 융합 8종의 런타임 효과 (sim.js가 호출). DOM 없음.
// api = sim.js가 넘겨주는 { damage, killEnemy, damageWall, emit, chainArc, frontMost }
import { WORLD_W, WORLD_H, WALL_Y, CANNONS, SPELL_BY_KEY, FUSION_FX } from './config.js';
import { heroBonuses } from './hero.js';

export function initSpells(g) {
  g.spells = {};                // { key: level(1~3) } — 스테이지 한정
  g.fusions = [];               // 지금 켜진 융합 키
  g.spellFx = { tornadoes: [], lances: [], beams: [], ghosts: [], dragon: null, golem: null, frostWard: null };
  g.spellT = { fireball: 0, lightningStrike: 0, iceLance: 0, tornado: 0, judgment: 0, dragon: 0 };
}

// 성벽 근처 서리 결계 감속 배율(0~1). 소유하지 않으면 1
export function frostSlowMul(g, e) {
  const lv = g.spells.frostWard;
  if (!lv) return 1;
  const p = SPELL_BY_KEY.frostWard.lv[lv - 1];
  return e.y + e.r > WALL_Y - p.r ? 1 - p.slow : 1;
}

// 질풍: 플레이어(0번) 공격속도 배율
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

// 내 탄환(플레이어 0번)이 적을 맞췄을 때: 불꽃 탄환 화상 · 연쇄 번개 확률 전이
export function onCannonHit(g, e, raw, o, api) {
  if (o !== 0) return;
  const s = g.spells;
  if (s.flameBullet && !e.dead) {
    const p = SPELL_BY_KEY.flameBullet.lv[s.flameBullet - 1];
    e.burn += raw * p.burn;
    e.burnT = Math.max(e.burnT, p.dur);
    e.burnO = 0;
  }
  if (s.chainLightning) {
    const p = SPELL_BY_KEY.chainLightning.lv[s.chainLightning - 1];
    if (g.rng() < p.chance) api.chainArc(g, e, raw * p.mul, 0, p.n);
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
  if (g.fusions.includes('steamBurst') && e.burnT > 0 && frostSlowMul(g, e) < 1) {
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
  const s = g.spells, fx = g.spellFx, T = g.spellT;
  if (s.fireball) updateFireball(g, dt, api, T, fx);
  if (s.lightningStrike) updateLightning(g, dt, api, T, fx);
  if (s.iceLance) updateIceLance(g, dt, api, T, fx);
  fx.frostWard = s.frostWard ? { r: SPELL_BY_KEY.frostWard.lv[s.frostWard - 1].r } : null;
  if (s.tornado) updateTornado(g, dt, api, T, fx);
  if (s.holyLight) updateHolyLight(g, dt);
  if (s.judgment) updateJudgment(g, dt, api, T, fx);
  if (s.babyDragon) updateDragon(g, dt, api, T, fx);
  else fx.dragon = null;
  if (s.stoneGolem) updateGolem(g, fx);
  else fx.golem = null;
  updateGhosts(g, dt, api, fx);
}

function pd(g) { return g.players[0].stats.dmg * (g.hero ? heroBonuses(g.hero).spellMul : 1); }

// 스킬 피해 = damage() 반환값을 그대로 hit 이벤트로(FX 데미지 숫자가 체력 감소 추정 대신 이걸 씀, o:3)
function sHit(g, api, e, dmg, kind, flash = true) {
  const dealt = api.damage(g, e, dmg, 0, flash);
  api.emit(g, { type: 'hit', x: e.x, y: e.y, dmg: dealt, o: 3, kind });
  return dealt;
}

function updateFireball(g, dt, api, T, fx) {
  const p = SPELL_BY_KEY.fireball.lv[g.spells.fireball - 1];
  T.fireball -= dt;
  if (T.fireball > 0) return;
  const tgt = api.frontMost(g);
  if (!tgt) { T.fireball = 0.4; return; }
  T.fireball = p.cd;
  const dmg = pd(g) * p.mul, r = p.r, hit = [];
  for (const e of g.enemies) {
    if (e.dead) continue;
    const dx = e.x - tgt.x, dy = e.y - tgt.y;
    if (dx * dx + dy * dy <= (r + e.r) * (r + e.r)) { sHit(g, api, e, dmg, 'fire'); hit.push(e); }
  }
  api.emit(g, { type: 'spell', key: 'fireball', x: tgt.x, y: tgt.y, r });
  if (g.fusions.includes('plasma') && hit.length) api.chainArc(g, hit[0], dmg * FUSION_FX.plasmaMul, 0, 3);
}

function updateLightning(g, dt, api, T) {
  const p = SPELL_BY_KEY.lightningStrike.lv[g.spells.lightningStrike - 1];
  const stormEye = g.fusions.includes('stormEye') && g.spellFx.tornadoes.length > 0;
  T.lightningStrike -= dt;
  if (T.lightningStrike > 0) return;
  const alive = g.enemies.filter(e => !e.dead);
  if (!alive.length) { T.lightningStrike = 0.3; return; }
  T.lightningStrike = stormEye ? p.cd / FUSION_FX.stormEyeMul : p.cd;
  const superconduct = g.fusions.includes('superconduct');
  const picked = [];
  for (let tries = 0; picked.length < p.n && tries < p.n * 5 && picked.length < alive.length; tries++) {
    const e = alive[Math.floor(g.rng() * alive.length)];
    if (!picked.includes(e)) picked.push(e);
  }
  for (const e of picked) {
    let dmg = pd(g) * p.mul;
    if (superconduct && (e.frozen || frostSlowMul(g, e) < 1)) dmg *= FUSION_FX.superconduct;
    sHit(g, api, e, dmg, 'lightning');
    api.emit(g, { type: 'spell', key: 'lightningStrike', x: e.x, y: e.y });
  }
}

function updateIceLance(g, dt, api, T, fx) {
  const p = SPELL_BY_KEY.iceLance.lv[g.spells.iceLance - 1];
  T.iceLance -= dt;
  if (T.iceLance <= 0) {
    const tgt = api.frontMost(g);
    if (tgt) {
      T.iceLance = p.cd;
      const c = CANNONS[0], a = Math.atan2(tgt.y - c.y, tgt.x - c.x);
      fx.lances.push({ x: c.x, y: c.y, vx: Math.cos(a) * 1000, vy: Math.sin(a) * 1000, dmg: pd(g) * p.mul, hit: [], life: 0 });
      api.emit(g, { type: 'spell', key: 'iceLance', x: c.x, y: c.y });
    } else T.iceLance = 0.3;
  }
  for (let i = fx.lances.length - 1; i >= 0; i--) {
    const l = fx.lances[i];
    l.x += l.vx * dt; l.y += l.vy * dt; l.life += dt;
    let gone = l.life > 1.6 || l.x < -30 || l.x > WORLD_W + 30 || l.y < -60 || l.y > WORLD_H;
    if (!gone) for (const e of g.enemies) {
      if (e.dead || l.hit.includes(e.id)) continue;
      const rr = e.r + 6;
      if ((l.x - e.x) ** 2 + (l.y - e.y) ** 2 <= rr * rr) {
        sHit(g, api, e, l.dmg, 'frost');
        l.hit.push(e.id);
        if (l.hit.length >= 5) { gone = true; break; }
      }
    }
    if (gone) fx.lances.splice(i, 1);
  }
}

function updateTornado(g, dt, api, T, fx) {
  const p = SPELL_BY_KEY.tornado.lv[g.spells.tornado - 1];
  T.tornado -= dt;
  if (T.tornado <= 0) {
    T.tornado = p.cd;
    const x = 60 + g.rng() * (WORLD_W - 120);
    fx.tornadoes.push({ x, y: WALL_Y - 40, r: p.r, t: 0, mul: p.mul });
    api.emit(g, { type: 'spell', key: 'tornado', x, y: WALL_Y - 40 });
  }
  const blaze = g.fusions.includes('blazeTornado');
  for (let i = fx.tornadoes.length - 1; i >= 0; i--) {
    const tn = fx.tornadoes[i];
    tn.y -= p.spd * dt;
    tn.t += dt;
    if (blaze) tn.r += FUSION_FX.blazeGrow * dt;
    if (tn.y < -40 || tn.t > 6) { fx.tornadoes.splice(i, 1); continue; }
    const dmg = pd(g) * tn.mul * dt;
    for (const e of g.enemies) {
      if (e.dead) continue;
      const dx = e.x - tn.x, dy = e.y - tn.y, rr = tn.r + e.r;
      if (dx * dx + dy * dy > rr * rr) continue;
      sHit(g, api, e, dmg, blaze ? 'fire' : 'wind', false);
      e.y = Math.max(0, e.y - 60 * dt); // 밀어냄: 성벽에서 먼 쪽(위)으로
      if (blaze) { e.burn += dmg * FUSION_FX.blazeBurn; e.burnT = Math.max(e.burnT, 1.5); e.burnO = 0; }
    }
  }
}

function updateHolyLight(g, dt) {
  const p = SPELL_BY_KEY.holyLight.lv[g.spells.holyLight - 1];
  g.wall.hp = Math.min(g.wall.max, g.wall.hp + g.wall.max * p.rate * dt);
}

function updateJudgment(g, dt, api, T, fx) {
  const p = SPELL_BY_KEY.judgment.lv[g.spells.judgment - 1];
  for (let i = fx.beams.length - 1; i >= 0; i--) if ((fx.beams[i].t -= dt) <= 0) fx.beams.splice(i, 1);
  T.judgment -= dt;
  if (T.judgment > 0) return;
  const tgt = api.frontMost(g);
  if (!tgt) { T.judgment = 0.3; return; }
  T.judgment = p.cd;
  const dmg = pd(g) * p.mul, twilight = g.fusions.includes('twilight');
  for (const e of g.enemies) {
    if (e.dead || Math.abs(e.x - tgt.x) > p.w / 2 + e.r) continue;
    sHit(g, api, e, dmg, 'holy');
    if (twilight && !e.dead) e.cursed = true;
  }
  fx.beams.push({ x: tgt.x, w: p.w, t: 0.25 });
  api.emit(g, { type: 'spell', key: 'judgment', x: tgt.x, w: p.w });
}

function updateDragon(g, dt, api, T, fx) {
  const p = SPELL_BY_KEY.babyDragon.lv[g.spells.babyDragon - 1];
  let d = fx.dragon;
  if (!d) d = fx.dragon = { x: WORLD_W / 2, y: 140, vx: 120, angle: 0, breathT: 0 };
  d.x += d.vx * dt;
  if (d.x < 90) { d.x = 90; d.vx = 120; } else if (d.x > WORLD_W - 90) { d.x = WORLD_W - 90; d.vx = -120; }
  d.angle = d.vx > 0 ? 0 : Math.PI;
  if (d.breathT > 0) {
    d.breathT -= dt;
    const dmg = pd(g) * p.mul * dt, guard = g.fusions.includes('guardianDragon');
    for (const e of g.enemies) {
      if (e.dead || Math.abs(e.x - d.x) > 70 || e.y < d.y) continue;
      sHit(g, api, e, dmg, 'fire', false);
    }
    if (guard) {
      g.wall.hp = Math.min(g.wall.max, g.wall.hp + g.wall.max * FUSION_FX.guardHeal * dt);
      if (fx.golem) fx.golem.hp = Math.min(fx.golem.maxHp, fx.golem.hp + fx.golem.maxHp * FUSION_FX.guardHeal * dt);
    }
    return;
  }
  T.dragon -= dt;
  if (T.dragon <= 0) {
    T.dragon = p.cd;
    d.breathT = p.breathT;
    api.emit(g, { type: 'spell', key: 'babyDragon', x: d.x, y: d.y });
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
    if (d < t.r + 10) { sHit(g, api, t, q.dmg, 'dark'); gh.splice(i, 1); continue; }
    if (q.life > 4) gh.splice(i, 1);
  }
}
