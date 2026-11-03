'use strict';

// ---------- State & DOM ----------
let config = null;     // loaded from config.json
let tasks = [];        // tasks currently shown
let editingId = null;  // id of the task being edited, or null when adding

const form = document.getElementById('task-form');
const titleInput = document.getElementById('task-title');
const descriptionInput = document.getElementById('task-description');
const submitButton = document.getElementById('task-submit');
const cancelButton = document.getElementById('task-cancel');
const list = document.getElementById('task-list');
const statusMessage = document.getElementById('status-message');
const emptyMessage = document.getElementById('empty-message');

// ---------- Config ----------
async function loadConfig() {
  let res;
  try {
    res = await fetch('config.json', { cache: 'no-store' });
  } catch {
    throw new Error('Could not load config.json.');
  }
  if (!res.ok) throw new Error(`Could not load config.json (HTTP ${res.status}).`);

  const cfg = await res.json();
  if (!cfg.supabaseUrl || !cfg.supabasePublishableKey ||
      cfg.supabaseUrl.includes('YOUR_PROJECT_ID') || cfg.supabasePublishableKey.includes('YOUR_')) {
    throw new Error('config.json is not filled in: add your Supabase URL and publishable key.');
  }
  cfg.supabaseUrl = cfg.supabaseUrl.replace(/\/+$/, '');
  cfg.tableName = cfg.tableName || 'tasks';
  return cfg;
}

// ---------- Supabase REST API ----------
function apiHeaders() {
  const key = config.supabasePublishableKey;
  const headers = {
    apikey: key,
    'Content-Type': 'application/json',
    Prefer: 'return=representation' // ask Supabase to return the affected rows
  };
  // Legacy "anon" keys are JWTs and also go in the Authorization header.
  // New "sb_publishable_..." keys only need the apikey header.
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  return headers;
}

async function request(method, query, body) {
  const url = `${config.supabaseUrl}/rest/v1/${config.tableName}${query}`;
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: apiHeaders(),
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw new Error('Network error: could not reach the database. Check your connection.');
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }

  if (!res.ok) {
    const detail = (data && (data.message || data.error)) || res.statusText || 'Unknown error';
    throw new Error(`${method} request failed (HTTP ${res.status}): ${detail}`);
  }
  return data;
}

// Supabase returns [] (not an error) when RLS blocks a write or the id doesn't exist.
function firstRow(rows, action) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`Could not ${action}: task not found or blocked by database permissions (RLS).`);
  }
  return rows[0];
}

// GET /tasks?select=*
const getTasks = () => request('GET', '?select=*&order=id.asc');

// GET /tasks?id=eq.1&select=*
const getTask = async (id) =>
  firstRow(await request('GET', `?id=eq.${encodeURIComponent(id)}&select=*`), 'load task');

// POST /tasks
const createTask = async ({ title, description }) =>
  firstRow(await request('POST', '', { title, description, completed: false }), 'create task');

// PUT /tasks?id=eq.1  (complete record)
const saveTask = async (task) =>
  firstRow(await request('PUT', `?id=eq.${encodeURIComponent(task.id)}`, {
    id: task.id,
    title: task.title,
    description: task.description,
    completed: task.completed
  }), 'save task');

// PATCH /tasks?id=eq.1  (only the completed flag)
const setCompleted = async (id, completed) =>
  firstRow(await request('PATCH', `?id=eq.${encodeURIComponent(id)}`, { completed }), 'update task');

// DELETE /tasks?id=eq.1
const deleteTask = async (id) =>
  firstRow(await request('DELETE', `?id=eq.${encodeURIComponent(id)}`), 'delete task');

// ---------- UI helpers ----------
function setStatus(message, type = 'info') {
  statusMessage.textContent = message;
  statusMessage.className = message ? type : '';
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text; // textContent avoids HTML injection
  return node;
}

function button(className, label) {
  const b = el('button', className, label);
  b.type = 'button';
  return b;
}

