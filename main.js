/* global board, teams, scores, savedScores, turnNum, roundNum, activeTeamNum, selectedSquare, trail, passCount, winningTeam, showingHints, showingDanger, pieceRotationEnabled, timerEnabled, turnTimeLimit, turnTime */
'use strict';

const GAME = 'Chess';
const STAGE_SIZE = 700;
const STAGE_PADDING = 10;
const TICK_TIME = 1000;
const DEBOUNCE_TIME = 500;
const TIMER_MIN = 1;
const TIMER_MAX = 3600;
const SQUARE_SIZE = 40;
const TRAIL_THICKNESS = 30;
const BOARD_SIZE = 17;
const DEAD_SQUARES = {
  0: [0, 1, 2, 3, 4, 12, 13, 14, 15, 16],
  1: [0, 1, 2, 3, 13, 14, 15, 16],
  2: [0, 1, 2, 14, 15, 16],
  3: [0, 1, 15, 16],
  4: [0, 16],
  12: [0, 16],
  13: [0, 1, 15, 16],
  14: [0, 1, 2, 14, 15, 16],
  15: [0, 1, 2, 3, 13, 14, 15, 16],
  16: [0, 1, 2, 3, 4, 12, 13, 14, 15, 16],
};
const CENTRAL_SQUARES = {
  6: [8],
  7: [7, 8, 9],
  8: [6, 7, 8, 9, 10],
  9: [7, 8, 9],
  10: [8],
};
const KNIGHT_SQUARES = {
  0: [7, 9],
  7: [0, 7, 9, 16],
  9: [0, 7, 9, 16],
  16: [7, 9],
};
const BISHOP_SQUARES = {
  0: [6, 10],
  6: [0, 8, 16],
  8: [6, 10],
  10: [0, 8, 16],
  16: [6, 10],
};
const ROOK_SQUARES = {
  0: [5, 11],
  5: [0, 16],
  7: [8],
  8: [7, 9],
  9: [8],
  11: [0, 16],
  16: [5, 11],
};
const QUEEN_SQUARES = {
  0: [8],
  8: [0, 16],
  16: [8],
};
const KING_SQUARES = {
  8: [8],
};
const SOUTH = 'south';
const WEST = 'west';
const NORTH = 'north';
const EAST = 'east';
const CENTRAL = 'central';
const DRAW = 'draw';
const TEAMS = [SOUTH, WEST, NORTH, EAST, CENTRAL];
const PAWN = 'pawn';
const KNIGHT = 'knight';
const BISHOP = 'bishop';
const ROOK = 'rook';
const QUEEN = 'queen';
const KING = 'king';
const PIECE_VALUES = {
  [PAWN]: 1,
  [KNIGHT]: 3,
  [BISHOP]: 3,
  [ROOK]: 5,
  [QUEEN]: 9,
  [KING]: 100,
};
const PIECE_TYPES = Object.keys(PIECE_VALUES);
const KNIGHT_OFFSETS = [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]];
const BISHOP_DELTAS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ROOK_DELTAS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const QUEEN_DELTAS = [...BISHOP_DELTAS, ...ROOK_DELTAS];
const AI_DEPTH = 1;
const DELIMS = ['~', '|'];
const DELIM_BOUNDARY = `([" ${DELIMS.join('')}])`;
const STATE_VARS = [
  'board',
  'teams',
  'scores',
  'savedScores',
  'turnNum',
  'roundNum',
  'activeTeamNum',
  'selectedSquare',
  'trail',
  'passCount',
  'winningTeam',
  'showingHints',
  'showingDanger',
  'pieceRotationEnabled',
  'timerEnabled',
  'turnTimeLimit',
  'turnTime',
];
const STATE_MAP = {
  s: SOUTH,
  w: WEST,
  n: NORTH,
  e: EAST,
  c: CENTRAL,
  d: DRAW,
  p: PAWN,
  N: KNIGHT,
  b: BISHOP,
  r: ROOK,
  q: QUEEN,
  k: KING,
  B: 'board',
  t: 'teams',
  S: 'scores',
  z: 'savedScores',
  u: 'turnNum',
  R: 'roundNum',
  a: 'activeTeamNum',
  Q: 'selectedSquare',
  m: 'trail',
  P: 'passCount',
  W: 'winningTeam',
  h: 'showingHints',
  D: 'showingDanger',
  E: 'pieceRotationEnabled',
  i: 'timerEnabled',
  l: 'turnTimeLimit',
  U: 'turnTime',
  T: 'team',
  o: 'origin',
  A: 'target',
  C: 'capture',
};
const CORRUPTION_POINT = 7;
const CORRUPTION_CHAR = 'K';

globalThis.board = [[]];
globalThis.teams = [...TEAMS];
globalThis.scores = {
  [SOUTH]: 0,
  [WEST]: 0,
  [NORTH]: 0,
  [EAST]: 0,
  [CENTRAL]: 0,
};
globalThis.savedScores = { ...scores };
globalThis.turnNum = 1;
globalThis.roundNum = 1;
globalThis.activeTeamNum = -1;
globalThis.selectedSquare = [];
globalThis.trail = null;
globalThis.passCount = 0;
globalThis.winningTeam = '';
globalThis.showingHints = false;
globalThis.showingDanger = false;
globalThis.pieceRotationEnabled = false;
globalThis.timerEnabled = false;
globalThis.turnTimeLimit = 30;
globalThis.turnTime = 0;

let justPasted = false;
let timerId;
let $stage;
let $scores;
let $instructions;
let $settings;
let $teamCheckboxes;
let $newGameButton;
let $endGameConfirmation;
let $resetConfirmation;
let $exportButton;
let $importButton;
let $timer;
let $computerTurnButton;
let $passTurnButton;
let $board;
let $trail;

/**
 * Creates a debounced wrapper around a callback.
 * @param {Function} fn
 * @returns {Function}
 */
const debounce = (fn) => {
  let id;
  return (...args) => {
    clearTimeout(id);
    id = setTimeout(() => fn.apply(this, args), DEBOUNCE_TIME);
  };
};

/**
 * Serializes the current game state for saving or sharing.
 * @param {boolean} [encoded=false] Whether to compress the encoded payload.
 * @returns {string}
 */
const getState = (encoded = false) => {
  const state = {};
  STATE_VARS.forEach((key) => {
    state[key] = globalThis[key];
  });
  let stateText = JSON.stringify(state, stateReplacer);
  Object.entries(STATE_MAP).forEach(([short, long]) => {
    stateText = stateText.replace(new RegExp(`${DELIM_BOUNDARY}${long}${DELIM_BOUNDARY}`, 'g'), `$1${short}$2`);
  });
  if (encoded) {
    stateText = encodeState(stateText);
  }
  return stateText;
};

/**
 * Encodes state text with a lightweight corruption marker for copy/paste safety.
 * @param {string} stateText
 * @returns {string}
 */
const encodeState = (stateText) => {
  const encodedStateText = btoa(stateText);
  if (encodedStateText.length <= CORRUPTION_POINT) {
    return encodedStateText;
  }
  return `${encodedStateText.slice(0, CORRUPTION_POINT)}${CORRUPTION_CHAR}${encodedStateText.slice(CORRUPTION_POINT)}`;
};

const saveState = debounce(() => {
  localStorage.setItem(`ozghard${GAME}`, getState(false));
  if (justPasted) {
    justPasted = false;
  } else {
    $exportButton.classList.remove('CONTROLS-button--success', 'CONTROLS-button--error');
    $importButton.classList.remove('CONTROLS-button--success', 'CONTROLS-button--error');
  }
});

/**
 * Restores a serialized game state, merging it into the live globals.
 * @param {string} stateText
 * @param {boolean} [encoded=false]
 * @returns {boolean}
 */
