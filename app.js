// ── CONFIG ──────────────────────────────────────────────────────────
// IMPORTANT: Replace this with Becky's own Google OAuth Web Client ID after
// creating it in Google Cloud and authorizing her GitHub Pages origin.
const CLIENT_ID = '255752713712-k3llal848drdndheiod5hff4tb4m3hn5.apps.googleusercontent.com';
const APP_VERSION = '2026.08.29.1';

// RG canonical Sheets
const SPREADSHEET_ID = '1KuLL5rWDSQK-sXHN0ZeXjHJj6RprFsL03lC-NyeK-dY';
const TAXONOMY_SHEET_ID = '1Na-tbzEToQTu1TJDdanMwe3cNxZ6paZfRJ5BZYA4gcw';
const BOARD_SHEET_ID = '1ufHUB77R-K8z1s6O51kD-a2cgFv4zOAQVmxfcc4Xuak';

const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
const RANGE = 'A:I';
const LONG_PRESS_MS = 550;
const TAXONOMY_RANGE = 'A:E';
const BOARD_RANGE = 'A:J';

let activeTab = 'tasks';
let domainFirst = 'Work';
let sortMode = 'priority';
let boardMode = 'tracked';

let tokenClient = null;
let accessToken = null;
let tasks = [];
let taxonomy = {};
let taxonomyParent = {};
let board = [];

// RG-specific localStorage keys prevent collision with Dave's app on same browser.
const CACHE_KEY = 'rg_tasks_cache';
const TAXONOMY_CACHE_KEY = 'rg_taxonomy_cache';
const BOARD_CACHE_KEY = 'rg_board_cache';
const QUEUE_KEY = 'rg_tasks_pending_writes';
const TOKEN_KEY = 'rg_tasks_token_cache';

function saveCache(taskList) { localStorage.setItem(CACHE_KEY, JSON.stringify(taskList)); }
function loadCache() { const raw = localStorage.getItem(CACHE_KEY); return raw ? JSON.parse(raw) : []; }
function saveTaxonomyCache(map) { localStorage.setItem(TAXONOMY_CACHE_KEY, JSON.stringify(map)); }
function loadTaxonomyCache() { const raw = localStorage.getItem(TAXONOMY_CACHE_KEY); return raw ? JSON.parse(raw) : {}; }
function queueWrite(row, column, value) {
  const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  q.push({ row, column, value, ts: Date.now() });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}
function getQueue() { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); }
function clearQueue() { localStorage.setItem(QUEUE_KEY, '[]'); }
function saveToken(token, expiresInSec) {
  const expiry = Date.now() + expiresInSec * 1000 - 60000;
  localStorage.setItem(TOKEN_KEY, JSON.stringify({ token, expiry }));
}
function loadValidToken() {
  const raw = localStorage.getItem(TOKEN_KEY);
  if (!raw) return null;
  const { token, expiry } = JSON.parse(raw);
  return Date.now() < expiry ? token : null;
}

function initAuth() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (resp) => {
      if (resp.error) { setStatus('Sign-in failed: ' + resp.error); return; }
      accessToken = resp.access_token;
      saveToken(accessToken, resp.expires_in);
      setStatus('Connected.');
      document.getElementById('connect-btn').style.display = 'none';
      Promise.all([fetchTaxonomy(), fetchBoard()]).then(fetchTasks);
    }
  });

  const cached = loadValidToken();
  if (cached) {
    accessToken = cached;
    document.getElementById('connect-btn').style.display = 'none';
    setStatus('Connected (cached).');
    if (navigator.onLine) Promise.all([fetchTaxonomy(), fetchBoard()]).then(fetchTasks);
  } else {
    const cachedTax = loadTaxonomyCache();
    taxonomy = cachedTax.labels || {};
    taxonomyParent = cachedTax.parents || {};
  }
}

function connect() { tokenClient.requestAccessToken({ prompt: '' }); }

