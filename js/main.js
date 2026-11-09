import { GameModel } from './model.js';
import { GameView } from './view.js';
import { GameController } from './controller.js';

/** Punto de entrada: construye y conecta las tres responsabilidades de MVC. */
const elements = {
  canvas: document.querySelector('#game-canvas'),
  score: document.querySelector('#score-value'),
  lives: document.querySelector('#lives-value'),
  wave: document.querySelector('#wave-value'),
  status: document.querySelector('#game-status'),
  statusLabel: document.querySelector('#status-label'),
  message: document.querySelector('#game-message'),
  difficulty: document.querySelector('#difficulty'),
  difficultyHint: document.querySelector('#difficulty-hint'),
  startButton: document.querySelector('#start-button'),
  startLabel: document.querySelector('#start-label'),
  pauseButton: document.querySelector('#pause-button'),
  pauseLabel: document.querySelector('#pause-label'),
  pauseIcon: document.querySelector('#pause-icon'),
  endButton: document.querySelector('#end-button'),
  help: document.querySelector('#help-popover'),
  announcement: document.querySelector('#announcement'),
};

const model = new GameModel();
const view = new GameView(elements.canvas);
new GameController(model, view, elements);