const setState = (stateText, encoded = false) => {
  try {
    if (encoded) {
      stateText = decodeState(stateText);
    }
  } catch {
    return false;
  }
  if (!stateText) {
    return false;
  }
  Object.entries(STATE_MAP).forEach(([short, long]) => {
    stateText = stateText.replace(new RegExp(`${DELIM_BOUNDARY}${short}${DELIM_BOUNDARY}`, 'g'), `$1${long}$2`);
  });
  let state;
  try {
    state = JSON.parse(stateText, stateReviver);
  } catch {
    return false;
  }
  STATE_VARS.forEach((key) => {
    if (state[key] === undefined) {
      return;
    }
    globalThis[key] = state[key];
  });
  renderBoard();
  renderTimer();
  makeSettings();
  return true;
};

/**
 * Decodes a game state string back to the plain serialized form.
 * @param {string} stateText
 * @returns {string}
 */
const decodeState = (stateText) => {
  if (stateText.length <= CORRUPTION_POINT + 1) {
    return atob(stateText);
  }
  return atob(`${stateText.slice(0, CORRUPTION_POINT)}${stateText.slice(CORRUPTION_POINT + 1)}`);
};

/**
 * Restores a saved game from local storage if available.
 * @returns {boolean}
 */
const loadState = () => {
  try {
    return setState(localStorage.getItem(`ozghard${GAME}`));
  } catch {
    return false;
  }
};

/**
 * Compresses nested arrays into a compact string form for state serialization.
 * @param {string} _key
 * @param {*} value
 * @returns {*}
 */
const stateReplacer = (_key, value) => {
  if (Array.isArray(value) && (Array.isArray(value[0]) || typeof value[0] === 'string')) {
    return value.map(
      (thisValue) => Array.isArray(thisValue) && typeof thisValue[0] === 'string'
        ? thisValue.join(DELIMS[1])
        : thisValue
    ).join(DELIMS[0]);
  }
  return value;
};

/**
 * Expands compact serialized arrays back into their original nested structure.
 * @param {string} _key
 * @param {*} value
 * @returns {*}
 */
const stateReviver = (_key, value) => {
  if (typeof value === 'string' && value.includes(DELIMS[0])) {
    value = value.split(DELIMS[0]);
    value = value.map((thisValue) => typeof thisValue === 'string' && thisValue.includes(DELIMS[1])
      ? thisValue.split(DELIMS[1])
      : thisValue);
  }
  return value;
};

/**
 * Prevents duplicate taps from firing on a touch or pointer event.
 * @param {number} [delay=500]
 * @returns {(event: Event) => void}
 */
const preventDoubleTap = (delay = 500) => {
  let timeout;
  let lastTapTime = 0;
  return (event) => {
    const currentTime = new Date().getTime();
    const elapsedTime = currentTime - lastTapTime;
    if (elapsedTime > 0 && elapsedTime < delay) {
      event.preventDefault();
    } else {
      timeout = setTimeout(() => clearTimeout(timeout), delay);
    }
    lastTapTime = currentTime;
  };
};

/**
 * Creates the game stage, controls, overlays, and resize listeners.
 */
const initStage = () => {
  $stage = document.querySelector('.STAGE');
  const $bylineLink = makeEl('a', '', 'Cliff Jones Jr.');
  $bylineLink.href = 'https://ko-fi.com/cliff';
  $bylineLink.target = '_blank';
  $scores = makeEl('section', 'SCORES');
  $board = makeEl('section', 'BOARD');
  $trail = makeEl('div', 'TRAIL');
  $stage.append(
    makeEl(
      'header',
      'TITLE',
      'Ozghard',
      makeEl('div', 'TITLE-subtitle', GAME),
      makeEl('div', 'TITLE-byline', 'By ', $bylineLink),
    ),
    $scores,
    makeLeftControls(),
    makeRightControls(),
    $board,
    $trail,
    makeInstructions(),
    makeSettings(),
  );

  // Make sure the stage maintains its normal size on all devices.
  document.addEventListener('dblclick', (e) => e.preventDefault());
  document.addEventListener('pointerup', preventDoubleTap());
  document.addEventListener('touchend', preventDoubleTap());
  window.addEventListener('resize', resizeStage, { passive: true });
  resizeStage();
};

/**
 * Creates a DOM element with an optional CSS class and children.
 * @param {string} type
 * @param {string} [className='']
 * @param {...Node} children
 * @returns {HTMLElement}
 */
const makeEl = (type, className, ...children) => {
  const $el = document.createElement(type);
  if (className) {
    $el.className = className;
  }
  if (children) {
    $el.append(...children);
  }
  return $el;
};

/**
 * Hides an element by setting its display property.
 * @param {HTMLElement|null|undefined} $el
 */
const hideEl = ($el) => {
  $el?.style.setProperty('display', 'none');
};

/**
 * Shows an element by clearing its display property.
 * @param {HTMLElement|null|undefined} $el
 */
const showEl = ($el) => {
  $el?.style.removeProperty('display');
};

/**
 * Builds the left-side control cluster with the instruction, settings, and new-game actions.
 * @returns {HTMLElement}
 */
const makeLeftControls = () => {
  const $instructionsButton = makeEl('button', 'CONTROLS-button', 'Instructions');
  $instructionsButton.addEventListener('click', () => showModal($instructions), { passive: true });

  const $settingsButton = makeEl('button', 'CONTROLS-button', 'Settings');
  $settingsButton.addEventListener('click', () => showModal($settings), { passive: true });

  $newGameButton = makeEl('button', 'CONTROLS-button', 'New Game');
  $newGameButton.addEventListener('click', askEndGame, { passive: true });

  const $yesEndGameButton = makeEl('button', 'CONTROLS-button CONTROLS-button--yes');
  $yesEndGameButton.title = 'Yes';
  $yesEndGameButton.addEventListener('click', () => answerEndGame(true), { passive: true });

  const $noEndGameButton = makeEl('button', 'CONTROLS-button CONTROLS-button--no');
  $noEndGameButton.title = 'No';
  $noEndGameButton.addEventListener('click', () => answerEndGame(false), { passive: true });

  $endGameConfirmation = makeEl(
    'div',
    'CONTROLS-confirmation',
    makeEl('div', '', 'End game?'),
    $yesEndGameButton,
    $noEndGameButton,
  );
  hideEl($endGameConfirmation);

  const $yesResetButton = makeEl('button', 'CONTROLS-button CONTROLS-button--yes');
  $yesResetButton.title = 'Yes';
  $yesResetButton.addEventListener('click', () => answerResetScores(true), { passive: true });

  const $noResetButton = makeEl('button', 'CONTROLS-button CONTROLS-button--no');
  $noResetButton.title = 'No';
  $noResetButton.addEventListener('click', () => answerResetScores(false), { passive: true });

  $resetConfirmation = makeEl(
    'div',
    'CONTROLS-confirmation',
    makeEl('div', '', 'Reset scores?'),
    $yesResetButton,
    $noResetButton,
  );
  hideEl($resetConfirmation);

  return makeEl(
    'section',
    'CONTROLS CONTROLS--left',
    $instructionsButton,
    $settingsButton,
    $newGameButton,
    $endGameConfirmation,
    $resetConfirmation,
  );
};

/**
 * Pauses the match timer and reveals a modal overlay.
 * @param {HTMLElement} $el
 */
/**
 * Pauses the timer and displays a modal overlay.
 * @param {HTMLElement} $el
 */
const showModal = ($el) => {
  pauseTimer();
  showEl($el);
};

/**
 * Builds the right-side control cluster with state sharing and turn controls.
 * @returns {HTMLElement}
 */
