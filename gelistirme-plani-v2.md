# WORLD LEADERS — Geliştirme Planı v2

Amaç: siteyi bir tablodan bir oyuna çevirmek.
Sıra önemli — her adımı bitirip test et, sonra diğerine geç.

**Her prompt'un başına şunu ekle:**
> Küçük değişikliklerde tam derleme ve kapsamlı test yapma, sadece ilgili dosyalara odaklan. Ben tarayıcıda kendim kontrol edeceğim. Bittiğinde bana sormadan commit et ve push et.

---

## AŞAMA 1 — Ana sayfa yeniden kurgusu

En önemli adım. Kullanıcı ilk 3 saniyede "ülkem kaçıncı ve ne yapabilirim" sorusunun cevabını almalı.

> Ana sayfayı yeniden kurgula. Öncelik mobil.
>
> Sayfanın en üstüne, haritadan önce gelecek şekilde bir hero bölümü ekle:
> - Büyük başlık: WHO RULES THE WORLD?
> - Şu anki lider ülke: bayrak, ad, puan
> - Hemen altında ikinci sıradaki ülke ve aradaki fark
> - Ziyaretçinin ülkesini tarayıcı diline veya IP'sine göre tahmin et ve "Your country: X — ranked #N" olarak göster. Yanlışsa değiştirebileceği bir bağlantı olsun.
> - Büyük ve belirgin bir buton: VOTE FOR YOUR COUNTRY
>
> Harita bu bölümün hemen altında kalsın, kaldırma veya küçültme. Masaüstünde hero ve harita yan yana olabilir.
>
> Sıralama listesi haritanın altında kalmaya devam etsin.
>
> Amaç: mobilde ilk ekranda kullanıcı kendi ülkesinin sırasını görsün ve oy verebilsin, hiç kaydırmadan.

---

## AŞAMA 1.5 — Haritayı öne çıkar

Harita sitenin kimliği. Şu an çok küçük, renkleri sönük ve lider görselleri seçilmiyor.

> Haritayı sitenin ana görsel unsuru haline getir.
>
> **Boyut:** Ana sayfada haritayı belirgin şekilde büyüt. Masaüstünde ekran yüksekliğinin en az yarısını kaplasın. Mobilde de hero bölümünün hemen altında geniş ve dolgun görünsün. Kenarlarda gereksiz boşluk kalmasın, harita alanı doldursun.
>
> **Kontrast:** Kara parçaları arka plandan net ayrılsın. Şu an ülkeler ve zemin birbirine çok yakın tonda, hiçbir şey seçilmiyor. Denizi/zemini daha koyu, kara parçalarını daha açık yap.
>
> **Oy renklendirmesi:** Oy oranına göre renklendirme tek bir renk ailesi içinde koyudan parlağa giden net bir skala olsun. En çok oy alan ülke gözle hemen bulunabilsin. Şu anki skala çok dar, aralığı genişlet. Hiç oy almamış ülkeler de görünür kalsın, kaybolmasın.
>
> **Lider görselleri:** Liderlerin görsellerinin üstündeki karartmayı azalt, görseller net seçilsin. Sadece ülke adının okunabilmesine yetecek kadar karartma kalsın. Lideri olan ülkelerin sınırları vurgu rengiyle belirginleşsin.
>
> **Etkileşim:** Ülke üzerine gelince gösterilen kutucukta ülke adı, sırası ve puanı olsun. Lideri varsa lider bilgisi de görünsün.

---

## AŞAMA 2 — Oy sonrası geri bildirim ve paylaşım

Viral döngünün kalbi. Oy vermek şu an sessiz bir işlem, olay olmalı.

> Oy verildikten sonra bir sonuç ekranı göster.
>
> İçinde şunlar olsun:
> - "You just moved [Country] +1" mesajı, kısa bir animasyonla
> - Ülkenin yeni sırası ve puanı
> - Sıra değiştiyse bunu vurgula: "Turkey moved up to #4"
> - En yakın rakip: "Greece is only 37 points ahead" veya "behind"
> - Paylaşım butonları: X, WhatsApp, Telegram, kopyala
>
> Paylaşım metni otomatik hazırlansın, örnek: "TURKEY IS #4 on World Leaders. Can your country beat us?" ve site bağlantısı.
>
> Paylaşım kartı görseli o ülkeye özel üretilsin: bayrak, ülke adı, sıra, puan.
>
> Ekran kapatılabilir olsun, kullanıcıyı hapsetme.

---

## AŞAMA 3 — Ülke sayfaları ve SEO

