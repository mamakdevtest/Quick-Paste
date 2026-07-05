# Graph Report - insta-paste-tauri  (2026-07-05)

## Corpus Check
- 21 files · ~88,389 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 553 nodes · 1080 edges · 49 communities (22 shown, 27 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `70ffca45`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_main.js|main.js]]
- [[_COMMUNITY_features.js|features.js]]
- [[_COMMUNITY_lib.rs|lib.rs]]
- [[_COMMUNITY_⚙️ Uygulamadaki Tüm Sistemler ve Çalışma Prensipleri|⚙️ Uygulamadaki Tüm Sistemler ve Çalışma Prensipleri]]
- [[_COMMUNITY_tauri.conf.json|tauri.conf.json]]
- [[_COMMUNITY_data_store.rs|data_store.rs]]
- [[_COMMUNITY_process_new_clipboard_text|process_new_clipboard_text]]
- [[_COMMUNITY_keyboard_hook.rs|keyboard_hook.rs]]
- [[_COMMUNITY_QuickPaste — Geliştirici ve Kurulum Kılavuzu (HowToDo.md)|QuickPaste — Geliştirici ve Kurulum Kılavuzu (HowToDo.md)]]
- [[_COMMUNITY_clipboard_manager.rs|clipboard_manager.rs]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_default.json|default.json]]
- [[_COMMUNITY_handleOutsideContextClick|handleOutsideContextClick]]
- [[_COMMUNITY_Tauri + Vanilla|Tauri + Vanilla]]
- [[_COMMUNITY_applyTheme|applyTheme]]
- [[_COMMUNITY_escapeHtml|escapeHtml]]
- [[_COMMUNITY_formatCharCount|formatCharCount]]
- [[_COMMUNITY_Tauri + Vanilla|Tauri + Vanilla]]
- [[_COMMUNITY_Mutex|Mutex]]
- [[_COMMUNITY_Option|Option]]
- [[_COMMUNITY_String|String]]
- [[_COMMUNITY_Vec|Vec]]
- [[_COMMUNITY_Self|Self]]
- [[_COMMUNITY_String|String]]
- [[_COMMUNITY_Vec|Vec]]
- [[_COMMUNITY_text-expansion-panel.js|text-expansion-panel.js]]
- [[_COMMUNITY_selectAndPaste|selectAndPaste]]
- [[_COMMUNITY_Result|Result]]
- [[_COMMUNITY_INPUT|INPUT]]
- [[_COMMUNITY_Vec|Vec]]
- [[_COMMUNITY_AppHandle|AppHandle]]
- [[_COMMUNITY_Mutex|Mutex]]
- [[_COMMUNITY_applyPanelHeaderState|applyPanelHeaderState]]
- [[_COMMUNITY_Drop|Drop]]
- [[_COMMUNITY_INPUT|INPUT]]
- [[_COMMUNITY_Option|Option]]
- [[_COMMUNITY_PathBuf|PathBuf]]
- [[_COMMUNITY_Self|Self]]
- [[_COMMUNITY_Settings|Settings]]
- [[_COMMUNITY_Snippet|Snippet]]
- [[_COMMUNITY_Snippet|Snippet]]
- [[_COMMUNITY_String|String]]
- [[_COMMUNITY_Vec|Vec]]
- [[_COMMUNITY_Mutex|Mutex]]
- [[_COMMUNITY_Mutex|Mutex]]
- [[_COMMUNITY_WebviewWindow|WebviewWindow]]

