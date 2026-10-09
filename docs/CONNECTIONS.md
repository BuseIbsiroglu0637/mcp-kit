# ChatGPT ve Claude bağlantı koşulları

Resmî belgeler 09.10.2026 tarihinde kontrol edildi. Paket protokol testleri ürün arayüzünde başarılı kurulumun yerine geçmez.

## ChatGPT

Kendi hesabınızın/çalışma alanınızın izin verdiği özel MCP kurulumu kullanılmalıdır. Resmî akış: Plugins → + → Add custom MCP server; Server URL veya Tunnel seçilir, sunucu kimlik doğrulaması yapılandırılır ve Create as a plugin ile eklenir.

Yerel HTTP sunucusuna erişmek için kendi OpenAI Secure MCP Tunnel kurulumunuzu oluşturun. Buse'nin tünel kimliğini veya çalışma anahtarını kullanmayın. Tünel istemcisinin upstream HTTP Authorization header'ında kendi **reader** token'ınızı kullanın. Yazma için ayrı writer granti/tünel tercih edin; yerel writesEnabled açık olmalıdır. Gizli çalışma anahtarını yerel güvenli ortamda tutun. Tünelde No authentication seçimi yalnız upstream header ve özel hesap kapsamı doğru kurulmuşsa anlamlıdır; bu sunucu hiçbir koşulda anonim HTTP çağrısını kabul etmez.

Doğrudan HTTPS URL kullanacaksanız istemciyle uyumlu kimlik doğrulama ayrıca gerekir. Bu pakette OAuth sunucusu yoktur; token'ı URL'ye veya sohbete eklemek çözüm değildir. Mevcut hesapta sunulan kimlik seçeneklerini doğrulayın.

Resmî kaynaklar:
- https://developers.openai.com/api/docs/guides/custom-mcp-server
- https://developers.openai.com/api/docs/guides/secure-mcp-tunnels

## Claude

Yerel STDIO taşımamız gerçek MCP SDK istemcisiyle test edildi. `examples/claude-desktop.json` tam dosya yolları ile doldurulacak **şablondur**; mevcut Claude ayarlarını otomatik değiştirmez. Claude Desktop'ın yerel sunucu/Developer ayarlarında bu tür komut yapılandırması sunuluyorsa kullanın; örneği mevcut config'e birleştirirken diğer sunucuları silmeyin. Uygulamadaki güncel menü ve araç keşfi ayrıca doğrulanacak.

Claude'nin güncel resmî yerel kurulum yolu Desktop Extensions ve `.mcpb` paketleridir. Bu sürümde `.mcpb` üretilmedi; Node SQLite sürüm gereksinimi nedeniyle gömülü Node'a uyumluluk iddia edilmez. Gerekli sonraki iş: uygun yerel Node ile gerçek Claude Desktop bağlantısı veya runtime gereksinimini karşılayan test edilmiş uzantı.

Claude web/remote connector için Anthropic bulutundan erişilebilir ayrı HTTPS MCP URL'si gerekir. OpenAI Secure MCP Tunnel kimliği bu URL yerine geçmez. Resmî akış Customize → Connectors → Add custom connector; URL ve kimlik seçenekleri seçilir. Desteklenen hesaplarda Request headers ile sabit kimlik bilgileri tanımlanabilir. OAuth yoksa uygun sınırlı token kullanılır. Reverse proxy token'ı doğrulamalı veya mevcut HTTP sunucusuna doğru Authorization iletmeli; token'sız public endpoint açılmamalıdır. Üretim barındırma/HTTPS ve hesapta gerçek çağrılar henüz doğrulanmadı.

Resmî kaynaklar:
- https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop
- https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp

## Her istemcide kabul kontrolü

1. Araçları keşfet; kendi projectId değeri doğru mu?
2. Proje durumunu ve örnek kanıtı gerçek araçlarla oku; example-only/not_run doğru mu?
3. Yazma bilinçli olarak açıldıysa bir deneme görevini oluştur; aynı UUID requestId ve payload ile tekrar çağır.
4. Aynı kayıt kimliği, replayed=true ve tek kayıt doğrula.
5. Reader erişiminden yazma reddini doğrula.

Bu kontrollerin istemci adı, tarih, proje kimliği ve sonucunu kaydetmeden “ChatGPT/Claude kurulumu tamamlandı” demeyin.
