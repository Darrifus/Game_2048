const ROWS = 4;
const COLS = 4;
const STORAGE_KEY_STATE = '2048_state';
const STORAGE_KEY_LEADER = '2048_leaderboard';
const MAX_UNDO = 20;
const MAX_LEADERS = 10;

const boardEl = document.getElementById('board') || createBoard();
const scoreEl = document.getElementById('score') || createScore();
const controlsEl = document.getElementById('controls') || createControlsContainer();
const mobileControlsEl = document.getElementById('mobile-controls') || createMobileControls();
const leaderboardModal = document.getElementById('leaderboard-modal') || createLeaderboardModal();
const gameOverModal = document.getElementById('gameover-modal') || createGameOverModal();

let board = createEmptyBoard();
let score = 0;
let isGameOver = false;
let undoStack = [];
let canUndo = true;
let touchStartX = 0, touchStartY = 0;

window.addEventListener('load', init);

function init() {
  buildGrid();
  attachControls();
  loadStateOrNew();
  renderAll();
  attachInputHandlers();
  updateMobileControlsVisibility();
  window.addEventListener('resize', updateMobileControlsVisibility);
}

function createBoard() {
  const el = document.createElement('div');
  el.id = 'board';
  document.body.appendChild(el);
  return el;
}

function createScore() {
  const h2 = document.createElement('h2');
  h2.textContent = 'Счёт: ';
  const span = document.createElement('span');
  span.id = 'score';
  span.textContent = '0';
  h2.appendChild(span);
  document.body.insertBefore(h2, boardEl);
  return span;
}

function createControlsContainer() {
  const div = document.createElement('div');
  div.id = 'controls';
  document.body.appendChild(div);
  return div;
}

function createLeaderboardModal() {
  const el = document.createElement('div');
  el.id = 'leaderboard-modal';
  el.classList.add('modal');
  el.setAttribute('aria-hidden', 'true');
  document.body.appendChild(el);
  return el;
}

function createGameOverModal() {
  const el = document.createElement('div');
  el.id = 'gameover-modal';
  el.classList.add('modal');
  el.setAttribute('aria-hidden', 'true');
  document.body.appendChild(el);
  return el;
}

function buildGrid() {
  clearElement(boardEl);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const tile = document.createElement('div');
      tile.id = `${r}-${c}`;
      tile.classList.add('tile');
      boardEl.appendChild(tile);
    }
  }
}

function createEmptyBoard() {
  const arr = [];
  for (let r = 0; r < ROWS; r++) {
    arr.push(new Array(COLS).fill(0));
  }
  return arr;
}

function clearElement(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function copyBoard(b) {
  return b.map(row => row.slice());
}

function saveState() {
  const state = { board, score, isGameOver, undoStack };
  localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(state));
}

function loadStateOrNew() {
  const raw = localStorage.getItem(STORAGE_KEY_STATE);
  if (raw) {
    try {
      const s = JSON.parse(raw);
      if (s && s.board) {
        board = s.board;
        score = s.score;
        isGameOver = s.isGameOver;
        undoStack = s.undoStack || [];
        renderAll();
        // Проверяем статус игры
        if (isGameOver) {
          canUndo = false;
          showGameOverModal(); // показываем модалку Game Over
        } else {
          canUndo = true;
          hideModal(gameOverModal); // скрываем модалки
          hideModal(leaderboardModal);
        }
        return;
      }
    } catch (e) {
      console.error('Ошибка загрузки состояния:', e);
    }
  }
  newGame();
}


function saveLeaderboardEntry(name, sc) {
  const leaders = loadLeaderboard();
  leaders.push({ name: name || 'Без имени', score: sc, date: new Date().toISOString() });
  leaders.sort((a, b) => b.score - a.score);
  localStorage.setItem(STORAGE_KEY_LEADER, JSON.stringify(leaders.slice(0, MAX_LEADERS)));
}

function loadLeaderboard() {
  const raw = localStorage.getItem(STORAGE_KEY_LEADER);
  return raw ? JSON.parse(raw) : [];
}


function renderAll() {
  renderBoard();
  scoreEl.textContent = score;
}

function renderBoard() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const tile = document.getElementById(`${r}-${c}`);
      updateTile(tile, board[r][c]);
    }
  }
}

