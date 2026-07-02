const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;
const { getCurrentWindow } = window.__TAURI__.window;
const appWindow = getCurrentWindow();

// ─── App State ─────────────────────────────────────────────────────────────────
let snippets = [];
let filteredSnippets = [];
let selectedIndex = -1;
let pinnedWindow = false;
let deferredClipboardText = null;
let appSettings = {};  // Full settings object - never partial-overwrite
let settingsOpen = false;

// ─── UI Elements ───────────────────────────────────────────────────────────────
const mainContainer   = document.getElementById('mainContainer');
const searchInput     = document.getElementById('searchInput');
const categoryFilter  = document.getElementById('categoryFilter');
const listContainer   = document.getElementById('listContainer');
const resultLabel     = document.getElementById('resultLabel');
const pinWindowBtn    = document.getElementById('pinWindowBtn');
const settingsBtn     = document.getElementById('settingsBtn');
const closeBtn        = document.getElementById('closeBtn');
const addBtn          = document.getElementById('addBtn');
const scrollArea      = document.getElementById('scrollArea');
const panelTrack      = document.getElementById('panelTrack');
const headerFrame     = document.getElementById('headerFrame');

// Settings UI
const autoPasteToggle       = document.getElementById('autoPasteToggle');
const darkModeToggle        = document.getElementById('darkModeToggle');
const clipboardHistoryToggle= document.getElementById('clipboardHistoryToggle');
const storagePathLabel      = document.getElementById('storagePathLabel');
const exportBtn             = document.getElementById('exportBtn');
const importBtn             = document.getElementById('importBtn');
const clearBtn              = document.getElementById('clearBtn');
const hotkeyKeysRow         = document.getElementById('hotkeyKeysRow');

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
const charCount               = document.getElementById('charCount');
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
  // Load settings
  appSettings = await invoke('load_settings');
  applySettings(appSettings);

  // Load snippets
  await reloadData();

  // Set storage path display
  const storagePath = await invoke('get_storage_path');
  storagePathLabel.textContent = storagePath;

  // Focus search
  searchInput.focus();

  // Listen for clipboard events from backend
  await listen('new-clipboard-entry', async (event) => {
    const text = event.payload;
    const isVisible = await appWindow.isVisible();
    if (isVisible) {
      // Defer: hold clipboard text until window is hidden / blurred
      deferredClipboardText = text;
    } else {
      await processClipboardEntry(text);
    }
  });

  // Setup smart shortcut input capture
  setupShortcutCapture();
});

// ─── Settings ──────────────────────────────────────────────────────────────────
function applySettings(settings) {
  autoPasteToggle.checked        = settings.auto_paste;
  darkModeToggle.checked         = settings.dark_mode;
  clipboardHistoryToggle.checked = settings.clipboard_history_enabled;

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
}

async function saveCurrentSettings() {
  // Merge only changed UI fields back into full settings object
  appSettings = {
    ...appSettings,
    dark_mode: darkModeToggle.checked,
    auto_paste: autoPasteToggle.checked,
    clipboard_history_enabled: clipboardHistoryToggle.checked,
  };
  await invoke('save_settings', { settings: appSettings });
  document.body.classList.toggle('dark', appSettings.dark_mode);
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
  // Restore previous selection if still valid
  if ([...categoryFilter.options].some(o => o.value === current)) {
    categoryFilter.value = current;
  }
}