async function fetchTaxonomy() {
  if (!accessToken || !navigator.onLine) {
    const cached = loadTaxonomyCache();
    taxonomy = cached.labels || {};
    taxonomyParent = cached.parents || {};
    return;
  }
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${TAXONOMY_SHEET_ID}/values/${TAXONOMY_RANGE}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const rows = (data.values || []).slice(1);
    const map = {}, parentMap = {};
    rows.forEach(r => {
      if (!r[0]) return;
      const code = r[0].trim();
      map[code] = r[1] || code;
      parentMap[code] = (r[2] || '').trim();
    });
    taxonomy = map;
    taxonomyParent = parentMap;
    saveTaxonomyCache({ labels: map, parents: parentMap });
  } catch (e) {
    const cached = loadTaxonomyCache();
    taxonomy = cached.labels || {};
    taxonomyParent = cached.parents || {};
  }
}

function getCategoryLabel(tag) {
  if (!tag) return 'Uncategorized';
  const primary = tag.split(/[·/]/).map(t => t.trim()).find(t => /^[WP]/.test(t)) || tag.trim();
  let current = primary, guard = 0;
  while (taxonomyParent[current] && taxonomyParent[current] !== 'W' && taxonomyParent[current] !== 'P' && guard < 10) {
    current = taxonomyParent[current];
    guard++;
  }
  return taxonomy[current] || current;
}

function labelTag(tag) {
  if (!tag) return '';
  return tag.split(/[·/]/).map(part => {
    const code = part.trim();
    const label = taxonomy[code];
    return label ? `${code} (${label})` : code;
  }).join(' · ');
}

async function fetchBoard() {
  if (!accessToken || !navigator.onLine) return;
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${BOARD_SHEET_ID}/values/${BOARD_RANGE}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const rows = (data.values || []).slice(1);
    board = rows.map(r => ({
      code: r[0] || '', name: r[1] || '', domain: r[2] || '', stage: r[3] || '',
      priority: r[4] || 'Medium', nextUp: r[5] || '', notes: r[6] || '',
      milestoneDate: r[7] || '', updated: r[8] || '',
      show: (r[9] || '').toString().toUpperCase() !== 'FALSE'
    })).filter(p => p.code);
    localStorage.setItem(BOARD_CACHE_KEY, JSON.stringify(board));
  } catch (e) {
    const raw = localStorage.getItem(BOARD_CACHE_KEY);
    board = raw ? JSON.parse(raw) : [];
  }
}

async function fetchTasks() {
  if (!accessToken || !navigator.onLine) return;
  setStatus('Syncing…');
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const rows = (data.values || []).slice(1);
    tasks = rows.map((r, i) => ({
      row: i + 2, id: r[0] || '', task: r[1] || '', tag: r[2] || '',
      due: r[3] || '', priority: r[4] || 'Medium', notes: r[5] || '',
      done: (r[6] || '').toString().toUpperCase() === 'TRUE',
      todayFlag: (r[7] || '').toString().trim().toUpperCase(),
      note: r[8] || ''
    })).filter(t => t.id);
    saveCache(tasks);
    setStatus('Synced ' + new Date().toLocaleTimeString());
    render();
    flushQueue();
  } catch (e) {
    setStatus('Sync failed, showing cached data: ' + e.message);
    tasks = loadCache();
    render();
  }
}

async function writeColumn(task, column, field, value) {
  task[field] = value;
  saveCache(tasks);
  render();
  const cellValue = (typeof value === 'boolean') ? (value ? 'TRUE' : 'FALSE') : value;

  if (accessToken && navigator.onLine) {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${column}${task.row}?valueInputOption=RAW`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [[cellValue]] })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      setStatus('Saved.');
    } catch (e) {
      queueWrite(task.row, column, cellValue);
      setStatus('Offline or write failed — queued for later sync.');
    }
  } else {
    queueWrite(task.row, column, cellValue);
    setStatus('Offline — change queued, will sync when connected.');
  }
}

function toggleDone(task, checked) { return writeColumn(task, 'G', 'done', checked); }
function toggleTodayShared(task, checked) { return writeColumn(task, 'H', 'todayFlag', checked ? 'TRUE' : 'FALSE'); }

function saveQuickNote(task, text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return Promise.resolve();
  const stamp = todayStr();
  const existing = (task.note || '').trim();
  const entry = '[' + stamp + '] ' + trimmed;
  const updated = existing ? existing + '\n' + entry : entry;
  return writeColumn(task, 'I', 'note', updated);
}

async function flushQueue() {
  const q = getQueue();
  if (!q.length || !accessToken || !navigator.onLine) return;
  setStatus('Syncing ' + q.length + ' queued change(s)…');
  for (const item of q) {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${item.column}${item.row}?valueInputOption=RAW`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [[item.value]] })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
    } catch (e) {
      setStatus('Some queued changes failed to sync — will retry next time.');
      return;
    }
  }
  clearQueue();
  setStatus('All queued changes synced.');
}

