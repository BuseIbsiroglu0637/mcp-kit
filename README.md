# ARKEMX MCP Kit — kendi projen için kurulum paketi

Bu paket bir kişinin kendi bilgisayarında kendi proje kayıtları, kararları ve görevlerini MCP üzerinden kullanması içindir. Buse'nin proje kayıtları, anahtarları, tünelleri, test kanıtları ve özel veritabanı dahil değildir. GitHub kodu dağıtır; sunucuyu çalıştırmaz.

## İlk kurulum

Node.js **24.19.0** ile test edilmiştir. Kurulum klasöründe terminal açın:

```powershell
npm ci --ignore-scripts
npm run init -- BENIM-PROJEM
npm test
```

`BENIM-PROJEM` yerine kendi kayıt bağlamınızı yazın (harf, rakam, tire veya alt çizgi). Bu bir mühendislik/CEM proje kimliği doğrulaması değildir. Kurulum `.local` altında size ait config, örnek kanıt dosyası ve ilk sunucu çağrısında SQLite veritabanı oluşturur. Windows'ta `.local` izinleri kuran kullanıcı ve SYSTEM ile sınırlandırılır. Başlatırken aynı kullanıcıyı kullanın. Init mevcut kurulumu ezmez.

Node/npm sürümlerini `node --version` ve `npm --version` ile kontrol edin. Claude'nin yerleşik Node sürümünün bu SQLite sürümünü desteklediği varsayılmadı; bu pakette kendi Node 24.19.0 yolunuzu kullanın.

## Önce salt okunur başlayın

```powershell
node src/server.mjs stdio reader
```

STDIO bir MCP istemcisinin başlatacağı süreçtir; terminalde normal sohbet ekranı beklemeyin. Yerel MCP istemcisine komut olarak `node`, argüman olarak sunucu dosyasının **tam yolu**, `stdio`, `reader` verin. İstemcinin Node yolu farklıysa `node.exe` tam yolunu kullanın.

`examples/claude-desktop.json` bir yapılandırma şablonudur. Gerçek Claude ürününde araçların keşfi ve örnek okuma çağrısı doğrulanmadan bağlantı tamamlandı sayılmaz. Claude web için ayrıca erişilebilir HTTPS sunucusu gerekir; OpenAI özel tüneli Claude bağlantısı değildir. Ayrıntı: docs/CONNECTIONS.md.

## Kendi verilerini ekleme

`.local/evidence.json` ilk başta açıkça `example-only` etiketli, test yapılmamış örnektir. Kendi kaynaklarınızı eklerken gerçek kaynak tarihini ve varsa ilgili commit'i belirtin. `kind` değerini `configured-records` yapabilirsiniz; bu yalnız sizin içerik beyanınızdır, sunucunun uygulamayı test ettiği anlamına gelmez. Kanıtlar tek yapılandırılmış JSON dosyasından okunur; modelden dosya yolu alınmaz. Yerel SHA-256 yanıtı dosyayı tanımlar; tarihsel immutable katalog veya otomatik kaynak doğrulaması değildir.

Dört okuma aracı: arkemx_list_evidence, arkemx_read_project_status, arkemx_read_test_evidence, arkemx_list_live_records. Araç şemasındaki projectId sizin kurulumunuza aittir.

## Karar ve görev yazma

Yazma başlangıçta kapalıdır. Bilinçli olarak etkinleştirmek için özel `.local/config.json` dosyasında `writesEnabled` değerini `true` yapın. STDIO istemcisinde role argümanını `writer` yapın. Bu yerel bilgisayar kullanıcısının yetkisidir; bulut hesabının kimliği doğrulanmaz. Yerel config'e erişebilen kişi bu kurulumu yönetir.

HTTP için reader ve writer token'ları ayrıdır. Yazma etkin writer toplam yedi araç keşfeder. Görev başlığı ayrı alan değildir; description ilk satırına yazın. assignee ve dueDate verilmezse null kalır. requestId UUID olmalıdır; aynı isteğin tekrarında aynı UUID ve aynı içeriği kullanın. Görev güncellemede expectedRevision gereklidir. done mühendislik onayı değildir. Kararlar değiştirilemez; düzeltici karar ayrı kaydedilir. Silme aracı yoktur.

## HTTP başlatma

```powershell
npm run http
```

Sunucu yalnız `http://127.0.0.1:43200/mcp` üzerinde dinler; Bearer token zorunludur. Port özel config'ten değiştirilebilir. Token'lar yalnız `.local/config.json` içindedir; sohbete/GitHub'a koymayın. Her istekte enabled ve son kullanma tarihi kontrol edilir. Yetkiler altı günlüktür; otomatik uzatılmaz. Gerektiğinde aynı dosyada yeni rastgele token ve en fazla yedi gün ileride bir expiresAt üretip ilgili istemciye güvenli yoldan verin. Ortak sunucuya birden fazla kullanıcı bağlama modeli bu sürümde yoktur; arkadaşınız kendi ayrı kurulumunu kullanmalıdır.

HTTP browser Origin istekleri reddedilir; CORS tarayıcı uygulaması sunulmaz. Tünel/reverse proxy loopback sunucusuna doğru Host ile iletmeli ve yetkili header eklemelidir. Dış HTTPS/kimlik bağlantıları ayrıca yapılandırılır. OAuth, TLS sonlandırma ve OpenAI tünel istemcisi bu pakete gömülü değildir.

## Kapsam

SQLite requestId tekrar koruması, revizyon kontrolü ve atomik audit; STDIO ve loopback Streamable HTTP taşımaları vardır. Tam bilgisayar sandbox'ı, Windows AppContainer, otomatik yedek/geri yükleme, otomatik Windows başlangıcı, çok kullanıcı OAuth, sunucu barındırma ve mühendislik doğrulaması dahil değildir. Bu paket mevcut Buse kurulumu yerine geçirilmedi.

## Dağıtım durumu

Yerel dağıtım adayıdır. npm yayını/marketplace kaydı yapılmadı. GitHub'a yüklerken yalnız kaynak paketini kullanın; `.local`, node_modules, SQLite, günlük ve anahtarları dahil etmeyin. Başkasının makinesindeki kurulum ile ChatGPT/Claude ürün kabulü ayrı doğrulanmalıdır. Lisans: özel değerlendirme/paylaşım; açık kaynak lisansı seçilmedi (LICENSE).