En büyük uzun vadeli kazanç. 250 ayrı sayfa, arama motorlarından sürekli trafik.

> Her ülke için ayrı bir sayfa oluştur: /turkey, /greece, /japan gibi. Adresler ülke adının sadeleştirilmiş halinden üretilsin.
>
> Sayfada şunlar olsun:
> - Ülke bayrağı, adı, şu anki sırası ve puanı
> - Bir üstteki ülkeyi geçmek için gereken oy sayısı
> - Son 7 günlük sıra değişimi
> - Ülkenin lideri varsa lider bilgisi ve gönderisi
> - Oy verme butonu
> - Paylaşım butonu
> - Haritada o ülkeye zoom yapılmış küçük bir görünüm
>
> Her sayfanın kendi başlığı, açıklaması ve paylaşım kartı olsun. Örnek başlık: "Turkey — Ranked #4 on World Leaders".
>
> Sitemap oluştur ve tüm ülke sayfalarını ekle. Sıralama listesindeki ülke adları bu sayfalara bağlansın.

---

## AŞAMA 4 — Rekabet mekanikleri

> Sitede ülkeler arası rekabeti öne çıkar.
>
> Ana sayfaya "Closest battles" bölümü ekle: puanları birbirine en yakın 3-5 ülke çiftini otomatik bul ve göster. Her çiftte iki ülke, puanları ve aradaki fark görünsün, her birinin yanında oy butonu olsun.
>
> Sıralama listesine sekmeler ekle: Biggest climbers (bu hafta en çok yükselenler), Rising countries, Most active today.
>
> Sıralama satırlarında son 24 saatteki sıra değişimini ok ve sayıyla göster: Turkey ↑4, France ↓3.
>
> Bir ülkeye oy verildiğinde o ülkenin en yakın rakibine karşı durumu gösterilsin.

---

## AŞAMA 5 — Başlangıç puanları (seed)

Dikkatli uygulanmalı. Amaç boş görünmemek, ama gerçek oyları anlamsızlaştırmamak.

> Ülkelere başlangıç puanı sistemi ekle.
>
> Kurallar:
> - Başlangıç puanları 50 ile 300 arasında olsun, daha yüksek olmasın. Gerçek oyların etkisi görünür kalmalı.
> - Nüfusa göre değil, ülkeler arasında dengeli dağılsın; küçük ülkeler baştan kaybetmiş olmasın.
> - Rastgele değil, tekrarlanabilir bir yöntemle üretilsin.
>
> Şeffaflık şart:
> - Bu puan arayüzde "Starting score" olarak ayrı gösterilsin, asla "kişi oy verdi" denmesin.
> - Ülke sayfasında ve kartında ayrımı göster: Starting score / Votes / Total power.
> - Rules sayfasına açıklama ekle: her ülkenin farklı bir başlangıç puanıyla başladığı yazılsın.
>
> Veritabanında seed ve gerçek oylar ayrı tutulsun. Admin panelinde ve analitikte yalnızca gerçek oylar görünsün.

---

## AŞAMA 6 — Canlılık ve tasarım dili

> Siteye oyun hissi kat.
>
> "Online now" göstergesini kaldır veya kullanıcı sayısı düşükken gizle. Yerine "Votes today" koy.
>
> Ana sayfaya küçük bir canlı akış ekle: son verilen oylar ve son alınan tahtlar, ülke adı ve zamanla birlikte.
>
> Sıralama değiştiğinde satırlar yumuşak bir animasyonla yer değiştirsin.
>
> Lider olan ülke haritada belirgin şekilde vurgulansın.
>
> Genel dil daha rekabetçi ve eğlenceli olsun, .lol kimliğine uysun. Bilgi vermekten çok aksiyon aldırmaya odaklan.

---

## YAPILMAYACAKLAR

- **Haritayı arka plana atmak.** Harita sitenin kimliği ve rakiplerinden farkı. Üstüne içerik eklenir, kendisi küçültülmez.
- **Büyük seed rakamları (10.000+).** Tek oyu görünmez kılar, oyunun amacını bozar.
- **Sahte lider veya sahte kullanıcı üretmek.** Seed skor şeffaf bir mekanik, sahte kullanıcı yalandır.

---

## AÇIK KONULAR

- Liderlik (taht) sistemi bu planda hiç yer almıyor. Yeniden kurgu yapılırken tahtların ana sayfadaki görünürlüğü korunmalı — gelir modeli orası.
- Cron sıklığı sorunu hâlâ çözülmedi, halka açılmadan önce yapılmalı.
