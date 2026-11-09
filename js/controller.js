import { DIFFICULTIES, GAME_STATE, RULES } from './config.js';

const DIFFICULTY_DESCRIPTIONS = {
  easy: '4 vidas · enemigos más lentos',
  normal: '3 vidas · velocidad estándar',
  hard: '2 vidas · invasión acelerada',
};

const STATUS_LABELS = {
  ready: 'PREPARADO',
  running: 'JUGANDO',
  paused: 'EN PAUSA',
  won: 'VICTORIA',
  lost: 'DERROTA',
  ended: 'FINALIZADO',
};

const MESSAGES = {
  ready: 'Todo listo. La misión comienza cuando tú decidas.',
  running: '¡Defiende el sector! Esquiva los disparos enemigos.',
  paused: 'Partida pausada. Puedes reanudarla cuando quieras.',
  won: '¡Victoria! Has superado las tres oleadas.',
  lost: 'Fin de la partida. Puedes volver a intentarlo.',
  ended: 'Has terminado la partida. Puedes iniciar otra misión.',
};

/** CONTROLADOR: traduce eventos del usuario en acciones sobre el modelo. */
export class GameController {
  constructor(model, view, elements) {
    this.model = model;
    this.view = view;
    this.elements = elements;
    this.keys = new Set();
    this.touchButtons = new Set();
    this.pendingTouchShot = false;
    this.animationId = null;
    this.previousTimestamp = null;
    this.loop = this.loop.bind(this);
    this.initialize();
  }