function loadAndDisplay() {
  const query = searchInput.value.toLowerCase().trim();
  const catFilter = categoryFilter.value;

  // Pinned snippets first, then unpinned
  const pinnedItems   = snippets.map((s, i) => ({ s, i })).filter(x => x.s.pinned);
  const unpinnedItems = snippets.map((s, i) => ({ s, i })).filter(x => !x.s.pinned);
  const ordered = [...pinnedItems, ...unpinnedItems];

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
    listContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${isEmpty ? '📋' : '🔍'}</div>
        <div class="empty-title">${isEmpty ? 'No snippets yet' : 'No results found'}</div>
        <div class="empty-desc">${isEmpty
          ? 'Click the + button below to add your first snippet.'
          : 'Try a different search term or category.'
        }</div>
      </div>
    `;
    resultLabel.textContent = '0 snippets';
    return;
  }

  filteredSnippets.forEach((item, index) => {
    const s = item.s;
    const card = document.createElement('div');
    card.className = `snippet-item${s.pinned ? ' pinned' : ''}${index === selectedIndex ? ' selected' : ''}`;
    card.draggable = true;

    // Drag-to-reorder
    card.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', item.i.toString()));
    card.addEventListener('dragover',  e => e.preventDefault());
    card.addEventListener('drop', e => {
      e.preventDefault();
      const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
      const toIdx   = item.i;
      if (fromIdx !== toIdx) swapSnippets(fromIdx, toIdx);
    });

    const tagsHtml     = (s.tags || []).map(t => `<span class="tag-chip">${escapeHtml(t)}</span>`).join('');
    const categoryHtml = s.category ? `<span class="project-chip">${escapeHtml(s.category)}</span>` : '';
    
    // Custom shortcut rendering
    const shortcutHtml = s.shortcut 
      ? `<span class="shortcut-label ${getShortcutColorClass(s.shortcut)}">${escapeHtml(s.shortcut)}</span>` 
      : '';

    // Type icon
    const typeIcon = getTypeIcon(s.snippet_type);
    const typeBadge = `<span class="type-badge" title="${s.snippet_type || 'text'}">${typeIcon}</span>`;

    // Secret badge
    const secretLock = s.is_secret ? `<span class="secret-lock" title="Secret">🔒</span>` : '';

    // Content preview: masked if secret
    const previewText = s.is_secret
      ? '••••••••••••'
      : escapeHtml(s.content);
    const previewClass = s.is_secret ? 'snippet-content-preview secret-masked' : 'snippet-content-preview';

    card.innerHTML = `
      <div class="snippet-row-1">
        <span class="drag-handle">⠿</span>
        <span class="pin-indicator">📌</span>
        ${typeBadge}
        <span class="snippet-title">${escapeHtml(s.title)}</span>
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
        <span class="count-badge">${s.use_count} clicks</span>
      </div>
    `;

    // Reveal button logic
    if (s.is_secret) {
      const revealBtn = card.querySelector('.reveal-btn');
      const previewEl = card.querySelector('.snippet-content-preview');
      revealBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const revealed = revealBtn.dataset.revealed === 'true';
        if (revealed) {
          previewEl.textContent = '••••••••••••';
          previewEl.classList.add('secret-masked');
          revealBtn.textContent = '👁 Show';
          revealBtn.classList.remove('revealed');
          revealBtn.dataset.revealed = 'false';
        } else {
          previewEl.textContent = s.content;
          previewEl.classList.remove('secret-masked');
          revealBtn.textContent = '🙈 Hide';
          revealBtn.classList.add('revealed');
          revealBtn.dataset.revealed = 'true';
        }
      });
    }

    // Single click → paste immediately!
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('drag-handle')) return;
      if (e.target.classList.contains('reveal-btn')) return;
      selectedIndex = index;
      selectAndPaste(item.i);
    });

    // Right-click context menu
    card.addEventListener('contextmenu', e => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, item.i);
    });

    listContainer.appendChild(card);
  });

  resultLabel.textContent = `${filteredSnippets.length} snippet${filteredSnippets.length !== 1 ? 's' : ''}`;
}

function swapSnippets(fromIdx, toIdx) {
  const item = snippets.splice(fromIdx, 1)[0];
  snippets.splice(toIdx, 0, item);
  invoke('save_snippets', { snippets }).then(() => reloadData());
}

// ─── Selection & AutoPaste FSM ─────────────────────────────────────────────────
async function selectAndPaste(index) {
  snippets[index].use_count += 1;
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

// ─── Window Focus & Blur Lifecycle ────────────────────────────────────────────
let firstFocus = true;

window.addEventListener('blur', async () => {
  // Process any deferred clipboard text now that UI is no longer visible
  if (deferredClipboardText) {
    await processClipboardEntry(deferredClipboardText);
    deferredClipboardText = null;
  }

  if (pinnedWindow) return;

  setTimeout(async () => {
    // Don't hide if dialog is open
    if (!dialogOverlay.classList.contains('hidden')) return;
    await appWindow.hide();
  }, 150);
});

window.addEventListener('focus', async () => {
  if (firstFocus) {
    // Record our own window's HWND so we never paste back into ourselves.
    firstFocus = false;
    await invoke('store_own_hwnd');
  }
});

async function processClipboardEntry(text) {
  const exists = snippets.some(s => s.content === text);
  if (!exists) {
    const firstLine = text.split('\n')[0].trim().substring(0, 50) || 'Clipboard entry';
    snippets.push({
      title: firstLine,
      content: text,
      pinned: false,
      use_count: 0,
      category: 'Clipboard',
      tags: ['history'],
      shortcut: null
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
    // Return focus to search when closing settings
    setTimeout(() => searchInput.focus(), 280); // after slide animation
  }
});

closeBtn.addEventListener('click', () => appWindow.hide());

// ─── Search ───────────────────────────────────────────────────────────────────
searchInput.addEventListener('input', () => {
  selectedIndex = -1;
  loadAndDisplay();
});

categoryFilter.addEventListener('change', () => {
  selectedIndex = -1;
  loadAndDisplay();
});

// ─── Keyboard Shortcuts ───────────────────────────────────────────────────────
window.addEventListener('keydown', e => {
  // Always handle Escape
  if (e.key === 'Escape') {
    if (!dialogOverlay.classList.contains('hidden')) {
      closeDialog();
      return;
    }
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

  // Block other shortcuts when dialog is open
  if (!dialogOverlay.classList.contains('hidden')) return;
  // Block when settings is open (allow typing)
  if (settingsOpen) return;

  // Match custom shortcuts first
  for (let i = 0; i < filteredSnippets.length; i++) {
    const item = filteredSnippets[i];
    if (matchShortcutEvent(e, item.s.shortcut)) {
      e.preventDefault();
      selectAndPaste(item.i);
      return;
    }
  }

  // Fallback arrow navigations
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
  
  // Format keydown event to standard lowercase representation
  const parts = shortcutStr.toLowerCase().split('+');
  const keyPart = parts[parts.length - 1];

  const ctrlMatch  = parts.includes('ctrl') === e.ctrlKey;
  const shiftMatch = parts.includes('shift') === e.shiftKey;
  const altMatch   = parts.includes('alt') === e.altKey;

  let eventKey = e.key.toLowerCase();
  if (eventKey === ' ') eventKey = 'space';

  // Compare keyPart with the eventKey or numeric equivalent
  const keyMatch = eventKey === keyPart;

  return ctrlMatch && shiftMatch && altMatch && keyMatch;
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

// ─── Import / Export / Clear ──────────────────────────────────────────────────
exportBtn.addEventListener('click', async () => {
  try {
    await invoke('export_data');
    showToast('Data exported successfully!');
  } catch (err) {
    showToast(`Export failed: ${err}`);
  }
});

importBtn.addEventListener('click', async () => {
  try {
    const result = await invoke('import_data');
    if (result) {
      appSettings = result.settings;
      applySettings(appSettings);
      await reloadData();
      showToast('Data imported successfully!');
    }
  } catch (err) {
    showToast(`Import failed: ${err}`);
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
  charCount.textContent = '0';
  charCount.parentElement.className = 'char-counter';
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
  const is_secret = dialogSecretToggle.checked;
  const snippet_type = dialogTypeInput.value || 'text';

  if (!title || !content) {
    showToast('Title and content are required.', 1600, 'error');
    return;
  }

  if (editIndex >= 0) {
    snippets[editIndex] = { ...snippets[editIndex], title, content, category, tags, shortcut, is_secret, snippet_type };
  } else {
    snippets.push({ title, content, pinned: false, use_count: 0, category, tags, shortcut, is_secret, snippet_type });
  }

  await invoke('save_snippets', { snippets });
  closeDialog();
  reloadData();
});

// Setup smart shortcut input capture
function setupShortcutCapture() {
  dialogShortcutInput.addEventListener('keydown', (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Ignore modifiers pressed by themselves
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

    const parts = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');

    let keyName = e.key;
    if (keyName === ' ') keyName = 'Space';
    else if (keyName.length === 1) keyName = keyName.toUpperCase();

    parts.push(keyName);
    dialogShortcutInput.value = parts.join('+');
  });

  dialogClearShortcutBtn.addEventListener('click', () => {
    dialogShortcutInput.value = '';
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

// ─── Custom Context Menu ──────────────────────────────────────────────────────
let activeContextIndex = -1;

function showContextMenu(x, y, index) {
  activeContextIndex = index;
  removeContextMenu();

  const menu = document.createElement('div');
  menu.className = 'custom-context-menu';

  // Constrain to window (using full 380x560 space now)
  const menuW = 130, menuH = 94;
  const safeX = Math.min(x, 380 - menuW);
  const safeY = Math.min(y, 560 - menuH);
  menu.style.left = `${safeX}px`;
  menu.style.top  = `${safeY}px`;

  const isPinned = snippets[index].pinned;
  menu.innerHTML = `
    <button class="context-item" id="ctxPinBtn">${isPinned ? '📌  Unpin' : '📌  Pin'}</button>
    <button class="context-item" id="ctxEditBtn">✏️  Edit</button>
    <button class="context-item danger" id="ctxDeleteBtn">🗑  Delete</button>
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
    dialogTitle.textContent    = 'Edit Snippet';
    dialogTitleInput.value     = snippets[index].title;
    dialogContentInput.value   = snippets[index].content;
    dialogCategoryInput.value  = snippets[index].category || '';
    dialogTagsInput.value      = (snippets[index].tags || []).join(', ');
    dialogShortcutInput.value  = snippets[index].shortcut || '';
    dialogSecretToggle.checked = snippets[index].is_secret || false;
    dialogTypeInput.value      = snippets[index].snippet_type || 'text';
    // Update char counter
    const len = snippets[index].content.length;
    charCount.textContent = len;
    const counter = charCount.parentElement;
    counter.className = 'char-counter';
    if (len > 5000) counter.classList.add('limit');
    else if (len > 2000) counter.classList.add('warn');
    removeContextMenu();
    dialogOverlay.classList.remove('hidden');
    dialogTitleInput.focus();
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
  if (existing) {
    existing.remove();
  }
  document.removeEventListener('click', handleOutsideContextClick);
  activeContextIndex = -1;
}

function handleOutsideContextClick(e) {
  if (!e.target.closest('.custom-context-menu')) {
    removeContextMenu();
  }
}

// ─── Native Window Dragging ──────────────────────────────────────────
headerFrame.addEventListener('mousedown', async (e) => {
  // Only left mouse button and not on header buttons
  if (e.button === 0 && !e.target.closest('.header-btn')) {
    e.preventDefault();
    await appWindow.startDragging();
  }
});

// ─── Utility ──────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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
