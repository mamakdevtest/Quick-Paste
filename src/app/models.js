const VALID_TYPES = new Set(['text', 'code', 'url', 'password']);

export function createSnippetId(snippet, index = 0) {
  if (snippet?.id) return String(snippet.id);
  const seed = `${snippet?.created_at || 0}:${snippet?.title || ''}:${snippet?.content || ''}:${index}`;
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `legacy-${(hash >>> 0).toString(36)}`;
}

export function normalizeSnippet(input, index = 0) {
  const source = input && typeof input === 'object' ? input : {};
  const createdAt = Number.isFinite(Number(source.created_at)) ? Number(source.created_at) : Date.now();
  const type = VALID_TYPES.has(source.snippet_type) ? source.snippet_type : 'text';
  return {
    ...source,
    id: createSnippetId({ ...source, created_at: createdAt }, index),
    title: String(source.title || '').trim(),
    content: String(source.content || ''),
    pinned: Boolean(source.pinned),
    use_count: Math.max(0, Number(source.use_count) || 0),
    category: source.category ? String(source.category).trim() : null,
    tags: Array.isArray(source.tags) ? [...new Set(source.tags.map(String).map((tag) => tag.trim()).filter(Boolean))] : [],
    shortcut: source.shortcut ? String(source.shortcut).trim() : null,
    trigger: source.trigger ? String(source.trigger).trim() : null,
    slot: Number.isInteger(Number(source.slot)) && Number(source.slot) >= 1 && Number(source.slot) <= 9 ? Number(source.slot) : null,
    is_secret: Boolean(source.is_secret),
    snippet_type: type,
    color: /^#[0-9a-f]{6}$/i.test(String(source.color || '')) ? source.color : null,
    created_at: createdAt,
    last_used_at: Math.max(0, Number(source.last_used_at) || 0),
    chain: Array.isArray(source.chain) ? source.chain.map(String).map((step) => step.trim()).filter(Boolean) : [],
  };
}

export function normalizeSnippets(items) {
  if (!Array.isArray(items)) return [];
  const used = new Set();
  return items.map(normalizeSnippet).map((snippet, index) => {
    let id = snippet.id;
    while (used.has(id)) id = `${snippet.id}-${index}`;
    used.add(id);
    return { ...snippet, id };
  });
}

export function validateSnippet(snippet) {
  const errors = [];
  if (!snippet.title) errors.push('Title is required.');
  if (!snippet.content) errors.push('Content is required.');
  if (snippet.title.length > 200) errors.push('Title is too long.');
  if (snippet.content.length > 1_000_000) errors.push('Content is too large.');
  return errors;
}

export function normalizeSettings(input) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    ...source,
    auto_paste: source.auto_paste !== false,
    dark_mode: source.dark_mode !== false,
    clipboard_history: source.clipboard_history !== false,
    hotkey: String(source.hotkey || 'Alt+Q'),
    opacity: Math.min(1, Math.max(0.4, Number(source.opacity) || 1)),
  };
}