const makeRightControls = () => {
  $exportButton = makeEl('button', 'CONTROLS-button CONTROLS-button--export');
  $exportButton.title = 'Copy to clipboard';
  $exportButton.addEventListener('click', exportStateToClipboard, { passive: true });

  $importButton = makeEl('button', 'CONTROLS-button CONTROLS-button--import');
  $importButton.title = 'Load from clipboard';
  $importButton.addEventListener('click', importStateFromClipboard, { passive: true });

  const $stateButtons = makeEl('div', 'CONTROLS-state', makeEl('div', '', 'Progress:'), $exportButton, $importButton);

  const $pauseTimerButton = makeEl('button', 'CONTROLS-button CONTROLS-button--pause');
  $pauseTimerButton.title = 'Pause turn timer';
  $pauseTimerButton.addEventListener('click', pauseTimer, { passive: true });

  const $startTimerButton = makeEl('button', 'CONTROLS-button CONTROLS-button--play');
  $startTimerButton.title = 'Start turn timer';
  $startTimerButton.addEventListener('click', startTimer, { passive: true });

  $timer = makeEl(
    'div',
    'CONTROLS-timer CONTROLS-timer--paused',
    makeEl('div'),
    $pauseTimerButton,
    $startTimerButton,
  );
  hideEl($timer);
  resetTimer();

  $computerTurnButton = makeEl('button', 'CONTROLS-button', 'Computer Turn');
  $computerTurnButton.addEventListener('click', takeComputerTurn, { passive: true });

  $passTurnButton = makeEl('button', 'CONTROLS-button', 'Pass Turn');
  $passTurnButton.addEventListener('click', passTurn, { passive: true });

  return makeEl('section', 'CONTROLS CONTROLS--right', $stateButtons, $timer, $computerTurnButton, $passTurnButton);
};

/**
 * Copies the current serialized game state to the clipboard.
 */
const exportStateToClipboard = async () => {
  let successful = true;
  try {
    await navigator.clipboard.writeText(getState(true));
  } catch {
    successful = false;
  }
  $exportButton.classList.toggle('CONTROLS-button--success', successful);
  $exportButton.classList.toggle('CONTROLS-button--error', !successful);
};

/**
 * Loads a game state from the system clipboard when it is valid.
 */
const importStateFromClipboard = async () => {
  let successful = true;
  try {
    const stateText = await navigator.clipboard.readText();
    successful = setState(stateText, true);
  } catch {
    successful = false;
  }
  $importButton.classList.toggle('CONTROLS-button--success', successful);
  $importButton.classList.toggle('CONTROLS-button--error', !successful);
  justPasted = true;
};

/**
 * Pauses the countdown for the active turn.
 */
const pauseTimer = () => {
  if (!timerEnabled || isTimerPaused()) {
    return;
  }
  clearTimeout(timerId);
  turnTime++;
  $timer.classList.add('CONTROLS-timer--paused');
  renderTimer();
};

/**
 * Starts or resumes the active turn countdown.
 */
const startTimer = () => {
  if (!timerEnabled || !isTimerPaused()) {
    return;
  }
  $timer.classList.remove('CONTROLS-timer--paused');
  updateTimer();
};

/**
 * Resets the timer to the configured turn limit.
 */
const resetTimer = () => {
  turnTime = turnTimeLimit;
  clearTimeout(timerId);
  if (turnTime) {
    updateTimer();
  }
};

/**
 * Updates the timer and triggers a pass when time expires.
 */
const updateTimer = () => {
  if (!timerEnabled) {
    return;
  }
  if (!turnTime) {
    pauseTimer();
    passTurn();
    return;
  }
  renderTimer();
  if (isTimerPaused()) {
    return;
  }
  turnTime = bindNum(turnTime - 1, 0, TIMER_MAX);
  timerId = setTimeout(updateTimer, TICK_TIME);
};

/**
 * Renders the visible countdown text and keeps the timer state in sync with the board.
 */
const renderTimer = () => {
  turnTime = bindNum(turnTime, 0, turnTimeLimit);
  if (!timerEnabled || !turnTime || winningTeam) {
    hideEl($timer);
    return;
  }
  const $time = $timer.firstElementChild;
  if (!$time) {
    return;
  }
  const numMinutes = Math.floor(turnTime / 60);
  const numSeconds = turnTime % 60;
  let timeText = String(numSeconds);
  if (numMinutes) {
    timeText = `${numMinutes}:${timeText.padStart(2, '0')}`;
  }
  $time.innerText = `${isTimerPaused() ? 'Paused at' : 'Passing in'} ${timeText}`;
  showEl($timer);

  saveState();
};

/**
 * Checks whether the turn timer is currently paused.
 * @returns {boolean}
 */
const isTimerPaused = () => $timer.classList.contains('CONTROLS-timer--paused');

/**
 * Creates a generic modal overlay that can be shown or hidden.
 * @param {...Node} $children
 * @returns {HTMLElement}
 */
const makeOverlay = (...$children) => {
  const $backdrop = makeEl('div', 'OVERLAY-backdrop');
  const $closeButton = makeEl('div', 'OVERLAY-close-button');
  const $el = makeEl('section', 'OVERLAY', $backdrop, makeEl('div', 'OVERLAY-modal', $closeButton, ...$children));
  $backdrop.addEventListener('click', () => hideEl($el), { passive: true });
  $closeButton.addEventListener('click', () => hideEl($el), { passive: true });
  hideEl($el);
  return $el;
};

/**
 * Replaces the content inside an existing overlay without recreating the node.
 * @param {HTMLElement} $el
 * @param {...Node} $children
 * @returns {HTMLElement}
 */
const updateOverlay = ($el, ...$children) => {
  const $backdrop = makeEl('div', 'OVERLAY-backdrop');
  const $closeButton = makeEl('div', 'OVERLAY-close-button');
  $el.replaceChildren($backdrop, makeEl('div', 'OVERLAY-modal', $closeButton, ...$children));
  $backdrop.addEventListener('click', () => hideEl($el), { passive: true });
  $closeButton.addEventListener('click', () => hideEl($el), { passive: true });
  hideEl($el);
  return $el;
};

/**
 * Builds the game instructions overlay.
 * @returns {HTMLElement}
 */
