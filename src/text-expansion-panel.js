const APP_FILTER_PRESETS = {
  all: [],
  unity: ['unity.exe'],
  rider: ['rider64.exe', 'rider.exe'],
  vscode: ['code.exe'],
  chrome: ['chrome.exe'],
};

const UNITY_PACKAGES = [
  {
    id: 'unity-debug',
    title: 'Unity Debug',
    description: 'Fast logging and test snippets for the Unity Editor and play mode.',
    items: [
      { trigger: ':ulog', replacement: 'Debug.Log("");', description: 'Unity Debug.Log', appFilter: ['unity.exe'], wordBoundary: true },
      { trigger: ':uwarn', replacement: 'Debug.LogWarning("");', description: 'Unity warning log', appFilter: ['unity.exe'], wordBoundary: true },
      { trigger: ':uerr', replacement: 'Debug.LogError("");', description: 'Unity error log', appFilter: ['unity.exe'], wordBoundary: true },
      { trigger: ':todou', replacement: '// TODO: ', description: 'Unity TODO comment', appFilter: ['rider64.exe', 'rider.exe', 'code.exe'], wordBoundary: true },
    ],
  },
  {
    id: 'unity-bug-report',
    title: 'Bug Report',
    description: 'Daily QA and reproduction templates for game-dev bug tracking.',
    items: [
      { trigger: ':ubug', replacement: 'Başlık:\nBuild:\nSahne:\nAdımlar:\nBeklenen Sonuç:\nGerçek Sonuç:\nNotlar:', description: 'Unity bug report template', appFilter: [], wordBoundary: true },
      { trigger: ':utest', replacement: 'Test Ortamı:\nPlatform:\nSonuç:\nNotlar:', description: 'Quick test result template', appFilter: [], wordBoundary: true },
      { trigger: ':urepro', replacement: 'Repro Rate:\n1. \n2. \n3. ', description: 'Repro steps template', appFilter: [], wordBoundary: true },
    ],
  },
  {
    id: 'unity-daily',
    title: 'Daily Workflow',
    description: 'Standup, commit and task notes used across Unity, Rider and chat tools.',
    items: [
      { trigger: ':standup', replacement: 'Dün:\nBugün:\nBloker:', description: 'Daily standup template', appFilter: [], wordBoundary: true },
      { trigger: ':task', replacement: 'Görev:\nDurum:\nSonraki Adım:', description: 'Task update template', appFilter: [], wordBoundary: true },
      { trigger: ':commitnote', replacement: 'Özet:\nEtkilenen Alan:\nRisk:', description: 'Commit / changelog note', appFilter: ['rider64.exe', 'rider.exe', 'code.exe'], wordBoundary: true },
      { trigger: ':scenecheck', replacement: 'Sahne:\nPrefab:\nBağımlılıklar:\nTest Durumu:', description: 'Scene validation checklist', appFilter: ['unity.exe'], wordBoundary: true },
    ],
  },
];

const APP_FILTER_LABELS = {
  en: {
    all: 'All apps',
    unity: 'Only Unity',
    rider: 'Only Rider',
    vscode: 'Only VS Code',
    chrome: 'Only Chrome',
    custom: 'Custom exe names',
  },
  tr: {
    all: 'Tüm uygulamalar',
    unity: 'Sadece Unity',
    rider: 'Sadece Rider',
    vscode: 'Sadece VS Code',
    chrome: 'Sadece Chrome',
    custom: 'Özel exe adları',
  },
};

