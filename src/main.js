import {
  detectContentType, getSmartIcon,
  TRANSFORMS, applyTransform,
  fuzzyFilter,
  processInlineExpressions,
  resolveLinkedSnippets,
  processConditionalTemplates,
  smartDedup,
  checkAutoPromote,
  sortByContext,
  THEMES, applyTheme, resolveTheme,
  showQuickLook,
  openCommandPalette, closeCommandPalette, isCommandPaletteOpen,
  executeChain,
} from '/features.js';
import { setupTextExpansionPanel } from '/text-expansion-panel.js';

const { invoke } = window.__TAURI__.core;
const { listen }  = window.__TAURI__.event;
const { getCurrentWindow } = window.__TAURI__.window;
const appWindow = getCurrentWindow();

// ─── Window Size Constants ──────────────────────────────────────────────────────
const WIN_BASE_WIDTH  = 410;  // default window width
const WIN_BASE_HEIGHT = 800;  // default window height
const WIN_PANEL_WIDTH = 480;  // width when a side panel (Settings/Dashboard) is open
const WIN_TEXT_EXPANSION_WIDTH = 860; // width when Text Expansion panel is open

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
  let selectedSnippets = new Set(); // stable indices into the source snippets array
let activeProcessName = null; // current foreground app name for context-aware sort
let currentThemeId   = 'violet'; // active theme id
let dashboardOpen    = false; // global state for dashboard visibility
let textExpansionPanel = null;
// Keyboard sequence state for new command-palette shortcut: Alt+Q then W
let seqAltQPending = false;
let seqAltQTimer = null;


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
const mainPageBtn     = document.getElementById('mainPageBtn');
const openLauncherBtn = document.getElementById('openLauncherBtn');
const openSettingsBtn = document.getElementById('openSettingsBtn');
const dashboardBtn    = document.getElementById('dashboardBtn');

const DASHBOARD_ICON_HTML = `<div class="flex gap-0.5 h-3.5"><div class="w-1 rounded-sm" style="background:var(--qp-primary)"></div><div class="w-1 rounded-sm" style="background:var(--qp-success)"></div><div class="w-1 rounded-sm" style="background:var(--qp-info)"></div></div>`;
const SETTINGS_ICON_HTML = '<span class="material-symbols-outlined" style="font-size:20px;">settings</span>';
const BACK_ICON_HTML = '<span class="material-symbols-outlined" style="font-size:20px;">arrow_back</span>';

function setHeaderButtonActive(button, active) {
  if (!button) {
    return;
  }
  button.classList.toggle('text-d-primary', active);
  button.classList.toggle('bg-d-primary/15', active);
  button.classList.toggle('text-d-dim', !active);
}

function applyPanelHeaderState(panel) {
  settingsOpen = panel === 'settings';
  dashboardOpen = panel === 'dashboard';
  const textExpansionOpen = !!textExpansionPanel?.isOpen?.();

  panelTrack.classList.remove('settings-open', 'dashboard-open');
  if (panel === 'settings') {
    panelTrack.classList.add('settings-open');
  } else if (panel === 'dashboard') {
    panelTrack.classList.add('dashboard-open');
  }

  setHeaderButtonActive(mainPageBtn, !settingsOpen && !dashboardOpen && !textExpansionOpen);
  setHeaderButtonActive(settingsBtn, settingsOpen);
  setHeaderButtonActive(dashboardBtn, dashboardOpen);
  settingsBtn.innerHTML = settingsOpen ? BACK_ICON_HTML : SETTINGS_ICON_HTML;
  dashboardBtn.innerHTML = dashboardOpen ? BACK_ICON_HTML : DASHBOARD_ICON_HTML;
}

function returnToMainPage() {
  if (textExpansionPanel?.closeWelcomeScreen) {
    textExpansionPanel.closeWelcomeScreen();
  }
  if (textExpansionPanel?.isOpen()) {
    textExpansionPanel.closePanel();
  }
  applyPanelHeaderState(null);
  resizeForSidePanel(false);
  setTimeout(() => searchInput.focus(), 280);
}

function resizeForSidePanel(isOpen) {
  if (appWindow.label !== 'main') {
    return;
  }
  const width = isOpen ? WIN_PANEL_WIDTH : WIN_BASE_WIDTH;
  appWindow.setSize({ type: 'Logical', width, height: WIN_BASE_HEIGHT }).catch(() => {});
}

async function setWelcomeWindowMode(enabled) {
  if (appWindow.label !== 'main') {
    return;
  }

  try {
    if (enabled) {
      if (typeof appWindow.setFullscreen === 'function') {
        await appWindow.setFullscreen(true);
      } else if (typeof appWindow.maximize === 'function') {
        await appWindow.maximize();
      }
    } else if (typeof appWindow.setFullscreen === 'function') {
      await appWindow.setFullscreen(false);
    } else if (typeof appWindow.unmaximize === 'function') {
      await appWindow.unmaximize();
    }
  } catch {
    // ignored - window APIs differ across runtime versions
  }
}

function applyResponsiveLayoutMode() {
  const width = window.innerWidth || document.documentElement.clientWidth || WIN_BASE_WIDTH;
  document.body.classList.toggle('qp-compact', width <= 900);
  document.body.classList.toggle('qp-narrow', width <= 640);
}

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
const customAccentInput      = document.getElementById('customAccentInput');
const openWelcomeScreenBtn   = document.getElementById('openWelcomeScreenBtn');

// Dialog
const dialogOverlay           = document.getElementById('dialogOverlay');
const dialogTitle             = document.getElementById('dialogTitle');
const dialogBackBtn           = document.getElementById('dialogBackBtn');
const dialogCancelBtn         = document.getElementById('dialogCancelBtn');
const dialogSaveBtn           = document.getElementById('dialogSaveBtn');
const dialogTitleInput        = document.getElementById('dialogTitleInput');
const dialogContentInput      = document.getElementById('dialogContentInput');
const dialogCategoryInput     = document.getElementById('dialogCategoryInput');
const dialogTriggerInput      = document.getElementById('dialogTriggerInput');
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
const toastContainer = document.getElementById('toastContainer');

function showToast(msg, duration = 1600, type = 'success') {
  if (!toastContainer) return;
  const t = document.createElement('div');
  t.className = `toast ${type === 'error' ? 'error' : type === 'info' ? 'info' : 'success'}`;
  t.textContent = msg;
  toastContainer.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transition = 'opacity 0.2s';
    setTimeout(() => t.remove(), 200);
  }, duration);
}

