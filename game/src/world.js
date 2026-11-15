// Emberfall's rules and state, with no drawing and no browser in it: the lantern,
// the pool of falling meteors, embers and power-ups, spawning, collisions, combo,
// score, lives and level. step() advances one fixed step and returns what happened
// as bit flags, so the caller can react without the world knowing about screens or
// sound; step() also fills state.fx with the effects the step caused (bursts and
// explosions the particle system should play). Nothing here allocates after
// createWorld returns, except the small fx list the caller drains each step.
//
// Depth, beyond the first version: meteors come in variants (swift streaks from
// level 2, zigzag weavers from level 3, big slow splitters from level 4 that burst
// into two swift fragments mid-fall), a giant boss meteor falls on levels 3, 6
// and 9 while shedding embers, and two more power-ups join the fall — slow-mo
// and 2x score. The base rules never changed: catch an ember to score, a meteor
// costs a life, three lives, combo multiplier capped at x5.

import {
  BOSS, COMBO, EMBER, FIELD, LEVEL, LIVES, MAX_LIVES, METEOR, METEOR_TYPES, PLAYER, POOL_SIZE, POWER,
} from './config.js';

export const KIND_METEOR = 0;
export const KIND_EMBER = 1;
export const KIND_SHIELD = 2;
export const KIND_MAGNET = 3;
export const KIND_HEART = 4;
export const KIND_SLOW = 5;
export const KIND_DOUBLE = 6;
export const KIND_BOSS = 7;

/** Meteor variants: 0 plain, 1 swift (small, fast), 2 splitter (big, bursts in two), 3 zigzag. */
export const VARIANT_PLAIN = 0;
export const VARIANT_SWIFT = 1;
export const VARIANT_SPLITTER = 2;
export const VARIANT_ZIGZAG = 3;

export const EVENT_HIT = 1;
export const EVENT_EMBER = 2;
export const EVENT_OVER = 4;
export const EVENT_POWER = 8;
export const EVENT_LEVEL = 16;
export const EVENT_SHIELD_BREAK = 32;
export const EVENT_BOSS = 64;
export const EVENT_BOSS_DODGED = 128;
export const EVENT_SPLIT = 256;

function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function comboMultiplier(combo) {
  return Math.min(combo, COMBO.max);
}

