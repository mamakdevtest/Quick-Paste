const { invoke } = window.__TAURI__.core;
const { listen }  = window.__TAURI__.event;
const { getCurrentWindow } = window.__TAURI__.window;
const appWindow = getCurrentWindow();

// ─── App State ─────────────────────────────────────────────────────────────────
let snippets         = [];
let filteredSnippets = [];
let selectedIndex    = -1;
let pinnedWindow     = false;
let deferredClipboardText = null;
let appSettings      = {};
let settingsOpen     = false;
let sortMode         = 'default';
let multiSelectMode  = false;
let selectedSnippets = new Set(); // indices into filteredSnippets

// ─── UI Elements ───────────────────────────────────────────────────────────────
const mainContainer   = document.getElementById('mainContainer');
const searchInput     = document.getElementById('searchInput');
const categoryFilter  = document.getElementById('categoryFilter');
const sortSelect      = document.getElementById('sortSelect');
const listContainer   = document.getElementById('listContainer');
const resultLabel     = document.getElementById('resultLabel');
const pinWindowBtn    = document.getElementById('pinWindowBtn');
const settingsBtn     = document.getElementById('settingsBtn');
const closeBtn        = document.getElementById('closeBtn');
const addBtn          = document.getElementById('addBtn');
const scrollArea      = document.getElementById('scrollArea');
const panelTrack      = document.getElementById('panelTrack');
const headerFrame     = document.getElementById('headerFrame');
const clipboardImportBtn = document.getElementById('clipboardImportBtn');
const multiSelectBtn  = document.getElementById('multiSelectBtn');
const bulkActionBar   = document.getElementById('bulkActionBar');
const selectedCount   = document.getElementById('selectedCount');
const bulkDeleteBtn   = document.getElementById('bulkDeleteBtn');
const bulkCancelBtn   = document.getElementById('bulkCancelBtn');

// Settings UI
const autoPasteToggle        = document.getElementById('autoPasteToggle');
const darkModeToggle         = document.getElementById('darkModeToggle');
const startupToggle          = document.getElementById('startupToggle');
const clipboardHistoryToggle = document.getElementById('clipboardHistoryToggle');
const storagePathLabel       = document.getElementById('storagePathLabel');
const exportBtn              = document.getElementById('exportBtn');
const importBtn              = document.getElementById('importBtn');
const clearBtn               = document.getElementById('clearBtn');
const hotkeyKeysRow          = document.getElementById('hotkeyKeysRow');
const hotkeyInput            = document.getElementById('hotkeyInput');
const hotkeyClearBtn         = document.getElementById('hotkeyClearBtn');
const opacitySlider          = document.getElementById('opacitySlider');
const opacityLabel           = document.getElementById('opacityLabel');

// Dialog
const dialogOverlay           = document.getElementById('dialogOverlay');
const dialogTitle             = document.getElementById('dialogTitle');
const dialogBackBtn           = document.getElementById('dialogBackBtn');
const dialogCancelBtn         = document.getElementById('dialogCancelBtn');
const dialogSaveBtn           = document.getElementById('dialogSaveBtn');
const dialogTitleInput        = document.getElementById('dialogTitleInput');
const dialogContentInput      = document.getElementById('dialogContentInput');
const dialogCategoryInput     = document.getElementById('dialogCategoryInput');
const dialogTagsInput         = document.getElementById('dialogTagsInput');
const dialogShortcutInput     = document.getElementById('dialogShortcutInput');
const dialogClearShortcutBtn  = document.getElementById('dialogClearShortcutBtn');
const dialogSecretToggle      = document.getElementById('dialogSecretToggle');
const dialogTypeInput         = document.getElementById('dialogTypeInput');
const dialogColorInput        = document.getElementById('dialogColorInput');
const charCount               = document.getElementById('charCount');
const shortcutGlobalWarning   = document.getElementById('shortcutGlobalWarning');
let editIndex = -1;

// ─── Toast ─────────────────────────────────────────────────────────────────────
const toast = document.createElement('div');
toast.id = 'toast';
document.body.appendChild(toast);
let toastTimeout = null;

function showToast(msg, duration = 1600, type = '') {
  toast.textContent = msg;
  toast.className = type ? `visible toast-${type}` : 'visible';
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('visible', 'toast-success', 'toast-error');
  }, duration);
}

