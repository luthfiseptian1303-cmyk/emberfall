// Emberfall — boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), particles and
// sound answer every event, and the renderer paints what is there. The game moves
// between four screens: title, play, paused and game over.
//
// ?seed=N fixes the falling pattern. ?shot=start|play|end (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, BOSS, FIELD, LIVES, PARTICLE_POOL, STEP } from './config.js';
import { createSeededRandom } from './random.js';
import { createWorld, EVENT_BOSS, EVENT_BOSS_DODGED, EVENT_EMBER, EVENT_HIT, EVENT_LEVEL, EVENT_OVER, EVENT_POWER, EVENT_SHIELD_BREAK, EVENT_SPLIT } from './world.js';
import { ACTION_CONFIRM, ACTION_DASH, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createSoundBank } from './audio.js';
import { createParticles } from './particles.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const random = createSeededRandom(seed);
const world = createWorld(random);
const particles = createParticles(random, PARTICLE_POOL);
const sounds = createSoundBank();
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

/** Turn a pointer's client x into a playfield x, using the same letterbox math as the renderer. */
function pointerToFieldX(clientX) {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / FIELD.width, rect.height / FIELD.height);
  const offsetX = (rect.width - FIELD.width * scale) / 2;
  return (clientX - rect.left - offsetX) / scale;
}

/** Play the effects this step caused, then clear them. */
function drainEffects() {
  const effects = world.state.fx;
  for (let index = 0; index < effects.length; index += 1) {
    const effect = effects[index];
    if (effect.type === 'burst') particles.burst(effect.x, effect.y, effect.color, 14, 200);
    else if (effect.type === 'explosion') particles.explosion(effect.x, effect.y, effect.color);
    else if (effect.type === 'split') particles.burst(effect.x, effect.y, effect.color, 18, 260);
    else if (effect.type === 'bossBoom') {
      particles.explosion(effect.x, effect.y, '#ff6b35');
      particles.burst(effect.x, effect.y, '#ffd97a', 26, 320);
    } else if (effect.type === 'ground') particles.burst(effect.x, effect.y, '#ff6b35', 8, 130);
    else if (effect.type === 'mote') particles.mote(effect.x, effect.y);
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  drainEffects();
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, particles);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let dashRequested = false;

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    dashRequested = false;
    screen = SCREEN_PLAY;
    sounds.resume();
    sounds.click();
    announce(`Playing. ${LIVES} lives. Catch embers, dodge meteors.`);
  }

  function endGame() {
    screen = SCREEN_OVER;
    sounds.gameOver();
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      sounds.setMuted(!sounds.isMuted());
      announce(sounds.isMuted() ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_DASH) dashRequested = true;
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      sounds.resume();
      announce('Playing.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, 0, true, false, null);
      drainEffects();
      return;
    }
    const pointerX = input.pointerX();
    const targetX = pointerX === null ? null : pointerToFieldX(pointerX);
    const events = world.step(STEP, input.direction(), false, dashRequested, targetX);
    dashRequested = false;
    drainEffects();
    if (events & EVENT_EMBER) sounds.pickup(world.state.combo);
    if (events & EVENT_POWER) sounds.power();
    if (events & EVENT_SPLIT) sounds.split();
    if (events & EVENT_BOSS) {
      sounds.boss();
      announce('Boss meteor incoming. Survive it for a big bonus.');
    }
    if (events & EVENT_BOSS_DODGED) {
      sounds.bossDodge();
      announce(`Boss dodged. +${BOSS.bonus} points.`);
    }
    if (events & EVENT_LEVEL) {
      sounds.levelUp();
      announce(`Level ${world.state.level}. Faster meteors.`);
    }
    if (events & EVENT_SHIELD_BREAK) sounds.shieldBreak();
    if (events & EVENT_HIT) {
      sounds.hit();
      announce(world.state.lives === 1 ? 'Hit. 1 life left.' : `Hit. ${world.state.lives} lives left.`);
    }
    if (events & EVENT_OVER) endGame();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const frameDt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      accumulator += frameDt;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    particles.update(frameDt);
    renderer.draw(world.state, screen, best, particles);
  }

  // Leaving the tab pauses a running game rather than letting meteors fall unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Emberfall. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