export function createWorld(random) {
  const player = {
    x: 0, y: FIELD.groundY - PLAYER.height, width: PLAYER.width, height: PLAYER.height,
    invulnerable: 0, shield: false, magnet: 0, dashTime: 0, dashCooldown: 0, facing: 1,
  };
  const items = [];
  for (let index = 0; index < POOL_SIZE; index += 1) {
    items.push({
      active: false, kind: KIND_METEOR, variant: VARIANT_PLAIN,
      x: 0, y: 0, width: 0, height: 0, speed: 0, drift: 0, spin: 0, spinSpeed: 0,
      phase: 0, zigAmp: 0, zigFreq: 0, splitAt: 0, shedTimer: 0,
    });
  }
  // The night sky: fixed star positions from the seed, so a screenshot scene is identical every run.
  const stars = [];
  for (let index = 0; index < 90; index += 1) {
    stars.push({ x: random() * FIELD.width, y: random() * FIELD.groundY * 0.62, radius: 0.6 + random() * 1.6, phase: random() * Math.PI * 2 });
  }
  const fx = [];
  const state = {
    player, items, stars, fx,
    score: 0, lives: LIVES, level: 1, elapsed: 0, combo: 1, bestCombo: 1,
    embersCaught: 0, meteorsDodged: 0, meteorsHit: 0, bossesDodged: 0,
    meteorTimer: 0, emberTimer: 0, powerTimer: 0, moteTimer: 0,
    slowmo: 0, doubleScore: 0, bossActive: false, bossSpawnedAtLevel: 0,
    banner: { text: '', until: 0 },
  };

  function reset() {
    player.x = (FIELD.width - player.width) / 2;
    player.invulnerable = 0;
    player.shield = false;
    player.magnet = 0;
    player.dashTime = 0;
    player.dashCooldown = 0;
    player.facing = 1;
    for (const item of items) item.active = false;
    fx.length = 0;
    state.score = 0;
    state.lives = LIVES;
    state.level = 1;
    state.elapsed = 0;
    state.combo = 1;
    state.bestCombo = 1;
    state.embersCaught = 0;
    state.meteorsDodged = 0;
    state.meteorsHit = 0;
    state.bossesDodged = 0;
    state.meteorTimer = METEOR.interval;
    state.emberTimer = EMBER.interval;
    state.powerTimer = POWER.interval;
    state.moteTimer = 0;
    state.slowmo = 0;
    state.doubleScore = 0;
    state.bossActive = false;
    state.bossSpawnedAtLevel = 0;
    state.banner.text = '';
    state.banner.until = 0;
  }

  function freeItem() {
    for (let index = 0; index < items.length; index += 1) {
      if (!items[index].active) return items[index];
    }
    return null;
  }

  function meteorBaseSpeed() {
    return METEOR.speed + METEOR.speedPerLevel * (state.level - 1) + random() * METEOR.speedJitter;
  }

  function spawnMeteor() {
    const item = freeItem();
    if (item === null) return;
    const roll = random();
    let variant = VARIANT_PLAIN;
    if (state.level >= METEOR_TYPES.splitter.minLevel && roll < METEOR_TYPES.splitter.chance) variant = VARIANT_SPLITTER;
    else if (state.level >= METEOR_TYPES.zigzag.minLevel && roll < METEOR_TYPES.splitter.chance + METEOR_TYPES.zigzag.chance) variant = VARIANT_ZIGZAG;
    else if (state.level >= METEOR_TYPES.swift.minLevel && roll < METEOR_TYPES.splitter.chance + METEOR_TYPES.zigzag.chance + METEOR_TYPES.swift.chance) variant = VARIANT_SWIFT;
    const type = variant === VARIANT_SWIFT ? METEOR_TYPES.swift : variant === VARIANT_ZIGZAG ? METEOR_TYPES.zigzag : variant === VARIANT_SPLITTER ? METEOR_TYPES.splitter : null;
    const size = type === null
      ? METEOR.minSize + random() * (METEOR.maxSize - METEOR.minSize)
      : type.sizeMin + random() * (type.sizeMax - type.sizeMin);
    item.active = true;
    item.kind = KIND_METEOR;
    item.variant = variant;
    item.width = size;
    item.height = size;
    item.x = random() * (FIELD.width - item.width);
    item.y = -item.height;
    item.speed = meteorBaseSpeed() * (type === null ? 1 : type.speedMul);
    item.drift = variant === VARIANT_ZIGZAG ? 0 : (random() - 0.5) * (variant === VARIANT_SPLITTER ? 40 : 70);
    item.spin = random() * Math.PI * 2;
    item.spinSpeed = (random() - 0.5) * 4;
    item.phase = random() * Math.PI * 2;
    item.zigAmp = type !== null && variant === VARIANT_ZIGZAG
      ? METEOR_TYPES.zigzag.ampMin + random() * (METEOR_TYPES.zigzag.ampMax - METEOR_TYPES.zigzag.ampMin) : 0;
    item.zigFreq = type !== null && variant === VARIANT_ZIGZAG
      ? METEOR_TYPES.zigzag.freqMin + random() * (METEOR_TYPES.zigzag.freqMax - METEOR_TYPES.zigzag.freqMin) : 0;
    item.splitAt = variant === VARIANT_SPLITTER ? FIELD.height * (0.5 + random() * 0.25) : 0;
    item.shedTimer = 0;
  }

  /** A splitter bursts mid-fall into two small swift meteors. */
  function splitMeteor(item) {
    item.active = false;
    fx.push({ type: 'split', x: item.x + item.width / 2, y: item.y + item.height / 2, color: '#ff6b35' });
    for (let count = 0; count < 2; count += 1) {
      const fragment = freeItem();
      if (fragment === null) return;
      const size = METEOR_TYPES.swift.sizeMin + random() * (METEOR_TYPES.swift.sizeMax - METEOR_TYPES.swift.sizeMin);
      fragment.active = true;
      fragment.kind = KIND_METEOR;
      fragment.variant = VARIANT_SWIFT;
      fragment.width = size;
      fragment.height = size;
      fragment.x = Math.min(FIELD.width - size, Math.max(0, item.x + item.width / 2 - size / 2 + (count === 0 ? -26 : 26)));
      fragment.y = item.y + item.height / 2;
      fragment.speed = meteorBaseSpeed() * METEOR_TYPES.swift.speedMul * 0.85;
      fragment.drift = count === 0 ? -140 : 140;
      fragment.spin = random() * Math.PI * 2;
      fragment.spinSpeed = (random() - 0.5) * 6;
      fragment.phase = 0;
      fragment.zigAmp = 0;
      fragment.zigFreq = 0;
      fragment.splitAt = 0;
      fragment.shedTimer = 0;
    }
  }

  function spawnEmber(x = null) {
    const item = freeItem();
    if (item === null) return;
    item.active = true;
    item.kind = KIND_EMBER;
    item.variant = VARIANT_PLAIN;
    item.width = EMBER.size;
    item.height = EMBER.size;
    item.x = x === null ? random() * (FIELD.width - item.width) : Math.min(FIELD.width - item.width, Math.max(0, x));
    item.y = -item.height;
    item.speed = EMBER.speed + EMBER.speedPerLevel * (state.level - 1);
    item.drift = (random() - 0.5) * 24;
    item.spin = 0;
    item.spinSpeed = 0;
    item.phase = 0;
    item.zigAmp = 0;
    item.zigFreq = 0;
    item.splitAt = 0;
    item.shedTimer = 0;
  }

  function spawnPower() {
    const item = freeItem();
    if (item === null) return;
    const roll = random();
    const kind = roll < 0.30 ? KIND_SHIELD : roll < 0.55 ? KIND_MAGNET : roll < 0.75 ? KIND_HEART : roll < 0.88 ? KIND_SLOW : KIND_DOUBLE;
    item.active = true;
    item.kind = kind;
    item.variant = VARIANT_PLAIN;
    item.width = POWER.size;
    item.height = POWER.size;
    item.x = random() * (FIELD.width - item.width);
    item.y = -item.height;
    item.speed = POWER.speed;
    item.drift = 0;
    item.spin = 0;
    item.spinSpeed = 0;
    item.phase = 0;
    item.zigAmp = 0;
    item.zigFreq = 0;
    item.splitAt = 0;
    item.shedTimer = 0;
  }

  function spawnBoss() {
    const item = freeItem();
    if (item === null) return false;
    item.active = true;
    item.kind = KIND_BOSS;
    item.variant = VARIANT_PLAIN;
    item.width = BOSS.size;
    item.height = BOSS.size;
    item.x = Math.min(FIELD.width - item.width, Math.max(0, FIELD.width / 2 - item.width / 2 + (random() - 0.5) * 400));
    item.y = -item.height;
    item.speed = BOSS.speed;
    item.drift = 0;
    item.spin = 0;
    item.spinSpeed = 0;
    item.phase = random() * Math.PI * 2;
    item.zigAmp = 0;
    item.zigFreq = 0;
    item.splitAt = 0;
    item.shedTimer = 0.5;
    state.bossActive = true;
    state.bossSpawnedAtLevel = state.level;
    state.banner.text = 'METEOR RAKSASA!';
    state.banner.until = state.elapsed + 2.5;
    return true;
  }

  function meteorInterval() {
    return Math.max(METEOR.minInterval, METEOR.interval * METEOR.intervalScale ** (state.level - 1));
  }

  /**
   * One fixed step. `direction` is -1, 0 or 1 from the keys; `targetX` is the mouse
   * position in field coordinates (or null). With `harmless` set (the title screen's
   * backdrop) things fall but nothing touches the player and nothing scores.
   */
  function step(dt, direction, harmless, dashRequested, targetX) {
    let events = 0;
    fx.length = 0;
    state.elapsed += dt;
    const level = Math.min(LEVEL.max, 1 + Math.floor(state.elapsed / LEVEL.seconds));
    if (level !== state.level) {
      state.level = level;
      state.score += LEVEL.bonusPerLevel * level;
      events |= EVENT_LEVEL;
      if (BOSS.levels.includes(level) && state.bossSpawnedAtLevel !== level && spawnBoss()) {
        events |= EVENT_BOSS;
      }
    }

    if (dashRequested && player.dashCooldown <= 0 && player.dashTime <= 0) {
      player.dashTime = PLAYER.dashTime;
      player.dashCooldown = PLAYER.dashCooldown;
      player.invulnerable = Math.max(player.invulnerable, PLAYER.dashTime + 0.05);
    }
    if (player.dashTime > 0) player.dashTime = Math.max(0, player.dashTime - dt);
    if (player.dashCooldown > 0) player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);
    if (player.magnet > 0) player.magnet = Math.max(0, player.magnet - dt);
    if (state.slowmo > 0) state.slowmo = Math.max(0, state.slowmo - dt);
    if (state.doubleScore > 0) state.doubleScore = Math.max(0, state.doubleScore - dt);

    // Slow-mo stretches the fall, never the player: the lantern still moves at full speed.
    const fallDt = state.slowmo > 0 ? dt * POWER.slowFactor : dt;

    const dashing = player.dashTime > 0;
    const speed = dashing ? PLAYER.dashSpeed : PLAYER.speed;
    if (direction !== 0) {
      player.facing = direction;
      player.x = Math.min(FIELD.width - player.width, Math.max(0, player.x + direction * speed * dt));
    } else if (targetX !== null && targetX !== undefined) {
      const centre = player.x + player.width / 2;
      const distance = targetX - centre;
      if (Math.abs(distance) > 4) {
        player.facing = distance > 0 ? 1 : -1;
        const move = Math.sign(distance) * Math.min(Math.abs(distance), speed * dt);
        player.x = Math.min(FIELD.width - player.width, Math.max(0, player.x + move));
      }
    }

    // No fresh meteors while the boss is falling: the giant rock is the whole storm.
    if (!state.bossActive) {
      state.meteorTimer -= dt;
      if (state.meteorTimer <= 0) {
        spawnMeteor();
        state.meteorTimer += meteorInterval();
      }
    }
    state.emberTimer -= dt;
    if (state.emberTimer <= 0) {
      spawnEmber();
      state.emberTimer += EMBER.interval + random() * EMBER.intervalJitter;
    }
    state.powerTimer -= dt;
    if (state.powerTimer <= 0) {
      spawnPower();
      state.powerTimer += POWER.interval + random() * POWER.intervalJitter;
    }
    state.moteTimer -= dt;
    if (state.moteTimer <= 0) {
      fx.push({ type: 'mote', x: player.x + player.width / 2, y: player.y + 8 });
      state.moteTimer += 0.12;
    }

    const playerCentreX = player.x + player.width / 2;
    const scoreMul = state.doubleScore > 0 ? 2 : 1;
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      if (!item.active) continue;
      item.y += item.speed * fallDt;
      item.x += item.drift * fallDt;
      item.spin += item.spinSpeed * fallDt;
      if (item.kind === KIND_METEOR && item.variant === VARIANT_ZIGZAG) {
        item.x += Math.sin(state.elapsed * item.zigFreq + item.phase) * item.zigAmp * fallDt;
      }
      if (item.kind === KIND_BOSS) {
        item.x += Math.cos(state.elapsed * BOSS.swayFreq + item.phase) * BOSS.swayAmp * fallDt;
        item.shedTimer -= fallDt;
        if (item.shedTimer <= 0) {
          spawnEmber(item.x + item.width / 2 + (random() - 0.5) * 120 - EMBER.size / 2);
          item.shedTimer += BOSS.shedInterval;
        }
      }
      if (item.x < 0) { item.x = 0; item.drift = Math.abs(item.drift); }
      if (item.x + item.width > FIELD.width) { item.x = FIELD.width - item.width; item.drift = -Math.abs(item.drift); }
      if (item.kind === KIND_EMBER && player.magnet > 0) {
        const itemCentreX = item.x + item.width / 2;
        const pull = playerCentreX - itemCentreX;
        if (Math.abs(pull) < 300) item.x += Math.sign(pull) * Math.min(Math.abs(pull), 340 * dt);
      }
      if (item.kind === KIND_METEOR && item.variant === VARIANT_SPLITTER && item.y + item.height / 2 >= item.splitAt) {
        splitMeteor(item);
        events |= EVENT_SPLIT;
        continue;
      }
      if (item.y > FIELD.groundY) {
        item.active = false;
        if (item.kind === KIND_BOSS) {
          state.bossActive = false;
          if (!harmless) {
            state.score += BOSS.bonus;
            state.bossesDodged += 1;
            state.meteorsDodged += 1;
            fx.push({ type: 'bossBoom', x: item.x + item.width / 2, y: FIELD.groundY });
            events |= EVENT_BOSS_DODGED;
          }
        } else if (!harmless && item.kind === KIND_METEOR) {
          state.score += METEOR.dodgePoints * scoreMul;
          state.meteorsDodged += 1;
          fx.push({ type: 'ground', x: item.x + item.width / 2, y: FIELD.groundY });
        } else if (!harmless && item.kind === KIND_EMBER) {
          state.combo = 1;
        }
        continue;
      }
      if (harmless || !overlaps(item, player)) continue;
      if (item.kind === KIND_EMBER) {
        item.active = false;
        state.combo += 1;
        state.bestCombo = Math.max(state.bestCombo, state.combo);
        state.score += EMBER.points * comboMultiplier(state.combo) * scoreMul;
        state.embersCaught += 1;
        fx.push({ type: 'burst', x: item.x + item.width / 2, y: item.y + item.height / 2, color: '#f2c94c' });
        events |= EVENT_EMBER;
      } else if (item.kind === KIND_SHIELD) {
        item.active = false;
        player.shield = true;
        fx.push({ type: 'burst', x: item.x + item.width / 2, y: item.y + item.height / 2, color: '#4fd8f7' });
        events |= EVENT_POWER;
      } else if (item.kind === KIND_MAGNET) {
        item.active = false;
        player.magnet = POWER.magnetSeconds;
        fx.push({ type: 'burst', x: item.x + item.width / 2, y: item.y + item.height / 2, color: '#b678f2' });
        events |= EVENT_POWER;
      } else if (item.kind === KIND_HEART) {
        item.active = false;
        if (state.lives < MAX_LIVES) state.lives += 1;
        else state.score += 50;
        fx.push({ type: 'burst', x: item.x + item.width / 2, y: item.y + item.height / 2, color: '#ff6b9d' });
        events |= EVENT_POWER;
      } else if (item.kind === KIND_SLOW) {
        item.active = false;
        state.slowmo = POWER.slowSeconds;
        fx.push({ type: 'burst', x: item.x + item.width / 2, y: item.y + item.height / 2, color: '#7dd3fc' });
        events |= EVENT_POWER;
      } else if (item.kind === KIND_DOUBLE) {
        item.active = false;
        state.doubleScore = POWER.doubleSeconds;
        fx.push({ type: 'burst', x: item.x + item.width / 2, y: item.y + item.height / 2, color: '#a3e635' });
        events |= EVENT_POWER;
      } else if (player.shield) {
        item.active = false;
        player.shield = false;
        player.invulnerable = Math.max(player.invulnerable, 0.8);
        if (item.kind === KIND_BOSS) state.bossActive = false;
        fx.push({ type: 'explosion', x: item.x + item.width / 2, y: item.y + item.height / 2, color: '#4fd8f7' });
        events |= EVENT_SHIELD_BREAK;
      } else if (player.invulnerable === 0) {
        item.active = false;
        state.lives -= 1;
        state.meteorsHit += 1;
        state.combo = 1;
        player.invulnerable = PLAYER.invulnerable;
        if (item.kind === KIND_BOSS) state.bossActive = false;
        fx.push({ type: 'explosion', x: item.x + item.width / 2, y: item.y + item.height / 2, color: '#e5534b' });
        events |= EVENT_HIT;
        if (state.lives === 0) {
          events |= EVENT_OVER;
          break;
        }
      }
    }
    return events;
  }

  reset();
  return { state, reset, step };
}
