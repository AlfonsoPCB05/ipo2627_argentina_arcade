import { BOARD, DIFFICULTIES, GAME_STATE, RULES } from './config.js';

/** Comprueba el solapamiento de dos cajas alineadas a los ejes. */
export function intersects(a, b) {
  return a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y;
}

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(value, maximum));

/**
 * MODELO: contiene el estado y las reglas de juego.
 * No accede al DOM, no dibuja y no registra eventos de teclado.
 */
export class GameModel {
  constructor(random = Math.random) {
    this.random = random;
    this.prepare('normal');
  }

  /** Configura el estado de espera; es seguro cambiar la dificultad aquí. */
  prepare(difficulty) {
    if (!Object.hasOwn(DIFFICULTIES, difficulty)) {
      throw new RangeError(`Dificultad desconocida: ${difficulty}`);
    }

    this.difficulty = difficulty;
    this.settings = DIFFICULTIES[difficulty];
    this.state = GAME_STATE.ready;
    this.score = 0;
    this.lives = this.settings.lives;
    this.wave = 1;
    this.player = {
      x: (BOARD.width - RULES.playerWidth) / 2,
      y: BOARD.height - RULES.playerBottomMargin - RULES.playerHeight,
      width: RULES.playerWidth,
      height: RULES.playerHeight,
      invulnerableFor: 0,
    };
    this.playerBullets = [];
    this.enemyBullets = [];
    this.effects = [];
    this.shotCooldown = 0;
    this.createWave(1);
  }

  start(difficulty = this.difficulty) {
    this.prepare(difficulty);
    this.state = GAME_STATE.running;
  }

  pause() {
    if (this.state !== GAME_STATE.running) return false;
    this.state = GAME_STATE.paused;
    return true;
  }

  resume() {
    if (this.state !== GAME_STATE.paused) return false;
    this.state = GAME_STATE.running;
    return true;
  }

  finish() {
    if (this.state !== GAME_STATE.running && this.state !== GAME_STATE.paused) return false;
    this.state = GAME_STATE.ended;
    return true;
  }

  createWave(wave) {
    const columns = wave === 3 ? 9 : 8;
    const rows = wave === 1 ? 3 : 4;
    const gapX = 71;
    const gapY = 49;
    const totalWidth = (columns - 1) * gapX + RULES.enemyWidth;
    const startX = (BOARD.width - totalWidth) / 2;

    this.enemies = [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        this.enemies.push({
          x: startX + column * gapX,
          y: 86 + row * gapY,
          width: RULES.enemyWidth,
          height: RULES.enemyHeight,
          row,
          column,
          type: row % 3,
          points: (rows - row) * 10,
          dead: false,
        });
      }
    }

