import { BOARD, GAME_STATE, RULES } from './config.js';

const ENEMY_COLORS = ['#72ede0', '#b7a0fa', '#ffd38a', '#ff909e'];

// Patrones originales y autocontenidos: no se requieren recursos de terceros.
const ENEMY_SPRITES = [
  ['00100100100', '00011111000', '00111111100', '01101110110', '11111111111', '11011111011', '10010001001', '00100100100'],
  ['00011111000', '01111111110', '11111111111', '11011011011', '11111111111', '00110101100', '01100000110', '10000000001'],
  ['00001110000', '00111111100', '01111111110', '11101110111', '11111111111', '00111011100', '01100100110', '11000000011'],
];

const SHIP_SPRITE = [
  '00000011000000', '00000111100000', '00000111100000', '00011111111000',
  '01111111111110', '11111111111111', '11111111111111', '11001111110011',
  '10000100100001',
];

/** VISTA: conoce el Canvas, pero nunca altera las reglas del modelo. */
export class GameView {
  constructor(canvas) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Tu navegador no admite Canvas 2D.');
    this.canvas = canvas;
    this.context = context;
    this.context.imageSmoothingEnabled = false;
    this.stars = this.createStars();
  }

  createStars() {
    // Generador determinista propio de la vista: el fondo no modifica el juego.
    let seed = 84915;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    return Array.from({ length: 92 }, () => ({
      x: rand() * BOARD.width,
      y: rand() * BOARD.height,
      size: rand() > .86 ? 2 : 1,
      brightness: .2 + rand() * .5,
    }));
  }

  render(model) {
    const ctx = this.context;
    ctx.clearRect(0, 0, BOARD.width, BOARD.height);
    this.drawBackground();
    this.drawEnemies(model.enemies);
    this.drawBullets(model.playerBullets, '#73f5e7');
    this.drawBullets(model.enemyBullets, '#ff8a98');
    this.drawPlayer(model.player);
    this.drawEffects(model.effects);

    if (model.state !== GAME_STATE.running) this.drawStateOverlay(model);
  }

  drawBackground() {
    const ctx = this.context;
    const sky = ctx.createLinearGradient(0, 0, 0, BOARD.height);
    sky.addColorStop(0, '#060e21');
    sky.addColorStop(.55, '#101a38');
    sky.addColorStop(1, '#080e20');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, BOARD.width, BOARD.height);

    const nebula = ctx.createRadialGradient(720, 180, 30, 720, 180, 340);
    nebula.addColorStop(0, 'rgba(76, 70, 161, .23)');
    nebula.addColorStop(1, 'rgba(76, 70, 161, 0)');
    ctx.fillStyle = nebula;
    ctx.fillRect(0, 0, BOARD.width, BOARD.height);

    const planet = ctx.createRadialGradient(780, 95, 4, 790, 95, 110);
    planet.addColorStop(0, '#2b3d6d');
    planet.addColorStop(.7, '#17244d');
    planet.addColorStop(1, '#0d1630');
    ctx.beginPath();
    ctx.arc(790, 96, 107, 0, Math.PI * 2);
    ctx.fillStyle = planet;
    ctx.fill();
    ctx.strokeStyle = 'rgba(125, 145, 227, .16)';
    ctx.lineWidth = 2;
    ctx.stroke();

    for (const star of this.stars) {
      ctx.fillStyle = `rgba(183, 220, 252, ${star.brightness})`;
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(109, 148, 195, .06)';
    ctx.lineWidth = 1;
    for (let x = 40; x < BOARD.width; x += 64) {
      ctx.moveTo(x, 0); ctx.lineTo(x, BOARD.height);
    }
    for (let y = 40; y < BOARD.height; y += 64) {
      ctx.moveTo(0, y); ctx.lineTo(BOARD.width, y);
    }
    ctx.stroke();

    ctx.fillStyle = '#7795b7';
    ctx.font = '700 13px monospace';
    ctx.fillText('◈  SISTEMA SOLAR / SECTOR 07', 31, 34);
    ctx.fillStyle = 'rgba(104, 230, 217, .4)';
    ctx.fillRect(20, BOARD.height - 36, BOARD.width - 40, 1);
    ctx.fillStyle = '#7091a7';
    ctx.font = '11px monospace';
    ctx.fillText('DEFENSA ORBITAL // NEBULA 84', 30, BOARD.height - 15);
  }

  drawSprite(sprite, x, y, pixelSize, color) {
    const ctx = this.context;
    ctx.fillStyle = color;
    for (let row = 0; row < sprite.length; row += 1) {
      for (let col = 0; col < sprite[row].length; col += 1) {
        if (sprite[row][col] === '1') {
          ctx.fillRect(Math.round(x + col * pixelSize), Math.round(y + row * pixelSize), Math.ceil(pixelSize), Math.ceil(pixelSize));
        }
      }
    }
  }

  drawEnemies(enemies) {
    const ctx = this.context;
    for (const enemy of enemies) {
      ctx.save();
      ctx.shadowBlur = 12;
      ctx.shadowColor = ENEMY_COLORS[enemy.type];
      this.drawSprite(ENEMY_SPRITES[enemy.type], enemy.x + 3, enemy.y + 2, 3.2, ENEMY_COLORS[enemy.type]);
      ctx.restore();
    }
  }

  drawPlayer(player) {
    // La invulnerabilidad se indica mediante un parpadeo visual, sin ocultar el HUD.
    if (player.invulnerableFor > 0 && Math.floor(player.invulnerableFor * 9) % 2 === 0) return;
    const ctx = this.context;
    ctx.save();
    ctx.shadowColor = '#72ede0';
    ctx.shadowBlur = 17;
    this.drawSprite(SHIP_SPRITE, player.x + 2, player.y + 1, 3.15, '#72ede0');
    ctx.restore();
    ctx.fillStyle = '#ffd38a';
    ctx.fillRect(Math.round(player.x + player.width / 2 - 6), Math.round(player.y + player.height - 4), 12, 6);
  }

  drawBullets(bullets, color) {
    const ctx = this.context;
    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    for (const bullet of bullets) ctx.fillRect(Math.round(bullet.x), Math.round(bullet.y), bullet.width, bullet.height);
    ctx.restore();
  }

  drawEffects(effects) {
    const ctx = this.context;
    for (const effect of effects) {
      ctx.globalAlpha = Math.min(1, effect.life / .3);
      ctx.fillStyle = ENEMY_COLORS[effect.type];
      ctx.fillRect(Math.round(effect.x), Math.round(effect.y), 4, 4);
    }
    ctx.globalAlpha = 1;
  }

  drawStateOverlay(model) {
    const ctx = this.context;
    const texts = {
      ready: ['SISTEMA PREPARADO', 'Prepara tu nave y pulsa «Iniciar partida».'],
      paused: ['MISIÓN EN PAUSA', 'Pulsa P o «Reanudar» para continuar.'],
      won: ['¡MISIÓN CUMPLIDA!', 'Has defendido el sector. ¡Enhorabuena!'],
      lost: ['FIN DE LA MISIÓN', 'Los invasores han tomado el sector.'],
      ended: ['PARTIDA FINALIZADA', 'Puedes comenzar una nueva misión cuando quieras.'],
    };
    const [title, description] = texts[model.state];

    ctx.fillStyle = 'rgba(5, 10, 24, .77)';
    ctx.fillRect(0, 0, BOARD.width, BOARD.height);
    ctx.fillStyle = '#101e34';
    ctx.fillRect(158, 178, 644, 212);
    ctx.strokeStyle = '#3d6870';
    ctx.lineWidth = 2;
    ctx.strokeRect(158, 178, 644, 212);
    ctx.fillStyle = '#68e6d9';
    ctx.fillRect(158, 178, 644, 4);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#f5ca7f';
    ctx.font = '700 15px monospace';
    ctx.fillText('✦  N E B U L A   8 4  ✦', BOARD.width / 2, 224);
    ctx.fillStyle = '#f3f7ff';
    ctx.font = 'bold 40px system-ui, sans-serif';
    ctx.fillText(title, BOARD.width / 2, 293);
    ctx.fillStyle = '#aabed4';
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillText(description, BOARD.width / 2, 335);
    ctx.textAlign = 'start';
  }
}