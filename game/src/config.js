// Emberfall — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size. Night sky, warm lantern
// light against cold meteors: gold embers, red-orange meteors, cyan shield,
// violet magnet, pink heart.

export const FIELD = { width: 1280, height: 720, groundY: 664 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  width: 64,
  height: 78,
  speed: 620,
  dashSpeed: 1450,
  dashTime: 0.22,
  dashCooldown: 2.2,
  invulnerable: 1.6,
};

export const LIVES = 3;
export const MAX_LIVES = 3;

/** A meteor: a jagged rock with a fire trail. Touching one costs a life (or the shield). */
export const METEOR = {
  minSize: 34,
  maxSize: 72,
  speed: 250,
  speedPerLevel: 34,
  speedJitter: 100,
  interval: 0.62,
  intervalScale: 0.86,
  minInterval: 0.16,
  dodgePoints: 2,
};

/**
 * Meteor variants, unlocked as the level climbs. A spawn rolls splitter first,
 * then zigzag, then swift; anything else is a plain meteor. `chance` is the
 * share of spawns at that roll, so the mix grows richer with the level.
 */
export const METEOR_TYPES = {
  swift: { sizeMin: 22, sizeMax: 30, speedMul: 1.7, minLevel: 2, chance: 0.18 },
  zigzag: { sizeMin: 34, sizeMax: 56, speedMul: 1.0, minLevel: 3, chance: 0.16, ampMin: 120, ampMax: 180, freqMin: 1.8, freqMax: 2.6 },
  splitter: { sizeMin: 88, sizeMax: 104, speedMul: 0.55, minLevel: 4, chance: 0.14 },
};

/**
 * The boss: a giant meteor that falls slowly, swaying side to side and shedding
 * embers as it comes down. It appears when the level first reaches 3, 6 and 9.
 * Surviving it (it thuds into the ground) pays a big bonus; touching it costs
 * a life like any meteor. No normal meteors spawn while it is falling.
 */
export const BOSS = {
  size: 220,
  speed: 85,
  bonus: 150,
  swayAmp: 150,
  swayFreq: 0.9,
  shedInterval: 0.9,
  levels: [3, 6, 9],
};

/** An ember: a glowing gold mote. Catching one scores 10 times the combo multiplier. */
export const EMBER = {
  size: 26,
  speed: 200,
  speedPerLevel: 12,
  interval: 1.1,
  intervalJitter: 0.7,
  points: 10,
};

/** Power-ups: shield (absorbs one hit), magnet (pulls embers for 6 s), heart (+1 life),
 *  slow-mo (the fall runs at slowFactor speed for slowSeconds), 2x score (double points). */
export const POWER = {
  size: 30,
  speed: 170,
  magnetSeconds: 6,
  slowSeconds: 5,
  slowFactor: 0.45,
  doubleSeconds: 8,
  interval: 9,
  intervalJitter: 5,
};

/** Seconds of play per level, and the last level: speeds and spawn rates stop growing there. */
export const LEVEL = { seconds: 15, max: 10, bonusPerLevel: 25 };

/** Combo: each ember caught in a row raises the multiplier by one, up to this cap. */
export const COMBO = { max: 5 };

/** How many falling things can exist at once; the pool is allocated once, at boot.
 *  96 leaves room for a boss, its shed embers and splitter fragments at once. */
export const POOL_SIZE = 96;

/** How many particles can exist at once; the pool is allocated once, at boot. */
export const PARTICLE_POOL = 240;

export const PALETTE = {
  backdrop: '#070a18',
  skyTop: '#0b1030',
  skyBottom: '#1c1440',
  moon: '#f4ead0',
  hillFar: '#141a38',
  hillNear: '#0e1229',
  ground: '#221a33',
  groundTop: '#3a2c55',
  lanternGlow: '#ffc95e',
  lanternBody: '#d99a2b',
  lanternFrame: '#5e3d12',
  flame: '#ffd97a',
  flameCore: '#fff3c4',
  meteor: '#e5534b',
  meteorCore: '#ff8a3c',
  meteorTrail: '#ff6b35',
  swift: '#ff8c42',
  swiftCore: '#ffd23f',
  zigzag: '#9b5de5',
  zigzagCore: '#d0a2f7',
  splitter: '#c0392b',
  splitterCore: '#ff6b35',
  bossCrack: '#ff9f1c',
  ember: '#f2c94c',
  emberCore: '#fff0a8',
  shield: '#4fd8f7',
  magnet: '#b678f2',
  heart: '#ff6b9d',
  slow: '#7dd3fc',
  double: '#a3e635',
  panel: '#191d33',
  panelEdge: '#3a4170',
  text: '#f2ead8',
  muted: '#9aa3c2',
  danger: '#ff5d5d',
};

/**
 * One sky per level, so climbing feels like the night itself changing: deep blue,
 * teal dusk, violet, ember dusk, burnt orange, blood red, aurora green, magenta,
 * crimson storm, and a near-black void with gold ground. Level 1 matches the
 * original palette exactly. The renderer picks SKIES[level - 1].
 */
export const SKIES = [
  { skyTop: '#0b1030', skyBottom: '#1c1440', hillFar: '#141a38', hillNear: '#0e1229', ground: '#221a33', groundTop: '#3a2c55', backdrop: '#070a18' },
  { skyTop: '#062a33', skyBottom: '#123f4d', hillFar: '#0d2430', hillNear: '#0a1a26', ground: '#14282e', groundTop: '#274b52', backdrop: '#04141a' },
  { skyTop: '#1a0b33', skyBottom: '#2e1450', hillFar: '#1d1238', hillNear: '#150d2b', ground: '#241536', groundTop: '#3d2658', backdrop: '#0d0618' },
  { skyTop: '#2b0e1e', skyBottom: '#4d1a2e', hillFar: '#331527', hillNear: '#24101f', ground: '#331a24', groundTop: '#5a2c40', backdrop: '#160810' },
  { skyTop: '#33130a', skyBottom: '#572412', hillFar: '#3a1a10', hillNear: '#2a130c', ground: '#3a1f14', groundTop: '#63371f', backdrop: '#180a05' },
  { skyTop: '#2e0810', skyBottom: '#4d1020', hillFar: '#330e18', hillNear: '#260a12', ground: '#331220', groundTop: '#5c1f30', backdrop: '#150409' },
  { skyTop: '#06231c', skyBottom: '#0e3d2e', hillFar: '#0c2a20', hillNear: '#081f18', ground: '#122e24', groundTop: '#1f4d38', backdrop: '#03120c' },
  { skyTop: '#26082e', skyBottom: '#3f1046', hillFar: '#2c0e33', hillNear: '#200a26', ground: '#2e1230', groundTop: '#4d1e52', backdrop: '#120410' },
  { skyTop: '#2b0a12', skyBottom: '#47101e', hillFar: '#320f1a', hillNear: '#240a12', ground: '#301420', groundTop: '#521e2e', backdrop: '#14050a' },
  { skyTop: '#05060f', skyBottom: '#141021', hillFar: '#0e0d1f', hillNear: '#090812', ground: '#171226', groundTop: '#2c2145', backdrop: '#02030a' },
];

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'emberfall.best';