function updateTile(tile, num) {
  tile.textContent = '';
  tile.className = 'tile';
  if (num > 0) {
    tile.textContent = num;
    tile.classList.add(num <= 4096 ? `x${num}` : 'x8192');
  } else {
    tile.classList.add('empty');
  }
}

function spawnRandomTile() {
  const empty = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c] === 0) empty.push([r, c]);
  if (!empty.length) return false;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  board[r][c] = Math.random() < 0.9 ? 2 : 4;
  return true;
}

function canMove() {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] === 0) return true;
      if (c < COLS - 1 && board[r][c] === board[r][c + 1]) return true;
      if (r < ROWS - 1 && board[r][c] === board[r + 1][c]) return true;
    }
  return false;
}

function slideRow(row) {
  const f = row.filter(x => x !== 0);
  const newRow = [];
  let gain = 0;
  for (let i = 0; i < f.length; i++) {
    if (f[i] === f[i + 1]) {
      const v = f[i] * 2;
      newRow.push(v);
      gain += v;
      i++;
    } else {
      newRow.push(f[i]);
    }
  }
  while (newRow.length < COLS) newRow.push(0);
  return { newRow, gain };
}

function pushUndo() {
  if (undoStack.length >= MAX_UNDO) undoStack.shift();
  undoStack.push({ board: copyBoard(board), score });
}

function moveLeft() {
  if (isGameOver) return;
  const before = copyBoard(board);
  pushUndo();
  let moved = false;
  for (let r = 0; r < ROWS; r++) {
    const { newRow, gain } = slideRow(board[r]);
    if (!arrayEquals(newRow, board[r])) moved = true;
    board[r] = newRow;
    score += gain;
  }
  if (moved) afterMove();
  else undoStack.pop();
}

function moveRight() {
  if (isGameOver) return;
  const before = copyBoard(board);
  pushUndo();
  let moved = false;
  for (let r = 0; r < ROWS; r++) {
    const rev = board[r].slice().reverse();
    const { newRow, gain } = slideRow(rev);
    const final = newRow.reverse();
    if (!arrayEquals(final, board[r])) moved = true;
    board[r] = final;
    score += gain;
  }
  if (moved) afterMove();
  else undoStack.pop();
}

function moveUp() {
  if (isGameOver) return;
  const before = copyBoard(board);
  pushUndo();
  let moved = false;
  for (let c = 0; c < COLS; c++) {
    const col = [];
    for (let r = 0; r < ROWS; r++) col.push(board[r][c]);
    const { newRow, gain } = slideRow(col);
    for (let r = 0; r < ROWS; r++) board[r][c] = newRow[r];
    score += gain;
  }
  if (!arrayEquals(before, board)) moved = true;
  if (moved) afterMove();
  else undoStack.pop();
}

function moveDown() {
  if (isGameOver) return;
  const before = copyBoard(board);
  pushUndo();
  let moved = false;
  for (let c = 0; c < COLS; c++) {
    const col = [];
    for (let r = 0; r < ROWS; r++) col.push(board[r][c]);
    const rev = col.reverse();
    const { newRow, gain } = slideRow(rev);
    const out = newRow.reverse();
    for (let r = 0; r < ROWS; r++) board[r][c] = out[r];
    score += gain;
  }
  if (!arrayEquals(before, board)) moved = true;
  if (moved) afterMove();
  else undoStack.pop();
}

