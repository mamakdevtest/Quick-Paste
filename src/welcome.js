const tauriApi = window.__TAURI__ || {};
const invoke = tauriApi.core?.invoke;
const getCurrentWindow = tauriApi.window?.getCurrentWindow;

const appWindow = typeof getCurrentWindow === 'function' ? getCurrentWindow() : null;

const WELCOME_I18N = {
  en: {
    title: 'Choose your default packs',
    description: 'Pick the packs you want QuickPaste to install on first launch. You can keep it minimal or install everything at once.',
    maybeLater: 'Maybe Later',
    profileTitle: 'Your Profile',
    profileDescription: 'We will use these details to personalize the signature and future setup suggestions.',
    profileNameLabel: 'Name',
    profileRoleLabel: 'Role',
    profileStackLabel: 'Stack',
    profileNamePlaceholder: 'Can',
    profileRolePlaceholder: 'Unity Developer',
    profileStackPlaceholder: 'Unity, Rider, VS Code',
    selectedTitle: 'Selected Packs',
    selectedDescription: 'These packs will be installed and remembered as your default selection.',
    selectAll: 'Select All',
    clearSelection: 'Clear Selection',
    availablePacksTitle: 'Available Packs',
    availablePacksDescription: 'Core essentials, productivity packs, and Unity Game Dev packs.',
    variablesTitle: 'Dynamic Variables',
    variablesDescription: 'Variables resolve when the expansion fires, not when it is saved.',
    installSelectedDefaults: 'Install Selected Defaults',
    revisitLater: 'You can revisit this later from Settings.',
    installed: 'Installed',
    installPack: 'Install Pack',
    packInstalled: (title, added, skipped) => `${title}: ${added} installed, ${skipped} skipped.`,
    onboardingSaved: 'Welcome setup saved.',
    noPacks: 'No packs selected yet.',
    allSelectedInstalled: 'Selected defaults are already installed.',
    installedStatus: 'Installed',
    partiallyInstalledStatus: 'Partially installed',
    notInstalledStatus: 'Not installed',
    installing: 'Installing...',
  },
  tr: {
    title: 'Varsayılan paketleri seçin',
    description: 'QuickPaste ilk açılışta hangi paketleri kuracağını bilsin. İsterseniz minimal, isterseniz tam kurulum yapabilirsiniz.',
    maybeLater: 'Sonra',
    profileTitle: 'Profil Bilgileri',
    profileDescription: 'Bu bilgiler imza bloğunu ve gelecekteki kurulum önerilerini kişiselleştirmek için kullanılacak.',
    profileNameLabel: 'Ad',
    profileRoleLabel: 'Rol',
    profileStackLabel: 'Stack',
    profileNamePlaceholder: 'Can',
    profileRolePlaceholder: 'Unity Developer',
    profileStackPlaceholder: 'Unity, Rider, VS Code',
    selectedTitle: 'Seçili Paketler',
    selectedDescription: 'Bu paketler kurulacak ve varsayılan seçiminiz olarak hatırlanacak.',
    selectAll: 'Tümünü Seç',
    clearSelection: 'Seçimi Temizle',
    availablePacksTitle: 'Mevcut Paketler',
    availablePacksDescription: 'Temel paketler, günlük üretkenlik ve Unity Game Dev paketleri.',
    variablesTitle: 'Dinamik Değişkenler',
    variablesDescription: 'Değişkenler kayıt edilirken değil, genişleme çalıştığı anda çözülür.',
    installSelectedDefaults: 'Seçili Varsayılanları Kur',
    revisitLater: 'Daha sonra Ayarlar’dan tekrar açabilirsiniz.',
    installed: 'Kuruldu',
    installPack: 'Paketi Kur',
    packInstalled: (title, added, skipped) => `${title}: ${added} kuruldu, ${skipped} atlandı.`,
    onboardingSaved: 'Hoş geldiniz ayarı kaydedildi.',
    noPacks: 'Henüz paket seçilmedi.',
    allSelectedInstalled: 'Seçili varsayılanlar zaten kurulu.',
    installedStatus: 'Kuruldu',
    partiallyInstalledStatus: 'Kısmen kurulu',
    notInstalledStatus: 'Kurulu değil',
    installing: 'Kuruluyor...',
  },
};

