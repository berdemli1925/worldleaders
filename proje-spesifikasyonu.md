# WORLD LEADERS — Proje Spesifikasyonu

**Alan adı:** worldleaders.lol
**Sürüm:** 3.0
**Değişiklik:** Haftalık taht döngüsü, +$2 artış kuralı, kredi sistemi, tavan yok

---

## 1. Konsept

Dünya ülkelerinin oy ile yarıştığı, interaktif dünya haritası üzerinden çalışan bir sıralama platformu. Kullanıcılar ücretsiz oy verir. Ayrıca ödeme yaparak bir ülkenin "leader"ı olur; X gönderisi, markası ve bağlantısı o ülkenin üstünde herkese görünür.

**İlham:** memleket.lol
**Farklar:** Dünya geneli (250 ülke) · X gönderisi zorunlu · Aylık sıfırlanan sıralama · İngilizce arayüz

---

## 2. Ülke Listesi

- Kaynak: ISO 3166-1 (~250 kayıt), liste sabit
- Kurallar sayfasında standart açıkça belirtilir, siyasi tercih olmadığı yazılır

---

## 3. Oylama

| Kural | Değer |
|---|---|
| Ücret | Ücretsiz |
| Sınır | IP + tarayıcı parmak izi başına günde 1 oy |
| Üyelik | Yok |
| Bot koruması | Cloudflare Turnstile (Invisible mod) |
| Sıfırlama | Her ayın 1'i, UTC |

Ek tablolar: **This month** (ana) · **All time** · **Champions** (geçmiş ay kazananları)

---

## 4. Liderlik ve Fiyatlandırma

### Süre — haftalık taht döngüsü
- Taht, ilk alındığı andan itibaren **1 hafta** sürer.
- **Devralmalar süreyi uzatmaz.** Hafta ilk alımda başlar.
- Süre dolunca: taht boşalır, ülke taban fiyatına döner, **tüm krediler sıfırlanır.**
- Oy sıralaması ayrıca her ayın 1'inde sıfırlanır (bu iki mekanizma birbirinden bağımsızdır).

### Taban fiyat (aylık sıralamadaki yere göre)

| Sıralama | Taban |
|---|---|
| 1 – 10 | $3.00 |
| 11 – 30 | $2.50 |
| 31 – 70 | $2.00 |
| 71+ | $1.50 |

Saatte bir güncellenir. Ayın ilk 24 saatinde önceki ayın sıralaması kullanılır.

### Devralma ve kredi sistemi
- Her hamle, mevcut taht değerinin **en az $2 üstüne** çıkmalıdır.
- Kullanıcı dilerse daha fazlasını ödeyebilir.
- **Tavan yoktur.**
- **Kredi:** Bir kullanıcının o ülkede daha önce ödediği tutar kredi olarak durur. Tahtı geri alırken yeni taht değerinden kredisi düşülür, sadece farkı öder.
- Krediler ülkeye özeldir ve taht döngüsü bitince sıfırlanır.
- Fazla ödemek koruma satın alır — arayüzde belirtilir:
  *"Paying more raises the price others must pay to take your throne."*

**Örnek (taban $3):**

| Hamle | Taht değeri | Kredi | Nakit ödenen |
|---|---|---|---|
| A alır | $3 | – | $3 |
| B devralır | $5 | – | $5 |
| A geri alır | $7 | $3 | $4 |
| B geri alır | $9 | $5 | $4 |
| C girer | $11 | – | $11 |

### İade
**İade yoktur.** Ödeme ekranında zorunlu onay kutusuyla kabul ettirilir. Kural ihlali hâlinde içerik iadesiz kaldırılır.

### Komisyon
MoR aracısı ~%5 + $0.50. Minimum artışın $2 olmasının sebebi budur: daha küçük tutarlarda komisyon geliri yutar.

---

## 5. Lider İçeriği

### Kabul edilenler
- **X gönderisi — zorunlu.** Liderlik bu olmadan alınamaz.
- Marka / başlık
- Açıklama veya slogan
- Web sitesi, X profili veya Instagram bağlantısı
- Logo (bağlantıdan otomatik çekilir veya elle girilir)

### Gösterim
- Ülke kartında: marka, açıklama, bağlantı, ödenen tutar
- **Alt bantta ve kart içinde: X gönderisi görseliyle birlikte açıkça görüntülenir**
- Haritada: liderin avatarı / kullanıcı adı
- "Past leaders" listesi kalıcıdır, kullanıcı adı ve tutar saklanır