function arrayEquals(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function afterMove() {
  spawnRandomTile();
  renderAll();
  saveState();
  if (!canMove()) gameOver();
}

function undo() {
  if (!canUndo || undoStack.length === 0) return;
  const prev = undoStack.pop();
  board = copyBoard(prev.board);
  score = prev.score;
  renderAll();
  saveState();
}

function gameOver() {
  isGameOver = true;
  canUndo = false;
  showGameOverModal();
  saveState();
}

function attachControls() {
  clearElement(controlsEl);
  const restart = createButton('Начать заново', newGame);
  const undoBtn = createButton('Отмена хода', undo);
  const lb = createButton('Лидерборд', showLeaderboardModal);
  const cont = createButton('Продолжить', () => { loadStateOrNew(); renderAll(); });
  controlsEl.append(restart, undoBtn, lb, cont);
}

function createButton(text, onClick) {
  const btn = document.createElement('button');
  btn.textContent = text;
  btn.addEventListener('click', onClick);
  return btn;
}

function showGameOverModal() {
  clearElement(gameOverModal);
  const wrap = document.createElement('div');
  wrap.className = 'modal-content';

  const t = document.createElement('h3');
  t.textContent = 'Игра окончена';

  const p = document.createElement('p');
  p.textContent = `Ваш счёт: ${score}`;

  const input = document.createElement('input');
  input.placeholder = 'Введите имя';

  const save = createButton('Сохранить результат', () => {
    if (save.dataset.saved === 'true') return; // защита от повторного нажатия
    saveLeaderboardEntry(input.value.trim(), score);
    save.dataset.saved = 'true'; 
    save.disabled = true;
    input.disabled = true;
    save.textContent = 'Сохранено!';
  });

  const restart = createButton('Начать заново', () => {
    hideModal(gameOverModal);
    newGame();
  });

  const lb = createButton('Таблица лидеров', () => {
    hideModal(gameOverModal);
    showLeaderboardModal();
  });

  wrap.append(t, p, input, save, restart, lb);
  gameOverModal.appendChild(wrap);
  gameOverModal.style.display = 'block';
  updateMobileControlsVisibility();
}

function showLeaderboardModal() {
  clearElement(leaderboardModal);
  const wrap = document.createElement('div');
  wrap.className = 'modal-content';
  const t = document.createElement('h3');
  t.textContent = 'Топ игроков';
  wrap.appendChild(t);
  const leaders = loadLeaderboard();
  if (!leaders.length) {
    const p = document.createElement('p');
    p.textContent = 'Пока нет рекордов';
    wrap.appendChild(p);
  } else {
    const table = document.createElement('table');
    const head = document.createElement('tr');
    ['#', 'Имя', 'Очки', 'Дата'].forEach(h => {
      const th = document.createElement('th');
      th.textContent = h;
      head.appendChild(th);
    });
    table.appendChild(head);
    leaders.forEach((e, i) => {
      const tr = document.createElement('tr');
      [i + 1, e.name, e.score, new Date(e.date).toLocaleString()].forEach(v => {
        const td = document.createElement('td');
        td.textContent = v;
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
    wrap.appendChild(table);
  }
  const close = createButton('Закрыть', () => hideModal(leaderboardModal));
  wrap.appendChild(close);
  leaderboardModal.appendChild(wrap);
  leaderboardModal.style.display = 'block';
  updateMobileControlsVisibility();
}

function hideModal(modal) {
  modal.style.display = 'none';
  updateMobileControlsVisibility();
}

function createMobileControls() {
  const div = document.createElement('div');
  div.id = 'mobile-controls';
  div.className = 'mobile-controls';
  const up = createButton('↑', moveUp);
  const right = createButton('→', moveRight);
  const down = createButton('↓', moveDown);
  const left = createButton('←', moveLeft);
  div.append(up);
  const row = document.createElement('div');
  row.className = 'm-row';
  row.append(left, right, down);
  div.append(row);
  div.style.display = 'none';
  document.body.appendChild(div);
  return div;
}

function updateMobileControlsVisibility() {
  const isSmall = window.innerWidth <= 768;
  const modals = leaderboardModal.style.display === 'block' || gameOverModal.style.display === 'block';
  mobileControlsEl.style.display = (isSmall && !modals && !isGameOver) ? 'block' : 'none';
}

function attachInputHandlers() {
  document.addEventListener('keydown', e => {
    // блокировка стандартного поведения стрелок
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
      e.preventDefault();
    }
    
    if (e.code === 'ArrowLeft') moveLeft();
    else if (e.code === 'ArrowRight') moveRight();
    else if (e.code === 'ArrowUp') moveUp();
    else if (e.code === 'ArrowDown') moveDown();
  });

  boardEl.addEventListener('touchstart', e => {
    const t = e.changedTouches[0];
    touchStartX = t.clientX; 
    touchStartY = t.clientY;
  }, { passive: true });

  boardEl.addEventListener('touchend', e => {
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    if (Math.abs(dx) < 30 && Math.abs(dy) < 30) return;
    if (Math.abs(dx) > Math.abs(dy)) dx > 0 ? moveRight() : moveLeft();
    else dy > 0 ? moveDown() : moveUp();
  });
}

function newGame() {
  board = createEmptyBoard();
  score = 0;
  isGameOver = false;
  canUndo = true;
  undoStack = [];
  const startTiles = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < startTiles; i++) spawnRandomTile();
  renderAll();
  saveState();
  hideModal(gameOverModal);
  hideModal(leaderboardModal);
}
