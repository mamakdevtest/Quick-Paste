# QuickPaste — Kapsamlı Proje Mimarisi ve Sistemleri (AboutProject.md)

Bu doküman, **QuickPaste** uygulamasındaki tüm alt sistemleri, veri akışlarını ve kullanılan teknolojileri detaylı bir şekilde listeler. Geliştirme yaparken bu sistemlerin birbiriyle olan ilişkisini anlamak kritik önem taşır.

---

## 🛠️ Teknoloji ve Bağımlılık Matrisi

QuickPaste, düşük kaynak tüketimi sağlamak ve yerel işletim sistemi yeteneklerine erişmek için **Tauri v2** mimarisi üzerine inşa edilmiştir.

### Arayüz Teknolojileri (Frontend)
- **HTML5 & CSS3 (Vanilla)**:
  - Material Design 3 benzeri tasarım dili (renk tokenları, dinamik karanlık mod, rounded köşeler).
  - Özel kaydırma çubukları (`::-webkit-scrollbar`), flexbox düzenleri ve pencere boyutlandırıldığında otomatik daralan/genişleyen panel animasyonları.
- **JavaScript (ES2025+)**:
  - Rust IPC (Inter-Process Communication) çağrıları.
  - Event listener'lar üzerinden gerçek zamanlı pano eşitlemesi ve saydamlık sinyalleri.

### Rust Arka Plan Bileşenleri (Backend)
- **Tauri Core v2.11.5**: Ana uygulama yaşam döngüsü, pencere olayları ve kanal yönetimi.
- **Tauri Plugins**:
  - `tauri-plugin-global-shortcut` (v2.3.1): Sistem düzeyinde küresel kısayol yakalama.
  - `tauri-plugin-opener` (v2.5.0): Yerel dosya gezgini veya web tarayıcısı başlatma.
- **Sistem Kütüphaneleri**:
  - `windows-sys` (v0.61.2): Windows Win32 API çağrıları (Pencere hiyerarşisi, odaklama, klavye simülasyonu).
  - `winreg` (v0.55.0): Windows Registry HKCU (Current User) erişimi.
  - `arboard` (v3.6.1): Bellek sızıntısı ve kilitlenme yaratmayan pano entegrasyonu.
  - `rfd` (v0.15.4): Yerel işletim sistemi dosya seçici penceresi.
  - `dirs` (v6.0.0): Platformdan bağımsız standart uygulama veri yolları (`%APPDATA%`).
  - `serde` / `serde_json`: JSON tabanlı hızlı serileştirme.

---

## ⚙️ Uygulamadaki Tüm Sistemler ve Çalışma Prensipleri

### 1. Pencere Odaklama & Otomatik Yapıştırma Sistemi (Win32 Bridge)
Bu sistem, kullanıcının QuickPaste arayüzünden seçtiği snippet'i, arka planda açık olan asıl yazı editörüne odaklanıp otomatik olarak yapıştırmaktan (`Ctrl+V`) sorumludur.
- **Hedef Pencere Takibi**: QuickPaste penceresi her odak (`focus`) kazandığında, o andaki aktif pencerenin `HWND` handle değerini `store_own_hwnd` ve `capture_target` fonksiyonları ile hafızaya kaydeder. Görev çubuğu (`Shell_TrayWnd`) gibi Windows arayüz bileşenleri filtrelenir.
- **Thread Bağlama (`AttachThreadInput`)**: İşletim sistemi güvenlik engellerini aşmak için QuickPaste thread'i ile hedef uygulamanın thread'i Win32 API ile birbirine bağlanır.
- **Minimised Pencere Kurtarma**: Eğer hedef pencere simge durumundaysa `ShowWindow(hwnd, SW_RESTORE)` ile otomatik olarak ekrana geri getirilir.
- **Sanal Tuş Simülasyonu**: `SendInput` API'si kullanılarak önce basılı kalmış olabilecek kontrol tuşları (`Ctrl`, `Alt`, `Shift`) serbest bırakılır, ardından milisaniyelik gecikmelerle `Ctrl + V` basma ve bırakma sinyalleri gönderilir.

### 2. Clipboard Monitor (Pano Takip & Kilit Yönetimi)
Sistem panosundaki değişiklikleri izleyerek kopyalanan metinleri otomatik olarak geçmişe ekler.
- **Kilit Yönetimi (Lock Prevention)**: Windows üzerinde panonun kilitli kalıp diğer uygulamaların kopyalama yapmasını engellemek amacıyla `arboard::Clipboard` nesnesi döngü içinde anlık oluşturulup veri okunduğu an bellekten atılır (`drop`).
- **Olay Gönderimi**: Yeni bir metin kopyalandığında `new-clipboard-entry` olayı tetiklenerek JS tarafı güncellenir. Uygulama o anda açık ise güncelleme blur anına ertelenir (`deferredClipboardText`), böylece kullanıcının listesi anlık değişerek odağını bozmaz.

### 3. Arama & Filtreleme & Kelime Vurgulama (Search & Highlight)
- **Highlight (Vurgulama)**: Kullanıcının arama kutusuna girdiği terimler regex ile analiz edilir. Bulunan kelimeler HTML render edilirken `<mark>` etiketleriyle sarılarak sarı renkle (karanlık modda turuncu/sarı) vurgulanır.
- **Kategori & Proje Filtresi**: Mevcut snippet'lerden dinamik olarak eşsiz kategori listesi çıkarılır ve arama kutusunun yanındaki dropdown menüye yüklenir.
- **Terim Bölme**: Arama sorgusu boşluk karakterlerine göre bölünerek "AND" (ve) mantığıyla tüm kriterleri sağlayan snippet'leri listeler.