function render() {
  list.replaceChildren();
  emptyMessage.hidden = tasks.length > 0;

  for (const task of tasks) {
    const item = el('li', task.completed ? 'task-item completed' : 'task-item');
    item.dataset.id = task.id;

    const body = el('div', 'task-body');
    body.append(
      el('h3', 'task-title', task.title),
      el('p', 'task-description', task.description || ''),
      el('span', 'task-status', task.completed ? 'Completed' : 'Incomplete')
    );

    const actions = el('div', 'task-actions');
    actions.append(
      button('toggle-task', task.completed ? 'Mark incomplete' : 'Mark complete'),
      button('edit-task', 'Edit'),
      button('delete-task', 'Delete')
    );

    item.append(body, actions);
    list.append(item);
  }
}

function findTask(id) {
  return tasks.find((t) => String(t.id) === String(id));
}

function replaceTask(updated) {
  tasks = tasks.map((t) => (String(t.id) === String(updated.id) ? updated : t));
}

function startEditing(task) {
  editingId = task.id;
  titleInput.value = task.title;
  descriptionInput.value = task.description || '';
  submitButton.textContent = 'Save changes';
  cancelButton.hidden = false;
  form.classList.add('editing');
  titleInput.focus();
  setStatus(`Editing "${task.title}".`);
}

function resetForm() {
  editingId = null;
  form.reset();
  submitButton.textContent = 'Add task';
  cancelButton.hidden = true;
  form.classList.remove('editing');
}

function setBusy(busy) {
  submitButton.disabled = busy;
  list.querySelectorAll('button').forEach((b) => { b.disabled = busy; });
}

// ---------- Event handlers ----------
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!config) return setStatus('The app is not connected to the database (see config.json).', 'error');

  const title = titleInput.value.trim();
  const description = descriptionInput.value.trim() || null;
  if (!title) return setStatus('Please enter a task title.', 'error');

  setBusy(true);
  try {
    if (editingId !== null) {
      const existing = findTask(editingId);
      if (!existing) throw new Error('The task you were editing no longer exists.');
      const saved = await saveTask({ ...existing, title, description });
      replaceTask(saved);
      setStatus('Task updated.', 'success');
    } else {
      const created = await createTask({ title, description });
      tasks.push(created);
      setStatus('Task added.', 'success');
    }
    resetForm();
    render();
  } catch (err) {
    setStatus(err.message, 'error');
  } finally {
    setBusy(false);
  }
});

cancelButton.addEventListener('click', () => {
  resetForm();
  setStatus('');
});

list.addEventListener('click', async (event) => {
  const btn = event.target.closest('button');
  if (!btn) return;
  const item = btn.closest('.task-item');
  const task = item && findTask(item.dataset.id);
  if (!task) return;

  if (btn.classList.contains('edit-task')) {
    startEditing(task);
    return;
  }

  setBusy(true);
  try {
    if (btn.classList.contains('toggle-task')) {
      const updated = await setCompleted(task.id, !task.completed);
      replaceTask(updated);
      setStatus(updated.completed ? 'Task marked as completed.' : 'Task marked as incomplete.', 'success');
    } else if (btn.classList.contains('delete-task')) {
      await deleteTask(task.id);
      tasks = tasks.filter((t) => String(t.id) !== String(task.id));
      if (String(editingId) === String(task.id)) resetForm();
      setStatus('Task deleted.', 'success');
    }
    render();
  } catch (err) {
    setStatus(err.message, 'error');
  } finally {
    setBusy(false);
  }
});

// ---------- Start ----------
async function init() {
  try {
    config = await loadConfig();
    setStatus('Loading tasks…');
    tasks = await getTasks();
    render();
    setStatus(`Loaded ${tasks.length} task${tasks.length === 1 ? '' : 's'}.`, 'success');
  } catch (err) {
    render();
    setStatus(err.message, 'error');
  }
}

init();