let noteModalTask = null;
function openNoteModal(task) {
  noteModalTask = task;
  document.getElementById('note-modal-title').textContent = task.task;
  document.getElementById('note-modal-existing').textContent = task.note || '';
  document.getElementById('note-modal-existing').style.display = task.note ? 'block' : 'none';
  document.getElementById('note-input').value = '';
  document.getElementById('note-modal').style.display = 'flex';
  setTimeout(() => document.getElementById('note-input').focus(), 50);
}
function closeNoteModal() {
  document.getElementById('note-modal').style.display = 'none';
  noteModalTask = null;
}
function setStatus(msg) { document.getElementById('status').textContent = msg; }
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function normalizeDue(due) {
  if (!due) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(due)) return due;
  const m = due.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, mo, da, yr] = m;
    return yr + '-' + mo.padStart(2, '0') + '-' + da.padStart(2, '0');
  }
  return '';
}
function isOverdue(t) {
  if (t.done) return false;
  const norm = normalizeDue(t.due);
  return !!norm && norm < todayStr();
}

function render() {
  if (activeTab === 'board') { renderBoard(); return; }
  const list = tasks.length ? tasks : loadCache();
  const today = todayStr();
  const container = document.getElementById('tasks');
  container.innerHTML = '';

  function isToday(t) {
    if (t.todayFlag === 'FALSE') return false;
    if (t.todayFlag === 'TRUE') return true;
    return normalizeDue(t.due) === today;
  }

  const todayItems = list.filter(t => isToday(t));
  const workItems = list.filter(t => t.tag.trim().startsWith('W') && !isToday(t));
  const personalItems = list.filter(t => t.tag.trim().startsWith('P') && !isToday(t));
  const otherItems = list.filter(t => !t.tag.trim().startsWith('W') && !t.tag.trim().startsWith('P') && !isToday(t));

  function taskRow(t) {
    const row = document.createElement('label');
    row.className = 'item' + (t.done ? ' done' : '');
    row.innerHTML = `
      <input type="checkbox" ${t.done ? 'checked' : ''} />
      <div class="content">
        <div class="label">${escapeHtml(t.task)}${t.note ? ' <span class="note-flag" title="Has a note">📝</span>' : ''}</div>
        <div class="proj">${escapeHtml(labelTag(t.tag))} · <span class="priority-tag">${escapeHtml(t.priority || 'Medium')}</span></div>
      </div>
      <div class="due-col${isOverdue(t) ? ' overdue' : ''}">${escapeHtml(t.due || '')}</div>
      <div class="today-btn ${isToday(t) ? 'active' : ''}" title="Toggle Today"></div>`;
    row.querySelector('input').addEventListener('change', (e) => toggleDone(t, e.target.checked));
    row.querySelector('.today-btn').addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      toggleTodayShared(t, !isToday(t));
    });

    let pressTimer = null, longPressed = false;
    const startPress = () => {
      longPressed = false;
      pressTimer = setTimeout(() => {
        longPressed = true;
        if (navigator.vibrate) navigator.vibrate(12);
        openNoteModal(t);
      }, LONG_PRESS_MS);
    };
    const cancelPress = () => clearTimeout(pressTimer);
    row.addEventListener('touchstart', startPress, { passive: true });
    row.addEventListener('touchend', cancelPress);
    row.addEventListener('touchmove', cancelPress);
    row.addEventListener('mousedown', startPress);
    row.addEventListener('mouseup', cancelPress);
    row.addEventListener('mouseleave', cancelPress);
    row.addEventListener('click', (e) => {
      if (longPressed) { e.preventDefault(); longPressed = false; }
    });
    return row;
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  }

  function subhead(text) { const h = document.createElement('div'); h.className = 'subhead'; h.textContent = text; return h; }
  function domainHead(text) { const h = document.createElement('div'); h.className = 'group-head'; h.textContent = text; return h; }
  function byDateAscending(items) {
    return [...items].sort((a, b) => {
      const da = normalizeDue(a.due), db = normalizeDue(b.due);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da.localeCompare(db);
    });
  }
  function byPriorityThenDate(items) {
    const order = { High: 0, Medium: 1, Low: 2 };
    return byDateAscending(items).sort((a, b) => (order[a.priority] ?? 1) - (order[b.priority] ?? 1));
  }
  function renderGroupedItems(items) {
    if (sortMode === 'category') {
      const groups = {};
      items.forEach(t => {
        const cat = getCategoryLabel(t.tag);
        (groups[cat] = groups[cat] || []).push(t);
      });
      Object.keys(groups).sort().forEach(cat => {
        container.appendChild(subhead(cat));
        byPriorityThenDate(groups[cat]).forEach(t => container.appendChild(taskRow(t)));
      });
    } else {
      ['High', 'Medium', 'Low'].forEach(tier => {
        const inTier = items.filter(t => (t.priority || 'Medium') === tier);
        if (!inTier.length) return;
        container.appendChild(subhead(tier));
        byDateAscending(inTier).forEach(t => container.appendChild(taskRow(t)));
      });
    }
  }
  function renderDomainSection(title, items) {
    if (!items.length) return;
    container.appendChild(domainHead(title));
    renderGroupedItems(items);
  }

  if (todayItems.length) {
    container.appendChild(domainHead('Today'));
    renderGroupedItems(todayItems);
  }
  if (domainFirst === 'Personal') {
    renderDomainSection('Personal', personalItems);
    renderDomainSection('Work', workItems);
  } else {
    renderDomainSection('Work', workItems);
    renderDomainSection('Personal', personalItems);
  }
  renderDomainSection('Other', otherItems);

  if (!list.length) container.innerHTML = '<p class="empty">No tasks loaded yet. Connect to sync.</p>';
}