### Zorunlu güvenlik önlemleri

> Gönderi görselinin tam boy yayınlanması, moderasyon riskini ciddi şekilde artırır. Bu maddeler pazarlık dışıdır.

- **Snapshot:** Gönderi satın alma anında çekilip veritabanına kaydedilir; sitede kopya gösterilir
- **Değişiklik kontrolü:** Orijinal 1–2 dakikada bir kontrol edilir; silinmiş veya düzenlenmişse içerik otomatik kaldırılır
  *(X Premium kullanıcıları gönderilerini düzenleyebiliyor)*
- **Hassas içerik reddi:** X tarafından "sensitive" işaretli gönderiler kabul edilmez
- **Kelime filtresi:** Otomatik metin taraması
- **Şikayet butonu:** Her görünen içerikte
- **Yönetim paneli:** Tek tıkla kaldırma ve engelleme
- **Vaat verilmez:** "Anında ve onaysız yayında" gibi ifadeler kullanılmaz

### Teknik risk
X'in gömme altyapısı istikrarsız. **Yedek plan:** gönderi verisini kendi sunucumuzda saklayıp kendi tasarımımızla göstermek.

---

## 6. Liderlik Satın Alma Ekranı (Modal)

**1 — Durum**
Bayrak, ülke adı, sıralama. Taht doluysa: mevcut liderin markası, X kullanıcı adı, ödediği tutar, minimum devralma bedeli.

**2 — İçerik girişi**
X gönderi bağlantısı (zorunlu) · marka/başlık · açıklama · web/sosyal bağlantı · logo.
"Preview" butonu → gönderi modal içinde önizlenir. **Önizleme yapılmadan ödeme aktif olmaz.**

**3 — Teklif**
Minimum tutar gösterilir. Hazır butonlar (min / min+$2 / min+$5) + serbest giriş. Girilen tutara göre "başkasının ödemesi gereken tutar" canlı hesaplanır.

**4 — Kurallar**
Taht 1 hafta sürer · Devralma = mevcut değer + en az $2 · Geri alırken kredi düşülür · Süre bitince taht ve krediler sıfırlanır · Kullanıcı adı "Past leaders"ta kalıcı kalır · İade yoktur

**5 — Onay**
Zorunlu onay kutusu: tahtın devralınabileceği, iade yapılmayacağı, kural ihlalinde içeriğin iadesiz kaldırılabileceği. İşaretlenmeden ödeme aktif olmaz.

---

## 7. Ana Sayfa Düzeni

- **Üst bar:** toplam oy · anlık online · sıralamanın sıfırlanmasına kalan süre · toplam hacim *(açık karar: gelir kamuya açık olsun mu?)*
- **Harita:** zoom, sürükleme, tıklama, oy oranına göre renklenme, liderli ülkelerde avatar
- **Alt bant:** sabit, sağdan sola kayan şerit — aktif liderler, gönderi görselleriyle. Hover'da durur, tıklanınca ülkeye gider
- **Arama:** ülke adı veya ISO kodu
- **Filtreler:** All / Has leader / No leader (sayılarla) + kıtalar
- **Sıralama kartları:** sıra, bayrak, ülke, başkent, oy, yüzde, dolgu çubuğu, Vote butonu, lider bölümü, past leaders rozetleri

---

## 8. Ödeme

Tek tek ödeme. Merchant of Record aracısı (Paddle / Lemon Squeezy). Stripe Türkiye'deki şirketlere doğrudan hesap açmıyor.

---

## 9. Sayfalar

Ana sayfa · Leaders · Champions · About · Rules · Admin (gizli)

---

## 10. İnşa Sırası

| Adım | İçerik | Durum |
|---|---|---|
| 1 | Kararlar | Tamamlandı |
| 2 | Harita (tıklanabilir, zoom, canlı) | Tamamlandı |
| 3 | Oylama, koruma, sıralama | 3E kaldı |
| — | Tasarım turu | Tamamlandı |
| 4 | Liderlik + X entegrasyonu + moderasyon paneli | Sıradaki |
| 5 | Ödeme | |
| 6 | Yayın ve tanıtım | |

---

## 11. Açık Konular

- Toplam hacim kamuya açık gösterilsin mi?
- Şirket kurulumu (Adım 5 öncesi) — şahıs işletmesi, genç girişimci istisnası
- Masaüstü uygulaması kararlılık sorunu (destek talebi)
