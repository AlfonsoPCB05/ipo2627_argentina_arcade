/** Parámetros y reglas configurables, independientes de HTML y Canvas. */
export const BOARD = Object.freeze({ width: 960, height: 560 });

export const RULES = Object.freeze({
  maxWaves: 3,
  playerWidth: 48,
  playerHeight: 34,
  playerSpeed: 390,
  playerBottomMargin: 53,
  playerCooldown: 0.23,
  playerBulletSpeed: 630,
  enemyBulletSpeed: 260,
  enemyWidth: 42,
  enemyHeight: 30,
  enemyStepDown: 24,
  enemyMargin: 28,
  enemyDangerDistance: 12,
  invulnerabilityDuration: 1.5,
});

export const DIFFICULTIES = Object.freeze({
  easy: Object.freeze({ lives: 4, speedMultiplier: 0.75, fireInterval: 2.1 }),
  normal: Object.freeze({ lives: 3, speedMultiplier: 1, fireInterval: 1.6 }),
  hard: Object.freeze({ lives: 2, speedMultiplier: 1.4, fireInterval: 1.15 }),
});

export const GAME_STATE = Object.freeze({
  ready: 'ready',
  running: 'running',
  paused: 'paused',
  won: 'won',
  lost: 'lost',
  ended: 'ended',
});