# Graph Report - insta-paste-tauri  (2026-07-05)

## Corpus Check
- 26 files · ~96,997 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 752 nodes · 1274 edges · 70 communities (43 shown, 27 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5549735e`
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
- [[_COMMUNITY_9. Text Expansion Panel|9. Text Expansion Panel]]
- [[_COMMUNITY_Desktop UIUX Skill|Desktop UI/UX Skill]]
- [[_COMMUNITY_11. Settings Panel|11. Settings Panel]]
- [[_COMMUNITY_Snippet Listesi|Snippet Listesi]]
- [[_COMMUNITY_Form Alanları|Form Alanları]]
- [[_COMMUNITY_Design System Guardian Skill|Design System Guardian Skill]]
- [[_COMMUNITY_18. Geliştirilebilir Tasarım Alanları|18. Geliştirilebilir Tasarım Alanları]]
- [[_COMMUNITY_QuickPaste Agent Instructions|QuickPaste Agent Instructions]]
- [[_COMMUNITY_Visual UI Review Skill|Visual UI Review Skill]]
- [[_COMMUNITY_QuickPaste Tasarım Envanteri|QuickPaste Tasarım Envanteri]]
- [[_COMMUNITY_12. Welcome Window|12. Welcome Window]]
- [[_COMMUNITY_13. Suggestions Popup|13. Suggestions Popup]]
- [[_COMMUNITY_10. Dashboard & Stats Panel|10. Dashboard & Stats Panel]]
- [[_COMMUNITY_6. Command Palette|6. Command Palette]]
- [[_COMMUNITY_14. Launcher Window|14. Launcher Window]]
- [[_COMMUNITY_5. Quick Look Overlay|5. Quick Look Overlay]]
- [[_COMMUNITY_16. Tema ve Görsel Dil|16. Tema ve Görsel Dil]]
- [[_COMMUNITY_1. Main Window  Ana Shell|1. Main Window / Ana Shell]]
- [[_COMMUNITY_4. Snippet Context Menu|4. Snippet Context Menu]]
- [[_COMMUNITY_7. Placeholder Modal|7. Placeholder Modal]]
- [[_COMMUNITY_8. Toast Notifications|8. Toast Notifications]]

## God Nodes (most connected - your core abstractions)
1. `TextExpansion` - 38 edges
2. `QuickPaste Tasarım Envanteri` - 21 edges
3. `AppState` - 15 edges
4. `build_default_catalog()` - 14 edges
5. `⚙️ Uygulamadaki Tüm Sistemler ve Çalışma Prensipleri` - 14 edges
6. `Form Alanları` - 13 edges
7. `Snippet` - 13 edges
8. `reregister_all_shortcuts()` - 12 edges
9. `Design System Guardian Skill` - 11 edges
10. `9. Text Expansion Panel` - 11 edges

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

## Communities (70 total, 27 thin omitted)

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

### Community 49 - "9. Text Expansion Panel"
Cohesion: 0.10
Nodes (20): 9. Text Expansion Panel, Ana Grid, Application Filter, Conflict Warning, Core Essentials Örnekleri, Default Packs Alanı, Description, Dynamic Variables (+12 more)

### Community 50 - "Desktop UI/UX Skill"
Cohesion: 0.12
Nodes (16): Avoid, Command Palette and Menus, Component Guidance, Dark and Light Mode, Desktop Product Principles, Desktop UI/UX Skill, Forms and Dialogs, Header Navigation (+8 more)

### Community 51 - "11. Settings Panel"
Cohesion: 0.12
Nodes (17): 11. Settings Panel, About, Accent Color, Appearance, Auto-Clean History, Clipboard, Clipboard History, Danger Zone (+9 more)

### Community 52 - "Snippet Listesi"
Cohesion: 0.12
Nodes (17): 2. Ana Sayfa / Snippet Listesi, Bulk Action Bar, Category Filter, Empty State, From Clipboard, İçerik Preview, Kart Aksiyonları, Kart Davranışları (+9 more)

### Community 53 - "Form Alanları"
Cohesion: 0.12
Nodes (17): 3. Add/Edit Snippet Dialog, Açıldığı Yerler, Color Label, Content, Emoji, Expansion Trigger, Footer, Form Alanları (+9 more)

### Community 54 - "Design System Guardian Skill"
Cohesion: 0.17
Nodes (11): CSS Placement Rules, Design System Guardian Skill, Hard Rules, Naming Rules, Preferred Future Token Structure, Project Context, Required Pre-Implementation Audit, Review Checklist (+3 more)

### Community 55 - "18. Geliştirilebilir Tasarım Alanları"
Cohesion: 0.18
Nodes (11): 18. Geliştirilebilir Tasarım Alanları, Ana Sayfa Search Alanı, Dashboard, Default Packs, Header Navigation, Launcher, Settings, Snippet Card (+3 more)

### Community 56 - "QuickPaste Agent Instructions"
Cohesion: 0.20
Nodes (9): Design System Rules, General Rules, Interactive Component Requirements, Project Architecture, QuickPaste Agent Instructions, Required Local Skills for UI Work, Responsive Rules, Verification Guidance (+1 more)

### Community 57 - "Visual UI Review Skill"
Cohesion: 0.20
Nodes (9): Interaction Review, Preferred Review Workflow, Project Context, Refinement Pass Requirement, Reporting, Required Screen Sizes, Visual Review Criteria, Visual UI Review Skill (+1 more)

### Community 58 - "QuickPaste Tasarım Envanteri"
Cohesion: 0.20
Nodes (9): 15. Eski Text Expansion Onboarding Overlay, 17. Tasarım İçin Component Listesi, 19. Tasarım Öncelik Sırası, Ana Pencere İçindeki Paneller, Genel Mimari, İçerik, QuickPaste Tasarım Envanteri, Tasarım Notu (+1 more)

### Community 59 - "12. Welcome Window"
Cohesion: 0.25
Nodes (8): 12. Welcome Window, Amaç, Davranış, Header, Sağ Kolon: Available Packs, Sol Kolon: Dynamic Variables, Sol Kolon: Selected Packs, Sol Kolon: Your Profile

### Community 60 - "13. Suggestions Popup"
Cohesion: 0.25
Nodes (8): 13. Suggestions Popup, Amaç, Davranış, Footer, Görünüm, Header, Query Row, Suggestion List

### Community 61 - "10. Dashboard & Stats Panel"
Cohesion: 0.33
Nodes (6): 10. Dashboard & Stats Panel, 7-Day Activity, Başlık, Metrics Breakdown, Most Used Snippets, Stat Cards

### Community 62 - "6. Command Palette"
Cohesion: 0.33
Nodes (6): 6. Command Palette, Davranış, Görünüm, Input, Sistem Komutları, Snippet Arama

### Community 63 - "14. Launcher Window"
Cohesion: 0.40
Nodes (5): 14. Launcher Window, Amaç, Launcher Mode Farkları, Pencere Özellikleri, Tasarım Notu

### Community 64 - "5. Quick Look Overlay"
Cohesion: 0.40
Nodes (5): 5. Quick Look Overlay, Açıldığı Yerler, Görünüm, İçerik, Secret State

### Community 65 - "16. Tema ve Görsel Dil"
Cohesion: 0.50
Nodes (4): 16. Tema ve Görsel Dil, Ana Token'lar, Mevcut Görsel Karakter, Tasarımda Korunması Gerekenler

### Community 66 - "1. Main Window / Ana Shell"
Cohesion: 0.50
Nodes (4): 1. Main Window / Ana Shell, Footer, Görsel Yapı, Header

### Community 67 - "4. Snippet Context Menu"
Cohesion: 0.50
Nodes (4): 4. Snippet Context Menu, Menü Öğeleri, Tasarım Notu, Transform Submenu

### Community 68 - "7. Placeholder Modal"
Cohesion: 0.50
Nodes (4): 7. Placeholder Modal, Davranış, Footer, Görünüm

### Community 69 - "8. Toast Notifications"
Cohesion: 0.50
Nodes (4): 8. Toast Notifications, Kullanıldığı Durumlar, Tasarım Notu, Tipler

## Knowledge Gaps
- **295 isolated node(s):** `Project Context`, `Required Pre-Implementation Audit`, `Token Rules`, `Preferred Future Token Structure`, `Hard Rules` (+290 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **27 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `QuickPaste Tasarım Envanteri` connect `QuickPaste Tasarım Envanteri` to `5. Quick Look Overlay`, `16. Tema ve Görsel Dil`, `1. Main Window / Ana Shell`, `4. Snippet Context Menu`, `7. Placeholder Modal`, `8. Toast Notifications`, `9. Text Expansion Panel`, `11. Settings Panel`, `Snippet Listesi`, `Form Alanları`, `18. Geliştirilebilir Tasarım Alanları`, `12. Welcome Window`, `13. Suggestions Popup`, `10. Dashboard & Stats Panel`, `6. Command Palette`, `14. Launcher Window`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `TextExpansion` connect `applyTheme` to `lib.rs`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **What connects `Project Context`, `Required Pre-Implementation Audit`, `Token Rules` to the rest of the system?**
  _295 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `main.js` be split into smaller, more focused modules?**
  _Cohesion score 0.021739130434782608 - nodes in this community are weakly interconnected._
- **Should `features.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07317073170731707 - nodes in this community are weakly interconnected._
- **Should `lib.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.11717171717171718 - nodes in this community are weakly interconnected._
- **Should `⚙️ Uygulamadaki Tüm Sistemler ve Çalışma Prensipleri` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._