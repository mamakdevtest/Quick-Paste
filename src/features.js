/**
 * QuickPaste — features.js
 * Gelişmiş özellikler modülü
 * © 2026 Emir Han Mamak — Mamak Studio
 */

// ─── Smart Content Detection ─────────────────────────────────────────────────

const CONTENT_DETECTORS = [
  {
    type: 'url',
    icon: '🔗',
    label: 'URL',
    test: (t) => /^https?:\/\/\S+/.test(t.trim()),
    actions: [
      { label: '🔗 Open', fn: (t) => { try { window.__TAURI__.shell.open(t.trim()); } catch { window.open(t.trim(), '_blank'); } } }
    ]
  },
  {
    type: 'email',
    icon: '📧',
    label: 'Email',
    test: (t) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t.trim()),
    actions: [
      { label: '📧 Mail To', fn: (t) => { window.open(`mailto:${t.trim()}`); } }
    ]
  },
  {
    type: 'color',
    icon: '🎨',
    label: 'Color',
    test: (t) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(t.trim()),
    actions: [],
    badge: (t) => `<span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${t.trim()};border:1px solid var(--outline-variant);vertical-align:middle;margin-left:4px;"></span>`
  },
  {
    type: 'json',
    icon: '📋',
    label: 'JSON',
    test: (t) => { try { JSON.parse(t); return t.trim().startsWith('{') || t.trim().startsWith('['); } catch { return false; } },
    actions: [
      { label: '✨ Prettify', fn: (t, updateFn) => updateFn(JSON.stringify(JSON.parse(t), null, 2)) },
      { label: '📦 Minify', fn: (t, updateFn) => updateFn(JSON.stringify(JSON.parse(t))) }
    ]
  },
  {
    type: 'ip',
    icon: '🖧',
    label: 'IP',
    test: (t) => /^(\d{1,3}\.){3}\d{1,3}(:\d+)?$/.test(t.trim()),
    actions: []
  },
  {
    type: 'date',
    icon: '📅',
    label: 'Date',
    test: (t) => !isNaN(Date.parse(t.trim())) && /\d{4}|\d{2}[\/\-]\d{2}/.test(t.trim()),
    actions: []
  },
  {
    type: 'phone',
    icon: '📞',
    label: 'Phone',
    test: (t) => /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{6,15}$/.test(t.trim()),
    actions: [
      { label: '📞 Call', fn: (t) => { window.open(`tel:${t.trim()}`); } }
    ]
  },
  {
    type: 'code',
    icon: '💻',
    label: 'Code',
    test: (t) => /\bfunction\b|\bconst\b|\blet\b|\bvar\b|\bimport\b|\bexport\b|\bclass\b|\bdef\b|\bint\b|\bvoid\b|\bpublic\b/.test(t),
    actions: []
  },
];

export function detectContentType(text) {
  if (!text) return null;
  for (const detector of CONTENT_DETECTORS) {
    if (detector.test(text)) return detector;
  }
  return null;
}

export function getSmartActions(text) {
  const detector = detectContentType(text);
  return detector ? detector.actions : [];
}

export function getSmartIcon(text, fallbackType) {
  const detector = detectContentType(text);
  if (detector) return detector.icon;
  switch (fallbackType) {
    case 'code': return '💻';
    case 'url': return '🔗';
    case 'password': return '🔒';
    default: return '📝';
  }
}

export function getColorPreviewBadge(text) {
  const detector = detectContentType(text);
  if (detector && detector.type === 'color' && detector.badge) {
    return detector.badge(text);
  }
  return '';
}

// ─── Transform Pipeline ───────────────────────────────────────────────────────