    this.enemyDirection = 1;
    this.enemyFireCountdown = this.settings.fireInterval;
    this.playerBullets = [];
    this.enemyBullets = [];
  }

  /** Avanza exactamente un paso lógico expresado en segundos. */
  update(deltaSeconds, input) {
    if (this.state !== GAME_STATE.running) return;
    const dt = clamp(deltaSeconds, 0, 0.05);
    if (dt === 0) return;

    this.shotCooldown = Math.max(0, this.shotCooldown - dt);
    this.player.invulnerableFor = Math.max(0, this.player.invulnerableFor - dt);
    this.updateEffects(dt);
    this.updatePlayer(dt, input);
    this.updateEnemies(dt);

    if (this.enemies.some(enemy => enemy.y + enemy.height >= this.player.y - RULES.enemyDangerDistance)) {
      this.state = GAME_STATE.lost;
      return;
    }

    this.updatePlayerBullets(dt);
    if (this.enemies.length === 0) {
      if (this.wave === RULES.maxWaves) {
        this.state = GAME_STATE.won;
      } else {
        this.wave += 1;
        this.createWave(this.wave);
      }
      return;
    }

    this.updateEnemyBullets(dt);
  }

  updatePlayer(dt, input) {
    const direction = Number(Boolean(input.right)) - Number(Boolean(input.left));
    this.player.x = clamp(
      this.player.x + direction * RULES.playerSpeed * dt,
      18,
      BOARD.width - this.player.width - 18,
    );

    if (input.shoot && this.shotCooldown === 0 && this.playerBullets.length < 3) {
      this.playerBullets.push({
        x: this.player.x + this.player.width / 2 - 3,
        y: this.player.y - 16,
        width: 6,
        height: 20,
        dead: false,
      });
      this.shotCooldown = RULES.playerCooldown;
    }
  }

  updateEnemies(dt) {
    const speed = (42 + (this.wave - 1) * 16 + (24 - this.enemies.length) * 0.9) * this.settings.speedMultiplier;
    const displacement = this.enemyDirection * speed * dt;
    const leftEdge = Math.min(...this.enemies.map(enemy => enemy.x));
    const rightEdge = Math.max(...this.enemies.map(enemy => enemy.x + enemy.width));
    const mustTurn = leftEdge + displacement < RULES.enemyMargin ||
      rightEdge + displacement > BOARD.width - RULES.enemyMargin;

    if (mustTurn) {
      this.enemyDirection *= -1;
      for (const enemy of this.enemies) enemy.y += RULES.enemyStepDown;
    } else {
      for (const enemy of this.enemies) enemy.x += displacement;
    }
  }

  updatePlayerBullets(dt) {
    for (const bullet of this.playerBullets) {
      bullet.y -= RULES.playerBulletSpeed * dt;
      for (const enemy of this.enemies) {
        if (!enemy.dead && intersects(bullet, enemy)) {
          bullet.dead = true;
          enemy.dead = true;
          this.score += enemy.points;
          this.addExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.type);
          break;
        }
      }
    }

    this.playerBullets = this.playerBullets.filter(bullet => !bullet.dead && bullet.y + bullet.height >= 0);
    this.enemies = this.enemies.filter(enemy => !enemy.dead);
  }

  updateEnemyBullets(dt) {
    this.enemyFireCountdown -= dt;
    if (this.enemyFireCountdown <= 0 && this.enemies.length > 0) {
      this.fireEnemyBullet();
      this.enemyFireCountdown = this.settings.fireInterval * (0.75 + this.random() * 0.5);
    }

    for (const bullet of this.enemyBullets) {
      bullet.y += (RULES.enemyBulletSpeed + (this.wave - 1) * 35) * dt;
      if (this.player.invulnerableFor === 0 && intersects(bullet, this.player)) {
        bullet.dead = true;
        this.lives -= 1;
        this.addExplosion(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2, 3);
        if (this.lives === 0) {
          this.state = GAME_STATE.lost;
        } else {
          this.player.invulnerableFor = RULES.invulnerabilityDuration;
        }
        // Evita que la nave reciba varios impactos en el mismo instante.
        this.enemyBullets = [];
        return;
      }
    }
    this.enemyBullets = this.enemyBullets.filter(bullet => !bullet.dead && bullet.y <= BOARD.height);
  }

  fireEnemyBullet() {
    // Solo disparan los invasores situados más abajo de su columna.
    const shooters = new Map();
    for (const enemy of this.enemies) {
      const previous = shooters.get(enemy.column);
      if (!previous || enemy.y > previous.y) shooters.set(enemy.column, enemy);
    }
    const candidates = [...shooters.values()];
    const enemy = candidates[Math.floor(this.random() * candidates.length)];
    if (!enemy) return;
    this.enemyBullets.push({
      x: enemy.x + enemy.width / 2 - 3,
      y: enemy.y + enemy.height,
      width: 6,
      height: 18,
      dead: false,
    });
  }

  addExplosion(x, y, type) {
    for (let i = 0; i < 12; i += 1) {
      const angle = (i / 12) * Math.PI * 2;
      const speed = 40 + this.random() * 105;
      this.effects.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.44, type });
    }
  }

  updateEffects(dt) {
    for (const effect of this.effects) {
      effect.x += effect.vx * dt;
      effect.y += effect.vy * dt;
      effect.life -= dt;
    }
    this.effects = this.effects.filter(effect => effect.life > 0);
  }
}