// ─── Initialize ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  appSettings = await invoke('load_settings');
  applySettings(appSettings);

  await reloadData();

  const storagePath = await invoke('get_storage_path');
  storagePathLabel.textContent = storagePath;

  searchInput.focus();

  await listen('new-clipboard-entry', async (event) => {
    const text = event.payload;
    const isVisible = await appWindow.isVisible();
    if (isVisible) {
      deferredClipboardText = text;
    } else {
      await processClipboardEntry(text);
    }
  });

  // Listen for opacity events from Rust
  await listen('set-opacity', (event) => {
    const val = event.payload;
    mainContainer.style.opacity = val;
  });

  setupShortcutCapture();
  setupHotkeyCapture();
  setupColorPicker();
});

// ─── Settings ──────────────────────────────────────────────────────────────────
function applySettings(settings) {
  autoPasteToggle.checked        = settings.auto_paste;
  darkModeToggle.checked         = settings.dark_mode;
  clipboardHistoryToggle.checked = settings.clipboard_history_enabled;
  startupToggle.checked          = settings.startup_with_os || false;

  document.body.classList.toggle('dark', !!settings.dark_mode);

  // Draw hotkey key chips
  hotkeyKeysRow.innerHTML = '';
  const hotkey = settings.hotkey || 'alt+q';
  hotkey.split('+').forEach(k => {
    const el = document.createElement('span');
    el.className = 'kbd-key';
    el.textContent = k.toUpperCase();
    hotkeyKeysRow.appendChild(el);
  });

  // Show current hotkey in input placeholder
  hotkeyInput.placeholder = `Current: ${hotkey.toUpperCase().split('+').join(' + ')} — Click to change`;
}

async function saveCurrentSettings() {
  appSettings = {
    ...appSettings,
    dark_mode: darkModeToggle.checked,
    auto_paste: autoPasteToggle.checked,
    clipboard_history_enabled: clipboardHistoryToggle.checked,
  };
  await invoke('save_settings', { settings: appSettings });
  document.body.classList.toggle('dark', appSettings.dark_mode);
}

function setupHotkeyCapture() {
  hotkeyInput.addEventListener('keydown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

    const parts = [];
    if (e.ctrlKey)  parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey)   parts.push('Alt');

    let keyName = e.key;
    if (keyName === ' ') keyName = 'Space';
    else if (keyName.length === 1) keyName = keyName.toUpperCase();
    parts.push(keyName);

    const combo = parts.join('+');
    hotkeyInput.value = combo;
  });

  hotkeyInput.addEventListener('blur', async () => {
    const val = hotkeyInput.value.trim();
    if (!val) return;
    appSettings = { ...appSettings, hotkey: val.toLowerCase() };
    await invoke('save_settings', { settings: appSettings });
    applySettings(appSettings);
    hotkeyInput.value = '';
    showToast(`Hotkey set to ${val}`, 1800, 'success');
  });

  hotkeyClearBtn.addEventListener('click', async () => {
    appSettings = { ...appSettings, hotkey: 'alt+q' };
    await invoke('save_settings', { settings: appSettings });
    applySettings(appSettings);
    showToast('Hotkey reset to Alt+Q', 1600, 'success');
  });
}

// ─── Data Loading & Displaying ─────────────────────────────────────────────────
async function reloadData() {
  snippets = await invoke('load_snippets');
  refreshCategoryFilter();
  loadAndDisplay();
}

function refreshCategoryFilter() {
  const current = categoryFilter.value;
  categoryFilter.innerHTML = '<option value="All">All</option>';
  const cats = [...new Set(snippets.map(s => s.category).filter(Boolean))].sort();
  cats.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    categoryFilter.appendChild(opt);
  });
  if ([...categoryFilter.options].some(o => o.value === current)) {
    categoryFilter.value = current;
  }
}