// ─── Initialize ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const windowLabel = appWindow.label;
  applyResponsiveLayoutMode();
  window.addEventListener('resize', applyResponsiveLayoutMode);
  
  if (windowLabel === 'launcher') {
    document.body.classList.add('launcher-mode');
    
    // Listen for focus-search events from Rust
    await listen('focus-search', async () => {
      await reloadData();
      setTimeout(() => searchInput.focus(), 80);
    });

    // Capture background window when mouse enters launcher area, 
    // before click steals focus
    document.addEventListener('mouseenter', async () => {
      await invoke('capture_foreground_window');
    });
  }

  appSettings = await invoke('load_settings');
  window.addEventListener('settings-updated', (event) => {
    if (event?.detail && typeof event.detail === 'object') {
      appSettings = event.detail;
    }
  });
  setupThemePicker();
  applySettings(appSettings);

  textExpansionPanel = setupTextExpansionPanel({
    invoke,
    listen,
    appWindow,
    showToast,
    locale: navigator.language,
    settings: appSettings,
    windowBaseWidth: WIN_BASE_WIDTH,
    windowExpansionWidth: WIN_TEXT_EXPANSION_WIDTH,
    windowHeight: WIN_BASE_HEIGHT,
  });
  applyPanelHeaderState(null);

  window.addEventListener('text-expansion-opened', () => {
    applyPanelHeaderState(null);
  });
  window.addEventListener('text-expansion-closed', () => {
    applyPanelHeaderState(null);
  });

  await reloadData();

  // Listen for snippets updates across windows (hotkey now Alt+Q)
  await listen('snippets-updated', async () => {
    await reloadData();
  });

  if (windowLabel === 'main') {
    const storagePath = await invoke('get_storage_path');
    storagePathLabel.textContent = storagePath;
  }

  if (appSettings?.text_expansion_onboarding_completed) {
    searchInput.focus();
  }

  // Run main background listeners only in main window
  if (windowLabel === 'main') {
    await listen('new-clipboard-entry', async (event) => {
      const payload = event.payload;
      const isVisible = await appWindow.isVisible();
      if (isVisible) {
        deferredClipboardText = payload;
      } else {
        await processClipboardEntry(payload);
      }
    });

    // Listen for opacity events from Rust
    await listen('set-opacity', (event) => {
      const val = event.payload;
      mainContainer.style.opacity = val;
    });

    // Periodically refresh active process for context-aware suggestions
    setInterval(async () => {
      try {
        const currentApp = await invoke('get_active_process_name');
        if (currentApp && !currentApp.toLowerCase().includes('quickpaste')) {
          activeProcessName = currentApp;
        }
      } catch { /* ignored */ }
    }, 3000);
  }

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
  const historyDurationInput = document.getElementById('historyDurationInput');
  historyDurationInput.value = settings.clipboard_history_duration_days !== undefined ? settings.clipboard_history_duration_days : 30;

  document.body.classList.toggle('dark', !!settings.dark_mode);
  document.documentElement.classList.toggle('dark', !!settings.dark_mode);
  document.body.classList.toggle('light', !settings.dark_mode);
  document.documentElement.classList.toggle('light', !settings.dark_mode);

  // Apply theme
  const themeId = settings.theme || 'violet';
  currentThemeId = themeId;
  applyTheme(themeId, !!settings.dark_mode);
  const resolvedTheme = resolveTheme(themeId);
  if (customAccentInput) {
    customAccentInput.value = resolvedTheme.accent || '#7c3aed';
  }
  document.querySelectorAll('.theme-dot-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === themeId);
  });

  // Draw hotkey key chips
  hotkeyKeysRow.innerHTML = '';
  const hotkey = settings.hotkey || 'alt+q';
  hotkey.split('+').forEach(k => {
    const el = document.createElement('span');
    el.className = 'kbd-chip';
    el.textContent = k.toUpperCase();
    hotkeyKeysRow.appendChild(el);
  });


  // Show current hotkey in input placeholder
  hotkeyInput.placeholder = `Current: ${hotkey.toUpperCase().split('+').join(' + ')} — Click to change`;
}