const APP_FILTER_PRESETS = {
  all: [],
  unity: ['unity.exe'],
  rider: ['rider64.exe', 'rider.exe'],
  vscode: ['code.exe'],
  chrome: ['chrome.exe'],
};

function resolveLocale() {
  const lang = String(navigator.language || 'en').toLowerCase();
  return lang.startsWith('tr') ? 'tr' : 'en';
}

function getStrings(locale) {
  return WELCOME_I18N[locale] || WELCOME_I18N.en;
}

function normalizeProcessName(value) {
  return String(value || '').trim().toLowerCase();
}

function uniqueNormalized(values) {
  const seen = new Set();
  const out = [];
  for (const value of values || []) {
    const normalized = normalizeProcessName(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeClipboardFriendlyText(text) {
  return String(text || '').replace(/\r\n/g, '\n');
}

function appFilterLabel(filters, locale) {
  const preset = detectPreset(filters);
  const names = {
    en: { all: 'All apps', unity: 'Only Unity', rider: 'Only Rider', vscode: 'Only VS Code', chrome: 'Only Chrome', custom: 'Custom exe names' },
    tr: { all: 'Tüm uygulamalar', unity: 'Sadece Unity', rider: 'Sadece Rider', vscode: 'Sadece VS Code', chrome: 'Sadece Chrome', custom: 'Özel exe adları' },
  };
  return (names[locale] || names.en)[preset];
}

function detectPreset(filters) {
  const normalized = uniqueNormalized(filters);
  if (normalized.length === 0) return 'all';
  const compare = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);
  if (compare(normalized, APP_FILTER_PRESETS.unity)) return 'unity';
  if (compare(normalized, APP_FILTER_PRESETS.rider)) return 'rider';
  if (compare(normalized, APP_FILTER_PRESETS.vscode)) return 'vscode';
  if (compare(normalized, APP_FILTER_PRESETS.chrome)) return 'chrome';
  return 'custom';
}

function buildPackageItem(baseItem, profileName = '') {
  const now = new Date().toISOString();
  let replacement = normalizeClipboardFriendlyText(baseItem.replacement);
  if (String(baseItem.trigger || '').toLowerCase().endsWith('sig')) {
    const resolvedName = String(profileName || '').trim() || 'Can';
    replacement = `Saygılarımla,\n${resolvedName}`;
  }
  return {
    id: crypto.randomUUID(),
    trigger: baseItem.trigger.trim(),
    replacement,
    description: baseItem.description || undefined,
    enabled: baseItem.enabled !== false,
    caseSensitive: !!baseItem.caseSensitive,
    wordBoundary: baseItem.wordBoundary !== false,
    appFilter: uniqueNormalized(baseItem.appFilter || []),
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeTrigger(trigger) {
  return String(trigger || '').trim().toLowerCase();
}

function triggerSetFrom(items) {
  return new Set((items || []).map((item) => normalizeTrigger(item.trigger)).filter(Boolean));
}

async function main() {
  if (typeof invoke !== 'function') {
    document.body.innerHTML = `
      <div style="min-height:100%;display:flex;align-items:center;justify-content:center;padding:32px;background:
        radial-gradient(circle at 14% 8%, rgba(74,163,255,0.14), transparent 28%),
        radial-gradient(circle at 86% 10%, rgba(124,58,237,0.12), transparent 24%),
        linear-gradient(180deg, #0c1017 0%, #101420 42%, #0b0f16 100%);
        color:#e7e7ea;font-family:Inter,sans-serif;">
        <div style="max-width:760px;border:1px solid #2f3446;border-radius:24px;padding:28px;background:linear-gradient(180deg, rgba(24,27,39,0.98), rgba(14,16,23,0.98));box-shadow:0 30px 84px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.03);">
          <div style="font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:#9aa0b4;margin-bottom:12px;">QuickPaste Welcome</div>
          <h1 style="margin:0 0 12px;font-size:28px;line-height:1.2;">QuickPaste welcome window could not initialize.</h1>
          <p style="margin:0;color:#9aa0b4;white-space:pre-wrap;">The app could not load the onboarding screen. Please reopen it from Settings.</p>
        </div>
      </div>
    `;
    return;
  }

  const locale = resolveLocale();
  const ui = getStrings(locale);

  const [settings, catalogData, currentItems] = await Promise.all([
    invoke('load_settings'),
    invoke('load_text_expansion_catalog', { locale }),
    invoke('load_text_expansions'),
  ]);

  try {
    requestAnimationFrame(async () => {
      try {
        if (typeof appWindow?.setFocus === 'function') {
          await appWindow.setFocus();
        }
      } catch {
        // ignored
      }
    });
  } catch {
    // ignored
  }

  const packs = Array.isArray(catalogData?.packs) ? catalogData.packs : [];
  const expansions = Array.isArray(currentItems) ? currentItems : [];
  const selectedPackIds = new Set(
    (settings?.text_expansion_default_pack_ids?.length
      ? settings.text_expansion_default_pack_ids
      : (catalogData?.recommendedPackIds || catalogData?.recommended_pack_ids || [])
    ).map((value) => String(value || '').trim()).filter(Boolean),
  );

  const elements = {
    title: document.getElementById('welcomeTitle'),
    description: document.getElementById('welcomeDescription'),
    maybeLater: document.getElementById('maybeLaterBtn'),
    profileTitle: document.getElementById('profileTitle'),
    profileDescription: document.getElementById('profileDescription'),
    profileNameLabel: document.getElementById('profileNameLabel'),
    profileRoleLabel: document.getElementById('profileRoleLabel'),
    profileStackLabel: document.getElementById('profileStackLabel'),
    profileNameInput: document.getElementById('profileNameInput'),
    profileRoleInput: document.getElementById('profileRoleInput'),
    profileStackInput: document.getElementById('profileStackInput'),
    selectedTitle: document.getElementById('selectedTitle'),
    selectedDescription: document.getElementById('selectedDescription'),
    selectedSummary: document.getElementById('selectedSummary'),
    selectAllBtn: document.getElementById('selectAllBtn'),
    clearSelectionBtn: document.getElementById('clearSelectionBtn'),
    availablePacksTitle: document.getElementById('availablePacksTitle'),
    availablePacksDescription: document.getElementById('availablePacksDescription'),
    variablesTitle: document.getElementById('variablesTitle'),
    variablesDescription: document.getElementById('variablesDescription'),
    packsList: document.getElementById('packsList'),
    installBtn: document.getElementById('installBtn'),
    installStatus: document.getElementById('installStatus'),
  };

  const requiredElementEntries = Object.entries(elements).filter(([, value]) => !value);
  if (requiredElementEntries.length > 0) {
    throw new Error(`Welcome DOM is missing required elements: ${requiredElementEntries.map(([key]) => key).join(', ')}`);
  }

  const state = {
    settings: { ...settings },
    selected: selectedPackIds,
    expansions,
    isInstalling: false,
  };

  function applyLocale() {
    document.documentElement.lang = locale;
    elements.title.textContent = ui.title;
    elements.description.textContent = ui.description;
    elements.maybeLater.textContent = ui.maybeLater;
    elements.profileTitle.textContent = ui.profileTitle;
    elements.profileDescription.textContent = ui.profileDescription;
    elements.profileNameLabel.textContent = ui.profileNameLabel;
    elements.profileRoleLabel.textContent = ui.profileRoleLabel;
    elements.profileStackLabel.textContent = ui.profileStackLabel;
    elements.profileNameInput.placeholder = ui.profileNamePlaceholder;
    elements.profileRoleInput.placeholder = ui.profileRolePlaceholder;
    elements.profileStackInput.placeholder = ui.profileStackPlaceholder;
    elements.selectedTitle.textContent = ui.selectedTitle;
    elements.selectedDescription.textContent = ui.selectedDescription;
    elements.selectAllBtn.textContent = ui.selectAll;
    elements.clearSelectionBtn.textContent = ui.clearSelection;
    elements.availablePacksTitle.textContent = ui.availablePacksTitle;
    elements.availablePacksDescription.textContent = ui.availablePacksDescription;
    elements.variablesTitle.textContent = ui.variablesTitle;
    elements.variablesDescription.textContent = ui.variablesDescription;
    elements.installBtn.textContent = ui.installSelectedDefaults;
    elements.installStatus.textContent = ui.revisitLater;
  }

  function getProfileSnapshot() {
    return {
      name: String(elements.profileNameInput.value || '').trim(),
      role: String(elements.profileRoleInput.value || '').trim(),
      stack: String(elements.profileStackInput.value || '').trim(),
    };
  }

  function updateSummary() {
    const selectedCount = state.selected.size;
    const selectedItems = packs
      .filter((pack) => state.selected.has(pack.id))
      .flatMap((pack) => pack.items || []).length;
    const packLabel = locale === 'tr' ? 'paket' : (selectedCount === 1 ? 'pack' : 'packs');
    const snippetLabel = locale === 'tr' ? 'öğe' : (selectedItems === 1 ? 'snippet' : 'snippets');
    elements.selectedSummary.textContent = `${selectedCount} ${packLabel} · ${selectedItems} ${snippetLabel}`;
    elements.installBtn.disabled = selectedCount === 0 || state.isInstalling;
    elements.installBtn.setAttribute('aria-disabled', elements.installBtn.disabled ? 'true' : 'false');
  }

  function setInstallStatus(message, tone = '') {
    elements.installStatus.textContent = message || ui.revisitLater;
    elements.installStatus.classList.toggle('success', tone === 'success');
    elements.installStatus.classList.toggle('info', tone === 'info');
  }

  function focusPrimaryInput() {
    const target = elements.profileNameInput || elements.installBtn;
    if (target && typeof target.focus === 'function') {
      try {
        target.focus({ preventScroll: true });
      } catch {
        target.focus();
      }
    }
  }

  function renderPacks() {
    elements.packsList.innerHTML = '';
    const installedTriggers = triggerSetFrom(state.expansions);
    packs.forEach((pkg) => {
      const selected = state.selected.has(pkg.id);
      const totalCount = pkg.items.length;
      const installedCount = pkg.items.filter((item) => installedTriggers.has(normalizeTrigger(item.trigger))).length;
      const fullyInstalled = totalCount > 0 && installedCount >= totalCount;
      const partiallyInstalled = installedCount > 0 && !fullyInstalled;
      const statusLabel = fullyInstalled
        ? ui.installedStatus
        : partiallyInstalled
          ? ui.partiallyInstalledStatus
          : ui.notInstalledStatus;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `pack-card rounded-2xl text-left ${selected ? 'selected' : ''} ${fullyInstalled ? 'installed' : ''}`;
      card.setAttribute('aria-pressed', selected ? 'true' : 'false');
      card.setAttribute('aria-label', `${pkg.title} ${statusLabel}`);
      if (fullyInstalled) {
        card.disabled = true;
        card.setAttribute('aria-disabled', 'true');
      }
      card.innerHTML = `
        <div class="pack-head">
          <div class="min-w-0">
            <div class="pack-title">${escapeHtml(pkg.title)}</div>
            <div class="pack-description">${escapeHtml(pkg.description || '')}</div>
          </div>
          <span class="pack-check" aria-hidden="true">${fullyInstalled || selected ? '✓' : ''}</span>
        </div>
        <div class="pack-meta">
          <span class="pack-chip">${escapeHtml(pkg.id)}</span>
          <span class="pack-status ${fullyInstalled ? 'complete' : partiallyInstalled ? 'partial' : ''}">
            ${installedCount}/${totalCount} ${escapeHtml(statusLabel)}
          </span>
        </div>
      `;
      card.addEventListener('click', () => {
        if (fullyInstalled || state.isInstalling) {
          return;
        }
        if (state.selected.has(pkg.id)) {
          state.selected.delete(pkg.id);
        } else {
          state.selected.add(pkg.id);
        }
        setInstallStatus(ui.revisitLater);
        renderPacks();
        updateSummary();
      });
      elements.packsList.appendChild(card);
    });
    updateSummary();
  }

  function collectSelectedItems() {
    const seen = new Set();
    const items = [];
    for (const pkg of packs) {
      if (!state.selected.has(pkg.id)) continue;
      for (const item of pkg.items || []) {
        const key = normalizeTrigger(item.trigger);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        items.push(item);
      }
    }
    return items;
  }

  async function saveWelcomeSettings(completed = true) {
    state.settings = {
      ...state.settings,
      text_expansion_onboarding_completed: completed,
      text_expansion_default_pack_ids: [...state.selected],
      text_expansion_profile_name: getProfileSnapshot().name,
      text_expansion_profile_role: getProfileSnapshot().role,
      text_expansion_profile_stack: getProfileSnapshot().stack,
    };
    await invoke('save_settings', { settings: state.settings });
  }

  async function startMainProgram() {
    await invoke('close_welcome_window');
  }

  async function installSelectedDefaults() {
    if (state.isInstalling) {
      return;
    }
    const profileSnapshot = getProfileSnapshot();
    const selectedItems = collectSelectedItems();
    if (selectedItems.length === 0) {
      setInstallStatus(ui.noPacks, 'info');
      return;
    }
    state.isInstalling = true;
    elements.installBtn.textContent = ui.installing;
    setInstallStatus(ui.installing, 'info');
    updateSummary();

    const nextItems = [...state.expansions];
    let added = 0;
    let skipped = 0;
    const seen = new Set(nextItems.map((item) => normalizeTrigger(item.trigger)));

    for (const item of selectedItems) {
      const key = normalizeTrigger(item.trigger);
      if (!key || seen.has(key)) {
        skipped += 1;
        continue;
      }
      seen.add(key);
      nextItems.push(buildPackageItem(item, profileSnapshot.name));
      added += 1;
    }

    try {
      if (added > 0) {
        const saved = await invoke('save_text_expansions', { items: nextItems });
        state.expansions = Array.isArray(saved) ? saved : nextItems;
      }
      await saveWelcomeSettings(true);
      renderPacks();
      setInstallStatus(
        added > 0 ? ui.packInstalled(ui.installSelectedDefaults, added, skipped) : ui.allSelectedInstalled,
        added > 0 ? 'success' : 'info',
      );
      await new Promise((resolve) => setTimeout(resolve, 500));
      await startMainProgram();
    } catch (error) {
      setInstallStatus(String(error), 'info');
    } finally {
      state.isInstalling = false;
      elements.installBtn.textContent = ui.installSelectedDefaults;
      updateSummary();
    }
  }

  function selectAll() {
    state.selected = new Set(packs.map((pack) => pack.id));
    renderPacks();
  }

  function clearSelection() {
    state.selected = new Set();
    renderPacks();
  }

  elements.profileNameInput.value = state.settings.text_expansion_profile_name || '';
  elements.profileRoleInput.value = state.settings.text_expansion_profile_role || '';
  elements.profileStackInput.value = state.settings.text_expansion_profile_stack || '';

  if (state.selected.size === 0) {
    packs.filter((pack) => pack.recommended).forEach((pack) => state.selected.add(pack.id));
    if (state.selected.size === 0) {
      packs.forEach((pack) => state.selected.add(pack.id));
    }
  }

  applyLocale();
  renderPacks();
  focusPrimaryInput();
  updateSummary();

  elements.selectAllBtn.addEventListener('click', selectAll);
  elements.clearSelectionBtn.addEventListener('click', clearSelection);
  elements.installBtn.addEventListener('click', installSelectedDefaults);
  elements.maybeLater.addEventListener('click', async () => {
    await saveWelcomeSettings(true);
    await startMainProgram();
  });

  [elements.profileNameInput, elements.profileRoleInput, elements.profileStackInput].forEach((input) => {
    input.addEventListener('input', () => {
      updateSummary();
    });
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      elements.maybeLater.click();
    }
  });
}

main().catch(async (error) => {
  console.error(error);
  document.body.innerHTML = `
    <div style="min-height:100%;display:flex;align-items:center;justify-content:center;padding:32px;background:
      radial-gradient(circle at 14% 8%, rgba(74,163,255,0.14), transparent 28%),
      radial-gradient(circle at 86% 10%, rgba(124,58,237,0.12), transparent 24%),
      linear-gradient(180deg, #0c1017 0%, #101420 42%, #0b0f16 100%);
      color:#e7e7ea;font-family:Inter,sans-serif;">
      <div style="max-width:760px;border:1px solid #2f3446;border-radius:24px;padding:28px;background:linear-gradient(180deg, rgba(24,27,39,0.98), rgba(14,16,23,0.98));box-shadow:0 30px 84px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.03);">
        <div style="font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:#9aa0b4;margin-bottom:12px;">QuickPaste Welcome</div>
        <h1 style="margin:0 0 12px;font-size:28px;line-height:1.2;">Welcome screen failed to load</h1>
        <p style="margin:0;color:#9aa0b4;white-space:pre-wrap;">${String(error).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
      </div>
    </div>
  `;
});