## God Nodes (most connected - your core abstractions)
1. `TextExpansion` - 38 edges
2. `AppState` - 15 edges
3. `build_default_catalog()` - 14 edges
4. `⚙️ Uygulamadaki Tüm Sistemler ve Çalışma Prensipleri` - 14 edges
5. `Snippet` - 13 edges
6. `reregister_all_shortcuts()` - 12 edges
7. `load_snippets()` - 11 edges
8. `load_settings()` - 11 edges
9. `keyboard_hook_proc()` - 11 edges
10. `build_seeded_text_expansions()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `ImportedData` --references--> `Snippet`  [EXTRACTED]
  src-tauri/src/lib.rs → src-tauri/src/data_store.rs
- `load_snippets()` --references--> `Snippet`  [EXTRACTED]
  src-tauri/src/lib.rs → src-tauri/src/data_store.rs
- `save_snippets()` --references--> `Snippet`  [EXTRACTED]
  src-tauri/src/lib.rs → src-tauri/src/data_store.rs
- `bootstrap_runtime()` --references--> `Snippet`  [EXTRACTED]
  src-tauri/src/text_expansion.rs → src-tauri/src/data_store.rs
- `build_seeded_text_expansions()` --references--> `Snippet`  [EXTRACTED]
  src-tauri/src/text_expansion.rs → src-tauri/src/data_store.rs

## Import Cycles
- None detected.

## Communities (49 total, 27 thin omitted)

### Community 0 - "main.js"
Cohesion: 0.02
Nodes (72): addBtn, appSettings, appWindow, autoPasteToggle, bulkActionBar, bulkCancelBtn, bulkDeleteBtn, bulkStackBtn (+64 more)

### Community 1 - "features.js"
Cohesion: 0.07
Nodes (28): applyTheme(), buildCustomTheme(), buildThemeTokens(), checkAutoPromote(), CONTENT_DETECTORS, CONTEXT_MAP, delay(), detectContentType() (+20 more)

### Community 2 - "lib.rs"
Cohesion: 0.12
Nodes (53): ClipboardMonitor, Mutex, apply_text_expansion_trigger(), AppState, capture_foreground_window(), capture_target(), clear_all_data(), close_welcome_window() (+45 more)

### Community 3 - "⚙️ Uygulamadaki Tüm Sistemler ve Çalışma Prensipleri"
Cohesion: 0.11
Nodes (18): 10. Saydamlık Kontrol Sistemi (Opacity Engine), 11. Karakter Sayacı ve Sınır Denetimi, 12. Clipboard'dan Doğrudan İçe Aktarma, 13. Hazır Şablon Sistemi (Templates), 1. Pencere Odaklama & Otomatik Yapıştırma Sistemi (Win32 Bridge), 2. Clipboard Monitor (Pano Takip & Kilit Yönetimi), 3. Arama & Filtreleme & Kelime Vurgulama (Search & Highlight), 4. Sıralama Sistemi (Sort Engine) (+10 more)

### Community 4 - "tauri.conf.json"
Cohesion: 0.11
Nodes (17): app, security, windows, withGlobalTauri, build, frontendDist, bundle, active (+9 more)

### Community 5 - "data_store.rs"
Cohesion: 0.19
Nodes (29): archive_corrupt_file(), backup_path(), corrupt_archive_path(), default_snippet_type(), default_theme(), get_app_dir(), get_settings_path(), get_snippets_path() (+21 more)

### Community 6 - "process_new_clipboard_text"
Cohesion: 0.16
Nodes (16): Arc, AtomicBool, Duration, HWND, clipboard_updates_suppressed(), clipboard_wnd_proc(), ClipboardMonitor, ClipboardPayload (+8 more)

### Community 7 - "keyboard_hook.rs"
Cohesion: 0.13
Nodes (37): app_handle(), apply_text_expansion_trigger(), classify_terminator(), current_target_window(), ensure_suggestion_window(), hide_suggestion_window(), is_injected(), is_key_down() (+29 more)

### Community 8 - "QuickPaste — Geliştirici ve Kurulum Kılavuzu (HowToDo.md)"
Cohesion: 0.18
Nodes (10): 1. Task Manager İsmi ve Telif Bilgisi, 2. Türkçe Karakterli Hotkey Desteği, 3. Pano Kilit Çatışması (Clipboard Lock Isolation), 📦 Dağıtım İçin Paketleme (Production Build), 🚀 Geliştirme Ortamında Çalıştırma (Dev Mode), 📂 Kritik Dosyaların Rolleri, 💡 Kritik Özellikler & Sorun Giderme, QuickPaste — Geliştirici ve Kurulum Kılavuzu (HowToDo.md) (+2 more)

### Community 9 - "clipboard_manager.rs"
Cohesion: 0.13
Nodes (20): capture_clipboard_snapshot(), ClipboardDataKind, ClipboardFormatData, ClipboardOpenGuard, ClipboardSnapshot, get_active_process_name(), make_keyboard_input(), open_clipboard_with_retry() (+12 more)

### Community 10 - "package.json"
Cohesion: 0.18
Nodes (10): devDependencies, @tauri-apps/cli, name, private, scripts, css:build, css:watch, tauri (+2 more)

### Community 11 - "default.json"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 12 - "handleOutsideContextClick"
Cohesion: 0.83
Nodes (4): handleOutsideContextClick(), hideTransformSubmenu(), removeContextMenu(), showContextMenu()

### Community 14 - "applyTheme"
Cohesion: 0.07
Nodes (88): FnOnce, HashMap, RwLock, app_filter_matches(), append_text(), backspace_buffer(), bootstrap_runtime(), boundary_allows() (+80 more)

### Community 28 - "text-expansion-panel.js"
Cohesion: 0.22
Nodes (13): APP_FILTER_LABELS, APP_FILTER_PRESETS, appFilterLabel(), appFilterSummary(), detectPreset(), getLocaleStrings(), normalizeProcessName(), normalizeTrigger() (+5 more)

### Community 29 - "selectAndPaste"
Cohesion: 0.18
Nodes (12): getCustomPlaceholders(), loadAndDisplay(), performPaste(), processClipboardEntry(), processStaticPlaceholders(), promptPlaceholders(), refreshCategoryFilter(), reloadData() (+4 more)

### Community 32 - "Vec"
Cohesion: 0.22
Nodes (11): APP_FILTER_PRESETS, appFilterLabel(), buildPackageItem(), detectPreset(), getStrings(), main(), normalizeClipboardFriendlyText(), normalizeProcessName() (+3 more)

### Community 33 - "AppHandle"
Cohesion: 0.38
Nodes (5): elements, main(), normalize(), render(), state

### Community 35 - "applyPanelHeaderState"
Cohesion: 0.50
Nodes (4): applyPanelHeaderState(), resizeForSidePanel(), returnToMainPage(), setHeaderButtonActive()

## Knowledge Gaps
- **134 isolated node(s):** `$schema`, `productName`, `version`, `identifier`, `frontendDist` (+129 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **27 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TextExpansion` connect `applyTheme` to `lib.rs`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `Snippet` connect `data_store.rs` to `lib.rs`, `applyTheme`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **What connects `$schema`, `productName`, `version` to the rest of the system?**
  _134 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `main.js` be split into smaller, more focused modules?**
  _Cohesion score 0.021739130434782608 - nodes in this community are weakly interconnected._
- **Should `features.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07317073170731707 - nodes in this community are weakly interconnected._
- **Should `lib.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.11717171717171718 - nodes in this community are weakly interconnected._
- **Should `⚙️ Uygulamadaki Tüm Sistemler ve Çalışma Prensipleri` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._