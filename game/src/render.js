// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the
// backdrop colour. A night sky with twinkling stars and a moon, two hill ridges, a
// warm glowing lantern, jagged meteors with fire cores, pulsing embers, and canvas
// text for the HUD and the panels. All motion comes from state.elapsed, never the
// wall clock, so a staged screenshot scene is identical every run.

import { BOSS, COMBO, FIELD, FONT, LIVES, PALETTE, PLAYER, SKIES } from './config.js';
import { KIND_BOSS, KIND_DOUBLE, KIND_EMBER, KIND_HEART, KIND_MAGNET, KIND_METEOR, KIND_SHIELD, KIND_SLOW, VARIANT_SPLITTER, VARIANT_SWIFT, VARIANT_ZIGZAG } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

/** The panel's width; its height grows with its lines: room for the title, the lines and the prompt. */
const PANEL = { width: 660, top: 150, line: 32, bottom: 76 };

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

function drawHeart(context, x, y, size, color) {
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(x, y + size * 0.35);
  context.bezierCurveTo(x - size, y - size * 0.55, x - size * 0.35, y - size * 1.05, x, y - size * 0.35);
  context.bezierCurveTo(x + size * 0.35, y - size * 1.05, x + size, y - size * 0.55, x, y + size * 0.35);
  context.closePath();
  context.fill();
}

function drawMeteorRock(context, item) {
  const cx = item.x + item.width / 2;
  const cy = item.y + item.height / 2;
  const radius = item.width / 2;
  const body = item.variant === VARIANT_SWIFT ? PALETTE.swift : item.variant === VARIANT_ZIGZAG ? PALETTE.zigzag : item.variant === VARIANT_SPLITTER ? PALETTE.splitter : PALETTE.meteor;
  const core = item.variant === VARIANT_SWIFT ? PALETTE.swiftCore : item.variant === VARIANT_ZIGZAG ? PALETTE.zigzagCore : item.variant === VARIANT_SPLITTER ? PALETTE.splitterCore : PALETTE.meteorCore;
  context.save();
  context.translate(cx, cy);
  context.rotate(item.spin);
  context.fillStyle = body;
  context.beginPath();
  const points = 7;
  for (let index = 0; index < points; index += 1) {
    const angle = (index / points) * Math.PI * 2;
    const r = radius * (0.72 + ((index * 37) % 10) / 28);
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r;
    if (index === 0) context.moveTo(px, py);
    else context.lineTo(px, py);
  }
  context.closePath();
  context.fill();
  context.fillStyle = core;
  context.beginPath();
  context.arc(0, 0, radius * 0.34, 0, Math.PI * 2);
  context.fill();
  // Splitters show their fault lines: the cracks they burst along.
  if (item.variant === VARIANT_SPLITTER) {
    context.strokeStyle = 'rgba(255, 220, 160, 0.85)';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(-radius * 0.5, -radius * 0.2);
    context.lineTo(0, 0);
    context.lineTo(radius * 0.45, -radius * 0.35);
    context.moveTo(0, 0);
    context.lineTo(-radius * 0.1, radius * 0.55);
    context.stroke();
  }
  context.restore();
}