const TEXT_EXPANSION_I18N = {
  en: {
    panelButtonTitle: 'Text Expansion',
    sectionLabel: 'Text Tools',
    cardTitle: 'Text Expansion',
    cardDescription: 'Manage system-wide triggers, app filters, and dynamic variables.',
    openPanel: 'Open Text Expansion',
    panelLabel: 'Text Expansion',
    panelTitle: 'System-wide snippets',
    panelDescription: 'Type a trigger in any app, then press Space, Enter, Tab, or punctuation to expand it instantly.',
    defaults: 'Defaults',
    importLabel: 'Import',
    exportLabel: 'Export',
    back: 'Back',
    searchPlaceholder: 'Search triggers, replacements, app filters...',
    newButton: 'New',
    listTitle: 'Snippet List',
    newExpansion: 'New Expansion',
    editExpansion: 'Edit Expansion',
    clear: 'New',
    delete: 'Delete',
    save: 'Save',
    triggerLabel: 'Trigger',
    descriptionLabel: 'Description',
    descriptionPlaceholder: 'Optional note',
    replacementLabel: 'Replacement',
    replacementPlaceholder: 'Type your replacement here...',
    conflictWarning: '⚠ Trigger conflict detected. Same trigger cannot be saved twice.',
    conflictWithTrigger: (trigger) => `Trigger conflict with "${trigger}"`,
    enabledLabel: 'Enabled',
    pausedLabel: 'Paused',
    caseSensitiveLabel: 'Case Sensitive',
    wordBoundaryLabel: 'Word Boundary',
    applicationFilterLabel: 'Application Filter',
    appFilterPreviewAll: 'Matches are compared against the active process/exe name.',
    appFilterPreviewCustom: 'Enter comma-separated executable names, e.g. Code.exe, chrome.exe',
    customExePlaceholder: 'Unity.exe, Rider64.exe, Code.exe',
    dynamicTitle: 'Dynamic Variables',
    dynamicDescription: 'Variables resolve when the expansion fires, not when it is saved.',
    packagesTitle: 'Unity Game Dev Packs',
    packagesDescription: 'Install daily-use expansions one by one or add a whole package in one step.',
    installAllPacks: 'Install All Packs',
    installPack: 'Install Pack',
    installItem: 'Install Item',
    installed: 'Installed',
    skipped: 'Skipped',
    emptyTitle: 'No text expansions found',
    emptyDescription: 'Try a different search or create a new trigger.',
    noDescription: 'No description',
    enabledChip: 'Enabled',
    pausedChip: 'Paused',
    boundaryChip: 'Word boundary',
    noBoundaryChip: 'No boundary',
    countOne: 'item',
    countMany: 'items',
    toastCreated: 'Text expansion created!',
    toastUpdated: 'Text expansion updated!',
    toastDeleted: 'Text expansion deleted.',
    toastDefaults: 'Default text expansions restored.',
    toastImported: 'Text expansions imported.',
    toastExported: 'Export saved.',
    toastPackInstalled: (title, added, skipped) => `${title}: ${added} installed, ${skipped} skipped.`,
    toastItemInstalled: (trigger) => `${trigger} installed.`,
    toastItemSkipped: (trigger) => `${trigger} already exists.`,
    errorTriggerRequired: 'Trigger is required.',
    errorReplacementRequired: 'Replacement is required.',
    errorConflict: 'Trigger conflict detected.',
    confirmDelete: (trigger) => `Delete text expansion "${trigger}"?`,
    appFilterOptions: {
      all: 'All apps',
      unity: 'Only Unity',
      rider: 'Only Rider',
      vscode: 'Only VS Code',
      chrome: 'Only Chrome',
      custom: 'Custom exe names',
    },
  },
  tr: {
    panelButtonTitle: 'Metin Genişletme',
    sectionLabel: 'Metin Araçları',
    cardTitle: 'Metin Genişletme',
    cardDescription: 'Sistem genelinde çalışan tetikleyicileri, uygulama filtrelerini ve dinamik değişkenleri yönetin.',
    openPanel: 'Metin Genişletmeyi Aç',
    panelLabel: 'Metin Genişletme',
    panelTitle: 'Sistem genelinde snippet\'ler',
    panelDescription: 'Herhangi bir uygulamada tetikleyici yazın; ardından Space, Enter, Tab veya noktalama ile anında genişletin.',
    defaults: 'Varsayılanlar',
    importLabel: 'İçe Aktar',
    exportLabel: 'Dışa Aktar',
    back: 'Geri',
    searchPlaceholder: 'Tetikleyici, replacement veya uygulama filtresi ara...',
    newButton: 'Yeni',
    listTitle: 'Snippet Listesi',
    newExpansion: 'Yeni Genişletme',
    editExpansion: 'Genişletmeyi Düzenle',
    clear: 'Yeni',
    delete: 'Sil',
    save: 'Kaydet',
    triggerLabel: 'Tetikleyici',
    descriptionLabel: 'Açıklama',
    descriptionPlaceholder: 'İsteğe bağlı not',
    replacementLabel: 'Yerine Geçecek Metin',
    replacementPlaceholder: 'Yerine geçecek metni buraya yazın...',
    conflictWarning: '⚠ Tetikleyici çakışması var. Aynı tetikleyici iki kez kaydedilemez.',
    conflictWithTrigger: (trigger) => `Tetikleyici çakışması: "${trigger}"`,
    enabledLabel: 'Etkin',
    pausedLabel: 'Duraklatıldı',
    caseSensitiveLabel: 'Büyük/Küçük Harf Duyarlı',
    wordBoundaryLabel: 'Kelime Sınırı',
    applicationFilterLabel: 'Uygulama Filtresi',
    appFilterPreviewAll: 'Eşleşmeler aktif process/exe adıyla karşılaştırılır.',
    appFilterPreviewCustom: 'Virgülle ayrılmış exe adlarını girin, örn. Code.exe, chrome.exe',
    customExePlaceholder: 'Unity.exe, Rider64.exe, Code.exe',
    dynamicTitle: 'Dinamik Değişkenler',
    dynamicDescription: 'Değişkenler kayıt edilirken değil, genişleme çalıştığı anda çözülür.',
    packagesTitle: 'Unity Game Dev Paketleri',
    packagesDescription: 'Günlük kullanılan expansion setlerini tek tek ya da tüm paket halinde kurun.',
    installAllPacks: 'Tüm Paketleri Kur',
    installPack: 'Paketi Kur',
    installItem: 'Öğeyi Kur',
    installed: 'Kuruldu',
    skipped: 'Atlandı',
    emptyTitle: 'Metin genişletme bulunamadı',
    emptyDescription: 'Farklı bir arama deneyin veya yeni bir tetikleyici oluşturun.',
    noDescription: 'Açıklama yok',
    enabledChip: 'Etkin',
    pausedChip: 'Duraklatıldı',
    boundaryChip: 'Kelime sınırı',
    noBoundaryChip: 'Sınır yok',
    countOne: 'öğe',
    countMany: 'öğe',
    toastCreated: 'Metin genişletme oluşturuldu!',
    toastUpdated: 'Metin genişletme güncellendi!',
    toastDeleted: 'Metin genişletme silindi.',
    toastDefaults: 'Varsayılan metin genişletmeler geri yüklendi.',
    toastImported: 'Metin genişletmeler içe aktarıldı.',
    toastExported: 'Dışa aktarma kaydedildi.',
    toastPackInstalled: (title, added, skipped) => `${title}: ${added} kuruldu, ${skipped} atlandı.`,
    toastItemInstalled: (trigger) => `${trigger} kuruldu.`,
    toastItemSkipped: (trigger) => `${trigger} zaten mevcut.`,
    errorTriggerRequired: 'Tetikleyici gerekli.',
    errorReplacementRequired: 'Yerine geçecek metin gerekli.',
    errorConflict: 'Tetikleyici çakışması algılandı.',
    confirmDelete: (trigger) => `Metin genişletme "${trigger}" silinsin mi?`,
    appFilterOptions: {
      all: 'Tüm uygulamalar',
      unity: 'Sadece Unity',
      rider: 'Sadece Rider',
      vscode: 'Sadece VS Code',
      chrome: 'Sadece Chrome',
      custom: 'Özel exe adları',
    },
  },
};

