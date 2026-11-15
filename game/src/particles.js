// Particles: sparks, bursts and trails. One pool, allocated once at boot; a
// particle is a point with a velocity, a lifetime, a size and a colour. The world
// asks for bursts (ember caught, meteor shattered, power-up taken) and the
// renderer draws what is alive. Nothing here allocates after createParticles returns.

export const FX_BURST = 'burst';
export const FX_EXPLOSION = 'explosion';
export const FX_TRAIL = 'trail';
export const FX_MOTE = 'mote';

export function createParticles(random, poolSize) {
  const pool = [];
  for (let index = 0; index < poolSize; index += 1) {
    pool.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#ffffff', gravity: 0 });
  }

  function freeParticle() {
    for (let index = 0; index < pool.length; index += 1) {
      if (!pool[index].active) return pool[index];
    }
    return null;
  }

  function spawn(x, y, vx, vy, life, size, color, gravity) {
    const particle = freeParticle();
    if (particle === null) return;
    particle.active = true;
    particle.x = x;
    particle.y = y;
    particle.vx = vx;
    particle.vy = vy;
    particle.life = life;
    particle.maxLife = life;
    particle.size = size;
    particle.color = color;
    particle.gravity = gravity;
  }

  function burst(x, y, color, count, speed) {
    for (let index = 0; index < count; index += 1) {
      const angle = random() * Math.PI * 2;
      const power = speed * (0.3 + random() * 0.7);
      spawn(x, y, Math.cos(angle) * power, Math.sin(angle) * power - 40, 0.35 + random() * 0.4, 2 + random() * 3.5, color, 320);
    }
  }

  function explosion(x, y, color) {
    burst(x, y, color, 22, 260);
    burst(x, y, '#ffd97a', 10, 160);
  }

  function trail(x, y, color) {
    spawn(x, y, (random() - 0.5) * 30, -20 - random() * 30, 0.3 + random() * 0.25, 2 + random() * 3, color, -60);
  }

  function mote(x, y) {
    spawn(x, y, (random() - 0.5) * 12, -14 - random() * 18, 1.2 + random(), 1.5 + random() * 2, '#ffca6a', -10);
  }

  function update(dt) {
    for (let index = 0; index < pool.length; index += 1) {
      const particle = pool[index];
      if (!particle.active) continue;
      particle.life -= dt;
      if (particle.life <= 0) {
        particle.active = false;
        continue;
      }
      particle.vy += particle.gravity * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
    }
  }

  function draw(context) {
    for (let index = 0; index < pool.length; index += 1) {
      const particle = pool[index];
      if (!particle.active) continue;
      const alpha = Math.max(0, particle.life / particle.maxLife);
      context.globalAlpha = alpha;
      context.fillStyle = particle.color;
      context.beginPath();
      context.arc(particle.x, particle.y, particle.size * (0.5 + alpha * 0.5), 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  return { burst, explosion, trail, mote, update, draw };
}
