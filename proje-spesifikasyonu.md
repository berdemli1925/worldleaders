# Dünya Ülkeleri Oylama Sitesi — Proje Spesifikasyonu

**Sürüm:** 1.0 (Adım 1 çıktısı)
**Durum:** Kararlar netleşti, inşaya hazır

---

## 1. Konsept

Dünya ülkelerinin oy ile yarıştığı, interaktif dünya haritası üzerinden çalışan bir sıralama platformu. Kullanıcılar ücretsiz oy verir. Ayrıca ödeme yaparak bir ülkenin 30 dakikalık "lideri" olabilir ve o süre boyunca kendi X gönderisini o ülkenin üstünde herkese gösterebilir.

**İlham alınan model:** memleket.lol (81 il / Şehrin Ağası)
**Temel farklar:** Dünya geneli · Süreli liderlik (kalıcı değil) · X gönderisi gösterimi · Aylık sıfırlanan sıralama

---

## 2. Ülke Listesi

- **Kaynak:** ISO 3166-1 standardı (yaklaşık 249 kayıt)
- **Liste sabittir.** Kullanıcı yeni ülke ekleyemez.
- **Önemli:** Tartışmalı bölgelerin dahil olup olmaması konusunda "biz X standardını kullanıyoruz, bu bir siyasi tercih değildir" ifadesi Kurallar sayfasında açıkça yer almalı.

---

## 3. Oylama Sistemi

| Kural | Değer |
|---|---|
| Ücret | Ücretsiz |
| Sınır | IP adresi başına **günde 1 oy** |
| Üyelik | Yok |
| Bot koruması | Cloudflare Turnstile (görünmez) |
| Sıralama dönemi | **Her ayın 1'inde sıfırlanır** |

### Ek tablolar
- **Bu ay** (ana sıralama — fiyatlandırma buna göre)
- **Tüm zamanlar** (kümülatif, sadece gösterim amaçlı)
- **Şampiyonlar** (geçmiş ayların kazananları — arşiv sayfası)

---

## 4. Fiyatlandırma

### Taban fiyat (aylık sıralamadaki yere göre)

| Sıralama | Taban fiyat |
|---|---|
| 1 – 10 | $3.00 |
| 11 – 30 | $2.50 |
| 31 – 70 | $2.00 |
| 71 ve altı | **$1.50** |

- Fiyatlar **saatte bir** güncellenir (kullanıcı ödeme yaparken fiyat elinde değişmesin diye).
- **Ay başı istisnası:** Ayın ilk 24 saatinde fiyatlar önceki ayın sıralamasına göre hesaplanır.

### Devralma (outbidding)

- Aktif lider varken, tahtı devralmak için **o an ödenmiş tutarın 2 katı** ödenir.
- **Tavan: $30.** Bu tutara ulaşıldığında ülke o 30 dakika boyunca kilitlenir, kimse devralamaz.
- Devralınca **süre sıfırdan başlar** (yeni 30 dakika).
- 30 dakika bitince ülke kendi taban fiyatına döner.

**Örnek katlanma zinciri (taban $1.50):**
$1.50 → $3 → $6 → $12 → $24 → $30 (kilit)

### İade politikası

- **İade yoktur.** Süresi dolmadan devrilen kullanıcıya iade yapılmaz.
- Bu kural ödeme ekranında **büyük ve okunur** şekilde gösterilir ve kullanıcı bir onay kutusunu işaretlemeden ödeme yapamaz.
- Bu, ödeme itirazlarına (chargeback) karşı en önemli savunmadır.

### Komisyon gerçeği (bilgi amaçlı)

Aracı komisyonu yaklaşık %5 + $0.50. $1.50'lık satışta yaklaşık **$0.92** kalır. Hacim arttıkça ve devralmalar yaşandıkça ortalama işlem tutarı yükselir.

---

## 5. Liderlik ve İçerik

