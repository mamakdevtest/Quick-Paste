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
      // Find snippet by title
      const found = snippets.find(s =>
        s.title.toLowerCase() === step.toLowerCase()
      );
      if (found) {
        try {
          const ok = await invoke('copy_and_paste', { content: found.content, hwnd: null, skipCopy: false });
          if (!ok) {
            console.error('copy_and_paste failed during executeChain');
            break;
          }
          await delay(120);
        } catch (err) {
          console.error('copy_and_paste threw in executeChain', err);
          break;
        }
      }
    }
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Theme System ─────────────────────────────────────────────────────────────

export const THEMES = [
  { id: 'teal', name: 'QuickPaste', accent: '#14b8a6', emoji: '🩵' },
  { id: 'blue', name: 'Ocean', accent: '#2563eb', emoji: '🔵' },
  { id: 'violet', name: 'Violet', accent: '#7c3aed', emoji: '💜' },
  { id: 'green', name: 'Forest', accent: '#16a34a', emoji: '🟢' },
  { id: 'orange', name: 'Amber', accent: '#d97706', emoji: '🟠' },
  { id: 'rose', name: 'Rose', accent: '#e11d48', emoji: '🌹' },
  { id: 'slate', name: 'Slate', accent: '#475569', emoji: '⬜' },
];