export const TRANSFORMS = [
  { id: 'uppercase',   label: '⬆ UPPERCASE',           fn: (t) => t.toUpperCase() },
  { id: 'lowercase',   label: '⬇ lowercase',           fn: (t) => t.toLowerCase() },
  { id: 'titlecase',   label: '🔠 Title Case',          fn: (t) => t.replace(/\b\w/g, c => c.toUpperCase()) },
  { id: 'trim',        label: '✂ Trim Whitespace',      fn: (t) => t.split('\n').map(l => l.trim()).join('\n').trim() },
  { id: 'noeol',       label: '↩ Remove Line Breaks',   fn: (t) => t.replace(/[\r\n]+/g, ' ').trim() },
  { id: 'slugify',     label: '🔗 Slugify',             fn: (t) => t.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') },
  { id: 'b64enc',      label: '📦 Base64 Encode',       fn: (t) => btoa(unescape(encodeURIComponent(t))) },
  { id: 'b64dec',      label: '📦 Base64 Decode',       fn: (t) => { try { return decodeURIComponent(escape(atob(t))); } catch { return t; } } },
  { id: 'urlenc',      label: '🌐 URL Encode',          fn: (t) => encodeURIComponent(t) },
  { id: 'urldec',      label: '🌐 URL Decode',          fn: (t) => { try { return decodeURIComponent(t); } catch { return t; } } },
  { id: 'jsonpretty',  label: '✨ JSON Prettify',       fn: (t) => { try { return JSON.stringify(JSON.parse(t), null, 2); } catch { return t; } } },
  { id: 'jsonminify',  label: '📦 JSON Minify',         fn: (t) => { try { return JSON.stringify(JSON.parse(t)); } catch { return t; } } },
  { id: 'mdtotext',    label: '📝 Markdown → Plain',    fn: (t) => t.replace(/#{1,6}\s/g, '').replace(/[*_`~]/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') },
  { id: 'reversetext', label: '🔄 Reverse Text',        fn: (t) => t.split('').reverse().join('') },
  { id: 'linecount',   label: '🔢 Count Lines',         fn: (t) => `${t.split('\n').length} lines, ${t.length} chars` },
  { id: 'sortlines',   label: '📑 Sort Lines A-Z',      fn: (t) => t.split('\n').sort().join('\n') },
  { id: 'deduplicatelines', label: '♻ Deduplicate Lines', fn: (t) => [...new Set(t.split('\n'))].join('\n') },
];

export function applyTransform(transformId, text) {
  const transform = TRANSFORMS.find(t => t.id === transformId);
  if (!transform) return text;
  return transform.fn(text);
}

// ─── Fuzzy Search ─────────────────────────────────────────────────────────────

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => {
    const row = new Array(n + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i-1][j-1];
      else dp[i][j] = 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

export function fuzzyScore(query, text) {
  if (!query || !text) return 0;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return 100; // exact substring = perfect
  if (t.startsWith(q)) return 90;
  // Check if all chars of query appear in order in text (subsequence)
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  if (qi === q.length) return 70; // all chars present in order
  // Levenshtein proximity
  const dist = levenshtein(q, t.substring(0, Math.min(q.length + 3, t.length)));
  const maxLen = Math.max(q.length, t.length);
  const similarity = 1 - (dist / maxLen);
  return similarity > 0.6 ? Math.round(similarity * 60) : 0;
}

export function fuzzyFilter(snippets, query) {
  if (!query || query.length < 2) return null; // return null = use normal filter
  const scored = snippets.map((item) => {
    const s = item.s;
    const titleScore = fuzzyScore(query, s.title || '') * 1.5; // title weighted more
    const contentScore = fuzzyScore(query, (s.content || '').substring(0, 200));
    const categoryScore = fuzzyScore(query, s.category || '') * 0.8;
    const tagsScore = Math.max(0, ...(s.tags || []).map(t => fuzzyScore(query, t))) * 0.9;
    const best = Math.max(titleScore, contentScore, categoryScore, tagsScore);
    return { item, score: best };
  }).filter(x => x.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.map(x => x.item);
}

// ─── Inline Expression Evaluator ─────────────────────────────────────────────

export function processInlineExpressions(text) {
  // {{= expression }} → evaluate safely
  text = text.replace(/\{\{=\s*([^}]+)\s*\}\}/g, (_, expr) => {
    try {
      // Safe math-only evaluation
      const sanitized = expr.replace(/[^0-9+\-*/.() %]/g, '');
      if (!sanitized.trim()) return `{{= ${expr} }}`;
      // eslint-disable-next-line no-new-func
      const result = Function(`"use strict"; return (${sanitized})`)();
      return String(result);
    } catch {
      return `{{= ${expr} }}`;
    }
  });

  // {{date +Nd}} or {{date -Nd}} → date arithmetic
  text = text.replace(/\{\{date\s*([+-]\d+)d?\}\}/g, (_, offset) => {
    const d = new Date();
    d.setDate(d.getDate() + parseInt(offset, 10));
    return d.toLocaleDateString('tr-TR');
  });

  // {{date}} → today
  text = text.replace(/\{\{date\}\}/g, () => new Date().toLocaleDateString('tr-TR'));

  return text;
}

// ─── Linked Snippets (Recursive Reference [[title]]) ─────────────────────────

export function resolveLinkedSnippets(text, snippets, depth = 0) {
  if (depth > 5) return text; // prevent infinite recursion
  return text.replace(/\[\[([^\]]+)\]\]/g, (_, refTitle) => {
    const found = snippets.find(s => s.title.toLowerCase() === refTitle.trim().toLowerCase());
    if (!found) return `[[${refTitle}]]`; // unresolved
    return resolveLinkedSnippets(found.content, snippets, depth + 1);
  });
}

// ─── Conditional Templates ────────────────────────────────────────────────────

export function processConditionalTemplates(text, context = {}) {
  // {{if var=value}}...{{else}}...{{/if}}
  return text.replace(/\{\{if\s+(\w+)=([^}]+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g,
    (_, varName, expectedVal, thenPart, elsePart = '') => {
      const actualVal = String(context[varName] || '').toLowerCase();
      const expected = expectedVal.trim().toLowerCase();
      return actualVal === expected ? thenPart : elsePart;
    }
  );
}

// ─── Smart Dedup ─────────────────────────────────────────────────────────────

export function smartDedup(snippets, newText, newSourceApp) {
  const existingIdx = snippets.findIndex(s => s.content === newText);
  if (existingIdx === -1) return { isDuplicate: false, updatedSnippets: snippets };

  // Move to top and update timestamp
  const existing = snippets[existingIdx];
  existing.last_used_at = Date.now();
  existing.use_count = (existing.use_count || 0) + 1;

  const updated = [
    existing,
    ...snippets.filter((_, i) => i !== existingIdx)
  ];
  return { isDuplicate: true, updatedSnippets: updated, existingSnippet: existing };
}

// ─── Auto-Promote Suggestions ────────────────────────────────────────────────

const PROMOTE_THRESHOLD = 10;

export function getAutoPromoteSuggestions(snippets) {
  return snippets.filter(s =>
    (s.use_count || 0) >= PROMOTE_THRESHOLD &&
    !s.pinned &&
    !s.slot &&
    !s.trigger
  );
}

// ─── Context-Aware Suggestions ───────────────────────────────────────────────

const CONTEXT_MAP = {
  'code.exe': ['code', 'snippet', 'function', 'sql', 'git'],
  'cursor.exe': ['code', 'snippet', 'function', 'sql', 'git'],
  'devenv.exe': ['code', 'snippet', 'function', 'sql', 'git'],
  'notepad.exe': ['text', 'note'],
  'notepad++.exe': ['code', 'text'],
  'outlook.exe': ['email', 'signature', 'template'],
  'thunderbird.exe': ['email', 'signature'],
  'chrome.exe': ['url', 'link', 'web'],
  'msedge.exe': ['url', 'link', 'web'],
  'firefox.exe': ['url', 'link', 'web'],
  'slack.exe': ['message', 'template', 'response'],
  'teams.exe': ['message', 'template'],
  'powershell.exe': ['command', 'code', 'script'],
  'cmd.exe': ['command', 'code'],
  'windowsterminal.exe': ['command', 'code', 'script'],
  'excel.exe': ['formula', 'code', 'data'],
  'word.exe': ['template', 'text', 'document'],
};

export function getContextScore(snippet, processName) {
  if (!processName) return 0;
  const pn = processName.toLowerCase();
  const keywords = CONTEXT_MAP[pn] || [];
  if (keywords.length === 0) return 0;

  const title = (snippet.title || '').toLowerCase();
  const category = (snippet.category || '').toLowerCase();
  const tags = (snippet.tags || []).map(t => t.toLowerCase());
  const type = (snippet.snippet_type || '').toLowerCase();

  let score = 0;
  for (const kw of keywords) {
    if (title.includes(kw) || category.includes(kw) || tags.includes(kw) || type === kw) {
      score += 20;
    }
  }
  return score;
}

export function sortByContext(snippets, processName) {
  if (!processName) return snippets;
  return [...snippets].sort((a, b) => {
    const scoreA = getContextScore(a.s, processName);
    const scoreB = getContextScore(b.s, processName);
    if (scoreB !== scoreA) return scoreB - scoreA;
    return 0; // preserve original order for equal context scores
  });
}

// ─── Snippet Chaining / Macros ────────────────────────────────────────────────

/**
 * chain format: Array of steps — string (snippet id/title) or "tab" | "enter" | "space" | "delay:N"
 */
export async function executeChain(chain, snippets, invoke) {
  for (const step of chain) {
    if (step === 'tab') {
      await invoke('send_key', { key: 'Tab' });
      await delay(80);
    } else if (step === 'enter') {
      await invoke('send_key', { key: 'Return' });
      await delay(80);
    } else if (step === 'space') {
      await invoke('send_key', { key: 'Space' });
      await delay(80);
    } else if (step.startsWith('delay:')) {
      const ms = parseInt(step.split(':')[1], 10) || 200;
      await delay(ms);
    } else {
      // Find snippet by title or id
      const found = snippets.find(s =>
        s.title.toLowerCase() === step.toLowerCase() ||
        s.id === step
      );
      if (found) {
        await invoke('copy_and_paste', { content: found.content, hwnd: null, skipCopy: false });
        await delay(120);
      }
    }
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Theme System ─────────────────────────────────────────────────────────────

export const THEMES = [
  {
    id: 'violet',
    name: 'QuickPaste',
    accent: '#7c3aed',
    emoji: '💜',
    vars: {
      '--primary': '#7c3aed',
      '--primary-container': '#8b5cf6',
      '--primary-fixed': '#ede9fe',
      '--card-hover': 'rgba(124,58,237,0.06)',
    },
    darkVars: {
      '--primary': '#a78bfa',
      '--primary-container': '#7c3aed',
      '--primary-fixed': '#2e1065',
      '--card-hover': 'rgba(167,139,250,0.08)',
    }
  },
  {
    id: 'blue',
    name: 'Ocean',
    accent: '#2563eb',
    emoji: '🔵',
    vars: {
      '--primary': '#1d4ed8',
      '--primary-container': '#2563eb',
      '--primary-fixed': '#dbeafe',
      '--card-hover': 'rgba(37,99,235,0.06)',
    },
    darkVars: {
      '--primary': '#60a5fa',
      '--primary-container': '#1e40af',
      '--primary-fixed': '#1e3a5f',
      '--card-hover': 'rgba(96,165,250,0.08)',
    }
  },
  {
    id: 'green',
    name: 'Forest',
    accent: '#16a34a',
    emoji: '🟢',
    vars: {
      '--primary': '#15803d',
      '--primary-container': '#16a34a',
      '--primary-fixed': '#dcfce7',
      '--card-hover': 'rgba(22,163,74,0.06)',
    },
    darkVars: {
      '--primary': '#4ade80',
      '--primary-container': '#166534',
      '--primary-fixed': '#14532d',
      '--card-hover': 'rgba(74,222,128,0.08)',
    }
  },
  {
    id: 'orange',
    name: 'Amber',
    accent: '#d97706',
    emoji: '🟠',
    vars: {
      '--primary': '#b45309',
      '--primary-container': '#d97706',
      '--primary-fixed': '#fef3c7',
      '--card-hover': 'rgba(217,119,6,0.06)',
    },
    darkVars: {
      '--primary': '#fbbf24',
      '--primary-container': '#92400e',
      '--primary-fixed': '#451a03',
      '--card-hover': 'rgba(251,191,36,0.08)',
    }
  },
  {
    id: 'rose',
    name: 'Rose',
    accent: '#e11d48',
    emoji: '🌹',
    vars: {
      '--primary': '#be123c',
      '--primary-container': '#e11d48',
      '--primary-fixed': '#ffe4e6',
      '--card-hover': 'rgba(225,29,72,0.06)',
    },
    darkVars: {
      '--primary': '#fb7185',
      '--primary-container': '#9f1239',
      '--primary-fixed': '#4c0519',
      '--card-hover': 'rgba(251,113,133,0.08)',
    }
  },
  {
    id: 'slate',
    name: 'Slate',
    accent: '#475569',
    emoji: '⬜',
    vars: {
      '--primary': '#334155',
      '--primary-container': '#475569',
      '--primary-fixed': '#e2e8f0',
      '--card-hover': 'rgba(71,85,105,0.06)',
    },
    darkVars: {
      '--primary': '#94a3b8',
      '--primary-container': '#334155',
      '--primary-fixed': '#1e293b',
      '--card-hover': 'rgba(148,163,184,0.08)',
    }
  },
  {
    id: 'teal',
    name: 'Teal',
    accent: '#0d9488',
    emoji: '🩵',
    vars: {
      '--primary': '#0f766e',
      '--primary-container': '#0d9488',
      '--primary-fixed': '#ccfbf1',
      '--card-hover': 'rgba(13,148,136,0.06)',
    },
    darkVars: {
      '--primary': '#2dd4bf',
      '--primary-container': '#115e59',
      '--primary-fixed': '#042f2e',
      '--card-hover': 'rgba(45,212,191,0.08)',
    }
  },
];

export function applyTheme(themeId, isDark) {
  const theme = THEMES.find(t => t.id === themeId) || THEMES[0];
  const vars = isDark ? { ...theme.vars, ...theme.darkVars } : theme.vars;
  const root = document.documentElement;
  for (const [key, val] of Object.entries(vars)) {
    root.style.setProperty(key, val);
  }
  // Store on body for reference
  document.body.dataset.theme = themeId;
}

export function resetThemeVars() {
  const root = document.documentElement;
  for (const theme of THEMES) {
    for (const key of Object.keys(theme.vars)) {
      root.style.removeProperty(key);
    }
  }
}

// ─── Quick Look Preview ───────────────────────────────────────────────────────

let quickLookOverlayEl = null;

export function showQuickLook(snippet) {
  removeQuickLook();
  const isCode = snippet.snippet_type === 'code' ||
    /\bfunction\b|\bconst\b|\bclass\b|\bdef\b/.test(snippet.content);

  const overlay = document.getElementById('quickLookOverlay');
  const panel = document.getElementById('quickLookPanel');
  
  panel.innerHTML = `
    <div class="flex items-center gap-3 mb-4">
      <span class="text-2xl">${getSmartIcon(snippet.content, snippet.snippet_type)}</span>
      <h3 class="text-lg font-bold text-d-text flex-1 truncate">${escapeHtmlSimple(snippet.title)}</h3>
      <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-d-primary/20 text-d-primary">${snippet.snippet_type || 'text'}</span>
    </div>
    <div class="flex-1 bg-black/30 rounded-lg p-4 border border-d-border/50 overflow-auto whitespace-pre-wrap font-mono text-sm leading-relaxed text-d-text">
      ${snippet.is_secret ? '••••••••••••••••' : escapeHtmlSimple(snippet.content)}
    </div>
    <div class="mt-4 flex items-center justify-between text-xs text-d-dim font-sans border-t border-d-border/50 pt-3">
      <div class="flex gap-4">
        <span><strong class="text-d-text">${snippet.use_count || 0}</strong> uses</span>
        <span><strong class="text-d-text">${snippet.content.length}</strong> chars</span>
      </div>
      ${snippet.category ? `<span class="flex items-center gap-1"><span class="material-symbols-outlined" style="font-size:14px;">folder</span> ${escapeHtmlSimple(snippet.category)}</span>` : ''}
    </div>
  `;
  
  quickLookOverlayEl = overlay;
  
  // Attach event listeners dynamically to close btn since we reuse DOM
  const closeBtn = document.getElementById('quickLookClose');
  const overlayClick = (e) => { if (e.target === overlay) removeQuickLook(); };
  
  closeBtn.onclick = removeQuickLook;
  overlay.onclick = overlayClick;

  // Show it
  overlay.classList.remove('hidden');
}

export function removeQuickLook() {
  if (quickLookOverlayEl) {
    quickLookOverlayEl.classList.add('hidden');
    quickLookOverlayEl.onclick = null;
    document.getElementById('quickLookClose').onclick = null;
    quickLookOverlayEl = null;
  }
}

function escapeHtmlSimple(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Command Palette ──────────────────────────────────────────────────────────

let commandPaletteEl = null;
let commandPaletteOpen = false;
let paletteSelectedIdx = 0;
let paletteItems = [];

export function openCommandPalette(snippets, callbacks) {
  if (commandPaletteOpen) return;
  commandPaletteOpen = true;

  const overlay = document.getElementById('commandPaletteOverlay');
  commandPaletteEl = overlay;
  const input = document.getElementById('paletteInput');
  const results = document.getElementById('paletteResults');

  // Clear previous input
  input.value = '';

  // Show it
  overlay.classList.remove('hidden');
  input.focus();

  function buildSystemCommands() {
    return [
      { type: 'cmd', icon: '➕', label: 'New Snippet', desc: 'Create a new snippet', action: callbacks.newSnippet },
      { type: 'cmd', icon: '⚙', label: 'Settings', desc: 'Open settings panel', action: callbacks.openSettings },
      { type: 'cmd', icon: '📊', label: 'Dashboard', desc: 'Open stats dashboard', action: callbacks.openDashboard },
      { type: 'cmd', icon: '📤', label: 'Export Data', desc: 'Export all snippets', action: callbacks.exportData },
      { type: 'cmd', icon: '📥', label: 'Import Data', desc: 'Import snippets from file', action: callbacks.importData },
      { type: 'cmd', icon: '🗑', label: 'Clear All', desc: 'Delete all data', action: callbacks.clearAll, danger: true },
    ];
  }

  function render(query) {
    results.innerHTML = '';
    paletteItems = [];
    paletteSelectedIdx = 0;

    const isCommand = query.startsWith('>');
    const q = isCommand ? query.slice(1).trim().toLowerCase() : query.toLowerCase();

    if (isCommand || !q) {
      const cmds = buildSystemCommands().filter(c =>
        !q || c.label.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q)
      );
      paletteItems = [...cmds];
    }

    if (!isCommand) {
      // Snippet search
      const matched = snippets
        .filter(s => {
          if (!q) return true;
          const score = Math.max(
            fuzzyScore(q, s.title || ''),
            fuzzyScore(q, (s.content || '').substring(0, 100))
          );
          return score > 30;
        })
        .slice(0, 8)
        .map(s => ({
          type: 'snippet',
          icon: getSmartIcon(s.content, s.snippet_type),
          label: s.title,
          desc: (s.content || '').substring(0, 60).replace(/\n/g, ' '),
          snippet: s,
          action: () => callbacks.pasteSnippet(s),
        }));
      paletteItems = [...paletteItems, ...matched];
    }

    if (paletteItems.length === 0) {
      results.innerHTML = `<div class="p-4 text-center text-sm text-d-dim">No results found</div>`;
      return;
    }

    paletteItems.forEach((item, idx) => {
      const el = document.createElement('div');
      // Use Tailwind classes dynamically based on state
      const isSelected = idx === paletteSelectedIdx;
      const isDanger = item.danger;
      
      let baseClasses = "flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors border-l-2 border-transparent";
      if (isSelected) {
        if (isDanger) baseClasses += " bg-red-500/10 border-red-500";
        else baseClasses += " bg-blue-500/10 border-blue-400";
      } else {
        baseClasses += " hover:bg-d-hover";
      }
      
      el.className = baseClasses;
      el.dataset.index = idx;
      
      el.innerHTML = `
        <span class="text-xl w-6 text-center ${isDanger ? 'text-red-400' : ''}">${item.icon}</span>
        <div class="flex-1 flex flex-col overflow-hidden">
          <span class="text-sm font-semibold truncate ${isSelected ? (isDanger ? 'text-red-400' : 'text-blue-400') : 'text-d-text'}">${escapeHtmlSimple(item.label)}</span>
          <span class="text-[10px] text-d-dim truncate">${escapeHtmlSimple(item.desc || '')}</span>
        </div>
        <span class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${item.type === 'cmd' ? 'bg-purple-500/20 text-purple-400' : 'bg-d-dim/20 text-d-dim'}">${item.type}</span>
      `;
      el.addEventListener('mouseenter', () => {
        paletteSelectedIdx = idx;
        highlightPaletteItem();
      });
      el.addEventListener('click', () => selectPaletteItem(idx));
      results.appendChild(el);
    });
  }

  function highlightPaletteItem() {
    render(input.value); // Re-render to update tailwind classes
    const selected = results.children[paletteSelectedIdx];
    if (selected) selected.scrollIntoView({ block: 'nearest' });
  }

  function selectPaletteItem(idx) {
    const item = paletteItems[idx];
    if (!item) return;
    closeCommandPalette();
    setTimeout(() => item.action && item.action(), 80);
  }

  // Clear old listeners by cloning input
  const newInput = input.cloneNode(true);
  input.parentNode.replaceChild(newInput, input);
  
  newInput.addEventListener('input', () => render(newInput.value));
  newInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeCommandPalette(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      paletteSelectedIdx = Math.min(paletteSelectedIdx + 1, paletteItems.length - 1);
      highlightPaletteItem();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      paletteSelectedIdx = Math.max(paletteSelectedIdx - 1, 0);
      highlightPaletteItem();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectPaletteItem(paletteSelectedIdx);
    }
  });

  overlay.onclick = (e) => {
    if (e.target === overlay) closeCommandPalette();
  };

  render('');
}

export function closeCommandPalette() {
  if (commandPaletteEl) {
    commandPaletteEl.classList.add('hidden');
    commandPaletteEl.onclick = null;
    commandPaletteEl = null;
  }
  commandPaletteOpen = false;
}

export function isCommandPaletteOpen() {
  return commandPaletteOpen;
}

// ─── Auto-Promote Toast ───────────────────────────────────────────────────────

let promoteCheckDone = false;

export function checkAutoPromote(snippets, showToastFn, openEditFn) {
  if (promoteCheckDone) return;
  const suggestions = getAutoPromoteSuggestions(snippets);
  if (suggestions.length > 0) {
    promoteCheckDone = true;
    const s = suggestions[0];
    // Show a non-blocking suggestion after a small delay
    setTimeout(() => {
      showToastFn(`⭐ "${s.title}" used ${s.use_count}x — assign a trigger? (Edit to configure)`, 4000);
    }, 2000);
  }
}