### Akış
1. Kullanıcı içeriğini önce **X'te paylaşır**
2. Gönderi bağlantısını siteye yapıştırır
3. Önizlemeyi görür, ödemeyi yapar
4. 30 dakika boyunca gönderi o ülkenin üstünde herkese görünür
5. Kullanıcı adı (@handle) görünür → hesap verebilirlik

### Neden bu model
Kullanıcıyı X'te paylaşım yapmaya zorlar → her lider siteyi tanıtmış olur. Ücretsiz büyüme döngüsü.

### Zorunlu güvenlik önlemleri

> Bu bölüm atlanamaz. Kullanıcı içeriğini herkese açık gösteren her sitenin taşıması gereken asgari koruma.

- **Anlık kopya (snapshot):** Gönderi satın alma anında çekilip veritabanına kaydedilir; sitede bu kopya gösterilir.
- **Değişiklik kontrolü:** Orijinal gönderi 1–2 dakikada bir kontrol edilir. Silinmiş veya düzenlenmişse içerik otomatik kaldırılır.
  *Gerekçe: X Premium kullanıcıları gönderilerini düzenleyebiliyor ve düzenleme penceresi 30 dakikalık liderlik süresini kapsıyor. Bu kontrol olmadan sistem açıktır.*
- **Kelime filtresi:** Otomatik metin taraması.
- **Şikayet butonu:** Her gösterilen içeriğin altında.
- **Yönetim paneli:** Tek tıkla içerik kaldırma ve kullanıcı engelleme.

### Teknik risk
X'in gömme (embed) altyapısı istikrarsız; özellikle "hassas" işaretli gönderiler gömülemeyebiliyor. **Yedek plan:** Gönderi verisini kendi sunucumuzda saklayıp kendi tasarımımızla göstermek.

---

## 6. Harita

- Zoom in / zoom out
- Sürükleyerek gezinme
- Tüm ülkeler tıklanabilir
- Oy oranına göre dinamik renklenme
- Aktif lideri olan ülkelerde görsel işaret (taç/çerçeve vb.)
- Mobil uyumlu (dokunmatik zoom)

---

## 7. Ödeme Altyapısı

- **Model:** Her seferinde tek tek ödeme (kredi paketi yok)
- **Sağlayıcı:** Merchant of Record aracısı (Paddle / Lemon Squeezy vb.)
- **Gerekçe:** Stripe Türkiye'deki şirketlere doğrudan hesap açmıyor. MoR aracıları global tahsilatı ve KDV/vergi yükümlülüğünü üstleniyor.
- **Not:** Sağlayıcı koşulları değişebilir; seçim aşamasında güncel şartlar teyit edilmeli.

---

## 8. Sayfalar

| Sayfa | İçerik |
|---|---|
| Ana sayfa | Harita + canlı sıralama + canlı sayaçlar |
| Liderler | O an aktif liderlerin listesi |
| Şampiyonlar | Geçmiş ayların kazananları |
| Hakkında | Proje tanıtımı |
| Kurallar | Oy kuralları, fiyat kuralları, iade politikası, ülke listesi açıklaması |
| Yönetim | (Gizli) İçerik moderasyon paneli |

---

## 9. İnşa Sırası

| Adım | İçerik | Durum |
|---|---|---|
| 1 | Kararların netleştirilmesi | ✅ Tamamlandı |
| 2 | Statik harita (tıklanabilir, zoom'lu — oy/para yok) | Sıradaki |
| 3 | Oylama + veritabanı + canlı sıralama | |
| 4 | Liderlik sistemi + X entegrasyonu + moderasyon paneli | |
| 5 | Ödeme entegrasyonu | |
| 6 | Yayın ve tanıtım | |

---

## 10. Açık Konular

- Alan adı seçimi
- Site adı
- Arayüz dili (Türkçe / İngilizce / çift dil) — global hedef için İngilizce ağırlıklı olması mantıklı
- Şirket kurulumu / vergi durumu (gelir oluşmaya başladığında)
- IP bazlı oylamanın alternatifleri (CGNAT ve VPN zafiyeti mevcut)
