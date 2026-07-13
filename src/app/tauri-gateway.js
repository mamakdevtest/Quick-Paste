const DEFAULT_TIMEOUT_MS = 15000;
const PREVIEW_RESULTS = {
  load_settings: {},
  load_snippets: [],
  load_text_expansions: [],
  load_text_expansion_catalog: { version: 1, locale: 'en', recommendedPackIds: [], packs: [] },
  get_active_process_name: '',
  get_pinned: false,
  capture_foreground_window: 0,
  store_own_hwnd: null,
};
const PREVIEW_MUTATIONS = new Set([
  'save_settings', 'save_snippets', 'save_text_expansions', 'set_pinned',
  'set_window_opacity', 'toggle_clipboard_monitor', 'close_welcome_window',
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

  async function invoke(command, payload, options = {}) {
    if (!isAvailable) {
      if (options.previewValue !== undefined) return structuredClone(options.previewValue);
      if (Object.hasOwn(PREVIEW_RESULTS, command)) return structuredClone(PREVIEW_RESULTS[command]);
      if (PREVIEW_MUTATIONS.has(command)) {
        if (command === 'save_text_expansions') return structuredClone(payload?.items || []);
        return null;
      }
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