  initialize() {
    const ui = this.elements;
    ui.startButton.addEventListener('click', () => this.start());
    ui.pauseButton.addEventListener('click', () => this.togglePause());
    ui.endButton.addEventListener('click', () => this.finish());
    ui.difficulty.addEventListener('change', () => {
      this.model.prepare(ui.difficulty.value);
      this.updateInterface();
      this.view.render(this.model);
    });

    document.addEventListener('keydown', event => this.handleKeyDown(event));
    document.addEventListener('keyup', event => this.handleKeyUp(event));
    window.addEventListener('blur', () => this.pauseIfRunning());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pauseIfRunning();
    });
    ui.help.addEventListener('toggle', event => {
      if (event.newState === 'open') this.pauseIfRunning();
    });
    this.initializeTouchControls();
    this.updateInterface();
    this.view.render(this.model);
  }

  initializeTouchControls() {
    for (const button of document.querySelectorAll('[data-control]')) {
      const command = button.dataset.control;
      button.addEventListener('pointerdown', event => {
        if (this.model.state !== GAME_STATE.running) return;
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        this.touchButtons.add(command);
        // Registrar también los toques muy breves, entre dos fotogramas.
        if (command === 'shoot') this.pendingTouchShot = true;
      });
      const release = () => this.touchButtons.delete(command);
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', release);
    }
  }

  handleKeyDown(event) {
    if (this.elements.help.matches(':popover-open')) return;
    // P sigue funcionando si el foco está en un botón, pero no en un campo.
    const isEditing = event.target instanceof Element &&
      event.target.closest('select, input, textarea, [contenteditable="true"]');
    if (event.code === 'KeyP' && !event.repeat && !isEditing) {
      event.preventDefault();
      this.togglePause();
      return;
    }

    // Space y flechas mantienen su comportamiento nativo en controles HTML.
    if (event.target instanceof Element && event.target.closest('button, select, input, textarea, [contenteditable="true"]')) return;
    if (this.model.state !== GAME_STATE.running) return;
    if (['ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    this.keys.add(event.code);
  }

  handleKeyUp(event) {
    this.keys.delete(event.code);
  }

  getInput() {
    const shoot = this.keys.has('Space') || this.touchButtons.has('shoot') || this.pendingTouchShot;
    this.pendingTouchShot = false;
    return {
      left: this.keys.has('ArrowLeft') || this.keys.has('KeyA') || this.touchButtons.has('left'),
      right: this.keys.has('ArrowRight') || this.keys.has('KeyD') || this.touchButtons.has('right'),
      shoot,
    };
  }

  clearInput() {
    this.keys.clear();
    this.touchButtons.clear();
    this.pendingTouchShot = false;
  }

  start() {
    if (this.model.state === GAME_STATE.running || this.model.state === GAME_STATE.paused) return;
    this.model.start(this.elements.difficulty.value);
    this.clearInput();
    this.view.render(this.model);
    this.updateInterface();
    this.announce('Partida iniciada. Primera oleada.');
    this.elements.canvas.focus({ preventScroll: true });
    this.scheduleLoop();
  }

  togglePause() {
    if (this.model.state === GAME_STATE.running) {
      this.pauseIfRunning();
    } else if (this.model.resume()) {
      this.updateInterface();
      this.announce('Partida reanudada.');
      this.elements.canvas.focus({ preventScroll: true });
      this.scheduleLoop();
    }
  }

  pauseIfRunning() {
    if (!this.model.pause()) return;
    this.stopLoop();
    this.clearInput();
    this.updateInterface();
    this.view.render(this.model);
    this.announce('Partida pausada.');
  }

  finish() {
    if (!this.model.finish()) return;
    this.stopLoop();
    this.clearInput();
    this.updateInterface();
    this.view.render(this.model);
    this.announce('Partida finalizada.');
  }

  scheduleLoop() {
    this.stopLoop();
    this.previousTimestamp = null;
    this.animationId = requestAnimationFrame(this.loop);
  }

  stopLoop() {
    if (this.animationId !== null) cancelAnimationFrame(this.animationId);
    this.animationId = null;
    this.previousTimestamp = null;
  }

  loop(timestamp) {
    if (this.model.state !== GAME_STATE.running) return;
    const dt = this.previousTimestamp === null ? 0 : Math.min((timestamp - this.previousTimestamp) / 1000, .05);
    this.previousTimestamp = timestamp;
    const oldWave = this.model.wave;
    const oldLives = this.model.lives;
    const oldState = this.model.state;

    this.model.update(dt, this.getInput());
    this.view.render(this.model);
    this.updateInterface();

    if (this.model.wave !== oldWave) this.announce(`Oleada ${this.model.wave} de ${RULES.maxWaves}.`);
    if (this.model.lives < oldLives) this.announce(`Impacto recibido. Vidas restantes: ${this.model.lives}.`);
    if (this.model.state !== oldState) {
      this.stopLoop();
      this.clearInput();
      this.updateInterface();
      this.announce(MESSAGES[this.model.state]);
    } else {
      this.animationId = requestAnimationFrame(this.loop);
    }
  }

  updateInterface() {
    const ui = this.elements;
    const state = this.model.state;
    const isPlaying = state === GAME_STATE.running;
    const isPaused = state === GAME_STATE.paused;
    const isActive = isPlaying || isPaused;
    const completed = [GAME_STATE.won, GAME_STATE.lost, GAME_STATE.ended].includes(state);

    ui.startButton.disabled = isActive;
    ui.startLabel.textContent = completed ? 'Nueva partida' : 'Iniciar partida';
    ui.pauseButton.disabled = !isActive;
    ui.pauseLabel.textContent = isPaused ? 'Reanudar' : 'Pausar';
    ui.pauseIcon.textContent = isPaused ? '▶' : 'Ⅱ';
    ui.endButton.disabled = !isActive;
    ui.difficulty.disabled = isActive;

    this.updateText(ui.score, String(this.model.score).padStart(5, '0'));
    this.updateText(ui.lives, Array(this.model.lives).fill('♥').join(' '));
    ui.lives.setAttribute('aria-label', `${this.model.lives} ${this.model.lives === 1 ? 'vida' : 'vidas'}`);
    this.updateText(ui.wave, `${String(this.model.wave).padStart(2, '0')} / ${String(RULES.maxWaves).padStart(2, '0')}`);
    this.updateText(ui.statusLabel, STATUS_LABELS[state]);
    ui.status.dataset.state = state;
    this.updateText(ui.message, MESSAGES[state]);
    this.updateText(ui.difficultyHint, DIFFICULTY_DESCRIPTIONS[ui.difficulty.value]);
  }

  updateText(element, text) {
    if (element.textContent !== text) element.textContent = text;
  }

  announce(message) {
    this.elements.announcement.textContent = message;
  }
}
