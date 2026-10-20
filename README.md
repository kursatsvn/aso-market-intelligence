# ASO & Pazar İstihbarat Radarı (Local-First / Zero-LLM)

Apple App Store için bağımsız geliştiricilere yönelik, harici API/LLM veya sunucu maliyeti gerektirmeyen, tamamen yerel makinede (Local IP) çalışan ASO ve pazar araştırma aracı.

---

## ⚡ Hızlı Başlangıç

### 1. Geliştirme Modunda Çalıştırma (Next.js + Electron Masaüstü)
```bash
npm run dev
```
Bu komut Next.js geliştirme sunucusunu ve Electron masaüstü uygulamasını aynı anda başlatır.

### 2. Sadece Web Tarayıcısında Önizleme
```bash
npm run dev:next
```
Tarayıcınızda `http://localhost:3000` adresini açar.

### 3. Üretim Derlemesi ve Bağımsız Çalıştırma
```bash
npm run build
npm start
```

### 4. Terminalden Hızlı Analiz (CLI)
Masaüstü uygulamasını açmadan doğrudan terminalden analiz yapmak için:
```bash
# Örnek: "habit tracker" analizi (ABD Mağazası)
npm run test:ingest "habit tracker"

# Örnek: Türkiye mağazasında analiz
npm run test:ingest "su içme" tr

# Yükselen Yıldızlar (Rising Stars) Radarı
npm run test:rising

# Birim Testleri Çalıştırma
npm test
```

### 5. Yerel Veritabanını Görsel Olarak İnceleme
```bash
npm run db:studio
```
Tarayıcıda Prisma Studio açılır ve `aso.db` içindeki tüm tabloları canlı incelemenizi sağlar.

---

## 📐 Mimari ve Özellikler

- **Maliyet:** 0 TL (Ne OpenAI/Gemini anahtarı, ne de Supabase/sunucu gerekir).
- **Veritabanı:** Yerel SQLite (`aso.db`), WAL modunda çalışır.
- **Apple Veri Çekicileri:**
  - `MZStore`: Gerçek App Store arama motorundan ilk 20 sıralama (SERP).
  - `iTunes Lookup`: Toplu meta veriler (puan, yorum, çıkış tarihi, versiyon).
  - `Web Scraper`: `apps.apple.com` sayfasını tarayarak abonelik/IAP tespiti.
  - `MZSearchHints`: Arama çubuğu otomatik tamamlamasından long-tail kelime keşfi.
  - `Reviews RSS`: Rakip uygulamanın 1, 2 ve 3 yıldızlı yorumlarını çekme.
- **Algoritmik Skorlar:**
  - **Keyword Difficulty (KD 1-100):** DCG normalizasyonlu, Bayes puanlı, başlık tam eşleşmeli ve yaş ağırlıklı rekabet gücü.
  - **Fırsat Skoru (0-100):** Hacim > 30 ve KD < 40 olan girilebilir nişleri tespit eden model.
  - **Rising Star Radarı:** Son 180 günde çıkmış, aboneliği olan ve son 30 günlük yorum artış hızı yüksek uygulamalar (cold-start korumalı).
  - **Yorum Röntgeni:** Kural bazlı kategori filtreleri (Fiyat, Hata, Eksik Özellik) ve en çok tekrarlanan 2'li şikayet öbekleri (Bi-gram).