const makeInstructions = () => {
  const $bookLink = makeEl('a', 'OVERLAY-link OVERLAY-link--italic', 'The Lasting Lands');
  $bookLink.href = 'https://cliffjonesjr.com/the-lasting-lands';
  $bookLink.target = '_blank';

  const $cliffLink = makeEl('a', 'OVERLAY-link', 'Cliff Jones Jr.');
  $cliffLink.href = 'https://ko-fi.com/cliff';
  $cliffLink.target = '_blank';

  const $noKingsLink = makeEl('a', 'OVERLAY-link', 'no kings');
  $noKingsLink.href = 'https://www.nokings.org/';
  $noKingsLink.target = '_blank';

  $instructions = makeOverlay(
    makeEl('header', 'OVERLAY-title', 'How to Play Ozghard Chess'),
    makeEl('div', 'OVERLAY-block', 'This game is based on ', $bookLink, ' by ', $cliffLink),
    makeEl('div', 'OVERLAY-block', 'Gameplay is very similar to standard chess, where the aim of each player is to capture an opponent’s king. In Ozghard, however, there is only a single ', makeEl('span', 'OVERLAY-text OVERLAY-text--central', 'Central'), ' king. So while the Central player attempts to keep the king alive to the end, all other players compete to see who can be the first to capture the king.'),
    makeEl('div', 'OVERLAY-block', 'You can also play with ', $noKingsLink, ' at all by disabling the Central player in Settings. In this case, your goal is to capture ', makeEl('em', 'OVERLAY-text OVERLAY-text--italic', 'all'), ' your opponents’ pieces.'),
    makeEl('div', 'OVERLAY-block', 'Pieces move by the same rules as in standard chess (indicated by highlighting potential moves when you select a piece), and captured pieces are worth the same point values:'),
    makeEl(
      'ul',
      'OVERLAY-list',
      makeEl('li', '', 'pawn (♙) = 1'),
      makeEl('li', '', 'knight (♘) = 3'),
      makeEl('li', '', 'bishop (♗) = 3'),
      makeEl('li', '', 'rook (♖) = 5'),
      makeEl('li', '', 'queen (♕) = 9'),
      makeEl('li', '', 'king (♔) = 100'),
    ),
    makeEl('div', 'OVERLAY-block', 'When starting a new game, one of the five players is selected at random to move first. This can either be a human player, or if you’d like the selected color to be played by the computer, click “Computer Turn” on their move.'),
    makeEl('div', 'OVERLAY-block', 'Unlike in standard chess, you may also choose “Pass Turn” anytime you’d like. This means that there is no checkmate or stalemate to end the game. If the king is unable to move, they simply pass and wait to be captured. If all five players pass in a row, the game ends in a draw.'),
    makeEl('div', 'OVERLAY-block', 'Ozghard strips away most of the special rules of standard chess. Castling is not possible, for example. And although pawns move in the same basic way, there is no ', makeEl('em', 'OVERLAY-text OVERLAY-text--italic', 'en passant'), ' rule, and promotion is always to queen. There are also no limits on the number or repetition of moves.'),
    makeEl('div', 'OVERLAY-block', 'You can save the exact state of your current game to your system clipboard using the up-arrow “Progress” button. To restore your game to that saved state at any point, hit the down-arrow “Progress” button. This means you can share your progress by pasting the copied game state into a message to a friend. To play a game with your friend remotely, you can take turns making a move, copying and sending progress, and then pasting in the received progress code. No accounts or sign-in needed.'),
    makeEl('div', 'OVERLAY-block', 'Have fun! ☻'),
  );
  return $instructions;
};

/**
 * Builds the settings overlay and keeps it synced to the current game preferences.
 * @returns {HTMLElement}
 */
const makeSettings = () => {
  const $showHintsCheckbox = makeEl('input');
  $showHintsCheckbox.type = 'checkbox';
  if (showingHints) {
    $showHintsCheckbox.checked = true;
  }
  $showHintsCheckbox.addEventListener('click', toggleShowHints, { passive: true });

  const $showDangerCheckbox = makeEl('input');
  $showDangerCheckbox.type = 'checkbox';
  if (showingDanger) {
    $showDangerCheckbox.checked = true;
  }
  $showDangerCheckbox.addEventListener('click', toggleShowDanger, { passive: true });

  const $rotatePiecesCheckbox = makeEl('input');
  $rotatePiecesCheckbox.type = 'checkbox';
  if (pieceRotationEnabled) {
    $rotatePiecesCheckbox.checked = true;
  }
  $rotatePiecesCheckbox.addEventListener('click', toggleRotatePieces, { passive: true });

  const $timerCheckbox = makeEl('input');
  $timerCheckbox.type = 'checkbox';
  if (timerEnabled) {
    $timerCheckbox.checked = true;
  }
  $timerCheckbox.addEventListener('click', toggleTimer, { passive: true });

  const $timerInput = makeEl('input');
  $timerInput.type = 'number';
  $timerInput.min = TIMER_MIN;
  $timerInput.max = TIMER_MAX;
  $timerInput.value = turnTimeLimit;
  $timerInput.addEventListener('change', ({ target: { value } }) => {
    const numValue = bindNum(value, TIMER_MIN, TIMER_MAX);
    turnTimeLimit = numValue;
    $timerInput.value = turnTimeLimit;
    renderTimer();
  }, { passive: true });

  $teamCheckboxes = TEAMS.map((team) => {
    const $el = makeEl('input');
    $el.type = 'checkbox';
    $el.checked = teams.includes(team);
    $el.addEventListener('click', () => toggleTeam(team), { passive: true });
    return $el;
  });
  const $teamToggles = TEAMS.map((team, teamNum) => makeEl(
    'label',
    `CONTROLS-toggle CONTROLS-toggle--${team}`,
    $teamCheckboxes[teamNum],
    capitalizeWord(team),
  ));

  const $children = [
    makeEl('header', 'OVERLAY-title', 'Game Settings'),
    makeEl('label', 'CONTROLS-toggle', $showHintsCheckbox, 'Highlight all possible moves'),
    makeEl('label', 'CONTROLS-toggle', $showDangerCheckbox, 'Indicate threatened pieces'),
    makeEl('label', 'CONTROLS-toggle', $rotatePiecesCheckbox, 'Rotate pieces to show their direction'),
    makeEl('div'),
    makeEl(
      'div',
      'CONTROLS-block',
      makeEl(
        'label',
        'CONTROLS-toggle',
        $timerCheckbox,
        'Limit turns to',
      ),
      makeEl(
        'label',
        'CONTROLS-input CONTROLS-input--timer',
        $timerInput,
        'seconds',
      ),
    ),
    makeEl('div'),
    makeEl('div', 'CONTROLS-block', 'Players:', ...$teamToggles),
  ];
  $settings = $settings ? updateOverlay($settings, ...$children) : makeOverlay(...$children);
  return $settings;
};

/**
 * Clamps a numeric value to a minimum and maximum range.
 * @param {number|string} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
const bindNum = (value, min, max) => Math.max(min, Math.min(Number(value || 0, 10), max));

/**
 * Scales the stage to fit the current browser viewport.
 */
const resizeStage = () => {
  const scale = Math.min(
    window.innerWidth / STAGE_SIZE,
    window.innerHeight / STAGE_SIZE
  );
  $stage.style.transform = `scale(${scale})`;
};

/**
 * Toggles display of all legal move highlights.
 */
const toggleShowHints = () => {
  showingHints = !showingHints;
  renderBoard();
};

/**
 * Toggles display of threatened-piece indicators.
 */
const toggleShowDanger = () => {
  showingDanger = !showingDanger;
  renderBoard();
};

/**
 * Toggles whether pieces rotate to match their directional facing.
 */
const toggleRotatePieces = () => {
  pieceRotationEnabled = !pieceRotationEnabled;
  renderBoard();
};

/**
 * Enables or disables the per-turn countdown timer.
 */
const toggleTimer = () => {
  timerEnabled = !timerEnabled;
  turnTime = timerEnabled ? turnTimeLimit : 0;
  renderTimer();
};

/**
 * Enables or disables a team and removes their pieces when deactivated.
 * @param {string} team
 */
const toggleTeam = (team) => {
  if (teams.includes(team)) {
    teams = teams.filter((thisTeam) => thisTeam !== team);
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        const team = getPieceTeam(board, [x, y]);
        if (team && !teams.includes(team)) {
          board[y][x] = '';
        }
      }
    }
    if (team === TEAMS[activeTeamNum]) {
      advanceTurn(true);
    }
    renderBoard();
  } else {
    teams.push(team);
    resetGame();
  }
  $teamCheckboxes.forEach(($el, teamNum) => $el.disabled = teams.includes(TEAMS[teamNum]) && teams.length <= 2);
};

/**
 * Starts the confirmation flow for beginning a fresh game.
 */
const askEndGame = () => {
  hideEl($newGameButton);
  const gameInProgress = !winningTeam && teams.some((team) => scores[team] !== savedScores[team]);
  if (gameInProgress) {
    showEl($endGameConfirmation);
  } else {
    askResetScores();
  }
};

/**
 * Handles the end-game confirmation choice.
 * @param {boolean} response
 */
const answerEndGame = (response) => {
  hideEl($endGameConfirmation);
  if (response) {
    askResetScores();
  } else {
    showEl($newGameButton);
  }
};