function buildThemeTokens(accentHex, isDark) {
  const accent = rgbToHex(hexToRgb(accentHex) || { r: 124, g: 58, b: 237 });
  const base = isDark
    ? {
        window: 'rgba(11, 15, 20, 0.94)',
        bg: '#0b0f14',
        surface: '#121820',
        surface2: '#171e27',
        surface3: '#202a35',
        border: '#283340',
        borderStrong: '#3b4a5b',
        text: '#f2f5f7',
        muted: '#8e9baa',
        mutedSoft: '#bac3cc',
        outline: '#3b4a5b',
        outlineVariant: '#283340',
        shadow: 'rgba(0,0,0,0.48)',
        overlay: 'rgba(3,6,9,0.78)',
        accentPrimary: mixHex(accent, '#ffffff', 0.2),
        accentPrimaryContainer: mixHex(accent, '#000000', 0.32),
        accentPrimaryFixed: mixHex(accent, '#000000', 0.7),
        accentPrimaryContrast: '#04110f',
        accentPrimarySoft: rgba(accent, 0.12),
        accentPrimaryStrong: rgba(accent, 0.2),
        accentSelected: rgba(accent, 0.16),
        accentSelectedBorder: rgba(accent, 0.46),
        accentHover: rgba('#ffffff', 0.05),
        accentHoverStrong: rgba('#ffffff', 0.08),
        focusRing: rgba(accent, 0.28),
        success: '#35c6af',
        warning: '#d9ad58',
        danger: '#ec7272',
        info: '#69a9df',
      }
    : {
        window: 'rgba(255,255,255,0.88)',
        bg: '#f6f0f8',
        surface: '#ffffff',
        surface2: '#f2ecf4',
        surface3: '#e6e0e9',
        border: '#cbc4d2',
        borderStrong: '#aba2b6',
        text: '#1d1b20',
        muted: '#605d66',
        mutedSoft: '#7d7884',
        outline: '#7d7884',
        outlineVariant: '#cbc4d2',
        shadow: 'rgba(29,27,32,0.18)',
        overlay: 'rgba(29,27,32,0.45)',
        accentPrimary: mixHex(accent, '#000000', 0.12),
        accentPrimaryContainer: mixHex(accent, '#ffffff', 0.08),
        accentPrimaryFixed: mixHex(accent, '#ffffff', 0.82),
        accentPrimaryContrast: '#ffffff',
        accentPrimarySoft: rgba(accent, 0.08),
        accentPrimaryStrong: rgba(accent, 0.14),
        accentSelected: rgba(accent, 0.12),
        accentSelectedBorder: rgba(accent, 0.28),
        accentHover: rgba(accent, 0.06),
        accentHoverStrong: rgba(accent, 0.1),
        focusRing: rgba(accent, 0.22),
        success: '#16a34a',
        warning: '#d97706',
        danger: '#dc2626',
        info: '#2563eb',
      };

  return {
    '--qp-window-bg': base.window,
    '--qp-bg': base.bg,
    '--qp-surface': base.surface,
    '--qp-surface-2': base.surface2,
    '--qp-surface-3': base.surface3,
    '--qp-input-bg': base.surface2,
    '--qp-border': base.border,
    '--qp-border-strong': base.borderStrong,
    '--qp-text': base.text,
    '--qp-muted': base.muted,
    '--qp-muted-soft': base.mutedSoft,
    '--qp-outline': base.outline,
    '--qp-outline-variant': base.outlineVariant,
    '--qp-shadow': base.shadow,
    '--qp-overlay': base.overlay,
    '--qp-primary': base.accentPrimary,
    '--qp-primary-container': base.accentPrimaryContainer,
    '--qp-primary-fixed': base.accentPrimaryFixed,
    '--qp-primary-contrast': base.accentPrimaryContrast,
    '--qp-primary-soft': base.accentPrimarySoft,
    '--qp-primary-strong': base.accentPrimaryStrong,
    '--qp-primary-selected': base.accentSelected,
    '--qp-primary-selected-border': base.accentSelectedBorder,
    '--qp-hover': base.accentHover,
    '--qp-hover-strong': base.accentHoverStrong,
    '--qp-focus-ring': base.focusRing,
    '--qp-success': base.success,
    '--qp-warning': base.warning,
    '--qp-danger': base.danger,
    '--qp-info': base.info,
    '--primary': base.accentPrimary,
    '--primary-container': base.accentPrimaryContainer,
    '--primary-fixed': base.accentPrimaryFixed,
    '--primary-contrast': base.accentPrimaryContrast,
    '--card-hover': base.accentHover,
    '--outline': base.outline,
    '--outline-variant': base.outlineVariant,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function expandHex(hex) {
  const clean = String(hex || '').trim().replace(/^#/, '');
  if (clean.length === 3) {
    return clean.split('').map((char) => char + char).join('');
  }
  return clean;
}

function hexToRgb(hex) {
  const expanded = expandHex(hex);
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    return null;
  }
  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }) {
  const toHex = (value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function mixHex(hex, targetHex, amount) {
  const start = hexToRgb(hex);
  const target = hexToRgb(targetHex);
  if (!start || !target) {
    return hex;
  }
  return rgbToHex({
    r: start.r + (target.r - start.r) * amount,
    g: start.g + (target.g - start.g) * amount,
    b: start.b + (target.b - start.b) * amount,
  });
}

function rgba(hex, alpha) {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return `rgba(124,58,237,${alpha})`;
  }
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
}

const THEME_VARIABLE_KEYS = Object.keys(buildThemeTokens('#7c3aed', true));

export function resolveTheme(themeId) {
  if (String(themeId || '').startsWith('custom:')) {
    const accent = String(themeId).slice('custom:'.length) || '#7c3aed';
    return buildCustomTheme(accent);
  }
  return THEMES.find(t => t.id === themeId) || THEMES[0];
}

export function applyTheme(themeId, isDark) {
  const theme = resolveTheme(themeId);
  const vars = buildThemeTokens(theme.accent, !!isDark);
  const root = document.documentElement;
  root.style.colorScheme = isDark ? 'dark' : 'light';
  for (const [key, val] of Object.entries(vars)) {
    root.style.setProperty(key, val);
  }
  root.dataset.theme = themeId;
  root.dataset.themeMode = isDark ? 'dark' : 'light';
  document.body.dataset.theme = themeId;
  document.body.dataset.themeMode = isDark ? 'dark' : 'light';
}

export function resetThemeVars() {
  const root = document.documentElement;
  for (const key of THEME_VARIABLE_KEYS) {
    root.style.removeProperty(key);
  }
}

function buildCustomTheme(accentHex) {
  const accent = rgbToHex(hexToRgb(accentHex) || { r: 124, g: 58, b: 237 });
  return {
    id: `custom:${accent.toLowerCase()}`,
    name: 'Custom',
    accent,
    emoji: '🎯',
  };
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