/** The boss: a huge rock with glowing cracks and a pulsing halo, impossible to miss. */
function drawBoss(context, item, elapsed) {
  const cx = item.x + item.width / 2;
  const cy = item.y + item.height / 2;
  const radius = item.width / 2;
  const pulse = 0.5 + 0.3 * Math.sin(elapsed * 4);
  const glow = context.createRadialGradient(cx, cy, 10, cx, cy, radius * 1.6);
  glow.addColorStop(0, `rgba(255, 107, 53, ${pulse})`);
  glow.addColorStop(1, 'rgba(255, 107, 53, 0)');
  context.fillStyle = glow;
  context.beginPath();
  context.arc(cx, cy, radius * 1.6, 0, Math.PI * 2);
  context.fill();
  context.save();
  context.translate(cx, cy);
  context.fillStyle = PALETTE.splitter;
  context.beginPath();
  const points = 9;
  for (let index = 0; index < points; index += 1) {
    const angle = (index / points) * Math.PI * 2;
    const r = radius * (0.78 + ((index * 53) % 10) / 30);
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r;
    if (index === 0) context.moveTo(px, py);
    else context.lineTo(px, py);
  }
  context.closePath();
  context.fill();
  context.strokeStyle = PALETTE.bossCrack;
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(-radius * 0.6, -radius * 0.3);
  context.lineTo(-radius * 0.1, 0);
  context.lineTo(radius * 0.5, -radius * 0.45);
  context.moveTo(-radius * 0.1, 0);
  context.lineTo(radius * 0.2, radius * 0.5);
  context.moveTo(-radius * 0.1, 0);
  context.lineTo(-radius * 0.5, radius * 0.4);
  context.stroke();
  context.fillStyle = PALETTE.meteorCore;
  context.beginPath();
  context.arc(0, 0, radius * 0.2, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('Score ');
  const levelLabel = cachedLabel('Level ');
  const bestLabel = cachedLabel('Best ');
  const finalLabel = cachedLabel('Score ');
  const comboLabel = cachedLabel('Combo x');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function drawSky(state) {
    // The night changes with the level: each level has its own sky.
    const sky = SKIES[Math.min(state.level, SKIES.length) - 1];
    const gradient = context.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, sky.skyTop);
    gradient.addColorStop(1, sky.skyBottom);
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    for (let index = 0; index < state.stars.length; index += 1) {
      const star = state.stars[index];
      const twinkle = 0.45 + 0.55 * Math.abs(Math.sin(state.elapsed * 1.6 + star.phase));
      context.globalAlpha = twinkle;
      context.fillStyle = '#e8ecff';
      context.beginPath();
      context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    context.fillStyle = PALETTE.moon;
    context.beginPath();
    context.arc(1090, 108, 46, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = sky.skyBottom;
    context.beginPath();
    context.arc(1072, 96, 40, 0, Math.PI * 2);
    context.fill();
    // Distant hill ridges.
    context.fillStyle = sky.hillFar;
    context.beginPath();
    context.moveTo(0, FIELD.groundY);
    context.quadraticCurveTo(320, 520, 640, FIELD.groundY - 40);
    context.quadraticCurveTo(960, 560, 1280, FIELD.groundY - 70);
    context.lineTo(1280, FIELD.groundY);
    context.closePath();
    context.fill();
    context.fillStyle = sky.hillNear;
    context.beginPath();
    context.moveTo(0, FIELD.groundY);
    context.quadraticCurveTo(420, 600, 820, FIELD.groundY - 18);
    context.quadraticCurveTo(1080, 620, 1280, FIELD.groundY - 30);
    context.lineTo(1280, FIELD.groundY);
    context.closePath();
    context.fill();
    context.fillStyle = sky.ground;
    context.fillRect(0, FIELD.groundY, FIELD.width, FIELD.height - FIELD.groundY);
    context.fillStyle = sky.groundTop;
    context.fillRect(0, FIELD.groundY, FIELD.width, 6);
  }

  function drawEmber(context, item, elapsed) {
    const cx = item.x + item.width / 2;
    const cy = item.y + item.height / 2;
    const pulse = 1 + 0.18 * Math.sin(elapsed * 6 + item.x);
    const radius = (item.width / 2) * pulse;
    const glow = context.createRadialGradient(cx, cy, 1, cx, cy, radius * 2.6);
    glow.addColorStop(0, 'rgba(255, 201, 94, 0.55)');
    glow.addColorStop(1, 'rgba(255, 201, 94, 0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(cx, cy, radius * 2.6, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.ember;
    context.beginPath();
    context.arc(cx, cy, radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.emberCore;
    context.beginPath();
    context.arc(cx - radius * 0.25, cy - radius * 0.25, radius * 0.45, 0, Math.PI * 2);
    context.fill();
  }

  function drawPowerUp(context, item) {
    const cx = item.x + item.width / 2;
    const cy = item.y + item.height / 2;
    const radius = item.width / 2;
    if (item.kind === KIND_SHIELD) {
      context.fillStyle = PALETTE.shield;
      context.beginPath();
      context.arc(cx, cy, radius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#eafcff';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(cx, cy, radius * 0.55, Math.PI * 0.15, Math.PI * 0.85, true);
      context.stroke();
      context.beginPath();
      context.moveTo(cx, cy - radius * 0.55);
      context.lineTo(cx, cy + radius * 0.55);
      context.stroke();
    } else if (item.kind === KIND_MAGNET) {
      context.fillStyle = PALETTE.magnet;
      context.beginPath();
      context.arc(cx, cy, radius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#f3e8ff';
      context.lineWidth = 4;
      context.beginPath();
      context.arc(cx, cy, radius * 0.5, Math.PI, Math.PI * 2);
      context.stroke();
      context.beginPath();
      context.moveTo(cx - radius * 0.5, cy);
      context.lineTo(cx - radius * 0.5, cy + radius * 0.45);
      context.moveTo(cx + radius * 0.5, cy);
      context.lineTo(cx + radius * 0.5, cy + radius * 0.45);
      context.stroke();
    } else if (item.kind === KIND_HEART) {
      drawHeart(context, cx, cy + 2, radius * 0.85, PALETTE.heart);
    } else if (item.kind === KIND_SLOW) {
      context.fillStyle = PALETTE.slow;
      context.beginPath();
      context.arc(cx, cy, radius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#0b2a3a';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(cx, cy, radius * 0.55, 0, Math.PI * 2);
      context.stroke();
      context.beginPath();
      context.moveTo(cx, cy);
      context.lineTo(cx, cy - radius * 0.35);
      context.moveTo(cx, cy);
      context.lineTo(cx + radius * 0.3, cy + radius * 0.15);
      context.stroke();
    } else if (item.kind === KIND_DOUBLE) {
      context.fillStyle = PALETTE.double;
      context.beginPath();
      context.arc(cx, cy, radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#1d2b08';
      context.font = `bold 20px ${FONT}`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText('×2', cx, cy + 1);
    }
  }

  function drawField(state) {
    drawSky(state);
    for (let index = 0; index < state.items.length; index += 1) {
      const item = state.items[index];
      if (!item.active) continue;
      if (item.kind === KIND_BOSS) drawBoss(context, item, state.elapsed);
      else if (item.kind === KIND_METEOR) drawMeteorRock(context, item);
      else if (item.kind === KIND_EMBER) drawEmber(context, item, state.elapsed);
      else drawPowerUp(context, item);
    }
    drawLantern(state);
  }

  function drawLantern(state) {
    const player = state.player;
    if (player.invulnerable > 0 && Math.floor(player.invulnerable * 10) % 2 === 0) return;
    const cx = player.x + player.width / 2;
    const top = player.y;
    const flicker = 1 + 0.12 * Math.sin(state.elapsed * 13) + 0.06 * Math.sin(state.elapsed * 29);
    // Warm glow.
    const glow = context.createRadialGradient(cx, top + 40, 4, cx, top + 40, 130);
    glow.addColorStop(0, 'rgba(255, 201, 94, 0.5)');
    glow.addColorStop(1, 'rgba(255, 201, 94, 0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(cx, top + 40, 130, 0, Math.PI * 2);
    context.fill();
    // Magnet aura.
    if (player.magnet > 0) {
      context.strokeStyle = 'rgba(182, 120, 242, 0.65)';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(cx, top + 40, 96 + 6 * Math.sin(state.elapsed * 5), 0, Math.PI * 2);
      context.stroke();
    }
    // Shield ring.
    if (player.shield) {
      context.strokeStyle = 'rgba(79, 216, 247, 0.9)';
      context.lineWidth = 4;
      context.beginPath();
      context.arc(cx, top + 40, 62, 0, Math.PI * 2);
      context.stroke();
    }
    // Slow-mo ring: the world is frozen, the lantern is not.
    if (state.slowmo > 0) {
      context.strokeStyle = 'rgba(125, 211, 252, 0.8)';
      context.lineWidth = 3;
      context.setLineDash([10, 8]);
      context.beginPath();
      context.arc(cx, top + 40, 76, 0, Math.PI * 2);
      context.stroke();
      context.setLineDash([]);
    }
    // Ground shadow.
    context.fillStyle = 'rgba(0, 0, 0, 0.35)';
    context.beginPath();
    context.ellipse(cx, FIELD.groundY + 8, 34, 7, 0, 0, Math.PI * 2);
    context.fill();
    // Handle.
    context.strokeStyle = PALETTE.lanternFrame;
    context.lineWidth = 4;
    context.beginPath();
    context.arc(cx, top + 6, 12, Math.PI, 0);
    context.stroke();
    // Body: brass frame and warm glass.
    context.fillStyle = PALETTE.lanternBody;
    context.fillRect(cx - 22, top + 16, 44, 46);
    context.fillStyle = PALETTE.flame;
    context.fillRect(cx - 16, top + 22, 32, 34);
    // Flame, flickering with elapsed time.
    context.fillStyle = PALETTE.flameCore;
    context.beginPath();
    context.moveTo(cx, top + 26);
    context.quadraticCurveTo(cx + 9 * flicker, top + 40, cx, top + 54);
    context.quadraticCurveTo(cx - 9 * flicker, top + 40, cx, top + 26);
    context.fill();
    // Frame bars and feet.
    context.fillStyle = PALETTE.lanternFrame;
    context.fillRect(cx - 22, top + 16, 44, 5);
    context.fillRect(cx - 22, top + 57, 44, 5);
    context.fillRect(cx - 24, top + 12, 48, 5);
    context.fillRect(cx - 24, top + 62, 48, 5);
  }

  function drawHud(state, best) {
    context.textBaseline = 'top';
    text(scoreLabel(state.score), 24, 18, 30, PALETTE.text, 'left');
    text(bestLabel(best), 24, 52, 18, PALETTE.muted, 'left');
    text(levelLabel(state.level), FIELD.width / 2, 18, 30, PALETTE.text, 'center');
    if (state.combo > 1) {
      text(`${comboLabel(Math.min(state.combo, COMBO.max))} COMBO`, FIELD.width / 2, 54, 22, PALETTE.ember, 'center');
    }
    // Lives as hearts, top right.
    const heartSize = 13;
    for (let life = 0; life < LIVES; life += 1) {
      const x = FIELD.width - 24 - life * 34;
      drawHeart(context, x, 34, heartSize, life < state.lives ? PALETTE.heart : '#3a3f55');
    }
    // Shield / magnet / slow-mo / 2x status under the hearts.
    let statusY = 62;
    if (state.player.shield) {
      text('SHIELD', FIELD.width - 24, statusY, 18, PALETTE.shield, 'right');
      statusY += 24;
    }
    if (state.player.magnet > 0) {
      text(`MAGNET ${Math.ceil(state.player.magnet)}s`, FIELD.width - 24, statusY, 18, PALETTE.magnet, 'right');
      statusY += 24;
    }
    if (state.slowmo > 0) {
      text(`SLOW-MO ${Math.ceil(state.slowmo)}s`, FIELD.width - 24, statusY, 18, PALETTE.slow, 'right');
      statusY += 24;
    }
    if (state.doubleScore > 0) {
      text(`2X SCORE ${Math.ceil(state.doubleScore)}s`, FIELD.width - 24, statusY, 18, PALETTE.double, 'right');
      statusY += 24;
    }
    // Boss warning, under the level line.
    if (state.bossActive) {
      text('BOSS — DODGE!', FIELD.width / 2, 92, 22, PALETTE.danger, 'center');
    }
    // Dash readiness, bottom left.
    const dashReady = state.player.dashCooldown <= 0;
    const dashWidth = 130;
    const dashFill = dashReady ? 1 : 1 - state.player.dashCooldown / PLAYER.dashCooldown;
    context.fillStyle = '#2a2f47';
    context.fillRect(24, FIELD.height - 34, dashWidth, 10);
    context.fillStyle = dashReady ? PALETTE.lanternGlow : PALETTE.muted;
    context.fillRect(24, FIELD.height - 34, dashWidth * dashFill, 10);
    text(dashReady ? 'DASH READY  [Shift]' : 'DASH…', 24, FIELD.height - 58, 16, PALETTE.muted, 'left');
    text('M: mute   P: pause', FIELD.width - 24, FIELD.height - 58, 16, PALETTE.muted, 'right');
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 78, 46, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 23, PALETTE.ember, 'center');
  }

  const TITLE_LINES = [
    'Guide the lantern through the meteor storm.',
    'Catch falling embers to score — in a row for a combo up to x5.',
    'Dodge the meteors. Three hits and the light goes out.',
    'Swift streaks, zigzag weavers, splitters that burst in two.',
    'Every 3rd level a giant boss falls — survive it for +150.',
    'Shield · Magnet · Heart · Slow-mo · 2x Score. Dash: Shift. Pause: P.',
    '',
  ];
  const PAUSED_LINES = ['The meteors will wait for you.', 'The lantern keeps burning.'];

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best, particles) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawField(state);
    if (particles) particles.draw(context);
    // Boss banner: a short warning across the sky when the giant rock arrives.
    if (state.banner && state.banner.text && state.elapsed < state.banner.until) {
      const pulse = 0.75 + 0.25 * Math.sin(state.elapsed * 10);
      context.globalAlpha = pulse;
      text(state.banner.text, FIELD.width / 2, 128, 44, PALETTE.danger, 'center');
      context.globalAlpha = 1;
    }
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[6] = bestLabel(best);
      drawPanel('EMBERFALL', TITLE_LINES, 'Press Space or click to start');
      return;
    }
    drawHud(state, best);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', PAUSED_LINES, 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      const minutes = Math.floor(state.elapsed / 60);
      const seconds = Math.floor(state.elapsed % 60);
      const time = `${minutes}:${String(seconds).padStart(2, '0')}`;
      const overLines = [
        finalLabel(state.score),
        bestLabel(best),
        `Embers caught ${state.embersCaught} · Best combo x${Math.min(state.bestCombo, COMBO.max)}`,
        `Meteors dodged ${state.meteorsDodged} · Bosses dodged ${state.bossesDodged}`,
        `Survived ${time} · Reached level ${state.level}`,
      ];
      drawPanel('The light goes out', overLines, 'Press Space or click to play again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