/**
 * Prompts to reset saved scores before starting a new match.
 */
const askResetScores = () => {
  const savedScoresExist = Object.values(savedScores).some((score) => score);
  if (savedScoresExist) {
    showEl($resetConfirmation);
  } else {
    showEl($newGameButton);
    resetGame();
  }
};

/**
 * Handles the score-reset confirmation response.
 * @param {boolean} response
 */
const answerResetScores = (response) => {
  hideEl($resetConfirmation);
  showEl($newGameButton);
  resetGame(response);
};

/**
 * Clears the in-flight confirmation dialogs and restores the new-game button.
 */
const abortNewGameConfirmation = () => {
  hideEl($endGameConfirmation);
  hideEl($resetConfirmation);
  showEl($newGameButton);
};

/**
 * Resets the board and optionally clears the running score ledger.
 * @param {boolean} [shouldResetScores=false]
 */
const resetGame = (shouldResetScores = false) => {
  if (shouldResetScores) {
    Object.keys(scores).forEach((key) => {
      scores[key] = 0;
    });
    savedScores = { ...scores };
  } else {
    scores = { ...savedScores };
  }
  turnNum = 1;
  roundNum = 1;
  activeTeamNum = TEAMS.indexOf(teams[getRandomItemNum(teams)]);
  selectedSquare = [];
  trail = null;
  passCount = 0;
  winningTeam = '';
  initBoard();
  renderBoard();
};

/**
 * Returns a random index from a list of choices.
 * @param {Array} list
 * @returns {number}
 */
const getRandomItemNum = (list) => getRandomNum(list.length - 1);

/**
 * Returns a random integer between 0 and max.
 * @param {number} max
 * @returns {number}
 */
const getRandomNum = (max) => Math.floor(Math.random() * (max + 1));

/**
 * Records a pass and advances the turn cycle.
 */
const passTurn = () => {
  trail = null;
  passCount++;
  advanceTurn();
};

/**
 * Advances the active team while tracking rounds, passes, and win conditions.
 * @param {boolean} [shouldSuspendCounts=false]
 */
const advanceTurn = (shouldSuspendCounts = false) => {
  abortNewGameConfirmation();
  selectedSquare = [];
  winningTeam = getWinningTeam();
  if (winningTeam) {
    if (winningTeam === CENTRAL || (winningTeam === TEAMS[activeTeamNum]) && !teams.includes(CENTRAL)) {
      scores[winningTeam] += PIECE_VALUES[KING];
    }
    activeTeamNum = -1;
    savedScores = { ...scores };
  } else {
    if (!shouldSuspendCounts) {
      turnNum++;
    }
    if (turnNum > TEAMS.length) {
      turnNum = 1;
      roundNum++;
    }
    activeTeamNum = getNextTeamNum(activeTeamNum);
    if (!countPieces(TEAMS[activeTeamNum])) {
      if (!shouldSuspendCounts) {
        passCount++;
      }
      advanceTurn(shouldSuspendCounts);
    }
  }
  renderBoard();
  resetTimer();
};

/**
 * Evaluates the current board to see whether a side has already won.
 * @returns {string}
 */
const getWinningTeam = () => {
  let winningTeam = '';
  if (passCount >= TEAMS.length) {
    winningTeam = DRAW;
  } else if (!getKingPosition(board)) {
    if (teams.includes(CENTRAL)) {
      winningTeam = TEAMS[activeTeamNum];
    } else {
      const survivingTeams = getSurvivingTeams();
      if (survivingTeams.length === 1) {
        winningTeam = survivingTeams[0];
      }
    }
  } else {
    const numPieces = countPieces();
    if (numPieces <= 2 || countPieces(CENTRAL) === numPieces) {
      winningTeam = CENTRAL;
    }
  }
  if (winningTeam) {
    savedScores = { ...scores };
  }
  return winningTeam;
};

/**
 * Moves the turn index forward by one team.
 * @param {number} teamNum
 * @returns {number}
 */
const getNextTeamNum = (teamNum) => wrapItemNum(teamNum + 1, TEAMS.length);

/**
 * Wraps an index around a circular range.
 * @param {number} itemNum
 * @param {number} numItems
 * @returns {number}
 */
const wrapItemNum = (itemNum, numItems) => {
  itemNum = itemNum % numItems;
  if (itemNum < 0) {
    itemNum += numItems;
  }
  return itemNum;
};

/**
 * Lists the teams that still have at least one piece on the board.
 * @returns {string[]}
 */
const getSurvivingTeams = () => {
  const survivingTeams = new Set();
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const team = getPieceTeam(board, [x, y]);
      if (team) {
        survivingTeams.add(team);
      }
    }
  }
  return [...survivingTeams];
};

/**
 * Counts pieces belonging to a team or to all active teams.
 * @param {string} [team='']
 * @returns {number}
 */
const countPieces = (team = '') => {
  let numPieces = 0;
  board.forEach((row) => {
    row.forEach((piece) => {
      if (
        (team && hasWord(piece, team)) ||
        (!team && teams.some((thisTeam) => hasWord(piece, thisTeam)))
       ) {
        numPieces++;
      }
    });
  });
  return numPieces;
};

/**
 * Executes the best available move for the computer-controlled team.
 */
const takeComputerTurn = () => {
  const move = getBestMove();
  if (!move) {
    passTurn();
    return;
  }
  selectedSquare = move.origin;
  movePiece(move.target);
};

/**
 * Creates a fresh board layout based on the active teams and starting positions.
 */
const initBoard = () => {
  const shouldIncludeSouth = teams.includes(SOUTH);
  const shouldIncludeWest = teams.includes(WEST);
  const shouldIncludeNorth = teams.includes(NORTH);
  const shouldIncludeEast = teams.includes(EAST);
  const shouldIncludeCentral = teams.includes(CENTRAL);
  board = Array.from({ length: BOARD_SIZE }, (_, y) =>
    Array.from({ length: BOARD_SIZE }, (_, x) => {
      if (isDeadSquare([x, y])) {
        return '';
      }
      let piece = '';
      if (shouldIncludeSouth && y >= 15) {
        piece = SOUTH;
      } else if (shouldIncludeWest && x <= 1) {
        piece = WEST;
      } else if (shouldIncludeNorth && y <= 1) {
        piece = NORTH;
      } else if (shouldIncludeEast && x >= 15) {
        piece = EAST;
      } else if (shouldIncludeCentral && CENTRAL_SQUARES[y]?.includes(x)) {
        piece = CENTRAL;
      }
      if (piece) {
        if (KING_SQUARES[y]?.includes(x)) {
          piece = `${piece} ${KING}`;
        } else if (QUEEN_SQUARES[y]?.includes(x)) {
          piece = `${piece} ${QUEEN}`;
        } else if (ROOK_SQUARES[y]?.includes(x)) {
          piece = `${piece} ${ROOK}`;
        } else if (BISHOP_SQUARES[y]?.includes(x)) {
          piece = `${piece} ${BISHOP}`;
        } else if (KNIGHT_SQUARES[y]?.includes(x)) {
          piece = `${piece} ${KNIGHT}`;
        } else {
          piece = `${piece} ${PAWN}`;
        }
      }
      return piece;
    })
  );
};

/**
 * Checks whether a coordinate is one of the board's impassable dead squares.
 * @param {number[]} position
 * @returns {boolean}
 */
const isDeadSquare = ([x, y]) => DEAD_SQUARES[y]?.includes(x) ?? false;

/**
 * Re-renders the board, score panel, and active UI state based on the current game status.
 */