function yearProgressPct(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + (dateStr.length === 10 ? 'T12:00:00' : ''));
  if (Number.isNaN(d.getTime())) return null;
  const start = new Date(d.getFullYear(), 0, 1), end = new Date(d.getFullYear(), 11, 31);
  return Math.round(((d - start) / (end - start)) * 100);
}
function getTopLevelCodes(domainRoot) {
  return Object.keys(taxonomyParent).filter(code => taxonomyParent[code] === domainRoot).sort();
}

function renderBoard() {
  const container = document.getElementById('tasks');
  container.innerHTML = '';
  const list = board.length ? board : JSON.parse(localStorage.getItem(BOARD_CACHE_KEY) || '[]');

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  }

  function boardCard(p) {
    const card = document.createElement('div');
    card.className = 'board-card priority-' + (p.priority || 'Medium').toLowerCase()
      + (p.stage === 'Untracked' ? ' untracked' : '');
    const pct = yearProgressPct(p.milestoneDate);
    const codeLabel = taxonomy[p.code] ? ' · ' + taxonomy[p.code] : '';
    card.innerHTML = `
      <div class="board-head">
        <span class="board-code">${escapeHtml(p.code + codeLabel)}</span>
        <span class="board-stage">${escapeHtml(p.stage)}</span>
      </div>
      <div class="board-name">${escapeHtml(p.name)}</div>
      ${p.nextUp ? `<div class="board-next">${escapeHtml(p.nextUp)}</div>` : ''}
      ${pct !== null ? `<div class="board-track"><div class="board-marker" style="left:${pct}%"></div></div><div class="board-date">${escapeHtml(p.milestoneDate)}</div>` : ''}
      ${p.notes ? `<div class="board-notes">${escapeHtml(p.notes)}</div>` : ''}`;
    return card;
  }

  function section(title, domainCode) {
    let items;
    if (boardMode === 'all') {
      const trackedByCode = {};
      list.forEach(p => { if (!trackedByCode[p.code]) trackedByCode[p.code] = p; });
      items = getTopLevelCodes(domainCode).map(code => trackedByCode[code] || {
        code, name: taxonomy[code] || code, domain: domainCode, stage: 'Untracked',
        priority: 'Low', nextUp: '', notes: '', milestoneDate: '', updated: '', show: true
      });
    } else {
      items = list.filter(p => p.domain === domainCode && p.show);
    }
    if (!items.length) return;

    const h = document.createElement('div');
    h.className = 'group-head'; h.textContent = title; container.appendChild(h);
    const stageOrder = { Milestone: 0, Active: 1, Scoping: 2, Waiting: 3, 'Wrapping up': 4, Monitor: 5, 'On-hold': 6, Untracked: 7 };
    items.sort((a, b) =>
      (stageOrder[a.stage] ?? 5) - (stageOrder[b.stage] ?? 5) ||
      a.code.localeCompare(b.code, undefined, { numeric: true })
    );
    items.forEach(p => container.appendChild(boardCard(p)));
  }

  section('Work', 'W');
  section('Personal', 'P');

  const anyContent = boardMode === 'all'
    ? (getTopLevelCodes('W').length || getTopLevelCodes('P').length)
    : list.some(p => p.show);
  if (!anyContent) container.innerHTML = '<p class="empty">No board data loaded yet.</p>';
}