### 4. Sıralama Sistemi (Sort Engine)
Kullanıcı arayüzden 5 farklı sıralama kriteri seçebilir:
- **📌 Default**: Sabitlenmiş (Pinned) snippet'ler en üstte kalır, diğerleri sıralı listelenir.
- **A → Z / Z → A**: Alfabetik başlık sıralaması.
- **🔥 Most Used**: Snippet'lerin `use_count` kullanım sayaçlarına göre en çok yapıştırılandan en aza doğru sıralama.
- **🕐 Newest / 📅 Oldest**: Oluşturulma zamanı (`created_at`) damgasına göre sıralama.

### 5. Multi-Select & Toplu İşlem Sistemi
- Arayüzdeki **"☑ Select"** butonu ile aktif edilir.
- Kartların üzerine tıklanarak birden fazla snippet seçilebilir. Seçim durumu frontend'de bir `Set` içinde tutulur.
- Toplu silme işlemi yapıldığında, filtrelenmiş listedeki indeksler ana Rust veri tabanındaki indekslerle eşleştirilerek tersten silinir ve tek bir kayıt işlemiyle diske yazılır.

### 6. Sağ Tık Bağlam Menüsü (Context Menu)
- Snippet kartlarına sağ tıklandığında tarayıcının varsayılan menüsü engellenerek özel bir HTML menüsü (`.custom-context-menu`) gösterilir.
- Menü konumlandırılırken ekran dışına taşmaması için görünüm alanı (viewport) sınırlarına göre otomatik konum hizalaması yapılır.
- **Menü Seçenekleri**:
  - `Pin/Unpin`: Snippet'i sabitleme durumunu değiştirir.
  - `Edit`: Düzenleme dialogunu açar.
  - `Duplicate`: Snippet'i klonlar (başlığa ` (copy)` ekler, kullanım sayacını sıfırlar ve o anki zaman damgasıyla kaydeder).
  - `Delete`: Snippet'i listeden siler.

### 7. Global ve Yerel Kısayol Sistemi (Hotkey Systems)
- **Sistem Düzeyinde (Global)**: `Alt+Q` (veya ayarlanan özel hotkey) tescil edilerek uygulama arka plandayken bile QuickPaste penceresini çağırabilir/gizleyebilir.
- **Uygulama İçi (In-App Fallback)**: Windows global kısayol motoru Türkçe karakterleri (`ü`, `ş`, `ç`, `.`) kabul etmediğinde, bu tuşlar için JS `keydown` dinleyicisi devreye girer. Bu sayede kısayol doğrudan uygulama penceresi etkinken de tetiklenebilir.
- Standart dışı tuş kombinasyonlarında arayüzde **"⚠ In-app only"** uyarısı gösterilir.

### 8. Yedekleme & Dışa/İçe Aktarma (Backup System)
- **Dışa Aktarma (Export)**: `snippets.json` ve `settings.json` dosyalarını tek bir `{ "snippets": [...], "settings": {...} }` yapısında birleştirerek kullanıcının seçtiği bir konuma `.json` uzantılı yedek dosyası olarak yazar.
- **İçe Aktarma (Import)**: Seçilen yedek JSON dosyasını okur, verileri doğrular, mevcut dosyaların üzerine yazar ve kısayolları yeniden tescil eder (`reregister_all_shortcuts`).

### 9. Başlangıçta Çalıştırma Yönetimi (Startup Subsystem)
- Ayarlardaki **"Start with Windows"** seçeneği açıldığında, Rust backend tarafı `winreg` kütüphanesini kullanarak Windows Kayıt Defteri'ne (`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`) uygulamanın o anki executable dosya yolunu `QuickPaste` adıyla yazar. Kapatıldığında bu kaydı siler.

### 10. Saydamlık Kontrol Sistemi (Opacity Engine)
- Ayarlar panelindeki slider kaydırıldığında anlık geri bildirim için JS tarafında `#mainContainer` opaklığı CSS düzeyinde değiştirilir.
- Değer bırakıldığında Rust tarafına `set_window_opacity` komutu gönderilerek ayar diske kaydedilir.

### 11. Karakter Sayacı ve Sınır Denetimi
- Yeni snippet eklerken veya düzenlerken içerik kutusunun sağ altında dinamik karakter sayısı gösterilir.
- Karakter sayısı `2000`'i geçtiğinde uyarı (sarı), `5000` limitini geçtiğinde ise kritik sınır (kırmızı) görsel uyarısı verilir.

### 12. Clipboard'dan Doğrudan İçe Aktarma
- **"📋 From Clipboard"** butonu, tarayıcının `navigator.clipboard.readText()` API'sini kullanarak kullanıcının panosundaki güncel metni okur ve doğrudan yeni snippet ekleme formunu doldurarak dialogu açar.

### 13. Hazır Şablon Sistemi (Templates)
- Uygulamada hiç veri bulunmadığında boş ekran durumunda kullanıcının hızlıca deneme yapabilmesi için 4 adet şablon kartı gösterilir:
  - *Email Signature* (E-posta imzası)
  - *SQL Select* (Veri tabanı sorgusu)
  - *Git Commit* (Git komut taslağı)
  - *TODO Comment* (Kod içi yorum)
- Şablonlara tıklandığı an veritabanına otomatik eklenir ve liste güncellenir.