const renderBoard = () => {
  const scoresHtml = [`<div class="SCORES-line">Round: ${roundNum}</div>`];
  Object.entries(scores).forEach(([team, value]) => {
    if (!teams.includes(team)) {
      return;
    }
    let indicator = '';
    if (winningTeam) {
      if (team === winningTeam) {
        indicator = '★ ';
      }
    } else if (team === TEAMS[activeTeamNum]) {
      indicator = '▸ ';
    }
    scoresHtml.push(
      `<div class="SCORES-line SCORES-line--${team}">${indicator}${capitalizeWord(team)}: ${value}</div>`,
    );
  });
  $scores.innerHTML = scoresHtml.join('');

  // Add temporary target/hint markers to certain squares to highlight them on this render.
  if (selectedSquare.length) {
    const moves = getMovesForPiece(board, selectedSquare);
    moves.forEach(({ target: [x, y] }) => {
      board[y][x] = `${board[y][x]} target`;
    });
  } else if (showingHints) {
    const moves = getMovesForTeam(board);
    moves.forEach(({ target: [x, y] }) => {
      board[y][x] = `${board[y][x]} hint`;
    });
  }

  // Optionally indicate when any of the active team's pieces are in danger.
  if (showingDanger) {
    getActiveSquares().forEach(([x, y]) => {
      if (isInDanger(board, [x, y])) {
        board[y][x] = `${board[y][x]} danger`;
      }
    });
  }

  // If a piece has just been captured, indicate its color at the end of the trail.
  if (trail?.capture && teams.includes(trail.capture)) {
    const [x, y] = trail.target;
    board[y][x] = `${board[y][x]} capture`;
  }

  $board.innerHTML = '';
  board.forEach((row, y) => {
    row.forEach((piece, x) => {
      const $square = makeEl('div');
      if (!isDeadSquare([x, y])) {
        $square.className = `BOARD-square ${x % 2 === y % 2 ? 'BOARD-square--dark' : 'BOARD-square--light'}`;
        const squareIsActive = hasWord(piece, TEAMS[activeTeamNum]);
        const squareIsTarget = hasWord(piece, 'target');
        const squareIsHint = hasWord(piece, 'hint');
        const squareInDanger = hasWord(piece, 'danger');
        const squareHasCapture = hasWord(piece, 'capture');
        if (squareIsActive || squareIsTarget || squareIsHint || squareInDanger || squareHasCapture) {
          if (squareIsActive || squareIsTarget || squareIsHint) {
            $square.classList.add(`BOARD-square--${TEAMS[activeTeamNum]}`);
            if (squareIsActive) {
              $square.classList.add('BOARD-square--active');
            } else if (squareIsTarget) {
              $square.classList.add('BOARD-square--target');
            } else {
              $square.classList.add('BOARD-square--hint');
            }
            if (isSelectedSquare([x, y])) {
              $square.classList.add('BOARD-square--selected');
            }
          }
          if (squareInDanger) {
            $square.classList.add('BOARD-square--danger');
          }
          if (squareHasCapture) {
            $square.classList.add('BOARD-capture');
            $square.classList.add(`BOARD-capture--${trail.capture}`);
          }

          // Remove any target/etc. markers since those are only for temporary highlighting.
          if (squareIsTarget || squareIsHint || squareInDanger || squareHasCapture) {
            board[y][x] = piece.split(' ')
              .filter((word) => !['target', 'hint', 'danger', 'capture'].includes(word))
              .join(' ');
          }
        }
        if (board[y][x]) {
          $square.append(
            makeEl('div', `BOARD-piece ${board[y][x].split(' ').map((word) => `BOARD-piece--${word}`).join(' ')}`)
          );
        }
        $square.addEventListener('pointerdown', () => handlePointerDown([x, y]), { passive: true });
        $square.addEventListener('pointerup', () => handlePointerUp([x, y]), { passive: true });
      }
      $board.append($square);
    });
  });
  $board.classList.toggle('BOARD--rotate-pieces', pieceRotationEnabled);
  showTrail();

  // If the game has ended, adjust the controls accordingly.
  $board.classList.toggle('BOARD--disabled', !!winningTeam);
  $computerTurnButton.disabled = !!winningTeam;
  $passTurnButton.disabled = !!winningTeam;
  let className = 'CONTROLS-button';
  if (TEAMS[activeTeamNum]) {
    className = `${className} ${className}--${TEAMS[activeTeamNum]}`;
  }
  $computerTurnButton.className = className;
  $passTurnButton.className = className;

  saveState();
};

/**
 * Capitalizes the first letter of a team or piece name.
 * @param {string} word
 * @returns {string}
 */