window.addEventListener('load', () => {
  document.title = 'RG Tasks (' + APP_VERSION + ')';
  const versionTag = document.createElement('div');
  versionTag.id = 'version-tag';
  versionTag.textContent = 'App code: ' + APP_VERSION;
  document.body.insertBefore(versionTag, document.getElementById('status'));

  const dayOfWeek = new Date().getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    domainFirst = 'Personal';
    document.getElementById('sort-domain').textContent = 'Personal first';
  }

  tasks = loadCache();
  const cachedTax = loadTaxonomyCache();
  taxonomy = cachedTax.labels || {};
  taxonomyParent = cachedTax.parents || {};
  board = JSON.parse(localStorage.getItem(BOARD_CACHE_KEY) || '[]');
  render();

  if (typeof google === 'undefined' || !google.accounts?.oauth2) {
    setStatus('Google sign-in library did not load. Refresh when online.');
  } else {
    initAuth();
  }

  document.getElementById('connect-btn').addEventListener('click', connect);
  document.getElementById('tab-tasks').addEventListener('click', () => setTab('tasks'));
  document.getElementById('tab-board').addEventListener('click', () => setTab('board'));
  document.getElementById('sort-domain').addEventListener('click', () => {
    domainFirst = domainFirst === 'Work' ? 'Personal' : 'Work';
    document.getElementById('sort-domain').textContent = domainFirst + ' first';
    render();
  });

  ['category', 'priority'].forEach(mode => {
    document.getElementById('sort-' + mode).addEventListener('click', () => {
      sortMode = mode;
      ['category', 'priority'].forEach(m =>
        document.getElementById('sort-' + m).classList.toggle('active', m === mode)
      );
      render();
    });
  });

  ['tracked', 'all'].forEach(mode => {
    document.getElementById('board-' + mode).addEventListener('click', () => {
      boardMode = mode;
      ['tracked', 'all'].forEach(m =>
        document.getElementById('board-' + m).classList.toggle('active', m === mode)
      );
      render();
    });
  });

  document.getElementById('note-cancel').addEventListener('click', closeNoteModal);
  document.getElementById('note-modal').addEventListener('click', (e) => {
    if (e.target.id === 'note-modal') closeNoteModal();
  });
  document.getElementById('note-save').addEventListener('click', () => {
    const text = document.getElementById('note-input').value;
    const task = noteModalTask;
    closeNoteModal();
    if (task) saveQuickNote(task, text);
  });
});

function setTab(tab) {
  activeTab = tab;
  document.getElementById('tab-tasks').classList.toggle('active', tab === 'tasks');
  document.getElementById('tab-board').classList.toggle('active', tab === 'board');
  document.getElementById('sort-controls').style.display = tab === 'tasks' ? 'flex' : 'none';
  document.getElementById('board-controls').style.display = tab === 'board' ? 'flex' : 'none';
  render();
}

window.addEventListener('online', () => {
  setStatus('Back online, syncing…');
  if (accessToken) Promise.all([fetchTaxonomy(), fetchBoard()]).then(fetchTasks);
});
window.addEventListener('offline', () => setStatus('Offline — showing cached data.'));

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js');
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
  });
}
