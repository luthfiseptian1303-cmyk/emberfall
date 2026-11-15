// The screenshot scenes behind ?shot=start|play|end. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot (look ahead each way the lantern could move, keep clear of meteors,
// chase the lowest ember when that is safe), so the frame is what a short game
// really looks like and the same seed always gives the same frame.

import { BOSS, FIELD, PLAYER, STEP } from './config.js';
import { EVENT_OVER, KIND_BOSS, KIND_METEOR, VARIANT_ZIGZAG } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const END_LIMIT_SECONDS = 600;
/**
 * How far ahead, in seconds, the autopilot checks each way it could move: the play scene's pilot
 * looks well ahead and keeps all its lives; the end scene's looks only a moment ahead, so it is
 * caught out once the meteors speed up, as a hurried player is.
 */
const HORIZON_PLAY = 0.7;
const HORIZON_END = 0.25;
const SAMPLE = 1 / 30;
const DIRECTIONS = [0, -1, 1];
/** Extra room, each side, it keeps between the lantern and a meteor. */
const MARGIN = 12;

/** Where an item's left edge will be in `t` seconds: drift, plus the zigzag weave or the boss sway. */
function itemXAt(item, state, t) {
  let x = item.x + item.drift * t;
  if (item.kind === KIND_BOSS) {
    x += (BOSS.swayAmp / BOSS.swayFreq) * (Math.sin((state.elapsed + t) * BOSS.swayFreq + item.phase) - Math.sin(state.elapsed * BOSS.swayFreq + item.phase));
  } else if (item.variant === VARIANT_ZIGZAG) {
    x += (item.zigAmp / item.zigFreq) * (Math.cos(state.elapsed * item.zigFreq + item.phase) - Math.cos((state.elapsed + t) * item.zigFreq + item.phase));
  }
  return x;
}

/** Seconds until moving in `direction` (-1, 0, 1) runs the lantern into a meteor or the boss; Infinity when it never does. */
function timeToHit(state, direction, horizon) {
  const player = state.player;
  for (let t = SAMPLE; t <= horizon; t += SAMPLE) {
    const x = Math.min(FIELD.width - player.width, Math.max(0, player.x + direction * PLAYER.speed * t));
    for (let index = 0; index < state.items.length; index += 1) {
      const item = state.items[index];
      if (!item.active || (item.kind !== KIND_METEOR && item.kind !== KIND_BOSS)) continue;
      const y = item.y + item.speed * t;
      const itemX = itemXAt(item, state, t);
      if (y + item.height > player.y && y < player.y + player.height && itemX < x + player.width + MARGIN && itemX + item.width > x - MARGIN) return t;
    }
  }
  return Infinity;
}

/** Of the safe ways to move, the one toward the lowest ember (or the centre); else the one that is hit last. */
function autopilot(state, horizon) {
  const player = state.player;
  let ember = null;
  for (let index = 0; index < state.items.length; index += 1) {
    const item = state.items[index];
    if (item.active && item.kind !== KIND_METEOR && item.kind !== KIND_BOSS && (ember === null || item.y > ember.y)) ember = item;
  }
  const target = ember === null ? FIELD.width / 2 : ember.x + ember.width / 2;
  const centre = player.x + player.width / 2;
  const wanted = target > centre + 8 ? 1 : target < centre - 8 ? -1 : 0;
  let best = wanted;
  let bestTime = timeToHit(state, wanted, horizon);
  for (let index = 0; index < DIRECTIONS.length && bestTime !== Infinity; index += 1) {
    const time = timeToHit(state, DIRECTIONS[index], horizon);
    if (time > bestTime) {
      bestTime = time;
      best = DIRECTIONS[index];
    }
  }
  return best;
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start) and return the
 * screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) world.step(STEP, 0, true, false, null);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  const horizon = name === 'end' ? HORIZON_END : HORIZON_PLAY;
  for (let index = 0; index < limit / STEP; index += 1) {
    if (world.step(STEP, autopilot(world.state, horizon), false, false, null) & EVENT_OVER) break;
  }
  const over = world.state.lives === 0;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}