const capitalizeWord = (word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`;

/**
 * Compares a coordinate with the currently selected square.
 * @param {number[]} position
 * @returns {boolean}
 */
const isSelectedSquare = ([x, y]) => selectedSquare[0] === x && selectedSquare[1] === y;

/**
 * Selects or deselects a square when the user presses on a friendly piece.
 * @param {number[]} position
 */
const handlePointerDown = ([x, y]) => {
  if (isActiveTeam(board, [x, y])) {
    selectedSquare = isSelectedSquare([x, y]) ? [] : [x, y];
    renderBoard();
  }
};

/**
 * Checks whether the piece at a coordinate belongs to the active team.
 * @param {string[][]} thisBoard
 * @param {number[]} position
 * @returns {boolean}
 */
const isActiveTeam = (thisBoard, [x, y]) => hasWord(thisBoard[y][x], TEAMS[activeTeamNum]);

/**
 * Executes a move when the player releases over a valid destination square.
 * @param {number[]} position
 */
const handlePointerUp = ([x, y]) => {
  if (getPieceTeam(board, [x, y]) === TEAMS[activeTeamNum]) {
    return;
  }
  if (selectedSquare.length) {
    movePiece([x, y]);
  }
};

/**
 * Draws the last-move trail marker on the board.
 */
const showTrail = () => {
  if (!trail || !teams.includes(trail.team)) {
    hideEl($trail);
    return;
  }
  showEl($trail);
  $trail.className = `TRAIL TRAIL--${trail.team}`;
  const [x, y] = trail.origin;
  const [targetX, targetY] = trail.target;
  $trail.style.setProperty('--x', STAGE_PADDING + ((x + 0.5) * SQUARE_SIZE));
  $trail.style.setProperty('--y', STAGE_PADDING + ((y + 0.5) * SQUARE_SIZE) - (TRAIL_THICKNESS / 2));
  $trail.style.setProperty('--target-x', STAGE_PADDING + ((targetX + 0.5) * SQUARE_SIZE));
  $trail.style.setProperty('--target-y', STAGE_PADDING + ((targetY + 0.5) * SQUARE_SIZE) - (TRAIL_THICKNESS / 2));
};

/**
 * Moves the currently selected piece to a target square and resolves captures.
 * @param {number[]} target
 */
const movePiece = ([targetX, targetY]) => {
  passCount = 0;
  const [x, y] = selectedSquare;
  const targetTeam = getPieceTeam(board, [targetX, targetY]);
  if (targetTeam) {
    const targetValue = getPieceValue(board, [targetX, targetY]);
    scores[targetTeam] -= targetValue;
    scores[TEAMS[activeTeamNum]] += targetValue;
  }
  board[targetY][targetX] = board[y][x];
  board[y][x] = '';
  selectedSquare = [];
  trail = { team: TEAMS[activeTeamNum], origin: [x, y], target: [targetX, targetY], capture: targetTeam };
  if (canPawnPromote([targetX, targetY])) {
    board[targetY][targetX] = board[targetY][targetX].replace(PAWN, QUEEN);
  }
  advanceTurn();
};

/**
 * Reads the team name stored on a board cell.
 * @param {string[][]} thisBoard
 * @param {number[]} position
 * @returns {string}
 */
const getPieceTeam = (thisBoard, [x, y]) => {
  const team = thisBoard[y][x]?.split(' ')[0] ?? '';
  return TEAMS.includes(team) ? team : '';
};

/**
 * Returns the point value of a piece on the board.
 * @param {string[][]} thisBoard
 * @param {number[]} position
 * @returns {number}
 */
const getPieceValue = (thisBoard, [x, y]) => PIECE_VALUES[getPieceType(thisBoard, [x, y])] ?? 0;

/**
 * Reads the type of a piece stored in a board cell.
 * @param {string[][]} thisBoard
 * @param {number[]} position
 * @returns {string}
 */
const getPieceType = (thisBoard, [x, y]) => {
  const pieceType = thisBoard[y][x]?.split(' ')[1] ?? '';
  return PIECE_TYPES.includes(pieceType) ? pieceType : '';
};

/**
 * Chooses the best available move for the active computer-controlled team.
 * @returns {{origin:number[], target:number[]}|null}
 */
const getBestMove = () => {
  let moves = getMovesForTeam(board);

  // Use minimax to find the highest scoring moves, avoiding duplicates.
  let bestScore = -Infinity;
  let bestMoveSet = new Set();
  for (const move of moves) {
    const nextBoard = testMove(board, move);
    for (let activeOffset = 1; activeOffset < TEAMS.length; activeOffset++) {
      const score = getMinimax(nextBoard, AI_DEPTH, activeOffset);
      if (score > bestScore) {
        bestScore = score;
        bestMoveSet = new Set([getMoveString(move)]);
      } else if (score === bestScore) {
        bestMoveSet.add(getMoveString(move));
      }
    }
  }
  let bestMoves = [...bestMoveSet].map((moveString) => parseMoveString(moveString));

  // All things being equal, prefer to move a pawn or develop from the back row.
  if (TEAMS[activeTeamNum] !== CENTRAL) {
    const developingMoves = bestMoves.filter(
      (move) => getPieceType(board, move.origin) === PAWN ||
      isOnBackRow(TEAMS[activeTeamNum], move.origin)
    );
    if (developingMoves.length) {
      bestMoves = developingMoves;
    }
  }

  return getRandomItem(bestMoves);
};

/**
 * Converts a move object into a compact lookup string.
 * @param {{origin:number[], target:number[]}} move
 * @returns {string}
 */
const getMoveString = (move) => `${move.origin[0]},${move.origin[1]},${move.target[0]},${move.target[1]}`;

/**
 * Converts a serialized move string back into a move object.
 * @param {string} moveString
 * @returns {{origin:number[], target:number[]}}
 */
const parseMoveString = (moveString) => {
  const moveItems = moveString.split(',');
  return {
    origin: [Number(moveItems[0]), Number(moveItems[1])],
    target: [Number(moveItems[2]), Number(moveItems[3])],
  };
};

/**
 * Finds the current king position on a board snapshot.
 * @param {string[][]} thisBoard
 * @returns {number[]|null}
 */
const getKingPosition = (thisBoard) => {
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (hasWord(thisBoard[y][x], KING)) {
        return [x, y];
      }
    }
  }
  return null;
};

/**
 * Checks whether a piece began on the far edge of its home side.
 * @param {string} team
 * @param {number[]} position
 * @returns {boolean}
 */
const isOnBackRow = (team, [x, y]) => (
  (team === WEST && x === 0) ||
  (team === EAST && x === 16) ||
  (team === NORTH && y === 0) ||
  (team === SOUTH && y === 16)
);

/**
 * Picks a random value from a list or returns null when empty.
 * @param {Array} list
 * @returns {*|null}
 */
const getRandomItem = (list) => list[Math.floor(Math.random() * list.length)] ?? null;

/**
 * Collects every legal move available to a team on a board snapshot.
 * @param {string[][]} thisBoard
 * @param {number} [activeOffset=0]
 * @returns {Array<{origin:number[], target:number[]}>}
 */
const getMovesForTeam = (thisBoard, activeOffset = 0) => {
  const moves = [];
  const movingTeamNum = wrapItemNum(activeTeamNum + activeOffset, TEAMS.length);
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (getPieceTeam(thisBoard, [x, y]) !== TEAMS[movingTeamNum]) {
        continue;
      }
      moves.push(...getMovesForPiece(thisBoard, [x, y]));
    }
  }
  return moves;
};

/**
 * Returns the legal moves for a single piece at a coordinate.
 * @param {string[][]} thisBoard
 * @param {number[]} position
 * @returns {Array<{origin:number[], target:number[]}>}
 */
const getMovesForPiece = (thisBoard, [x, y]) => {
  let moves = [];
  const pieceType = getPieceType(thisBoard, [x, y]);
  if (pieceType === PAWN) {
    moves = getPawnMoves(thisBoard, [x, y]);
  } else if (pieceType === KNIGHT) {
    moves = getKnightMoves(thisBoard, [x, y]);
  } else if (pieceType === BISHOP) {
    moves = getSlidingMoves(thisBoard, [x, y], BISHOP_DELTAS);
  } else if (pieceType === ROOK) {
    moves = getSlidingMoves(thisBoard, [x, y], ROOK_DELTAS);
  } else if (pieceType === QUEEN) {
    moves = getSlidingMoves(thisBoard, [x, y], QUEEN_DELTAS);
  } else if (pieceType === KING) {
    moves = getKingMoves(thisBoard, [x, y]);
  }

  // Don't allow the Central team to leave the king in check.
  if (TEAMS[activeTeamNum] === CENTRAL && getPieceTeam(thisBoard, [x, y]) === CENTRAL) {
    moves = moves.filter((move) => {
      const newBoard = testMove(thisBoard, move);
      const kingPosition = getKingPosition(newBoard);
      return kingPosition ? !isInDanger(newBoard, kingPosition) : true;
    });
  }

  return moves;
};

/**
 * Computes legal pawn motions, including two-step opening pushes and captures.
 * @param {string[][]} thisBoard
 * @param {number[]} position
 * @returns {Array<{origin:number[], target:number[]}>}
 */
const getPawnMoves = (thisBoard, [x, y]) => {
  const moves = [];
  const team = getPieceTeam(thisBoard, [x, y]);
  const [xDelta, yDelta] = getPawnDeltas(thisBoard, [x, y]);
  let forwardX = x + xDelta;
  let forwardY = y + yDelta;
  const freeAhead = isInsideBoard([forwardX, forwardY]) && !hasPiece(thisBoard, [forwardX, forwardY]);
  if (freeAhead) {
    moves.push({ origin: [x, y], target: [forwardX, forwardY] });
  }

  // Allow pawns to advance two spaces on the first move.
  const onStartingRow = (
    (team === WEST && x === 1) ||
    (team === EAST && x === 15) ||
    (team === NORTH && y === 1) ||
    (team === SOUTH && y === 15)
  );
  if (onStartingRow && freeAhead) {
    forwardX = x + (xDelta * 2);
    forwardY = y + (yDelta * 2);
    if (!hasPiece(thisBoard, [forwardX, forwardY])) {
      moves.push({ origin: [x, y], target: [forwardX, forwardY] });
    }
  }

  // Allow pawns to capture opponents diagonally.
  for (const offset of [-1, 1]) {
    const targetX = xDelta ? x + xDelta : x + offset;
    const targetY = yDelta ? y + yDelta : y + offset;
    if (!isInsideBoard([targetX, targetY])) {
      continue;
    }
    const move = { origin: [x, y], target: [targetX, targetY] };
    if (isOpponent(thisBoard, move)) {
      moves.push(move);
    }
  }

  return moves;
};

/**
 * Returns the forward direction for a pawn based on its team.
 * @param {string[][]} thisBoard
 * @param {number[]} position
 * @returns {number[]}
 */
const getPawnDeltas = (thisBoard, [x, y]) => {
  const team = getPieceTeam(thisBoard, [x, y]);
  let xDelta = 0;
  if (team === WEST) {
    xDelta = 1;
  } else if (team === EAST) {
    xDelta = -1;
  }
  let yDelta = 0;
  if (team === NORTH) {
    yDelta = 1;
  } else if (team === SOUTH) {
    yDelta = -1;
  }
  return [xDelta, yDelta];
};

/**
 * Determines whether a coordinate stays within the live board area.
 * @param {number[]} position
 * @returns {boolean}
 */
const isInsideBoard = ([x, y]) =>
  x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE && !isDeadSquare([x, y]);

/**
 * Checks whether two pieces belong to opposing teams.
 * @param {string[][]} thisBoard
 * @param {{origin:number[], target:number[]}} move
 * @returns {boolean}
 */
const isOpponent = (thisBoard, { origin, target }) => {
  const teamA = getPieceTeam(thisBoard, origin);
  const teamB = getPieceTeam(thisBoard, target);
  return teamA && teamB && teamA !== teamB;
};

/**
 * Checks whether a square contains any piece.
 * @param {string[][]} thisBoard
 * @param {number[]} position
 * @returns {boolean}
 */
const hasPiece = (thisBoard, [x, y]) => !!getPieceTeam(thisBoard, [x, y]);

/**
 * Computes L-shaped knight movements.
 * @param {string[][]} thisBoard
 * @param {number[]} position
 * @returns {Array<{origin:number[], target:number[]}>}
 */
const getKnightMoves = (thisBoard, [x, y]) => {
  const moves = [];
  for (const [xOffset, yOffset] of KNIGHT_OFFSETS) {
    const targetX = x + xOffset;
    const targetY = y + yOffset;
    if (!isInsideBoard([targetX, targetY])) {
      continue;
    }
    const move = { origin: [x, y], target: [targetX, targetY] };
    if (
      !hasPiece(thisBoard, [targetX, targetY]) ||
      isOpponent(thisBoard, move)
    ) {
      moves.push(move);
    }
  }
  return moves;
};

/**
 * Computes sliding-piece movement along a set of directional deltas.
 * @param {string[][]} thisBoard
 * @param {number[]} position
 * @param {number[][]} deltas
 * @returns {Array<{origin:number[], target:number[]}>}
 */
const getSlidingMoves = (thisBoard, [x, y], deltas) => {
  const moves = [];
  for (let i = 0; i < deltas.length; i++) {
    const [xDelta, yDelta] = deltas[i];
    let currentX = x + xDelta;
    let currentY = y + yDelta;
    while (isInsideBoard([currentX, currentY])) {
      const move = { origin: [x, y], target: [currentX, currentY] };
      if (hasPiece(thisBoard, [currentX, currentY])) {
        if (isOpponent(thisBoard, move)) {
          moves.push(move);
        }
        break;
      }
      moves.push(move);
      currentX += xDelta;
      currentY += yDelta;
    }
  }
  return moves;
};

/**
 * Computes the king's one-square movements.
 * @param {string[][]} thisBoard
 * @param {number[]} position
 * @returns {Array<{origin:number[], target:number[]}>}
 */
const getKingMoves = (thisBoard, [x, y]) => {
  const moves = [];
  for (let yOffset = -1; yOffset <= 1; yOffset++) {
    for (let xOffset = -1; xOffset <= 1; xOffset++) {
      if (xOffset === 0 && yOffset === 0) {
        continue;
      }
      const targetX = x + xOffset;
      const targetY = y + yOffset;
      if (!isInsideBoard([targetX, targetY])) {
        continue;
      }
      const move = { origin: [x, y], target: [targetX, targetY] };
      if (!hasPiece(thisBoard, [targetX, targetY]) || isOpponent(thisBoard, move)) {
        moves.push(move);
      }
    }
  }
  return moves;
};

/**
 * Checks whether a square is currently under attack by any enemy piece.
 * @param {string[][]} thisBoard
 * @param {number[]} position
 * @returns {boolean}
 */
const isInDanger = (thisBoard, [x, y]) => {
  const team = getPieceTeam(thisBoard, [x, y]);
  if (team !== TEAMS[activeTeamNum]) {
    return false;
  }

  // Step through the opponent teams' possible moves to see if the specified square is a target.
  const moves = [];
  for (let teamOffset = 1; teamOffset < TEAMS.length; teamOffset++) {
    moves.push(...getMovesForTeam(thisBoard, teamOffset));
  }
  return moves.some(({ target: [targetX, targetY] }) => targetX === x && targetY === y);
};

/**
 * Applies a move to a board snapshot without mutating the original board.
 * @param {string[][]} thisBoard
 * @param {{origin:number[], target:number[]}} move
 * @returns {string[][]}
 */
const testMove = (thisBoard, move) => {
  const newBoard = thisBoard.map((row) => [...row]);
  const [x, y] = move.origin;
  const [targetX, targetY] = move.target;
  newBoard[targetY][targetX] = newBoard[y][x];
  newBoard[y][x] = '';
  return newBoard;
};

/**
 * Runs a shallow minimax search to score the current move tree.
 * @param {string[][]} thisBoard
 * @param {number} depth
 * @param {number} activeOffset
 * @returns {number}
 */
const getMinimax = (thisBoard, depth, activeOffset) => {
  if (depth <= 0) {
    return evaluateBoard(thisBoard);
  }
  const moves = getMovesForTeam(thisBoard, activeOffset);
  if (!moves.length) {
    return evaluateBoard(thisBoard);
  }
  if (activeOffset === 0) {
    let bestScore = -Infinity;
    for (let i = 0; i < moves.length; i++) {
      const nextBoard = testMove(thisBoard, moves[i]);
      for (let offset = 1; offset < TEAMS.length; offset++) {
        bestScore = Math.max(bestScore, getMinimax(nextBoard, depth - 1, offset));
      }
    }
    return bestScore;
  }
  let bestScore = Infinity;
  for (let i = 0; i < moves.length; i++) {
    const nextBoard = testMove(thisBoard, moves[i]);
    bestScore = Math.min(bestScore, getMinimax(nextBoard, depth - 1, 0));
  }
  return bestScore;
};

/**
 * Gives a board snapshot a lightweight material score for AI evaluation.
 * @param {string[][]} thisBoard
 * @returns {number}
 */
const evaluateBoard = (thisBoard) => {
  let score = 0;
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (!hasPiece(thisBoard, [x, y])) {
        continue;
      }
      const value = getPieceValue(thisBoard, [x, y]);
      score += isActiveTeam(thisBoard, [x, y]) ? value : -value;
    }
  }
  return score;
};

/**
 * Checks whether a pawn has reached the far edge of the board and should promote.
 * @param {number[]} position
 * @returns {boolean}
 */
const canPawnPromote = ([x, y]) => {
  if (getPieceType(board, [x, y]) !== PAWN) {
    return false;
  }
  const [xDelta, yDelta] = getPawnDeltas(board, [x, y]);
  return !isInsideBoard([x + xDelta, y + yDelta]);
};

/**
 * Lists the squares currently occupied by the active team.
 * @returns {number[][]}
 */
const getActiveSquares = () => {
  const activeSquares = [];
  board.forEach((row, y) => {
    row.forEach((piece, x) => {
      if (hasWord(piece, TEAMS[activeTeamNum])) {
        activeSquares.push([x, y]);
      }
    });
  });
  return activeSquares;
};

/**
 * Determines whether a space-delimited text value includes the given word.
 * @param {string} text
 * @param {string} word
 * @returns {boolean}
 */
const hasWord = (text, word) => text?.split(' ')?.some((thisWord) => thisWord === word) ?? false;

// Initialize the game, either loading saved state from local storage or starting a new game.
initStage();
if (!loadState()) {
  resetGame();
}