async function saveCurrentSettings() {
  const historyDurationInput = document.getElementById('historyDurationInput');
  appSettings = {
    ...appSettings,
    dark_mode: darkModeToggle.checked,
    auto_paste: autoPasteToggle.checked,
    clipboard_history_enabled: clipboardHistoryToggle.checked,
    clipboard_history_duration_days: parseInt(historyDurationInput.value, 10),
    theme: currentThemeId,
    text_expansion_show_welcome_on_startup: false,
  };
  await invoke('save_settings', { settings: appSettings });
  window.dispatchEvent(new CustomEvent('settings-updated', { detail: appSettings }));
  document.body.classList.toggle('dark', appSettings.dark_mode);
  document.documentElement.classList.toggle('dark', appSettings.dark_mode);
  document.body.classList.toggle('light', !appSettings.dark_mode);
  document.documentElement.classList.toggle('light', !appSettings.dark_mode);
  applyTheme(currentThemeId, appSettings.dark_mode);
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
  checkAutoPromote(snippets, showToast, (s) => {
    // open edit for suggested snippet
    const idx = snippets.findIndex(x => x.title === s.title);
    if (idx >= 0) document.getElementById('ctxEditBtn')?.click();
  });
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
  const query = searchInput.value.trim();
  const queryLower = query.toLowerCase();
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

  // Context-aware sorting (boost based on active app)
  if (sortMode === 'default' && activeProcessName) {
    ordered = sortByContext(ordered, activeProcessName);
  }

  // Category filter
  let categoryFiltered = ordered.filter(item => {
    if (catFilter !== 'All' && item.s.category !== catFilter) return false;
    return true;
  });

  // Fuzzy search (if query has 2+ chars, try fuzzy before AND)
  if (queryLower && queryLower.length >= 2) {
    const fuzzyResult = fuzzyFilter(categoryFiltered, queryLower);
    if (fuzzyResult && fuzzyResult.length > 0) {
      filteredSnippets = fuzzyResult;
    } else {
      // Fall back to exact AND search
      filteredSnippets = categoryFiltered.filter(item => {
        const terms = queryLower.split(/\s+/);
        return terms.every(term =>
          (item.s.title    || '').toLowerCase().includes(term) ||
          (item.s.content  || '').toLowerCase().includes(term) ||
          (item.s.category || '').toLowerCase().includes(term) ||
          (item.s.tags     || []).some(t => t.toLowerCase().includes(term))
        );
      });
    }
  } else if (!queryLower) {
    filteredSnippets = categoryFiltered;
  } else {
    // Single-char: AND filter only
    filteredSnippets = categoryFiltered.filter(item => {
      const terms = queryLower.split(/\s+/);
      return terms.every(term =>
        (item.s.title    || '').toLowerCase().includes(term) ||
        (item.s.content  || '').toLowerCase().includes(term) ||
        (item.s.category || '').toLowerCase().includes(term) ||
        (item.s.tags     || []).some(t => t.toLowerCase().includes(term))
      );
    });
  }

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
          <div class="empty-desc">Try fuzzy search or a different category.</div>
        </div>
      `;
    }
    resultLabel.textContent = '0 snippets';
    return;
  }

  filteredSnippets.forEach((item, index) => {
    const s = item.s;
    const card = document.createElement('div');
    card.className = `snippet-card ${s.pinned ? 'pinned-card' : ''} ${index === selectedIndex ? 'selected-card' : ''} ${multiSelectMode && selectedSnippets.has(item.i) ? 'multi-selected' : ''}`;
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
    const categoryHtml = s.category ? `<span class="project-chip">📁 ${escapeHtml(s.category)}</span>` : '';
    const shortcutHtml = s.shortcut
      ? `<span class="shortcut-label ${getShortcutColorClass(s.shortcut)}">${escapeHtml(s.shortcut)}</span>`
      : '';
    const triggerHtml = s.trigger
      ? `<span class="trigger-label" title="Abbreviation: ${escapeHtml(s.trigger)}">⚡ ${escapeHtml(s.trigger)}</span>`
      : '';
    const emojiHtml = s.emoji ? `<span class="snippet-emoji">${escapeHtml(s.emoji)}</span>` : '';
    const chainBadge = (s.chain && s.chain.length > 0) ? `<span class="chain-badge">🔗 Macro</span>` : '';

    // Smart Content Detection
    const detector = detectContentType(s.content);
    const smartTypeBadge = detector ? `<span class="smart-type-badge">${detector.label}</span>` : '';
    const colorSwatch = (detector && detector.type === 'color')
      ? `<span class="color-preview-swatch" style="background:${escapeHtml(s.content.trim())}"></span>`
      : '';

    // Inline expression badge
    const hasExpr = /\{\{=/.test(s.content);
    const exprBadge = hasExpr ? `<span class="expr-badge">fx</span>` : '';
    // Linked snippet badge
    const hasLink = /\[\[/.test(s.content);
    const linkBadge = hasLink ? `<span class="linked-snippet-badge">[[ref]]</span>` : '';

    const typeIcon   = emojiHtml || getTypeIcon(s.snippet_type);
    const secretLock = s.is_secret ? `<span class="secret-lock" title="Secret">🔒</span>` : '';
    const charBadge  = `<span class="char-badge" title="Content length">${formatCharCount(s.content.length)}</span>`;
    const timeAgoStr = s.last_used_at ? `<span class="time-ago" title="Last used">${timeAgo(s.last_used_at)}</span>` : (s.created_at ? `<span class="time-ago" title="Created">${timeAgo(s.created_at)}</span>` : '');
    const multiCheckbox = multiSelectMode ? `<span class="multi-check" aria-hidden="true">${selectedSnippets.has(item.i) ? 'Selected' : ''}</span>` : '';

    // Content preview: masked if secret
    const previewText  = s.is_secret ? '••••••••••••' : highlightText(escapeHtml(s.content), queryLower);
    const previewClass = s.is_secret ? 'snippet-content-preview secret-masked' : 'snippet-content-preview';

    const titleHtml = highlightText(escapeHtml(s.title), queryLower);

    // Smart action buttons for this card
    let smartActionsHtml = '';
    if (!s.is_secret && detector && detector.actions && detector.actions.length > 0) {
      const btns = detector.actions.map(a =>
        `<button class="smart-action-btn" data-action-id="${escapeHtml(a.label)}">${escapeHtml(a.label)}</button>`
      ).join('');
      smartActionsHtml = `<div class="smart-actions-row">${colorSwatch}${btns}</div>`;
    } else if (detector && detector.type === 'color') {
      smartActionsHtml = `<div class="smart-actions-row">${colorSwatch}</div>`;
    }

    card.innerHTML = `
      <div class="snippet-row-1">
        ${multiCheckbox}
        <span class="drag-handle">${multiSelectMode ? '' : '⠿'}</span>
        <span class="pin-indicator">📌</span>
        <span class="type-badge" title="${s.snippet_type || 'text'}">${typeIcon}</span>
        <span class="snippet-title">${titleHtml}</span>
        ${secretLock}
        ${smartTypeBadge}
        ${chainBadge}
        ${exprBadge}
        ${linkBadge}
        ${shortcutHtml}
        ${triggerHtml}
      </div>
      <div class="secret-preview-row">
        <span class="${previewClass}">${previewText}</span>
        ${s.is_secret ? `<button class="reveal-btn" data-revealed="false" title="Show content">👁 Show</button>` : ''}
      </div>
      ${smartActionsHtml}
      <div class="snippet-meta-row">
        ${categoryHtml}
        ${tagsHtml}
        ${charBadge}
        <span class="count-badge">${s.use_count} uses</span>
        ${timeAgoStr}
      </div>
      <div class="card-actions">
        <button class="card-copy-btn" title="Copy without pasting">📋</button>
        <button class="card-preview-btn" title="Quick Look (Space)">👁</button>
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
      try {
        const ok = await invoke('copy_only', { content: s.content });
        if (ok) {
          showToast('Copied!', 1200, 'success');
          if (appWindow.label === 'launcher' && !pinnedWindow) {
            await appWindow.hide();
          }
        } else {
          showToast('Copy failed', 1600, 'error');
        }
      } catch (err) {
        showToast('Copy failed', 1600, 'error');
      }
    });

    // Quick Look button on card
    card.querySelector('.card-preview-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      showQuickLook(s);
    });

    // Smart action buttons
    if (!s.is_secret && detector && detector.actions) {
      card.querySelectorAll('.smart-action-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const actionLabel = btn.dataset.actionId;
          const action = detector.actions.find(a => a.label === actionLabel);
          if (action) {
            action.fn(s.content, async (newContent) => {
              snippets[item.i].content = newContent;
              await invoke('save_snippets', { snippets });
              reloadData();
              showToast('Content transformed!', 1200, 'success');
            });
          }
        });
      });
    }

    // Multi-select click
    if (multiSelectMode) {
      card.addEventListener('click', () => {
        if (selectedSnippets.has(item.i)) {
          selectedSnippets.delete(item.i);
        } else {
          selectedSnippets.add(item.i);
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
      showContextMenu(e.clientX, e.clientY, item.i, s.content);
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

async function swapSnippets(fromIdx, toIdx) {
  if (!Number.isInteger(fromIdx) || !Number.isInteger(toIdx)
      || fromIdx < 0 || toIdx < 0
      || fromIdx >= snippets.length || toIdx >= snippets.length) {
    return;
  }
  const previous = [...snippets];
  const item = snippets.splice(fromIdx, 1)[0];
  snippets.splice(toIdx, 0, item);
  try {
    await invoke('save_snippets', { snippets });
    await reloadData();
  } catch (error) {
    snippets = previous;
    loadAndDisplay();
    showToast(`Reorder failed: ${String(error)}`, 2400, 'error');
  }
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

  const actualIndices = [...selectedSnippets]
    .filter(index => Number.isInteger(index) && index >= 0 && index < snippets.length)
    .sort((a, b) => b - a);
  for (const idx of actualIndices) {
    snippets.splice(idx, 1);
  }
  try {
    await invoke('save_snippets', { snippets });
  } catch (error) {
    await reloadData();
    showToast(`Delete failed: ${String(error)}`, 2400, 'error');
    return;
  }
  selectedSnippets.clear();
  multiSelectMode = false;
  multiSelectBtn.classList.remove('active');
  bulkActionBar.classList.add('hidden');
  reloadData();
  showToast(`${actualIndices.length} snippet(s) deleted`, 1600);
});

// ─── Selection & AutoPaste ─────────────────────────────────────────────────────
async function selectAndPaste(index) {
  if (!Number.isInteger(index) || index < 0 || index >= snippets.length) {
    showToast('This snippet is no longer available.', 1800, 'error');
    await reloadData();
    return;
  }
  const now = Date.now();
  snippets[index].use_count = Number(snippets[index].use_count || 0) + 1;
  snippets[index].last_used_at = now;
  await invoke('save_snippets', { snippets });

  const s = snippets[index];

  // If the snippet has a macro chain, execute it instead
  if (s.chain && s.chain.length > 0) {
    await appWindow.hide();
    await new Promise(r => setTimeout(r, 120));
    await executeChain(s.chain, snippets, invoke);
    reloadData();
    return;
  }

  let content = s.content;
  content = processStaticPlaceholders(content);
  content = await resolveClipboardPlaceholder(content);

  const customPlaceholders = getCustomPlaceholders(content);
  if (customPlaceholders.length > 0) {
    promptPlaceholders(customPlaceholders, content, async (filledContent) => {
      await performPaste(filledContent);
      reloadData();
    });
  } else {
    await performPaste(content);
    reloadData();
  }
}

// ─── Window Focus & Blur ───────────────────────────────────────────────────────
let firstFocus = true;

window.addEventListener('blur', async () => {
  if (appWindow.label === 'launcher') {
    // DO NOT hide on blur, allow clicking background windows
    return;
  }

  if (deferredClipboardText) {
    await processClipboardEntry(deferredClipboardText);
    deferredClipboardText = null;
  }

  if (pinnedWindow) return;
  // Prevent hide if select dropdown or input is active (avoids WebView2 dropdown blur bug)
  if (document.activeElement && (document.activeElement.tagName === 'SELECT' || document.activeElement.tagName === 'INPUT')) {
    return;
  }
  setTimeout(async () => {
    if (!dialogOverlay.classList.contains('hidden')) return;
    if (document.activeElement && (document.activeElement.tagName === 'SELECT' || document.activeElement.tagName === 'INPUT')) {
      return;
    }
    await appWindow.hide();
  }, 150);
});

window.addEventListener('focus', async () => {
  if (firstFocus) {
    firstFocus = false;
    await invoke('store_own_hwnd');
  }
  
  // Guarantee fresh data when switching to this window
  await reloadData();
});

async function processClipboardEntry(payload) {
  if (!payload || typeof payload !== 'object') return;
  const text = payload.text || '';
  const sourceApp = payload.source_app || 'Unknown';

  // Auto-detect Credit Card or IBAN formats to mask them
  const ibanRegex = /\bTR\d{2}[ ]?\d{4}[ ]?\d{4}[ ]?\d{4}[ ]?\d{4}[ ]?\d{4}[ ]?\d{2}\b/i;
  const ccRegex = /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/;
  const isSecret = ibanRegex.test(text) || ccRegex.test(text);

  // Smart Dedup: if exact content exists, bump it to top instead of adding a new entry
  const dedupResult = smartDedup(snippets, text, sourceApp);
  if (dedupResult.isDuplicate) {
    snippets = dedupResult.updatedSnippets;
    await invoke('save_snippets', { snippets });
    reloadData();
    return;
  }

  const firstLine = text.split('\n')[0].trim().substring(0, 50) || 'Clipboard entry';
  const now = Date.now();

  // Auto-detect type from content
  const detector = detectContentType(text);
  const autoType = isSecret ? 'password' : (detector ? detector.type : 'text');

  snippets.push({
    title: firstLine,
    content: text,
    pinned: false,
    use_count: 0,
    category: 'Clipboard',
    tags: ['history'],
    shortcut: null,
    is_secret: isSecret,
    snippet_type: autoType,
    color: null,
    created_at: now,
    last_used_at: 0,
    trigger: null,
    slot: null,
    source_app: sourceApp,
    emoji: null,
    chain: [],
  });
  await invoke('save_snippets', { snippets });
  reloadData();
}

// ─── Header Controls ──────────────────────────────────────────────────────────
pinWindowBtn.addEventListener('click', () => {
  pinnedWindow = !pinnedWindow;
  pinWindowBtn.classList.toggle('active', pinnedWindow);
  invoke('set_pinned', { value: pinnedWindow });
  showToast(pinnedWindow ? 'Window pinned' : 'Window unpinned');
});

if (openLauncherBtn) {
  openLauncherBtn.addEventListener('click', async () => {
    await appWindow.hide();
    await invoke('open_launcher_window');
  });
}

if (openSettingsBtn) {
  openSettingsBtn.addEventListener('click', async () => {
    await appWindow.hide();
    await invoke('open_main_window');
  });
}

// (Settings btn logic moved to bottom)

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
    dialogTriggerInput.value  = '';
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
window.addEventListener('keydown', async e => {
  if (e.key === 'Escape') {
    if (textExpansionPanel?.isOpen()) { textExpansionPanel.closePanel(); return; }
    if (isCommandPaletteOpen()) { closeCommandPalette(); return; }
    if (!dialogOverlay.classList.contains('hidden')) { closeDialog(); return; }
    if (multiSelectMode) { bulkCancelBtn.click(); return; }
    if (settingsOpen) {
      returnToMainPage();
      return;
    }
    if (dashboardOpen) {
      returnToMainPage();
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
  if (textExpansionPanel?.isOpen()) return;
  if (settingsOpen) return;

  // 0. Command Palette (Alt+Q then W)
  // New shortcut: press Alt+Q, then press W within timeout to open the palette.
  if (e.altKey && e.key.toLowerCase() === 'q') {
    // Start sequence wait
    e.preventDefault();
    seqAltQPending = true;
    if (seqAltQTimer) clearTimeout(seqAltQTimer);
    seqAltQTimer = setTimeout(() => { seqAltQPending = false; seqAltQTimer = null; }, 1200);
    return;
  }

  if (seqAltQPending && e.key.toLowerCase() === 'w') {
    e.preventDefault();
    seqAltQPending = false;
    if (seqAltQTimer) { clearTimeout(seqAltQTimer); seqAltQTimer = null; }
    openCommandPalette(snippets, {
      newSnippet: () => addBtn.click(),
      openSettings: () => settingsBtn.click(),
      openDashboard: () => dashboardBtn.click(),
      exportData: () => exportBtn.click(),
      importData: () => importBtn.click(),
      clearAll: () => clearBtn.click(),

      pasteSnippet: (s) => {
        const idx = snippets.findIndex(x => x.title === s.title && x.content === s.content);
        if (idx >= 0) selectAndPaste(idx);
      },
    });
    return;
  }

  // Quick Look with Space on selected snippet
  if (e.key === ' ' && !e.ctrlKey && !e.altKey && !e.shiftKey && document.activeElement !== searchInput) {
    if (selectedIndex >= 0 && selectedIndex < filteredSnippets.length) {
      e.preventDefault();
      const s = filteredSnippets[selectedIndex].s;
      showQuickLook(s);
      return;
    }
  }

  // 1. Paste as Plain Text (Ctrl + Shift + V)
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'v') {
    e.preventDefault();
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        if (pinnedWindow) {
          try {
            const ok = await invoke('copy_and_paste', { content: text, hwnd: null, skipCopy: false });
            if (ok) {
              setTimeout(() => appWindow.setFocus(), 180);
            } else {
              showToast('Paste failed', 1600, 'error');
            }
          } catch (err) {
            showToast('Paste failed', 1600, 'error');
          }
        } else {
          await appWindow.hide();
          setTimeout(async () => {
            try {
              const ok = await invoke('copy_and_paste', { content: text, hwnd: null, skipCopy: false });
              if (!ok) showToast('Paste failed', 1600, 'error');
            } catch (err) {
              showToast('Paste failed', 1600, 'error');
            }
          }, 120);
        }
      }
    } catch {
      showToast('Cannot read clipboard', 1600, 'error');
    }
    return;
  }

  // 2. Ctrl + C on selected snippet to copy only
  if (e.ctrlKey && e.key.toLowerCase() === 'c') {
    if (selectedIndex >= 0 && selectedIndex < filteredSnippets.length) {
      e.preventDefault();
      const s = filteredSnippets[selectedIndex].s;
      try {
        const ok = await invoke('copy_only', { content: s.content });
        if (ok) {
          showToast('Copied to clipboard!', 1200, 'success');
          if (appWindow.label === 'launcher' && !pinnedWindow) {
            await appWindow.hide();
          }
        } else {
          showToast('Copy failed', 1600, 'error');
        }
      } catch (err) {
        showToast('Copy failed', 1600, 'error');
      }
      return;
    }
  }

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
  } else {
    // 3. Type-to-Filter Autofocus redirect
    if (document.activeElement !== searchInput && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      searchInput.focus();
      searchInput.value += e.key;
      // Trigger input event
      searchInput.dispatchEvent(new Event('input'));
      e.preventDefault();
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
  const el = listContainer.querySelector('.snippet-card.selected-card');
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

// ─── Opacity Slider ─────────────────────────────────────────────────────────���─
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
  dialogTriggerInput.value  = '';
  dialogTagsInput.value     = '';
  dialogShortcutInput.value = '';
  document.getElementById('dialogSlotInput').value = '';
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
  const emoji        = (document.getElementById('dialogEmojiInput')?.value || '').trim() || null;
  const chainRaw     = (document.getElementById('dialogChainInput')?.value || '').trim();
  const chain        = chainRaw ? chainRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

  const trigger  = dialogTriggerInput.value.trim() || null;
  const slotRaw  = document.getElementById('dialogSlotInput').value;
  const slot     = slotRaw ? parseInt(slotRaw, 10) : null;

  if (!title || !content) {
    showToast('Title and content are required.', 1600, 'error');
    return;
  }

  const now = Date.now();
  if (editIndex >= 0) {
    snippets[editIndex] = {
      ...snippets[editIndex],
      title, content, category, tags, shortcut,
      is_secret, snippet_type, color, trigger, slot, emoji, chain,
    };
  } else {
    snippets.push({
      title, content,
      pinned: false, use_count: 0,
      category, tags, shortcut,
      is_secret, snippet_type, color,
      created_at: now,
      last_used_at: 0,
      trigger, slot, emoji, chain,
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

// ─── Theme Picker ─────────────────────────────────────────────────────────────
function setupThemePicker() {
  const themePickerGrid = document.getElementById('themePickerGrid');
  if (!themePickerGrid) {
    return;
  }

  themePickerGrid.innerHTML = '';

  THEMES.forEach((theme) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-dot-btn';
    btn.dataset.theme = theme.id;
    btn.title = `${theme.name} (${theme.accent})`;
    btn.innerHTML = `
      <span class="theme-dot-inner" style="background:${theme.accent}; color:#fff;">
        ${theme.emoji || ''}
      </span>
    `;
    btn.addEventListener('click', async () => {
      currentThemeId = theme.id;
      if (customAccentInput) {
        customAccentInput.value = theme.accent;
      }
      applyTheme(currentThemeId, !!appSettings.dark_mode);
      document.querySelectorAll('.theme-dot-btn').forEach((item) => {
        item.classList.toggle('active', item.dataset.theme === currentThemeId);
      });
      await saveCurrentSettings();
      showToast(`Theme updated: ${theme.name}`, 1400, 'success');
    });
    themePickerGrid.appendChild(btn);
  });

  if (customAccentInput) {
    customAccentInput.addEventListener('input', () => {
      currentThemeId = `custom:${customAccentInput.value.toLowerCase()}`;
      applyTheme(currentThemeId, !!appSettings.dark_mode);
      document.querySelectorAll('.theme-dot-btn').forEach((item) => {
        item.classList.remove('active');
      });
    });

    customAccentInput.addEventListener('change', async () => {
      currentThemeId = `custom:${customAccentInput.value.toLowerCase()}`;
      applyTheme(currentThemeId, !!appSettings.dark_mode);
      document.querySelectorAll('.theme-dot-btn').forEach((item) => {
        item.classList.remove('active');
      });
      await saveCurrentSettings();
      showToast(`Accent updated: ${customAccentInput.value.toUpperCase()}`, 1400, 'success');
    });
  }
}

// ─── Context Menu ─────────────────────────────────────────────────────────────
let activeContextIndex = -1;
let activeContextContent = '';

function showContextMenu(x, y, index, contentForTransform) {
  activeContextIndex = index;
  activeContextContent = contentForTransform || '';
  removeContextMenu();
  hideTransformSubmenu();

  const menu = document.createElement('div');
  // add `custom-context-menu` so removeContextMenu() can reliably find and remove it
  menu.className = 'custom-context-menu fixed z-[9500] rounded-xl py-1 min-w-[160px] bg-d-card border border-d-border animate-[ctxFadeIn_0.1s_ease]';
  menu.style.boxShadow = '0 8px 32px var(--qp-shadow)';

  const menuW = 170, menuH = 160;
  const safeX = Math.min(x, window.innerWidth  - menuW);
  const safeY = Math.min(y, window.innerHeight - menuH);
  menu.style.left = `${safeX}px`;
  menu.style.top  = `${safeY}px`;

  const isPinned = snippets[index].pinned;
  const btnClass = "block w-full text-left px-3.5 py-1.5 text-xs font-sans bg-transparent border-none cursor-pointer text-d-text hover:bg-d-hover transition-colors";
  
  menu.innerHTML = `
    <button class="${btnClass}" id="ctxPinBtn">${isPinned ? '📌 Unpin' : '📌 Pin'}</button>
    <button class="${btnClass}" id="ctxEditBtn">✏️ Edit</button>
    <button class="${btnClass}" id="ctxDupBtn">⧉ Duplicate</button>
    <button class="${btnClass} flex justify-between" id="ctxTransformBtn"><span>✨ Transform</span> <span class="opacity-50">›</span></button>
    <button class="${btnClass}" id="ctxQuickLookBtn">👁 Quick Look</button>
    <button class="${btnClass} text-red-400 hover:text-red-300" id="ctxDeleteBtn">🗑 Delete</button>
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
    dialogTriggerInput.value   = s.trigger || '';
    dialogTagsInput.value      = (s.tags || []).join(', ');
    dialogShortcutInput.value  = s.shortcut || '';
    dialogSecretToggle.checked = s.is_secret || false;
    dialogTypeInput.value      = s.snippet_type || 'text';
    dialogColorInput.value     = s.color || '';
    const emojiInput = document.getElementById('dialogEmojiInput');
    if (emojiInput) emojiInput.value = s.emoji || '';
    const chainInput = document.getElementById('dialogChainInput');
    if (chainInput) chainInput.value = (s.chain || []).join(', ');
    document.getElementById('dialogSlotInput').value = s.slot !== undefined && s.slot !== null ? s.slot.toString() : '';
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

  document.getElementById('ctxTransformBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    showTransformSubmenu(activeContextContent, index);
  });

  document.getElementById('ctxQuickLookBtn').addEventListener('click', () => {
    removeContextMenu();
    showQuickLook(snippets[index]);
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
  if (!e.target.closest('.custom-context-menu') && !e.target.closest('#transformSubmenu')) {
    removeContextMenu();
    hideTransformSubmenu();
  }
}

// ─── Transform Submenu ────────────────────────────────────────────────────────
const transformSubmenuEl = document.getElementById('transformSubmenu');

function showTransformSubmenu(content, snippetIndex) {
  transformSubmenuEl.innerHTML = '';
  transformSubmenuEl.classList.remove('hidden');

  // Position near the context menu
  const ctxMenu = document.querySelector('.custom-context-menu');
  if (ctxMenu) {
    const rect = ctxMenu.getBoundingClientRect();
    transformSubmenuEl.style.left = `${rect.right + 4}px`;
    transformSubmenuEl.style.top  = `${rect.top}px`;
  }

  TRANSFORMS.forEach((transform, idx) => {
    if (idx > 0 && idx % 5 === 0) {
      const sep = document.createElement('div');
      sep.className = 'h-px bg-d-border my-1';
      transformSubmenuEl.appendChild(sep);
    }
    const btn = document.createElement('button');
    btn.className = 'w-full text-left px-3 py-1.5 text-[11px] font-sans bg-transparent border-none cursor-pointer text-d-text hover:bg-d-hover hover:text-d-primary transition-colors block';
    btn.textContent = transform.label;
    btn.addEventListener('click', async () => {
      const transformed = applyTransform(transform.id, content);
      snippets[snippetIndex].content = transformed;
      await invoke('save_snippets', { snippets });
      hideTransformSubmenu();
      removeContextMenu();
      reloadData();
      showToast(`Transform applied: ${transform.label.split(' ').slice(-1)[0]}`, 1400, 'success');
    });
    transformSubmenuEl.appendChild(btn);
  });
}

function hideTransformSubmenu() {
  transformSubmenuEl.classList.add('hidden');
  transformSubmenuEl.innerHTML = '';
}

// ─── Native Window Dragging ───────────────────────────────────────────────────
// NOTE: header buttons no longer carry the legacy `.header-btn` class, so the
// drag-guard must match the actual interactive elements (button/select and
// their children) or every click on Pin/Dashboard/Settings/Close gets hijacked
// into a window-drag instead of firing the button's click handler.
headerFrame.addEventListener('mousedown', async (e) => {
  if (e.button === 0 && !e.target.closest('button, select')) {
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
  const classes = ['shortcut-blue', 'shortcut-green', 'shortcut-orange', 'shortcut-purple', 'shortcut-pink', 'shortcut-teal'];
  return classes[Math.abs(hash) % classes.length];
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

// ─── Placeholders & Dynamic Processing ──────────────────────────────────────────
function processStaticPlaceholders(text) {
  const dateStr = new Date().toLocaleDateString('tr-TR') + ' ' + new Date().toLocaleTimeString('tr-TR');
  text = text.replace(/\{\{tarih\}\}/g, dateStr).replace(/\{date\}/g, dateStr);
  // Inline math expressions: {{= 5*20 }}
  text = processInlineExpressions(text);
  // Linked snippets: [[title]]
  text = resolveLinkedSnippets(text, snippets);
  // Conditional templates: {{if lang=tr}}...{{/if}}
  const context = { lang: navigator.language?.slice(0, 2) || 'tr' };
  text = processConditionalTemplates(text, context);
  return text;
}


async function resolveClipboardPlaceholder(text) {
  if (text.includes('{{pano}}') || text.includes('{clipboard}')) {
    try {
      const clipText = await navigator.clipboard.readText() || '';
      text = text.replace(/\{\{pano\}\}/g, clipText).replace(/\{clipboard\}/g, clipText);
    } catch (e) {
      text = text.replace(/\{\{pano\}\}/g, '').replace(/\{clipboard\}/g, '');
    }
  }
  return text;
}

function getCustomPlaceholders(text) {
  const regex = /\{\{([^}=]+)\}\}/g;
  const matches = new Set();
  let match;
  while ((match = regex.exec(text)) !== null) {
    const name = match[1].trim();
    if (name !== 'tarih' && name !== 'pano' && !name.startsWith('=') && !name.startsWith('if') && !name.startsWith('/if') && !name.startsWith('else') && !name.startsWith('date')) {
      matches.add(name);
    }
  }
  return [...matches];
}

const placeholderOverlay = document.getElementById('placeholderOverlay');
const placeholderFieldsContainer = document.getElementById('placeholderFieldsContainer');
const placeholderCancelBtn = document.getElementById('placeholderCancelBtn');
const placeholderPasteBtn = document.getElementById('placeholderPasteBtn');

let placeholderCallback = null;
let originalPlaceholderContent = '';

function promptPlaceholders(placeholders, content, callback) {
  originalPlaceholderContent = content;
  placeholderCallback = callback;
  placeholderFieldsContainer.innerHTML = '';

  placeholders.forEach(name => {
    const row = document.createElement('div');
    row.className = 'flex flex-col gap-1';

    const label = document.createElement('label');
    label.className = 'text-[10px] font-semibold text-d-dim uppercase tracking-wider pl-1';
    label.textContent = name.toUpperCase();

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'w-full px-3 py-2 bg-d-input border border-d-border/50 rounded-lg text-sm text-d-text focus:outline-none focus:border-d-primary transition-colors';
    input.dataset.placeholderName = name;
    input.placeholder = `Enter value for ${name}…`;

    row.appendChild(label);
    row.appendChild(input);
    placeholderFieldsContainer.appendChild(row);
  });

  placeholderOverlay.classList.remove('hidden');
  const firstInput = placeholderFieldsContainer.querySelector('input');
  if (firstInput) setTimeout(() => firstInput.focus(), 150);
}

placeholderCancelBtn.addEventListener('click', () => {
  placeholderOverlay.classList.add('hidden');
  placeholderCallback = null;
});

placeholderPasteBtn.addEventListener('click', () => {
  let content = originalPlaceholderContent;
  const inputs = placeholderFieldsContainer.querySelectorAll('input');
  inputs.forEach(input => {
    const name = input.dataset.placeholderName;
    const value = input.value || '';
    const regex = new RegExp(`\\{\\{\\s*${name}\\s*\\}\\}`, 'g');
    content = content.replace(regex, value);
  });
  
  placeholderOverlay.classList.add('hidden');
  if (placeholderCallback) {
    placeholderCallback(content);
    placeholderCallback = null;
  }
});

async function performPaste(content) {
  const isLauncher = appWindow.label === 'launcher';
  const autoPaste = isLauncher ? true : appSettings.auto_paste;
  if (autoPaste) {
    if (pinnedWindow && !isLauncher) {
      try {
        const ok = await invoke('copy_and_paste', { content, hwnd: null, skipCopy: false });
        if (ok) {
          setTimeout(() => appWindow.setFocus(), 180);
        } else {
          showToast('Paste failed', 1600, 'error');
        }
      } catch (err) {
        showToast('Paste failed', 1600, 'error');
      }
    } else {
      await appWindow.hide();
      setTimeout(async () => {
        try {
          const ok = await invoke('copy_and_paste', { content, hwnd: null, skipCopy: false });
          if (!ok) showToast('Paste failed', 1600, 'error');
        } catch (err) {
          showToast('Paste failed', 1600, 'error');
        }
      }, 120);
    }
  } else {
    try {
      const ok = await invoke('copy_only', { content });
      if (ok) {
        showToast('Copied to clipboard!', 1600, 'success');
        if (!pinnedWindow) {
          await appWindow.hide();
        }
      } else {
        showToast('Copy failed', 1600, 'error');
      }
    } catch (err) {
      showToast('Copy failed', 1600, 'error');
    }
  }
}

// ─── Dashboard Stats Calculation ────────────────────────────────────────────────
function updateDashboardStats() {
  let totalPastes = 0;
  let totalChars = 0;
  let textCount = 0;
  let codeCount = 0;
  let urlCount = 0;
  let passwordCount = 0;

  snippets.forEach(s => {
    totalPastes += (s.use_count || 0);
    totalChars += ((s.use_count || 0) * (s.content || '').length);
    
    const type = s.snippet_type || 'text';
    if (type === 'text') textCount++;
    else if (type === 'code') codeCount++;
    else if (type === 'url') urlCount++;
    else if (type === 'password') passwordCount++;
  });

  document.getElementById('statTotalPastes').textContent = totalPastes;
  
  const secondsSaved = totalPastes * 3;
  if (secondsSaved < 60) {
    document.getElementById('statTimeSaved').textContent = `${secondsSaved}s`;
  } else {
    const mins = Math.floor(secondsSaved / 60);
    const secs = secondsSaved % 60;
    document.getElementById('statTimeSaved').textContent = secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }

  document.getElementById('statTotalChars').textContent = formatCharCount(totalChars);

  const topList = document.getElementById('statTopSnippetsList');
  topList.innerHTML = '';
  const sortedByUse = [...snippets]
    .filter(s => (s.use_count || 0) > 0)
    .sort((a, b) => b.use_count - a.use_count)
    .slice(0, 5);

  if (sortedByUse.length === 0) {
    topList.innerHTML = `<div style="font-size: 10px; color: var(--outline); text-align: center; padding: 4px;">No pastes recorded yet</div>`;
  } else {
    sortedByUse.forEach(s => {
      const item = document.createElement('div');
      item.className = 'flex items-center justify-between py-1.5 border-b border-d-border/50 last:border-0';
      item.innerHTML = `
        <span class="text-[11px] font-medium text-d-text truncate pr-2 flex-1">${escapeHtml(s.title)}</span>
        <span class="text-[10px] text-d-dim shrink-0 bg-d-input px-1.5 py-0.5 rounded">${s.use_count} uses</span>
      `;
      topList.appendChild(item);
    });
  }

  const activityBars = document.getElementById('statActivityBars');
  activityBars.innerHTML = '';
  
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const activityData = [0, 0, 0, 0, 0, 0, 0];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const todayDay = new Date().getDay();

  snippets.forEach(s => {
    if (s.last_used_at) {
      const diffMs = now - s.last_used_at;
      const dayIdx = Math.floor(diffMs / dayMs);
      if (dayIdx >= 0 && dayIdx < 7) {
        activityData[dayIdx] += s.use_count || 0;
      }
    }
  });

  const maxActivity = Math.max(...activityData, 1);

  for (let i = 6; i >= 0; i--) {
    const val = activityData[i];
    const pct = Math.max((val / maxActivity) * 60, 4); // Max height scaled nicely to container
    const dayIndex = (todayDay - i + 7) % 7;
    const label = dayNames[dayIndex];

    const col = document.createElement('div');
    col.className = 'flex flex-col items-center justify-end gap-1.5 h-full flex-1';
    col.innerHTML = `
      <div class="w-full bg-d-primary rounded-t-sm min-h-[3px] transition-all duration-300" style="height: ${pct}px; opacity: ${val > 0 ? 1 : 0.2}" title="${val} pastes"></div>
      <div class="text-[9px] font-bold uppercase tracking-widest text-d-dim scale-90">${label}</div>
    `;
    activityBars.appendChild(col);
  }

  const totalTypeCount = textCount + codeCount + urlCount + passwordCount || 1;
  document.getElementById('barTypeText').style.width = `${(textCount / totalTypeCount) * 100}%`;
  document.getElementById('barTypeCode').style.width = `${(codeCount / totalTypeCount) * 100}%`;
  document.getElementById('barTypeUrl').style.width = `${(urlCount / totalTypeCount) * 100}%`;
  document.getElementById('barTypePassword').style.width = `${(passwordCount / totalTypeCount) * 100}%`;
}

// ─── Dashboard Transition ────────────────────────────────────────────────────────
dashboardBtn.addEventListener('click', () => {
  if (textExpansionPanel?.isOpen()) {
    textExpansionPanel.closePanel();
  }
  const nextOpen = !dashboardOpen;

  if (nextOpen) {
    applyPanelHeaderState('dashboard');
    resizeForSidePanel(true);
    updateDashboardStats();
  } else {
    returnToMainPage();
  }
});

// Update settingsBtn listener to handle dashboard panel toggle state
settingsBtn.addEventListener('click', () => {
  if (textExpansionPanel?.isOpen()) {
    textExpansionPanel.closePanel();
  }
  const nextOpen = !settingsOpen;

  if (nextOpen) {
    applyPanelHeaderState('settings');
    resizeForSidePanel(true);
  } else {
    returnToMainPage();
  }
});

if (mainPageBtn) {
  mainPageBtn.addEventListener('click', returnToMainPage);
}

openWelcomeScreenBtn?.addEventListener('click', () => {
  invoke('open_welcome_window');
});


// ─── Paste Stack (Sıralı Yapıştırma) ─────────────────────────────────────────────
let pasteStack = [];
const bulkStackBtn = document.getElementById('bulkStackBtn');
const stackBadge = document.getElementById('stackBadge');
const stackCount = document.getElementById('stackCount');

bulkStackBtn.addEventListener('click', () => {
  if (selectedSnippets.size === 0) return;
  
  const sortedIndices = [...selectedSnippets].sort((a, b) => a - b);
  pasteStack = sortedIndices.map(fi => filteredSnippets[fi].s.content);
  
  selectedSnippets.clear();
  multiSelectMode = false;
  multiSelectBtn.classList.remove('active');
  bulkActionBar.classList.add('hidden');
  
  updateStackUI();
  loadAndDisplay();
  showToast(`${pasteStack.length} items added to Stack!`, 1800, 'success');
});

function updateStackUI() {
  if (pasteStack.length > 0) {
    stackCount.textContent = pasteStack.length;
    stackBadge.classList.remove('hidden');
  } else {
    stackBadge.classList.add('hidden');
  }
}

stackBadge.addEventListener('click', async () => {
  if (pasteStack.length === 0) return;
  
  const content = pasteStack.shift();
  updateStackUI();
  
  await performPaste(content);
});

// ─── Extra Settings Listeners ───────────────────────────────────────────────────
const historyDurationInput = document.getElementById('historyDurationInput');
historyDurationInput.addEventListener('change', saveCurrentSettings);

