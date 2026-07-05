# Graph Report - insta-paste-tauri  (2026-07-05)

## Corpus Check
- 19 files · ~77,910 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 437 nodes · 797 edges · 36 communities (19 shown, 17 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.71)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4154b2c7`
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

## God Nodes (most connected - your core abstractions)
1. `TextExpansion` - 34 edges
2. `⚙️ Uygulamadaki Tüm Sistemler ve Çalışma Prensipleri` - 14 edges
3. `AppState` - 13 edges
4. `reregister_all_shortcuts()` - 12 edges
5. `bootstrap_runtime()` - 10 edges
6. `evaluate_match()` - 10 edges
7. `keyboard_hook_proc()` - 9 edges
8. `paste_via_clipboard()` - 9 edges
9. `import_data()` - 9 edges
10. `set_runtime()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `loadAndDisplay()` --calls--> `fuzzyFilter()`  [INFERRED]
  src/main.js → src/features.js
- `processStaticPlaceholders()` --calls--> `processInlineExpressions()`  [INFERRED]
  src/main.js → src/features.js
- `processStaticPlaceholders()` --calls--> `resolveLinkedSnippets()`  [INFERRED]
  src/main.js → src/features.js
- `processStaticPlaceholders()` --calls--> `processConditionalTemplates()`  [INFERRED]
  src/main.js → src/features.js
- `loadAndDisplay()` --calls--> `sortByContext()`  [INFERRED]
  src/main.js → src/features.js

## Import Cycles
- None detected.

## Communities (36 total, 17 thin omitted)

### Community 0 - "main.js"
Cohesion: 0.02
Nodes (70): addBtn, appSettings, appWindow, autoPasteToggle, bulkActionBar, bulkCancelBtn, bulkDeleteBtn, bulkStackBtn (+62 more)

### Community 1 - "features.js"
Cohesion: 0.07
Nodes (34): applyTheme(), buildCustomTheme(), checkAutoPromote(), CONTENT_DETECTORS, CONTEXT_MAP, delay(), detectContentType(), escapeHtmlSimple() (+26 more)

### Community 2 - "lib.rs"
Cohesion: 0.13
Nodes (44): AppHandle, ClipboardMonitor, Mutex, Settings, AppState, capture_foreground_window(), capture_target(), clear_all_data() (+36 more)

### Community 3 - "⚙️ Uygulamadaki Tüm Sistemler ve Çalışma Prensipleri"
Cohesion: 0.11
Nodes (18): 10. Saydamlık Kontrol Sistemi (Opacity Engine), 11. Karakter Sayacı ve Sınır Denetimi, 12. Clipboard'dan Doğrudan İçe Aktarma, 13. Hazır Şablon Sistemi (Templates), 1. Pencere Odaklama & Otomatik Yapıştırma Sistemi (Win32 Bridge), 2. Clipboard Monitor (Pano Takip & Kilit Yönetimi), 3. Arama & Filtreleme & Kelime Vurgulama (Search & Highlight), 4. Sıralama Sistemi (Sort Engine) (+10 more)

### Community 4 - "tauri.conf.json"
Cohesion: 0.11
Nodes (17): app, security, windows, withGlobalTauri, build, frontendDist, bundle, active (+9 more)

### Community 5 - "data_store.rs"
Cohesion: 0.17
Nodes (23): Default, FnOnce, Option, PathBuf, Self, default_snippet_type(), default_theme(), get_app_dir() (+15 more)

### Community 6 - "process_new_clipboard_text"
Cohesion: 0.26
Nodes (8): Arc, AtomicBool, clipboard_wnd_proc(), ClipboardMonitor, ClipboardPayload, is_password_manager(), process_new_clipboard_text(), HWND

### Community 7 - "keyboard_hook.rs"
Cohesion: 0.17
Nodes (23): Drop, INPUT, classify_terminator(), is_injected(), is_key_down(), is_navigation_key(), is_pure_modifier(), keyboard_hook_proc() (+15 more)

### Community 8 - "QuickPaste — Geliştirici ve Kurulum Kılavuzu (HowToDo.md)"
Cohesion: 0.18
Nodes (10): 1. Task Manager İsmi ve Telif Bilgisi, 2. Türkçe Karakterli Hotkey Desteği, 3. Pano Kilit Çatışması (Clipboard Lock Isolation), 📦 Dağıtım İçin Paketleme (Production Build), 🚀 Geliştirme Ortamında Çalıştırma (Dev Mode), 📂 Kritik Dosyaların Rolleri, 💡 Kritik Özellikler & Sorun Giderme, QuickPaste — Geliştirici ve Kurulum Kılavuzu (HowToDo.md) (+2 more)

### Community 9 - "clipboard_manager.rs"
Cohesion: 0.27
Nodes (7): get_active_process_name(), make_keyboard_input(), release_all_modifiers(), restore_focus_and_paste(), INPUT, String, send_ctrl_v()

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
Cohesion: 0.11
Nodes (59): RwLock, app_filter_matches(), append_text(), backspace_buffer(), bootstrap_runtime(), boundary_allows(), buffer_limit(), build_runtime_state() (+51 more)

### Community 28 - "text-expansion-panel.js"
Cohesion: 0.20
Nodes (14): APP_FILTER_LABELS, APP_FILTER_PRESETS, appFilterLabel(), appFilterSummary(), detectPreset(), getLocaleStrings(), normalizeProcessName(), normalizeTrigger() (+6 more)

### Community 29 - "selectAndPaste"
Cohesion: 0.18
Nodes (12): fuzzyFilter(), sortByContext(), getCustomPlaceholders(), loadAndDisplay(), performPaste(), promptPlaceholders(), refreshCategoryFilter(), reloadData() (+4 more)

## Knowledge Gaps
- **129 isolated node(s):** `CONTENT_DETECTORS`, `TRANSFORMS`, `CONTEXT_MAP`, `THEMES`, `paletteItems` (+124 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TextExpansion` connect `applyTheme` to `lib.rs`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Why does `processClipboardEntry()` connect `features.js` to `main.js`, `selectAndPaste`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Why does `processStaticPlaceholders()` connect `features.js` to `main.js`, `selectAndPaste`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **What connects `CONTENT_DETECTORS`, `TRANSFORMS`, `CONTEXT_MAP` to the rest of the system?**
  _129 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `main.js` be split into smaller, more focused modules?**
  _Cohesion score 0.022727272727272728 - nodes in this community are weakly interconnected._
- **Should `features.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0743321718931475 - nodes in this community are weakly interconnected._
- **Should `lib.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.13140096618357489 - nodes in this community are weakly interconnected._