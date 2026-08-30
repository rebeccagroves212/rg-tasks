// ── CONFIG ──────────────────────────────────────────────────────────
const CLIENT_ID = '255752713712-k3llal848drdndheiod5hff4tb4m3hn5.apps.googleusercontent.com';
const APP_VERSION = '2026.08.30.2';
const SPREADSHEET_ID = '1KuLL5rWDSQK-sXHN0ZeXjHJj6RprFsL03lC-NyeK-dY';
const TAXONOMY_SHEET_ID = '1Na-tbzEToQTu1TJDdanMwe3cNxZ6paZfRJ5BZYA4gcw';
const BOARD_SHEET_ID = '1ufHUB77R-K8z1s6O51kD-a2cgFv4zOAQVmxfcc4Xuak';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
const RANGE = 'A:J'; // Task ID | Task | Activity Tag | Due Date | Priority | Notes | Done | Today | Quick Note | Recurrence
const COMPLETIONS_RANGE = "'Recurring Completions'!A:B"; // Task ID | Date
const LONG_PRESS_MS = 550;
const TAXONOMY_RANGE = 'A:E'; // Code | Label | Parent | Domain | Notes
const BOARD_RANGE = 'A:J'; // Code | Name | Domain | Stage | Priority | NextUp | Notes | MilestoneDate | Updated | Show

let activeTab = 'tasks'; // 'tasks' | 'board'
let domainFirst = 'Work'; // 'Work' | 'Personal' — which section renders first
let sortMode = 'priority'; // 'category' | 'priority'
let boardMode = 'tracked'; // 'tracked' | 'all'

// ── STATE ───────────────────────────────────────────────────────────
let tokenClient = null;
let accessToken = null;
let tasks = []; // [{row, id, task, tag, due, priority, notes, done, todayFlag, note, recurrence}]
let recurringCompletions = []; // [{row, taskId, date}]
let taxonomy = {}; // Code -> Label lookup
let taxonomyParent = {}; // Code -> Parent code lookup (for resolving top-level category)
let board = []; // [{code, name, domain, stage, priority, nextUp, notes, milestoneDate, updated, show}]

// ── STORAGE HELPERS (offline cache + pending write queue) ─────────
const CACHE_KEY = 'rg_tasks_cache';
const TAXONOMY_CACHE_KEY = 'rg_taxonomy_cache';
const QUEUE_KEY = 'rg_tasks_pending_writes';
const TOKEN_KEY = 'rg_tasks_token_cache';
const COMPLETIONS_CACHE_KEY = 'rg_recurring_completions_cache';

function saveCache(taskList) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(taskList));
}

function loadCache() {
  const raw = localStorage.getItem(CACHE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveTaxonomyCache(map) {
  localStorage.setItem(TAXONOMY_CACHE_KEY, JSON.stringify(map));
}

function loadTaxonomyCache() {
  const raw = localStorage.getItem(TAXONOMY_CACHE_KEY);
  return raw ? JSON.parse(raw) : {};
}

function saveCompletionsCache(items) {
  localStorage.setItem(COMPLETIONS_CACHE_KEY, JSON.stringify(items));
}

function loadCompletionsCache() {
  const raw = localStorage.getItem(COMPLETIONS_CACHE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function getQueue() {
  return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
}

function setQueue(q) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

function queueOperation(op) {
  const q = getQueue();
  q.push({ ...op, ts: Date.now() });
  setQueue(q);
}

function queueWrite(row, column, value) {
  queueOperation({ type: 'cell', row, column, value });
}

function clearQueue() {
  setQueue([]);
}

function removeQueuedCompletionAdd(taskId, date) {
  const q = getQueue();

  const idx = q.findIndex(item =>
    item.type === 'completion-add' &&
    item.taskId === taskId &&
    item.date === date
  );

  if (idx === -1) return false;

  q.splice(idx, 1);
  setQueue(q);
  return true;
}

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

// ── GOOGLE AUTH ─────────────────────────────────────────────────────
function initAuth() {
  token ​:contentReference[oaicite:0]{index=0}​
