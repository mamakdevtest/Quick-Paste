# QuickPaste — Geliştirici ve Kurulum Kılavuzu (HowToDo.md)

Bu kılavuz, **QuickPaste** uygulamasının geliştirme ortamında çalıştırılması, derlenmesi, yapılandırması ve yaygın karşılaşılan durumların çözülmesiyle ilgili tüm kritik bilgileri içerir.

---

## 🛠️ Sistem Gereksinimleri

Uygulamayı derlemeden önce sisteminizde aşağıdaki bileşenlerin kurulu olduğundan emin olun:
- **Node.js**: v20+ LTS önerilir (Tauri CLI ve frontend bağımlılıkları için).
- **Rust & Cargo**: En güncel stable sürüm (Rust toolchain'in yüklü ve `PATH` ortam değişkeninde kayıtlı olması gerekir).
- **Windows Build Tools**: C++ derleme araçları (Tauri'nin Windows API entegrasyonu için gereklidir, Rust kurulumu sırasında istenir).

---

## 🚀 Geliştirme Ortamında Çalıştırma (Dev Mode)

Uygulamayı canlı değişiklik takibi (Hot-Reload) aktif olacak şekilde çalıştırmak için:

1. Proje ana dizininde terminali açın.
2. Node.js paketlerini yükleyin (ilk kurulum için):
   ```bash
   npm install
   ```
3. Tauri geliştirme sunucusunu başlatın:
   ```bash
   npm run tauri dev
   ```

*Bu komut frontend kodunu izler, Rust derleyicisini çalıştırır ve uygulamayı açar.*

---

## 📦 Dağıtım İçin Paketleme (Production Build)

Uygulamanın optimize edilmiş, dağıtıma hazır tek bir `.exe` ve kurulum dosyalarını (MSI/NSIS) üretmek için:

```bash
npm run tauri build
```

### Çıktı Dosyaları:
Derleme tamamlandığında paketlenmiş dosyalar şu dizine yerleştirilir:
`src-tauri/target/release/bundle/`

---

## 📂 Kritik Dosyaların Rolleri

- **`src-tauri/tauri.conf.json`**: Uygulamanın pencere boyutları, izinleri (capabilities), Task Manager ismi (`productName`), logo ve telif/yayıncı bilgileri buradan yönetilir.
- **`src-tauri/Cargo.toml`**: Rust bağımlılıklarının ve sürümlerinin yönetildiği yerdir.
- **`src-tauri/src/lib.rs`**: Uygulamanın arka plan komutlarını (Tauri Commands), global kısayolları ve sistem tepsisi (tray icon) mantığını yönetir.
- **`src-tauri/src/clipboard_manager.rs`**: Windows API çağrıları ile hedef pencereye odaklanma ve yapıştırma (`Ctrl+V`) simülasyonunu gerçekleştirir.
- **`src-tauri/src/clipboard_monitor.rs`**: Clipboard kilitleme hatasını engellemek için anlık kilit açma mantığına sahip olan pano izleme mekanizmasıdır.
- **`src/main.js`**: Frontend mantığını, filtrelemeyi, çoklu seçimi ve kısayol tanımlama akışlarını yönetir.

---

## 💡 Kritik Özellikler & Sorun Giderme

### 1. Task Manager İsmi ve Telif Bilgisi
Uygulama adı Görev Yöneticisi'nde **`QuickPaste`** olarak görünür. Bu bilgiler ve telif sahipliği (`Emir Han Mamak`, `Mamak Studio`) şu dosyalarda tanımlıdır:
- `src-tauri/tauri.conf.json` (`productName`, `copyright`, `publisher`)
- `src-tauri/Cargo.toml` (`authors`, `description`)

### 2. Türkçe Karakterli Hotkey Desteği
Kısayol tanımlama penceresinde `ü, ş, ç, .` gibi yerel karakterler girildiğinde arayüz bunu algılar. Ancak global Windows kısayolu (uygulama kapalıyken tetiklenen) olarak çalışması için standart ASCII karakterler gerekebilir. Sistem standart dışı tuşlarda arayüzde otomatik olarak **"⚠ In-app only"** uyarısı göstererek kısayolun sadece uygulama odağı varken çalışacağını belirtir.

### 3. Pano Kilit Çatışması (Clipboard Lock Isolation)
Windows üzerinde pano (`arboard`) nesneleri sürekli açık tutulduğunda kilitlenmelere yol açabilir. Projedeki `clipboard_monitor.rs` bu sorunu engellemek amacıyla arboard örneğini her döngüde anlık olarak oluşturup anında yok edecek şekilde (`drop`) tasarlanmıştır. Geliştirme yaparken pano nesnesini global bir değişkende tutmamaya özen gösterin.
