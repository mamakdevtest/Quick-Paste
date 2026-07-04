# Graph Report - insta-paste-tauri  (2026-07-04)

## Corpus Check
- 17 files · ~22,950 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 308 nodes · 439 edges · 28 communities (17 shown, 11 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.71)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b3b0c6e8`
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

## God Nodes (most connected - your core abstractions)
1. `⚙️ Uygulamadaki Tüm Sistemler ve Çalışma Prensipleri` - 14 edges
2. `AppState` - 13 edges
3. `reregister_all_shortcuts()` - 12 edges
4. `import_data()` - 10 edges
5. `Snippet` - 8 edges
6. `Settings` - 8 edges
7. `save_settings()` - 8 edges
8. `save_snippets()` - 8 edges
9. `run()` - 8 edges
10. `selectAndPaste()` - 8 edges

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

## Communities (28 total, 11 thin omitted)

### Community 0 - "main.js"
Cohesion: 0.02
Nodes (69): addBtn, appSettings, appWindow, autoPasteToggle, bulkActionBar, bulkCancelBtn, bulkDeleteBtn, bulkStackBtn (+61 more)

### Community 1 - "features.js"
Cohesion: 0.07
Nodes (36): checkAutoPromote(), CONTENT_DETECTORS, CONTEXT_MAP, delay(), detectContentType(), escapeHtmlSimple(), executeChain(), fuzzyFilter() (+28 more)

### Community 2 - "lib.rs"
Cohesion: 0.16
Nodes (36): Snippet, Result, AppState, capture_foreground_window(), capture_target(), clear_all_data(), copy_and_paste(), copy_only() (+28 more)

### Community 3 - "⚙️ Uygulamadaki Tüm Sistemler ve Çalışma Prensipleri"
Cohesion: 0.11
Nodes (18): 10. Saydamlık Kontrol Sistemi (Opacity Engine), 11. Karakter Sayacı ve Sınır Denetimi, 12. Clipboard'dan Doğrudan İçe Aktarma, 13. Hazır Şablon Sistemi (Templates), 1. Pencere Odaklama & Otomatik Yapıştırma Sistemi (Win32 Bridge), 2. Clipboard Monitor (Pano Takip & Kilit Yönetimi), 3. Arama & Filtreleme & Kelime Vurgulama (Search & Highlight), 4. Sıralama Sistemi (Sort Engine) (+10 more)

### Community 4 - "tauri.conf.json"
Cohesion: 0.11
Nodes (17): app, security, windows, withGlobalTauri, build, frontendDist, bundle, active (+9 more)

### Community 5 - "data_store.rs"
Cohesion: 0.31
Nodes (12): get_app_dir(), get_settings_path(), get_snippets_path(), load_settings(), load_snippets(), save_and_load_settings_roundtrip(), save_and_load_snippets_roundtrip(), save_settings() (+4 more)

### Community 6 - "process_new_clipboard_text"
Cohesion: 0.26
Nodes (8): Arc, AtomicBool, clipboard_wnd_proc(), ClipboardMonitor, ClipboardPayload, is_password_manager(), process_new_clipboard_text(), HWND

### Community 7 - "keyboard_hook.rs"
Cohesion: 0.22
Nodes (11): HookEvent, make_keyboard_input(), map_vk_to_char(), INPUT, Option, String, Vec, send_backspaces() (+3 more)

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
Cohesion: 0.67
Nodes (3): applyTheme(), applySettings(), saveCurrentSettings()

## Knowledge Gaps
- **125 isolated node(s):** `name`, `private`, `version`, `type`, `tauri` (+120 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `processClipboardEntry()` connect `features.js` to `main.js`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `processStaticPlaceholders()` connect `features.js` to `main.js`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `AppState` connect `lib.rs` to `process_new_clipboard_text`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _125 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `main.js` be split into smaller, more focused modules?**
  _Cohesion score 0.023809523809523808 - nodes in this community are weakly interconnected._
- **Should `features.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0664451827242525 - nodes in this community are weakly interconnected._
- **Should `⚙️ Uygulamadaki Tüm Sistemler ve Çalışma Prensipleri` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._