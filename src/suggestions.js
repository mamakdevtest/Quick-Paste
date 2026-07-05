const tauriApi = window.__TAURI__ || {};
const invoke = tauriApi.core?.invoke;
const listen = tauriApi.event?.listen;
const getCurrentWindow = tauriApi.window?.getCurrentWindow;

const appWindow = typeof getCurrentWindow === 'function' ? getCurrentWindow() : null;

const elements = {
  shell: document.querySelector('.shell'),
  searchWrap: document.getElementById('searchWrap'),
  filterInput: document.getElementById('filterInput'),
  list: document.getElementById('list'),
};

const state = {
  query: '',
  normalizedQuery: '',
  deleteGraphemes: 0,
  suggestions: [],
  filter: '',
  placement: 'below',
};

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalize(value) {
  return String(value || '').trim().replace(/^:+/, '').toLowerCase();
}

function render() {
  if (!elements.list) {
    return;
  }
  elements.shell?.classList.toggle('above', state.placement === 'above');
  const filter = normalize(state.filter);
  const items = state.suggestions.filter((item) => {
    if (!filter) return true;
    return normalize(item.trigger).includes(filter)
      || normalize(item.description).includes(filter)
      || normalize(item.replacementPreview).includes(filter);
  });

  if (items.length === 0) {
    elements.list.innerHTML = `
      <div class="rounded-xl border border-dashed border-[var(--qp-border)] px-2.5 py-2 text-[11px] text-[var(--qp-muted)]">
        No matching suggestions.
      </div>
    `;
    return;
  }

  elements.list.innerHTML = items.map((item) => `
    <button
      type="button"
      class="item w-full rounded-xl px-2 py-1 text-left flex items-center gap-1.5"
      data-trigger="${escapeHtml(item.trigger)}"
    >
      <span class="trigger-pill shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-[var(--qp-primary)] bg-[var(--qp-primary-soft)] border border-[rgba(74,163,255,0.18)]">${escapeHtml(item.trigger)}</span>
      <span class="preview-text text-[11px] text-[var(--qp-text)] opacity-80 truncate">${escapeHtml(item.replacementPreview || item.description || '')}</span>
    </button>
  `).join('');

  elements.list.querySelectorAll('[data-trigger]').forEach((button) => {
    button.addEventListener('click', async () => {
      const trigger = button.getAttribute('data-trigger');
      if (!trigger || typeof invoke !== 'function') {
        return;
      }
      try {
        await invoke('apply_text_expansion_trigger', {
          trigger,
          deleteGraphemes: state.deleteGraphemes,
        });
      } catch (error) {
        console.error(error);
      }
    });
  });
}

async function main() {
  if (typeof listen === 'function') {
    await listen('text-expansion-suggestions', (event) => {
      const payload = event?.payload || {};
      state.query = String(payload.query || '');
      state.normalizedQuery = String(payload.normalizedQuery || '');
      state.deleteGraphemes = Number(payload.deleteGraphemes || 0);
      state.suggestions = Array.isArray(payload.suggestions) ? payload.suggestions : [];
      state.placement = payload.placement === 'above' ? 'above' : 'below';
      state.filter = state.normalizedQuery || state.query;
      if (elements.filterInput) {
        elements.filterInput.value = state.query || state.filter;
      }
      render();
    });
  }

  elements.filterInput?.addEventListener('input', () => {
    state.filter = elements.filterInput.value;
    render();
  });

  elements.filterInput?.addEventListener('keydown', async (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (appWindow?.hide) {
        await appWindow.hide();
      }
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const first = elements.list.querySelector('[data-trigger]');
      if (first) {
        first.click();
      }
    }
  });

  render();
}

main().catch((error) => {
  console.error(error);
  elements.list.innerHTML = `
    <div class="rounded-xl border border-red-500/25 bg-gradient-to-b from-red-500/12 to-red-500/6 px-3 py-3 text-xs text-red-50 shadow-[0_16px_32px_rgba(0,0,0,0.24)]">
      Failed to load suggestions.
    </div>
  `;
});