function loadAndDisplay() {
  const query = searchInput.value.toLowerCase().trim();
  const catFilter = categoryFilter.value;

  // Pinned snippets first (unless sorting overrides)
  let ordered;
  if (sortMode === 'default') {
    const pinnedItems   = snippets.map((s, i) => ({ s, i })).filter(x => x.s.pinned);
    const unpinnedItems = snippets.map((s, i) => ({ s, i })).filter(x => !x.s.pinned);
    ordered = [...pinnedItems, ...unpinnedItems];
  } else {
    ordered = snippets.map((s, i) => ({ s, i }));
    if (sortMode === 'az') {
      ordered.sort((a, b) => a.s.title.localeCompare(b.s.title));
    } else if (sortMode === 'za') {
      ordered.sort((a, b) => b.s.title.localeCompare(a.s.title));
    } else if (sortMode === 'most_used') {
      ordered.sort((a, b) => b.s.use_count - a.s.use_count);
    } else if (sortMode === 'newest') {
      ordered.sort((a, b) => b.s.created_at - a.s.created_at);
    } else if (sortMode === 'oldest') {
      ordered.sort((a, b) => a.s.created_at - b.s.created_at);
    }
  }

  filteredSnippets = ordered.filter(item => {
    if (catFilter !== 'All' && item.s.category !== catFilter) return false;
    if (!query) return true;
    const terms = query.split(/\s+/);
    return terms.every(term =>
      (item.s.title    || '').toLowerCase().includes(term) ||
      (item.s.content  || '').toLowerCase().includes(term) ||
      (item.s.category || '').toLowerCase().includes(term) ||
      (item.s.tags     || []).some(t => t.toLowerCase().includes(term))
    );
  });

  listContainer.innerHTML = '';

  if (filteredSnippets.length === 0) {
    const isEmpty = snippets.length === 0;
    if (isEmpty) {
      renderEmptyState();
    } else {
      listContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <div class="empty-title">No results found</div>
          <div class="empty-desc">Try a different search term or category.</div>
        </div>
      `;
    }
    resultLabel.textContent = '0 snippets';
    return;
  }

  filteredSnippets.forEach((item, index) => {
    const s = item.s;
    const card = document.createElement('div');
    card.className = `snippet-item${s.pinned ? ' pinned' : ''}${index === selectedIndex ? ' selected' : ''}${multiSelectMode && selectedSnippets.has(index) ? ' multi-selected' : ''}`;
    card.draggable = !multiSelectMode;

    // Color label border
    if (s.color) {
      card.style.borderLeftColor = s.color;
      card.style.borderLeftWidth = '3px';
    }

    if (!multiSelectMode) {
      card.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', item.i.toString()));
      card.addEventListener('dragover',  e => e.preventDefault());
      card.addEventListener('drop', e => {
        e.preventDefault();
        const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (fromIdx !== item.i) swapSnippets(fromIdx, item.i);
      });
    }

    const tagsHtml     = (s.tags || []).map(t => `<span class="tag-chip">${escapeHtml(t)}</span>`).join('');
    const categoryHtml = s.category ? `<span class="project-chip">${escapeHtml(s.category)}</span>` : '';
    const shortcutHtml = s.shortcut
      ? `<span class="shortcut-label ${getShortcutColorClass(s.shortcut)}">${escapeHtml(s.shortcut)}</span>`
      : '';

    const typeIcon   = getTypeIcon(s.snippet_type);
    const secretLock = s.is_secret ? `<span class="secret-lock" title="Secret">🔒</span>` : '';
    const charBadge  = `<span class="char-badge" title="Content length">${formatCharCount(s.content.length)}</span>`;
    const timeAgoStr = s.last_used_at ? `<span class="time-ago" title="Last used">${timeAgo(s.last_used_at)}</span>` : (s.created_at ? `<span class="time-ago" title="Created">${timeAgo(s.created_at)}</span>` : '');
    const multiCheckbox = multiSelectMode ? `<span class="multi-check">${selectedSnippets.has(index) ? '☑' : '☐'}</span>` : '';

    // Content preview: masked if secret
    const previewText  = s.is_secret ? '••••••••••••' : highlightText(escapeHtml(s.content), query);
    const previewClass = s.is_secret ? 'snippet-content-preview secret-masked' : 'snippet-content-preview';

    const titleHtml = highlightText(escapeHtml(s.title), query);

    card.innerHTML = `
      <div class="snippet-row-1">
        ${multiCheckbox}
        <span class="drag-handle">${multiSelectMode ? '' : '⠿'}</span>
        <span class="pin-indicator">📌</span>
        <span class="type-badge" title="${s.snippet_type || 'text'}">${typeIcon}</span>
        <span class="snippet-title">${titleHtml}</span>
        ${secretLock}
        ${shortcutHtml}
      </div>
      <div class="secret-preview-row">
        <span class="${previewClass}">${previewText}</span>
        ${s.is_secret ? `<button class="reveal-btn" data-revealed="false" title="Show content">👁 Show</button>` : ''}
      </div>
      <div class="snippet-meta-row">
        ${categoryHtml}
        ${tagsHtml}
        ${charBadge}
        <span class="count-badge">${s.use_count} uses</span>
        ${timeAgoStr}
      </div>
      <div class="card-actions">
        <button class="card-copy-btn" title="Copy without pasting">📋</button>
      </div>
    `;

    // Reveal button
    if (s.is_secret) {
      const revealBtn = card.querySelector('.reveal-btn');
      const previewEl = card.querySelector('.snippet-content-preview');
      revealBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const revealed = revealBtn.dataset.revealed === 'true';
        if (revealed) {
          previewEl.innerHTML = '••••••••••••';
          previewEl.classList.add('secret-masked');
          revealBtn.textContent = '👁 Show';
          revealBtn.classList.remove('revealed');
          revealBtn.dataset.revealed = 'false';
        } else {
          previewEl.innerHTML = escapeHtml(s.content);
          previewEl.classList.remove('secret-masked');
          revealBtn.textContent = '🙈 Hide';
          revealBtn.classList.add('revealed');
          revealBtn.dataset.revealed = 'true';
        }
      });
    }

    // Copy-only button
    card.querySelector('.card-copy-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      await invoke('copy_only', { content: s.content });
      showToast('Copied!', 1200, 'success');
    });

    // Multi-select click
    if (multiSelectMode) {
      card.addEventListener('click', () => {
        if (selectedSnippets.has(index)) {
          selectedSnippets.delete(index);
        } else {
          selectedSnippets.add(index);
        }
        updateBulkBar();
        loadAndDisplay();
      });
    } else {
      // Single click → paste
      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('drag-handle')) return;
        if (e.target.classList.contains('reveal-btn')) return;
        if (e.target.classList.contains('card-copy-btn')) return;
        selectedIndex = index;
        selectAndPaste(item.i);
      });
    }

    // Right-click context menu
    card.addEventListener('contextmenu', e => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, item.i);
    });

    listContainer.appendChild(card);
  });

  resultLabel.textContent = `${filteredSnippets.length} snippet${filteredSnippets.length !== 1 ? 's' : ''}`;
}

// ─── Empty State with Templates ────────────────────────────────────────────────
const TEMPLATES = [
  { title: 'Email Signature', content: 'Best regards,\nYour Name\nyourname@email.com', snippet_type: 'text', tags: ['email'] },
  { title: 'SQL Select', content: 'SELECT * FROM table_name WHERE condition = 1;', snippet_type: 'code', tags: ['sql'] },
  { title: 'Git Commit', content: 'git commit -m "feat: your message here"', snippet_type: 'code', tags: ['git'] },
  { title: 'TODO Comment', content: '// TODO: ', snippet_type: 'code', tags: ['code'] },
];

function renderEmptyState() {
  const el = document.createElement('div');
  el.className = 'empty-state';
  el.innerHTML = `
    <div class="empty-icon">📋</div>
    <div class="empty-title">No snippets yet</div>
    <div class="empty-desc">Click + to add your first snippet, or start with a template:</div>
    <div class="template-grid">
      ${TEMPLATES.map((t, i) => `
        <button class="template-card" data-tpl="${i}">
          <span class="template-icon">${getTypeIcon(t.snippet_type)}</span>
          <span class="template-title">${escapeHtml(t.title)}</span>
        </button>
      `).join('')}
    </div>
  `;

  el.querySelectorAll('.template-card').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tpl = TEMPLATES[parseInt(btn.dataset.tpl)];
      const now = Date.now();
      snippets.push({
        title: tpl.title,
        content: tpl.content,
        pinned: false,
        use_count: 0,
        category: null,
        tags: tpl.tags,
        shortcut: null,
        is_secret: false,
        snippet_type: tpl.snippet_type,
        color: null,
        created_at: now,
        last_used_at: 0,
      });
      await invoke('save_snippets', { snippets });
      reloadData();
      showToast(`Template "${tpl.title}" added!`, 1600, 'success');
    });
  });

  listContainer.appendChild(el);
}

function swapSnippets(fromIdx, toIdx) {
  const item = snippets.splice(fromIdx, 1)[0];
  snippets.splice(toIdx, 0, item);
  invoke('save_snippets', { snippets }).then(() => reloadData());
}

// ─── Multi-select ──────────────────────────────────────────────────────────────
function updateBulkBar() {
  selectedCount.textContent = `${selectedSnippets.size} selected`;
}

multiSelectBtn.addEventListener('click', () => {
  multiSelectMode = !multiSelectMode;
  selectedSnippets.clear();
  multiSelectBtn.classList.toggle('active', multiSelectMode);
  bulkActionBar.classList.toggle('hidden', !multiSelectMode);
  loadAndDisplay();
});

bulkCancelBtn.addEventListener('click', () => {
  multiSelectMode = false;
  selectedSnippets.clear();
  multiSelectBtn.classList.remove('active');
  bulkActionBar.classList.add('hidden');
  loadAndDisplay();
});

bulkDeleteBtn.addEventListener('click', async () => {
  if (selectedSnippets.size === 0) return;
  if (!confirm(`Delete ${selectedSnippets.size} snippet(s)?`)) return;

  // Map filtered indices back to actual indices
  const actualIndices = [...selectedSnippets].map(fi => filteredSnippets[fi].i).sort((a, b) => b - a);
  for (const idx of actualIndices) {
    snippets.splice(idx, 1);
  }
  await invoke('save_snippets', { snippets });
  selectedSnippets.clear();
  multiSelectMode = false;
  multiSelectBtn.classList.remove('active');
  bulkActionBar.classList.add('hidden');
  reloadData();
  showToast(`${actualIndices.length} snippet(s) deleted`, 1600);
});

// ─── Selection & AutoPaste ─────────────────────────────────────────────────────
async function selectAndPaste(index) {
  const now = Date.now();
  snippets[index].use_count += 1;
  snippets[index].last_used_at = now;
  await invoke('save_snippets', { snippets });

  const autoPaste = appSettings.auto_paste;
  const content   = snippets[index].content;

  if (autoPaste) {
    if (pinnedWindow) {
      await invoke('copy_and_paste', { content, hwnd: null, skipCopy: false });
      setTimeout(() => appWindow.setFocus(), 180);
    } else {
      await appWindow.hide();
      setTimeout(async () => {
        await invoke('copy_and_paste', { content, hwnd: null, skipCopy: false });
      }, 120);
    }
  } else {
    await invoke('copy_only', { content });
    showToast('Copied to clipboard!', 1600, 'success');
    if (!pinnedWindow) {
      await appWindow.hide();
    }
  }

  reloadData();
}

// ─── Window Focus & Blur ───────────────────────────────────────────────────────
let firstFocus = true;

window.addEventListener('blur', async () => {
  if (deferredClipboardText) {
    await processClipboardEntry(deferredClipboardText);
    deferredClipboardText = null;
  }
  if (pinnedWindow) return;
  setTimeout(async () => {
    if (!dialogOverlay.classList.contains('hidden')) return;
    await appWindow.hide();
  }, 150);
});

window.addEventListener('focus', async () => {
  if (firstFocus) {
    firstFocus = false;
    await invoke('store_own_hwnd');
  }
});

async function processClipboardEntry(text) {
  const exists = snippets.some(s => s.content === text);
  if (!exists) {
    const firstLine = text.split('\n')[0].trim().substring(0, 50) || 'Clipboard entry';
    const now = Date.now();
    snippets.push({
      title: firstLine,
      content: text,
      pinned: false,
      use_count: 0,
      category: 'Clipboard',
      tags: ['history'],
      shortcut: null,
      is_secret: false,
      snippet_type: 'text',
      color: null,
      created_at: now,
      last_used_at: 0,
    });
    await invoke('save_snippets', { snippets });
    reloadData();
  }
}

// ─── Header Controls ──────────────────────────────────────────────────────────
pinWindowBtn.addEventListener('click', () => {
  pinnedWindow = !pinnedWindow;
  pinWindowBtn.classList.toggle('active', pinnedWindow);
  invoke('set_pinned', { value: pinnedWindow });
  showToast(pinnedWindow ? 'Window pinned' : 'Window unpinned');
});

settingsBtn.addEventListener('click', () => {
  settingsOpen = !settingsOpen;
  panelTrack.classList.toggle('settings-open', settingsOpen);
  settingsBtn.textContent = settingsOpen ? '←' : '⚙';
  if (!settingsOpen) {
    setTimeout(() => searchInput.focus(), 280);
  }
});

closeBtn.addEventListener('click', () => appWindow.hide());

// ─── Sort ─────────────────────────────────────────────────────────────────────
sortSelect.addEventListener('change', () => {
  sortMode = sortSelect.value;
  selectedIndex = -1;
  loadAndDisplay();
});

// ─── Search ───────────────────────────────────────────────────────────────────
searchInput.addEventListener('input', () => {
  selectedIndex = -1;
  loadAndDisplay();
});

categoryFilter.addEventListener('change', () => {
  selectedIndex = -1;
  loadAndDisplay();
});

// ─── Clipboard Import ─────────────────────────────────────────────────────────
clipboardImportBtn.addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (!text.trim()) {
      showToast('Clipboard is empty', 1600);
      return;
    }
    const exists = snippets.some(s => s.content === text);
    if (exists) {
      showToast('Already in your snippets!', 1600);
      return;
    }
    // Pre-fill dialog with clipboard content
    editIndex = -1;
    dialogTitle.textContent = 'Add Snippet';
    dialogTitleInput.value    = text.split('\n')[0].trim().substring(0, 60) || 'Clipboard import';
    dialogContentInput.value  = text;
    dialogCategoryInput.value = '';
    dialogTagsInput.value     = '';
    dialogShortcutInput.value = '';
    dialogSecretToggle.checked = false;
    dialogTypeInput.value = 'text';
    dialogColorInput.value = '';
    updateColorPicker('');
    const len = text.length;
    charCount.textContent = len;
    charCount.parentElement.className = 'char-counter' + (len > 5000 ? ' limit' : len > 2000 ? ' warn' : '');
    dialogOverlay.classList.remove('hidden');
    dialogTitleInput.focus();
    dialogTitleInput.select();
  } catch {
    showToast('Cannot read clipboard', 1600, 'error');
  }
});

// ─── Keyboard Shortcuts ───────────────────────────────────────────────────────
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!dialogOverlay.classList.contains('hidden')) { closeDialog(); return; }
    if (multiSelectMode) { bulkCancelBtn.click(); return; }
    if (settingsOpen) {
      settingsOpen = false;
      panelTrack.classList.remove('settings-open');
      settingsBtn.textContent = '⚙';
      setTimeout(() => searchInput.focus(), 280);
      return;
    }
    if (searchInput.value) {
      searchInput.value = '';
      selectedIndex = -1;
      loadAndDisplay();
    } else {
      appWindow.hide();
    }
    return;
  }

  if (!dialogOverlay.classList.contains('hidden')) return;
  if (settingsOpen) return;

  // Match custom snippet shortcuts
  for (let i = 0; i < filteredSnippets.length; i++) {
    const item = filteredSnippets[i];
    if (matchShortcutEvent(e, item.s.shortcut)) {
      e.preventDefault();
      selectAndPaste(item.i);
      return;
    }
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedIndex = Math.min(selectedIndex + 1, filteredSnippets.length - 1);
    loadAndDisplay();
    scrollToSelected();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedIndex = Math.max(selectedIndex - 1, 0);
    loadAndDisplay();
    scrollToSelected();
  } else if (e.key === 'Enter') {
    if (selectedIndex >= 0 && selectedIndex < filteredSnippets.length) {
      e.preventDefault();
      selectAndPaste(filteredSnippets[selectedIndex].i);
    }
  }
});

function matchShortcutEvent(e, shortcutStr) {
  if (!shortcutStr) return false;
  const parts   = shortcutStr.toLowerCase().split('+');
  const keyPart = parts[parts.length - 1];

  const ctrlMatch  = parts.includes('ctrl')  === e.ctrlKey;
  const shiftMatch = parts.includes('shift') === e.shiftKey;
  const altMatch   = parts.includes('alt')   === e.altKey;

  let eventKey = e.key.toLowerCase();
  if (eventKey === ' ') eventKey = 'space';

  return ctrlMatch && shiftMatch && altMatch && (eventKey === keyPart);
}

function scrollToSelected() {
  const el = listContainer.querySelector('.snippet-item.selected');
  if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// ─── Settings Toggles ─────────────────────────────────────────────────────────
autoPasteToggle.addEventListener('change', saveCurrentSettings);
darkModeToggle.addEventListener('change', saveCurrentSettings);
clipboardHistoryToggle.addEventListener('change', () => {
  saveCurrentSettings();
  invoke('toggle_clipboard_monitor', { enabled: clipboardHistoryToggle.checked });
});

startupToggle.addEventListener('change', async () => {
  try {
    await invoke('set_autostart', { enabled: startupToggle.checked });
    showToast(startupToggle.checked ? 'Will launch on startup' : 'Startup disabled', 1600, 'success');
  } catch (e) {
    showToast(`Startup error: ${e}`, 2000, 'error');
    startupToggle.checked = !startupToggle.checked;
  }
});

// ─── Opacity Slider ───────────────────────────────────────────────────────────
opacitySlider.addEventListener('input', () => {
  const val = parseInt(opacitySlider.value) / 100;
  opacityLabel.textContent = `${opacitySlider.value}%`;
  mainContainer.style.opacity = val;
});

opacitySlider.addEventListener('change', async () => {
  const val = parseInt(opacitySlider.value) / 100;
  await invoke('set_window_opacity', { opacity: val });
});

// ─── Import / Export / Clear ──────────────────────────────────────────────────
exportBtn.addEventListener('click', async () => {
  try {
    await invoke('export_data');
    showToast('Data exported successfully!', 1600, 'success');
  } catch (err) {
    showToast(`Export failed: ${err}`, 2000, 'error');
  }
});

importBtn.addEventListener('click', async () => {
  try {
    const result = await invoke('import_data');
    if (result) {
      appSettings = result.settings;
      applySettings(appSettings);
      await reloadData();
      showToast('Data imported successfully!', 1600, 'success');
    }
  } catch (err) {
    showToast(`Import failed: ${err}`, 2000, 'error');
  }
});

clearBtn.addEventListener('click', async () => {
  if (!confirm('Clear all snippets and reset settings? This cannot be undone.')) return;
  await invoke('clear_all_data');
  appSettings = await invoke('load_settings');
  applySettings(appSettings);
  await reloadData();
  showToast('All data cleared.');
});

// ─── Add / Edit Snippet Dialog ────────────────────────────────────────────────
addBtn.addEventListener('click', () => {
  editIndex = -1;
  dialogTitle.textContent = 'Add Snippet';
  dialogTitleInput.value    = '';
  dialogContentInput.value  = '';
  dialogCategoryInput.value = '';
  dialogTagsInput.value     = '';
  dialogShortcutInput.value = '';
  dialogSecretToggle.checked = false;
  dialogTypeInput.value = 'text';
  dialogColorInput.value = '';
  updateColorPicker('');
  charCount.textContent = '0';
  charCount.parentElement.className = 'char-counter';
  shortcutGlobalWarning.classList.add('hidden');
  dialogOverlay.classList.remove('hidden');
  dialogTitleInput.focus();
});

dialogBackBtn.addEventListener('click', closeDialog);
dialogCancelBtn.addEventListener('click', closeDialog);

function closeDialog() {
  dialogOverlay.classList.add('hidden');
  searchInput.focus();
}

dialogSaveBtn.addEventListener('click', async () => {
  const title    = dialogTitleInput.value.trim();
  const content  = dialogContentInput.value.trim();
  const category = dialogCategoryInput.value.trim() || null;
  const tagsRaw  = dialogTagsInput.value.trim();
  const tags     = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
  const shortcut = dialogShortcutInput.value.trim() || null;
  const is_secret    = dialogSecretToggle.checked;
  const snippet_type = dialogTypeInput.value || 'text';
  const color        = dialogColorInput.value || null;

  if (!title || !content) {
    showToast('Title and content are required.', 1600, 'error');
    return;
  }

  const now = Date.now();
  if (editIndex >= 0) {
    snippets[editIndex] = {
      ...snippets[editIndex],
      title, content, category, tags, shortcut,
      is_secret, snippet_type, color,
    };
  } else {
    snippets.push({
      title, content,
      pinned: false, use_count: 0,
      category, tags, shortcut,
      is_secret, snippet_type, color,
      created_at: now,
      last_used_at: 0,
    });
  }

  await invoke('save_snippets', { snippets });
  closeDialog();
  reloadData();
  showToast(editIndex >= 0 ? 'Snippet updated!' : 'Snippet added!', 1400, 'success');
});

// ─── Shortcut Capture ─────────────────────────────────────────────────────────
function setupShortcutCapture() {
  dialogShortcutInput.addEventListener('keydown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

    const parts = [];
    if (e.ctrlKey)  parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey)   parts.push('Alt');

    let keyName = e.key;
    if (keyName === ' ') keyName = 'Space';
    else if (keyName.length === 1) keyName = keyName; // keep original case/char (Turkish etc.)

    parts.push(keyName);
    const combo = parts.join('+');
    dialogShortcutInput.value = combo;

    // Warn if the key is non-ASCII (won't work as a global shortcut)
    const isNonStandard = keyName.length > 1 || (keyName.charCodeAt(0) > 127);
    const hasNoModifier = !e.ctrlKey && !e.shiftKey && !e.altKey;
    if (isNonStandard || hasNoModifier) {
      shortcutGlobalWarning.classList.remove('hidden');
    } else {
      shortcutGlobalWarning.classList.add('hidden');
    }
  });

  dialogClearShortcutBtn.addEventListener('click', () => {
    dialogShortcutInput.value = '';
    shortcutGlobalWarning.classList.add('hidden');
  });

  // Character counter
  dialogContentInput.addEventListener('input', () => {
    const len = dialogContentInput.value.length;
    charCount.textContent = len;
    const counter = charCount.parentElement;
    counter.className = 'char-counter';
    if (len > 5000) counter.classList.add('limit');
    else if (len > 2000) counter.classList.add('warn');
  });
}

// ─── Color Picker ─────────────────────────────────────────────────────────────
function setupColorPicker() {
  document.querySelectorAll('.color-dot-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const color = btn.dataset.color;
      dialogColorInput.value = color;
      updateColorPicker(color);
    });
  });
}

function updateColorPicker(selectedColor) {
  document.querySelectorAll('.color-dot-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.color === selectedColor);
  });
}

// ─── Context Menu ─────────────────────────────────────────────────────────────
let activeContextIndex = -1;

function showContextMenu(x, y, index) {
  activeContextIndex = index;
  removeContextMenu();

  const menu = document.createElement('div');
  menu.className = 'custom-context-menu';

  const menuW = 150, menuH = 130;
  const safeX = Math.min(x, window.innerWidth  - menuW);
  const safeY = Math.min(y, window.innerHeight - menuH);
  menu.style.left = `${safeX}px`;
  menu.style.top  = `${safeY}px`;

  const isPinned = snippets[index].pinned;
  menu.innerHTML = `
    <button class="context-item" id="ctxPinBtn">${isPinned ? '📌 Unpin' : '📌 Pin'}</button>
    <button class="context-item" id="ctxEditBtn">✏️ Edit</button>
    <button class="context-item" id="ctxDupBtn">⧉ Duplicate</button>
    <button class="context-item danger" id="ctxDeleteBtn">🗑 Delete</button>
  `;
  document.body.appendChild(menu);

  document.getElementById('ctxPinBtn').addEventListener('click', async () => {
    snippets[index].pinned = !snippets[index].pinned;
    await invoke('save_snippets', { snippets });
    removeContextMenu();
    reloadData();
  });

  document.getElementById('ctxEditBtn').addEventListener('click', () => {
    editIndex = index;
    const s = snippets[index];
    dialogTitle.textContent    = 'Edit Snippet';
    dialogTitleInput.value     = s.title;
    dialogContentInput.value   = s.content;
    dialogCategoryInput.value  = s.category || '';
    dialogTagsInput.value      = (s.tags || []).join(', ');
    dialogShortcutInput.value  = s.shortcut || '';
    dialogSecretToggle.checked = s.is_secret || false;
    dialogTypeInput.value      = s.snippet_type || 'text';
    dialogColorInput.value     = s.color || '';
    updateColorPicker(s.color || '');
    const len = s.content.length;
    charCount.textContent = len;
    charCount.parentElement.className = 'char-counter' + (len > 5000 ? ' limit' : len > 2000 ? ' warn' : '');
    shortcutGlobalWarning.classList.add('hidden');
    removeContextMenu();
    dialogOverlay.classList.remove('hidden');
    dialogTitleInput.focus();
  });

  document.getElementById('ctxDupBtn').addEventListener('click', async () => {
    const orig = snippets[index];
    const now = Date.now();
    const dupe = {
      ...orig,
      title: orig.title + ' (copy)',
      pinned: false,
      use_count: 0,
      created_at: now,
      last_used_at: 0,
    };
    snippets.splice(index + 1, 0, dupe);
    await invoke('save_snippets', { snippets });
    removeContextMenu();
    reloadData();
    showToast('Snippet duplicated!', 1400, 'success');
  });

  document.getElementById('ctxDeleteBtn').addEventListener('click', async () => {
    snippets.splice(index, 1);
    await invoke('save_snippets', { snippets });
    removeContextMenu();
    reloadData();
  });

  document.addEventListener('click', handleOutsideContextClick);
}

function removeContextMenu() {
  const existing = document.querySelector('.custom-context-menu');
  if (existing) existing.remove();
  document.removeEventListener('click', handleOutsideContextClick);
  activeContextIndex = -1;
}

function handleOutsideContextClick(e) {
  if (!e.target.closest('.custom-context-menu')) removeContextMenu();
}

// ─── Native Window Dragging ───────────────────────────────────────────────────
headerFrame.addEventListener('mousedown', async (e) => {
  if (e.button === 0 && !e.target.closest('.header-btn')) {
    e.preventDefault();
    await appWindow.startDragging();
  }
});

// ─── Utility ─────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function highlightText(escapedHtml, query) {
  if (!query) return escapedHtml;
  const terms = query.split(/\s+/).filter(Boolean);
  let result = escapedHtml;
  for (const term of terms) {
    const escapedTerm = escapeHtml(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`(${escapedTerm})`, 'gi'), '<mark>$1</mark>');
  }
  return result;
}

function getShortcutColorClass(shortcut) {
  if (!shortcut) return '';
  let hash = 0;
  for (let i = 0; i < shortcut.length; i++) {
    hash = shortcut.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `shortcut-color-${Math.abs(hash) % 5}`;
}

function getTypeIcon(type) {
  switch (type) {
    case 'code':     return '💻';
    case 'url':      return '🔗';
    case 'password': return '🔒';
    default:         return '📝';
  }
}

function formatCharCount(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${n}c`;
}

function timeAgo(timestamp) {
  if (!timestamp) return '';
  const diff = Date.now() - timestamp;
  const s = Math.floor(diff / 1000);
  if (s < 60)  return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30)  return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}