function resolveLocale(preferredLocale) {
  const raw = String(preferredLocale || (typeof navigator !== 'undefined' ? navigator.language : '') || 'en').toLowerCase();
  return raw.startsWith('tr') ? 'tr' : 'en';
}

function getLocaleStrings(locale) {
  return TEXT_EXPANSION_I18N[locale] || TEXT_EXPANSION_I18N.en;
}

function normalizeProcessName(value) {
  return (value || '').trim().toLowerCase();
}

function normalizeTrigger(trigger) {
  return normalizeProcessName(trigger);
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function uniqueNormalized(values) {
  const seen = new Set();
  const out = [];
  for (const value of values || []) {
    const normalized = normalizeProcessName(value);
    if (!normalized) continue;
    if (!seen.has(normalized)) {
      seen.add(normalized);
      out.push(normalized);
    }
  }
  return out;
}

function sortForDisplay(values) {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function detectPreset(filters) {
  const normalized = sortForDisplay(uniqueNormalized(filters));
  for (const [preset, presetFilters] of Object.entries(APP_FILTER_PRESETS)) {
    const candidate = sortForDisplay(uniqueNormalized(presetFilters));
    if (normalized.length !== candidate.length) continue;
    if (normalized.every((item, index) => item === candidate[index])) {
      return preset;
    }
  }
  return 'custom';
}

function appFilterLabel(filters, locale = 'en') {
  if (!filters || filters.length === 0) {
    return (APP_FILTER_LABELS[locale] || APP_FILTER_LABELS.en).all;
  }
  const preset = detectPreset(filters);
  const labels = APP_FILTER_LABELS[locale] || APP_FILTER_LABELS.en;
  if (preset !== 'custom') {
    return labels[preset] || labels.all;
  }
  return labels.custom;
}

function appFilterSummary(filters, locale = 'en') {
  if (!filters || filters.length === 0) {
    return (APP_FILTER_LABELS[locale] || APP_FILTER_LABELS.en).all;
  }
  const preset = detectPreset(filters);
  if (preset !== 'custom') {
    return appFilterLabel(filters, locale);
  }
  return sortForDisplay(uniqueNormalized(filters))
    .map((item) => item.replace(/\.exe$/i, ''))
    .join(', ');
}

function normalizeClipboardFriendlyText(value) {
  return String(value || '').replace(/\r\n/g, '\n');
}

export function setupTextExpansionPanel({
  invoke,
  listen,
  appWindow,
  showToast,
  locale: preferredLocale,
  windowBaseWidth = 410,
  windowExpansionWidth = 860,
  windowHeight = 800,
}) {
  const locale = resolveLocale(preferredLocale);
  const ui = getLocaleStrings(locale);
  const panelTrack = document.getElementById('panelTrack');
  const panel = document.getElementById('textExpansionScroll');
  const openButton = document.getElementById('textExpansionBtn');
  const openFromSettingsButton = document.getElementById('openTextExpansionBtn');
  const sectionLabel = document.getElementById('textExpansionSectionLabel');
  const cardTitle = document.getElementById('textExpansionCardTitle');
  const cardDescription = document.getElementById('textExpansionCardDescription');
  const backButton = document.getElementById('textExpansionBackBtn');
  const addButton = document.getElementById('textExpansionAddBtn');
  const searchInput = document.getElementById('textExpansionSearchInput');
  const listContainer = document.getElementById('textExpansionList');
  const countLabel = document.getElementById('textExpansionCount');
  const listTitle = document.getElementById('textExpansionListTitle');
  const formTitle = document.getElementById('textExpansionFormTitle');
  const triggerInput = document.getElementById('textExpansionTriggerInput');
  const descriptionInput = document.getElementById('textExpansionDescriptionInput');
  const replacementInput = document.getElementById('textExpansionReplacementInput');
  const triggerLabel = document.getElementById('textExpansionTriggerLabel');
  const descriptionLabel = document.getElementById('textExpansionDescriptionLabel');
  const replacementLabel = document.getElementById('textExpansionReplacementLabel');
  const enabledToggle = document.getElementById('textExpansionEnabledToggle');
  const caseSensitiveToggle = document.getElementById('textExpansionCaseSensitiveToggle');
  const wordBoundaryToggle = document.getElementById('textExpansionWordBoundaryToggle');
  const enabledLabel = document.getElementById('textExpansionEnabledLabel');
  const caseSensitiveLabel = document.getElementById('textExpansionCaseSensitiveLabel');
  const wordBoundaryLabel = document.getElementById('textExpansionWordBoundaryLabel');
  const appFilterMode = document.getElementById('textExpansionAppFilterMode');
  const appFilterCustom = document.getElementById('textExpansionAppFilterCustom');
  const appFilterPreview = document.getElementById('textExpansionAppFilterPreview');
  const appFilterTitle = document.getElementById('textExpansionAppFilterTitle');
  const conflictWarning = document.getElementById('textExpansionConflictWarning');
  const saveButton = document.getElementById('textExpansionSaveBtn');
  const deleteButton = document.getElementById('textExpansionDeleteBtn');
  const clearButton = document.getElementById('textExpansionClearBtn');
  const defaultsButton = document.getElementById('textExpansionDefaultsBtn');
  const importButton = document.getElementById('textExpansionImportBtn');
  const exportButton = document.getElementById('textExpansionExportBtn');
  const panelLabel = document.getElementById('textExpansionPanelLabel');
  const panelTitle = document.getElementById('textExpansionPanelTitle');
  const panelDescription = document.getElementById('textExpansionPanelDescription');
  const dynamicTitle = document.getElementById('textExpansionDynamicTitle');
  const dynamicDescription = document.getElementById('textExpansionDynamicDescription');
  const packagesTitle = document.getElementById('textExpansionPackagesTitle');
  const packagesDescription = document.getElementById('textExpansionPackagesDescription');
  const packagesList = document.getElementById('textExpansionPackagesList');
  const installAllPackagesButton = document.getElementById('textExpansionInstallAllPackagesBtn');

  let expansions = [];
  let editingId = null;
  let isOpen = false;
  let searchTerm = '';
  let loadPromise = null;
  let isMutating = false;
  let renderQueued = false;
  let suppressRemoteReloadUntil = 0;

  function setOpenButtonState(open) {
    if (!openButton) {
      return;
    }
    openButton.classList.toggle('text-d-primary', open);
    openButton.classList.toggle('bg-d-primary/15', open);
    openButton.classList.toggle('text-d-dim', !open);
    openButton.innerHTML = open
      ? '<span class="material-symbols-outlined" style="font-size:20px;">arrow_back</span>'
      : '<span class="material-symbols-outlined" style="font-size:20px;">text_snippet</span>';
  }

  if (panel) {
    panel.dataset.locale = locale;
  }

  function setWindowSize(isExpanded) {
    if (!appWindow || typeof appWindow.setSize !== 'function') {
      return;
    }
    const width = isExpanded ? windowExpansionWidth : windowBaseWidth;
    appWindow.setSize({ type: 'Logical', width, height: windowHeight }).catch(() => {});
  }

  function applyLocale() {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.lang = locale;
    }

    if (openButton) {
      openButton.title = ui.panelButtonTitle;
    }
    if (openFromSettingsButton) {
      openFromSettingsButton.textContent = ui.openPanel;
    }
    if (sectionLabel) {
      sectionLabel.textContent = ui.sectionLabel;
    }
    if (cardTitle) {
      cardTitle.textContent = ui.cardTitle;
    }
    if (cardDescription) {
      cardDescription.textContent = ui.cardDescription;
    }
    if (panelLabel) {
      panelLabel.textContent = ui.panelLabel;
    }
    if (panelTitle) {
      panelTitle.textContent = ui.panelTitle;
    }
    if (panelDescription) {
      panelDescription.textContent = ui.panelDescription;
    }
    if (defaultsButton) {
      defaultsButton.textContent = ui.defaults;
    }
    if (importButton) {
      importButton.textContent = ui.importLabel;
    }
    if (exportButton) {
      exportButton.textContent = ui.exportLabel;
    }
    if (backButton) {
      backButton.textContent = ui.back;
    }
    if (addButton) {
      addButton.innerHTML = `<span class="material-symbols-outlined" style="font-size:14px;">add</span>${ui.newButton ? ` ${escapeHtml(ui.newButton)}` : ''}`;
    }
    if (listTitle) {
      listTitle.textContent = ui.listTitle;
    }
    if (countLabel) {
      countLabel.textContent = `0 ${ui.countMany}`;
    }
    if (formTitle) {
      formTitle.textContent = ui.newExpansion;
    }
    if (triggerLabel) {
      triggerLabel.textContent = ui.triggerLabel;
    }
    if (descriptionLabel) {
      descriptionLabel.textContent = ui.descriptionLabel;
    }
    if (replacementLabel) {
      replacementLabel.textContent = ui.replacementLabel;
    }
    if (enabledLabel) {
      enabledLabel.textContent = ui.enabledLabel;
    }
    if (caseSensitiveLabel) {
      caseSensitiveLabel.textContent = ui.caseSensitiveLabel;
    }
    if (wordBoundaryLabel) {
      wordBoundaryLabel.textContent = ui.wordBoundaryLabel;
    }
    if (appFilterTitle) {
      appFilterTitle.textContent = ui.applicationFilterLabel;
    }
    if (dynamicTitle) {
      dynamicTitle.textContent = ui.dynamicTitle;
    }
    if (dynamicDescription) {
      dynamicDescription.textContent = ui.dynamicDescription;
    }
    if (packagesTitle) {
      packagesTitle.textContent = ui.packagesTitle;
    }
    if (packagesDescription) {
      packagesDescription.textContent = ui.packagesDescription;
    }
    if (installAllPackagesButton) {
      installAllPackagesButton.textContent = ui.installAllPacks;
    }
    if (searchInput) {
      searchInput.placeholder = ui.searchPlaceholder;
    }
    if (triggerInput) {
      triggerInput.placeholder = ':mail';
    }
    if (descriptionInput) {
      descriptionInput.placeholder = ui.descriptionPlaceholder;
    }
    if (replacementInput) {
      replacementInput.placeholder = ui.replacementPlaceholder;
    }
    if (appFilterCustom) {
      appFilterCustom.placeholder = ui.customExePlaceholder || 'Unity.exe, Rider64.exe, Code.exe';
    }
    if (conflictWarning) {
      conflictWarning.textContent = ui.conflictWarning;
    }
    if (saveButton) {
      saveButton.innerHTML = `${escapeHtml(ui.save)} <span class="material-symbols-outlined" style="font-size:16px;">check</span>`;
    }
    if (deleteButton) {
      deleteButton.textContent = ui.delete;
    }
    if (clearButton) {
      clearButton.textContent = ui.clear;
    }

    Array.from(appFilterMode?.options || []).forEach((option) => {
      const translated = ui.appFilterOptions?.[option.value];
      if (translated) {
        option.textContent = translated;
      }
    });

    if (appFilterMode) {
      const currentMode = appFilterMode.value;
      if (currentMode === 'all') {
        appFilterPreview.textContent = ui.appFilterPreviewAll;
      } else if (currentMode === 'custom') {
        appFilterPreview.textContent = ui.appFilterPreviewCustom;
      } else {
        appFilterPreview.textContent = appFilterLabel(APP_FILTER_PRESETS[currentMode] || [], locale);
      }
    }
  }

  function scheduleRender() {
    if (renderQueued) {
      return;
    }
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      renderList();
      renderPackages();
    });
  }

  function setBusy(value) {
    isMutating = value;
    [
      saveButton,
      deleteButton,
      clearButton,
      defaultsButton,
      importButton,
      exportButton,
      addButton,
      installAllPackagesButton,
      triggerInput,
      descriptionInput,
      replacementInput,
      enabledToggle,
      caseSensitiveToggle,
      wordBoundaryToggle,
      appFilterMode,
      appFilterCustom,
      searchInput,
    ].forEach((element) => {
      if (!element) {
        return;
      }
      element.disabled = value;
    });
  }

  function markLocalMutation() {
    suppressRemoteReloadUntil = Date.now() + 1200;
  }

  function triggerExists(trigger, ignoreId = null) {
    const key = normalizeTrigger(trigger);
    if (!key) return false;
    return expansions.some((item) => {
      if (ignoreId && item.id === ignoreId) {
        return false;
      }
      return normalizeTrigger(item.trigger) === key;
    });
  }

  function buildPackageItem(baseItem) {
    const now = new Date().toISOString();
    return {
      id: crypto.randomUUID(),
      trigger: baseItem.trigger.trim(),
      replacement: normalizeClipboardFriendlyText(baseItem.replacement),
      description: baseItem.description || undefined,
      enabled: baseItem.enabled !== false,
      caseSensitive: !!baseItem.caseSensitive,
      wordBoundary: baseItem.wordBoundary !== false,
      appFilter: uniqueNormalized(baseItem.appFilter || []),
      createdAt: now,
      updatedAt: now,
    };
  }

  function mergePackageItems(sourceItems) {
    const next = [...expansions];
    let added = 0;
    let skipped = 0;

    sourceItems.forEach((item) => {
      if (triggerExists(item.trigger)) {
        skipped += 1;
        return;
      }
      next.push(buildPackageItem(item));
      added += 1;
    });

    return { next, added, skipped };
  }

  function getFilteredExpansions() {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return expansions;
    }
    return expansions.filter((item) => {
      const haystack = [
        item.trigger,
        item.description || '',
        item.replacement || '',
        appFilterSummary(item.appFilter || [], locale),
      ].join(' \n').toLowerCase();
      return haystack.includes(term);
    });
  }

  function resolveAppFilterFromForm() {
    const mode = appFilterMode.value;
    if (mode === 'all') {
      return [];
    }
    if (mode === 'custom') {
      return uniqueNormalized(appFilterCustom.value.split(','));
    }
    return [...(APP_FILTER_PRESETS[mode] || [])];
  }

  function applyAppFilterFields(item) {
    const filters = item.appFilter || [];
    const mode = detectPreset(filters);
    appFilterMode.value = mode;
    const customSummary = sortForDisplay(uniqueNormalized(filters)).join(', ');
    appFilterCustom.value = mode === 'custom'
      ? customSummary
      : '';
    appFilterCustom.disabled = mode !== 'custom';
    appFilterPreview.textContent = mode === 'custom'
      ? (customSummary || ui.appFilterPreviewCustom)
      : mode === 'all'
        ? ui.appFilterPreviewAll
        : appFilterSummary(filters, locale);
  }

  function updateConflictState() {
    const trigger = normalizeTrigger(triggerInput.value);
    if (!trigger) {
      conflictWarning.classList.add('hidden');
      conflictWarning.textContent = ui.conflictWarning;
      saveButton.disabled = false;
      return;
    }

    const conflict = expansions.find((item) => {
      if (editingId && item.id === editingId) {
        return false;
      }
      return normalizeTrigger(item.trigger) === trigger;
    });

    if (conflict) {
      conflictWarning.classList.remove('hidden');
      conflictWarning.textContent = `${ui.conflictWarning} ${ui.conflictWithTrigger(conflict.trigger)}`;
      saveButton.disabled = true;
    } else {
      conflictWarning.classList.add('hidden');
      conflictWarning.textContent = ui.conflictWarning;
      saveButton.disabled = false;
    }
  }

  function clearForm() {
    editingId = null;
    formTitle.textContent = ui.newExpansion;
    triggerInput.value = '';
    descriptionInput.value = '';
    replacementInput.value = '';
    enabledToggle.checked = true;
    caseSensitiveToggle.checked = false;
    wordBoundaryToggle.checked = true;
    appFilterMode.value = 'all';
    appFilterCustom.value = '';
    appFilterCustom.disabled = true;
    appFilterPreview.textContent = ui.appFilterPreviewAll;
    conflictWarning.classList.add('hidden');
    conflictWarning.textContent = ui.conflictWarning;
    saveButton.disabled = false;
    deleteButton.disabled = true;
    scheduleRender();
  }

  function loadItemIntoForm(item) {
    editingId = item.id;
    formTitle.textContent = ui.editExpansion;
    triggerInput.value = item.trigger || '';
    descriptionInput.value = item.description || '';
    replacementInput.value = item.replacement || '';
    enabledToggle.checked = item.enabled !== false;
    caseSensitiveToggle.checked = !!item.caseSensitive;
    wordBoundaryToggle.checked = item.wordBoundary !== false;
    applyAppFilterFields(item);
    conflictWarning.classList.add('hidden');
    conflictWarning.textContent = ui.conflictWarning;
    saveButton.disabled = false;
    deleteButton.disabled = false;
    scheduleRender();
  }

  function normalizeFormPayload(existing = null) {
    const now = new Date().toISOString();
    const createdAt = existing?.createdAt || now;
    return {
      id: existing?.id || crypto.randomUUID(),
      trigger: triggerInput.value.trim(),
      replacement: normalizeClipboardFriendlyText(replacementInput.value),
      description: descriptionInput.value.trim() || undefined,
      enabled: enabledToggle.checked,
      caseSensitive: caseSensitiveToggle.checked,
      wordBoundary: wordBoundaryToggle.checked,
      appFilter: resolveAppFilterFromForm(),
      createdAt,
      updatedAt: now,
    };
  }

  function renderList() {
    const items = getFilteredExpansions();
    countLabel.textContent = `${items.length} ${items.length === 1 ? ui.countOne : ui.countMany}`;
    listContainer.innerHTML = '';

    if (items.length === 0) {
      listContainer.innerHTML = `
        <div class="text-center py-10 px-4">
          <div class="text-4xl mb-3 opacity-70">✦</div>
          <div class="font-semibold dark:text-d-text">${escapeHtml(ui.emptyTitle)}</div>
          <div class="text-xs dark:text-d-dim mt-1">${escapeHtml(ui.emptyDescription)}</div>
        </div>
      `;
      return;
    }

    items.forEach((item) => {
      const selected = item.id === editingId;
      const snippetPreview = normalizeClipboardFriendlyText(item.replacement)
        .replace(/\n/g, ' ⏎ ')
        .slice(0, 160);
      const filters = item.appFilter || [];
      const filterLabel = appFilterSummary(filters, locale);

      const card = document.createElement('button');
      card.type = 'button';
      card.className = [
        'text-left rounded-xl border p-3 transition-colors',
        'dark:bg-d-input dark:border-d-border hover:dark:border-d-primary',
        selected ? 'outline outline-2 outline-d-primary/60' : '',
      ].join(' ');
      card.innerHTML = `
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="px-2 py-1 rounded-md text-[11px] font-mono font-bold bg-d-primary/15 text-d-primary">${escapeHtml(item.trigger)}</span>
              ${item.enabled ? `<span class="px-2 py-1 rounded-md text-[10px] font-semibold bg-green-500/15 text-green-400">${escapeHtml(ui.enabledChip)}</span>` : `<span class="px-2 py-1 rounded-md text-[10px] font-semibold bg-red-500/15 text-red-400">${escapeHtml(ui.pausedChip)}</span>`}
            </div>
            <div class="text-xs dark:text-d-dim mt-2 line-clamp-2">${escapeHtml(item.description || ui.noDescription)}</div>
          </div>
          <div class="text-[10px] font-mono dark:text-d-dim shrink-0">${item.caseSensitive ? 'Aa' : 'aa'}</div>
        </div>
        <div class="mt-3 text-[11px] dark:text-d-text font-mono whitespace-pre-wrap break-words leading-relaxed">
          ${escapeHtml(snippetPreview || '(empty)')}
        </div>
        <div class="mt-3 flex flex-wrap gap-1.5">
          <span class="px-2 py-1 rounded-md text-[10px] dark:bg-black/20 dark:text-d-dim">${item.wordBoundary ? escapeHtml(ui.boundaryChip) : escapeHtml(ui.noBoundaryChip)}</span>
          <span class="px-2 py-1 rounded-md text-[10px] dark:bg-black/20 dark:text-d-dim">${filterLabel}</span>
        </div>
      `;
      card.addEventListener('click', () => loadItemIntoForm(item));
      listContainer.appendChild(card);
    });
  }

  function renderPackages() {
    if (!packagesList) {
      return;
    }

    packagesList.innerHTML = '';

    UNITY_PACKAGES.forEach((pkg) => {
      const installedCount = pkg.items.filter((item) => triggerExists(item.trigger)).length;
      const card = document.createElement('section');
      card.className = 'rounded-xl border dark:border-d-border dark:bg-d-input/60 p-3 flex flex-col gap-3';

      const itemsHtml = pkg.items.map((item) => {
        const installed = triggerExists(item.trigger);
        return `
          <div class="rounded-lg border dark:border-d-border/70 dark:bg-black/10 px-3 py-2 flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="px-2 py-0.5 rounded bg-d-primary/15 text-d-primary text-[10px] font-mono font-bold">${escapeHtml(item.trigger)}</span>
                <span class="text-[10px] dark:text-d-dim">${escapeHtml(item.description || '')}</span>
              </div>
              <div class="text-[10px] dark:text-d-dim mt-1 truncate">${escapeHtml(normalizeClipboardFriendlyText(item.replacement).replace(/\n/g, ' ⏎ '))}</div>
            </div>
            <button
              type="button"
              data-package-item-trigger="${escapeHtml(item.trigger)}"
              class="px-2.5 py-1 rounded-md text-[10px] font-semibold ${installed ? 'dark:bg-d-border/40 dark:text-d-dim' : 'bg-d-primary text-black'}"
              ${installed || isMutating ? 'disabled' : ''}
            >
              ${installed ? escapeHtml(ui.installed) : escapeHtml(ui.installItem)}
            </button>
          </div>
        `;
      }).join('');

      card.innerHTML = `
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="font-semibold text-sm dark:text-d-text">${escapeHtml(pkg.title)}</div>
            <div class="text-xs dark:text-d-dim mt-1">${escapeHtml(pkg.description)}</div>
          </div>
          <button
            type="button"
            data-package-id="${escapeHtml(pkg.id)}"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold ${installedCount === pkg.items.length ? 'dark:bg-d-border/40 dark:text-d-dim' : 'dark:bg-d-card bg-d-primary text-black'}"
            ${installedCount === pkg.items.length || isMutating ? 'disabled' : ''}
          >
            ${installedCount === pkg.items.length ? escapeHtml(ui.installed) : escapeHtml(ui.installPack)}
          </button>
        </div>
        <div class="text-[10px] dark:text-d-dim">${installedCount}/${pkg.items.length} ${escapeHtml(ui.installed.toLowerCase())}</div>
        <div class="flex flex-col gap-2">${itemsHtml}</div>
      `;

      card.querySelector(`[data-package-id="${pkg.id}"]`)?.addEventListener('click', async () => {
        await installPackage(pkg.id);
      });

      pkg.items.forEach((item) => {
        card.querySelector(`[data-package-item-trigger="${item.trigger}"]`)?.addEventListener('click', async () => {
          await installPackageItem(item);
        });
      });

      packagesList.appendChild(card);
    });
  }

  async function loadTextExpansions() {
    const items = await invoke('load_text_expansions');
    expansions = Array.isArray(items) ? items : [];
    if (editingId && !expansions.some((item) => item.id === editingId)) {
      clearForm();
    }
    scheduleRender();
  }

  async function saveCurrent() {
    if (isMutating) {
      return;
    }
    const existing = expansions.find((item) => item.id === editingId) || null;
    const payload = normalizeFormPayload(existing);
    if (!payload.trigger) {
      showToast(ui.errorTriggerRequired, 1600, 'error');
      triggerInput.focus();
      return;
    }
    if (!payload.replacement) {
      showToast(ui.errorReplacementRequired, 1600, 'error');
      replacementInput.focus();
      return;
    }
    if (getConflict(payload.trigger, payload.id)) {
      updateConflictState();
      showToast(ui.errorConflict, 1600, 'error');
      return;
    }

    const nextItems = existing
      ? expansions.map((item) => (item.id === existing.id ? payload : item))
      : [...expansions, payload];

    try {
      setBusy(true);
      markLocalMutation();
      const saved = await invoke('save_text_expansions', { items: nextItems });
      expansions = Array.isArray(saved) ? saved : nextItems;
      editingId = payload.id;
      const savedItem = expansions.find((item) => item.id === payload.id);
      scheduleRender();
      if (savedItem) {
        loadItemIntoForm(savedItem);
      }
      showToast(existing ? ui.toastUpdated : ui.toastCreated, 1400, 'success');
    } catch (error) {
      showToast(String(error), 1800, 'error');
    } finally {
      setBusy(false);
      updateConflictState();
    }
  }

  function getConflict(trigger, ignoreId) {
    const key = normalizeTrigger(trigger);
    if (!key) return null;
    return expansions.find((item) => {
      if (ignoreId && item.id === ignoreId) return false;
      return normalizeTrigger(item.trigger) === key;
    }) || null;
  }

  async function deleteCurrent() {
    if (isMutating) {
      return;
    }
    if (!editingId) {
      return;
    }
    const item = expansions.find((entry) => entry.id === editingId);
    if (!item) {
      clearForm();
      return;
    }

    const confirmed = window.confirm(ui.confirmDelete(item.trigger));
    if (!confirmed) {
      return;
    }

    const nextItems = expansions.filter((entry) => entry.id !== editingId);
    try {
      setBusy(true);
      markLocalMutation();
      const saved = await invoke('save_text_expansions', { items: nextItems });
      expansions = Array.isArray(saved) ? saved : nextItems;
      clearForm();
      scheduleRender();
      showToast(ui.toastDeleted, 1200, 'info');
    } catch (error) {
      showToast(String(error), 1800, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function loadDefaults() {
    if (isMutating) {
      return;
    }
    try {
      setBusy(true);
      markLocalMutation();
      const saved = await invoke('reset_text_expansions');
      expansions = Array.isArray(saved) ? saved : [];
      clearForm();
      scheduleRender();
      showToast(ui.toastDefaults, 1400, 'success');
    } catch (error) {
      showToast(String(error), 1800, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function importExpansions() {
    if (isMutating) {
      return;
    }
    try {
      setBusy(true);
      markLocalMutation();
      const imported = await invoke('import_text_expansions', { locale });
      if (!imported) {
        return;
      }
      expansions = Array.isArray(imported) ? imported : expansions;
      clearForm();
      scheduleRender();
      showToast(ui.toastImported, 1400, 'success');
    } catch (error) {
      showToast(String(error), 1800, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function exportExpansions() {
    if (isMutating) {
      return;
    }
    try {
      setBusy(true);
      const exported = await invoke('export_text_expansions', { locale });
      if (exported) {
        showToast(ui.toastExported, 1200, 'success');
      }
    } catch (error) {
      showToast(String(error), 1800, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function commitExpansionList(nextItems) {
    setBusy(true);
    markLocalMutation();
    try {
      const saved = await invoke('save_text_expansions', { items: nextItems });
      expansions = Array.isArray(saved) ? saved : nextItems;
      scheduleRender();
      return expansions;
    } finally {
      setBusy(false);
      updateConflictState();
    }
  }

  async function installPackageItem(item) {
    if (isMutating) {
      return;
    }
    if (triggerExists(item.trigger)) {
      showToast(ui.toastItemSkipped(item.trigger), 1200, 'info');
      return;
    }
    try {
      const nextItems = [...expansions, buildPackageItem(item)];
      await commitExpansionList(nextItems);
      showToast(ui.toastItemInstalled(item.trigger), 1400, 'success');
    } catch (error) {
      showToast(String(error), 1800, 'error');
    }
  }

  async function installPackage(packageId) {
    if (isMutating) {
      return;
    }
    const pkg = UNITY_PACKAGES.find((entry) => entry.id === packageId);
    if (!pkg) {
      return;
    }
    try {
      const { next, added, skipped } = mergePackageItems(pkg.items);
      if (added === 0) {
        showToast(ui.toastPackInstalled(pkg.title, added, skipped), 1500, 'info');
        return;
      }
      await commitExpansionList(next);
      showToast(ui.toastPackInstalled(pkg.title, added, skipped), 1600, 'success');
    } catch (error) {
      showToast(String(error), 1800, 'error');
    }
  }

  async function installAllPackages() {
    if (isMutating) {
      return;
    }
    try {
      const allItems = UNITY_PACKAGES.flatMap((pkg) => pkg.items);
      const { next, added, skipped } = mergePackageItems(allItems);
      if (added === 0) {
        showToast(ui.toastPackInstalled(ui.installAllPacks, added, skipped), 1600, 'info');
        return;
      }
      await commitExpansionList(next);
      showToast(ui.toastPackInstalled(ui.installAllPacks, added, skipped), 1800, 'success');
    } catch (error) {
      showToast(String(error), 1800, 'error');
    }
  }

  function openPanel() {
    if (isOpen) {
      return;
    }
    isOpen = true;
    setOpenButtonState(true);
    panelTrack.classList.remove('settings-open', 'dashboard-open', 'text-expansion-open');
    panelTrack.classList.add('text-expansion-open');
    setWindowSize(true);
    scheduleRender();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scheduleRender();
        searchInput.focus();
      });
    });
    window.dispatchEvent(new CustomEvent('text-expansion-opened'));
  }

  function closePanel() {
    if (!isOpen) {
      return;
    }
    isOpen = false;
    setOpenButtonState(false);
    panelTrack.classList.remove('text-expansion-open');
    setWindowSize(false);
    window.dispatchEvent(new CustomEvent('text-expansion-closed'));
  }

  function refreshConflictWarning() {
    updateConflictState();
  }

  function attachEvents() {
    searchInput.addEventListener('input', () => {
      searchTerm = searchInput.value;
      scheduleRender();
    });

    triggerInput.addEventListener('input', refreshConflictWarning);
    appFilterMode.addEventListener('change', () => {
      const mode = appFilterMode.value;
      appFilterCustom.disabled = mode !== 'custom';
      if (mode !== 'custom') {
        appFilterCustom.value = '';
      }
      if (mode === 'all') {
        appFilterPreview.textContent = ui.appFilterPreviewAll;
        return;
      }
      if (mode === 'custom') {
        const customList = sortForDisplay(uniqueNormalized(appFilterCustom.value.split(','))).join(', ');
        appFilterPreview.textContent = customList || ui.appFilterPreviewCustom;
        return;
      }
      appFilterPreview.textContent = appFilterLabel(APP_FILTER_PRESETS[mode] || [], locale);
    });
    appFilterCustom.addEventListener('input', () => {
      if (appFilterMode.value === 'custom') {
        appFilterPreview.textContent = sortForDisplay(uniqueNormalized(appFilterCustom.value.split(','))).join(', ') || ui.appFilterPreviewCustom;
      }
    });
    [descriptionInput, replacementInput, enabledToggle, caseSensitiveToggle, wordBoundaryToggle].forEach((element) => {
      element.addEventListener('input', refreshConflictWarning);
      element.addEventListener('change', refreshConflictWarning);
    });

    saveButton.addEventListener('click', saveCurrent);
    deleteButton.addEventListener('click', deleteCurrent);
    clearButton.addEventListener('click', clearForm);
    defaultsButton.addEventListener('click', loadDefaults);
    importButton.addEventListener('click', importExpansions);
    exportButton.addEventListener('click', exportExpansions);
    addButton.addEventListener('click', clearForm);
    installAllPackagesButton?.addEventListener('click', installAllPackages);
    backButton.addEventListener('click', closePanel);
    openButton?.addEventListener('click', () => {
      if (isOpen) {
        closePanel();
        return;
      }
      openPanel();
    });
    openFromSettingsButton?.addEventListener('click', openPanel);

  }

  const eventUnsubscribe = [];

  async function attachListeners() {
    if (!listen) {
      return;
    }
    const handle = await listen('text-expansions-updated', async () => {
      if (isMutating || Date.now() < suppressRemoteReloadUntil) {
        return;
      }
      await loadTextExpansions();
    });
    eventUnsubscribe.push(handle);
  }

  applyLocale();
  setOpenButtonState(false);
  attachEvents();
  void attachListeners();

  loadPromise = loadTextExpansions()
    .then(() => {
      clearForm();
      updateConflictState();
      scheduleRender();
    })
    .catch((error) => {
      showToast(String(error), 1800, 'error');
    });

  return {
    openPanel,
    closePanel,
    isOpen: () => isOpen,
    refresh: async () => {
      await loadTextExpansions();
      refreshConflictWarning();
      scheduleRender();
    },
    ready: () => loadPromise,
    dispose: async () => {
      for (const item of eventUnsubscribe) {
        if (typeof item === 'function') {
          try {
            await item();
          } catch {
            // ignored
          }
        }
      }
    },
  };
}
