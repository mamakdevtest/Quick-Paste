const DEFAULT_TIMEOUT_MS = 15000;

/**
 * In-memory backend stand-in used only when the native Tauri runtime is absent
 * (e.g. the browser preview). It round-trips reads and writes so the UI behaves
 * exactly like it does against the Rust backend, instead of silently dropping
 * mutations. The native path never touches this.
 */
function createPreviewStore() {
  const state = {
    settings: {},
    snippets: [],
    expansions: [],
    catalog: { version: 1, locale: 'en', recommendedPackIds: [], packs: [] },
  };
  const clone = (value) => structuredClone(value);
  return {
    handle(command, payload) {
      switch (command) {
        case 'load_settings': return clone(state.settings);
        case 'save_settings': state.settings = clone(payload?.settings || {}); return null;
        case 'load_snippets': return clone(state.snippets);
        case 'save_snippets': state.snippets = clone(payload?.snippets || []); return null;
        case 'load_text_expansions': return clone(state.expansions);
        case 'save_text_expansions': state.expansions = clone(payload?.items || []); return clone(state.expansions);
        case 'load_text_expansion_catalog': return clone(state.catalog);
        case 'clear_all_data': state.snippets = []; state.settings = {}; state.expansions = []; return null;
        case 'get_active_process_name': return '';
        case 'get_pinned': return false;
        case 'capture_foreground_window': return 0;
        default: return undefined;
      }
    },
  };
}

const NON_PERSISTED_PREVIEW = new Set([
  'set_pinned', 'set_window_opacity', 'toggle_clipboard_monitor',
  'close_welcome_window', 'store_own_hwnd', 'reregister_shortcuts',
]);

export class AppCommandError extends Error {
  constructor(command, cause, code = 'COMMAND_FAILED') {
    const detail = cause instanceof Error ? cause.message : String(cause || 'Unknown error');
    super(`${command}: ${detail}`);
    this.name = 'AppCommandError';
    this.command = command;
    this.code = code;
    this.cause = cause;
  }
}

function withTimeout(promise, command, timeoutMs) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = window.setTimeout(() => {
      reject(new AppCommandError(command, `Timed out after ${timeoutMs}ms`, 'COMMAND_TIMEOUT'));
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timer));
}

export function createTauriGateway(runtime = window.__TAURI__) {
  const nativeInvoke = runtime?.core?.invoke;
  const nativeListen = runtime?.event?.listen;
  const getCurrentWindow = runtime?.window?.getCurrentWindow;
  const isAvailable = typeof nativeInvoke === 'function';
  const pendingMutations = new Map();
  const previewStore = isAvailable ? null : createPreviewStore();

  async function invoke(command, payload, options = {}) {
    if (!isAvailable) {
      const handled = previewStore.handle(command, payload);
      if (handled !== undefined) return handled;
      if (options.previewValue !== undefined) return structuredClone(options.previewValue);
      if (NON_PERSISTED_PREVIEW.has(command)) return null;
      throw new AppCommandError(command, 'Tauri runtime is unavailable', 'RUNTIME_UNAVAILABLE');
    }
    try {
      return await withTimeout(
        Promise.resolve(nativeInvoke(command, payload)),
        command,
        options.timeoutMs || DEFAULT_TIMEOUT_MS,
      );
    } catch (error) {
      if (error instanceof AppCommandError) throw error;
      throw new AppCommandError(command, error);
    }
  }

  function mutate(key, command, payload, options = {}) {
    const previous = pendingMutations.get(key) || Promise.resolve();
    const next = previous.catch(() => undefined).then(() => invoke(command, payload, options));
    pendingMutations.set(key, next);
    return next.finally(() => {
      if (pendingMutations.get(key) === next) pendingMutations.delete(key);
    });
  }

  async function listen(eventName, handler) {
    if (typeof nativeListen !== 'function') return () => {};
    try {
      return await nativeListen(eventName, handler);
    } catch (error) {
      throw new AppCommandError(`listen:${eventName}`, error, 'LISTENER_FAILED');
    }
  }

  const previewWindow = {
    label: 'preview',
    hide: async () => {},
    show: async () => {},
    setFocus: async () => {},
    setSize: async () => {},
    setFullscreen: async () => {},
    maximize: async () => {},
    unmaximize: async () => {},
    startDragging: async () => {},
  };

  return {
    isAvailable,
    invoke,
    mutate,
    listen,
    window: typeof getCurrentWindow === 'function' ? getCurrentWindow() : previewWindow,
  };
}

export function userError(error, fallback = 'The operation could not be completed.') {
  if (error?.code === 'COMMAND_TIMEOUT') return 'The operation took too long. Please try again.';
  if (error?.code === 'RUNTIME_UNAVAILABLE') return 'This action is available in the desktop app.';
  return fallback;
}
