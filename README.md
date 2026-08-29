# 🏙️ Emlak Kralı

Business Tour'dan ilham alan, **stilize 3D izometrik**, tarayıcıda oynanan
bir zar/tahta (Monopoly tarzı) oyunu. Kendi orijinal teması ve tahta
düzeniyle — jenerik "zar at, tahtada ilerle, mülk al/kirala" mekaniğini
kullanır.

Şu an **M1 aşamasında**: 4 oyunculu (1 insan + 3 bot), tek cihazda/yerel
tarayıcıda oynanan, tamamen çalışan bir çekirdek prototip. Build aracı,
framework veya harici bağımlılık yok — vanilla HTML/CSS/JS + Three.js.

## Nasıl oynanır (yerelde)

```bash
cd client
python3 -m http.server 8080
# tarayıcıda http://localhost:8080 aç
```

- 🎲 **Zar At**'a bas, piyonun tahtada 3D olarak ilerlediğini izle.
- Sahipsiz bir mülke gelince **Satın Al / Geç** seç.
- Bir bölgenin (renk grubunun) tamamı elindeyse o bölgedeki kiralar 2 katına
  çıkar.
- Şans karesi rastgele bir olay kartı çeker, vergi karesi sabit bir miktar
  keser.
- Tahtayı parmağınla/fareyle sürükleyerek 3D kamerayı döndürebilirsin.
- Bir oyuncu dışında herkes iflas edince oyun biter.

## Dosya yapısı

```
client/
  index.html, style.css, app.js   Uygulama kabuğu ve oyun döngüsü orkestrasyonu
  engine/
    board.js       Tahta veri modeli (28 kare, renk grupları, 3D koordinatlar)
    dice.js         Zar atma
    cards.js        Şans kartı destesi
    economy.js      Oyuncu state'i, satın alma/kira/iflas
    turns.js        Saf tur/oyun durum makinesi (DOM'a dokunmaz — test edilebilir)
    pieces.js       Piyon mesh üretimi
    render3d.js      Three.js sahnesi: izometrik ortografik kamera, tahta/piyon
                     render'ı, hareket animasyonu, sürükle-döndür
  net/, editor/     Henüz boş — M4 (çok oyunculu) ve M5 (harita editörü) için
  vendor/three.min.js
server/, shared/     Henüz boş — M4'te dolacak (bkz. server/README.md)
test/engine.test.js  DOM'suz, saf mantık testleri (`node test/engine.test.js`)
```

## Yol haritası

1. ✅ **M0** — İskelet (PWA kabuğu, boş Three.js sahnesi)
2. ✅ **M1** — Tek oyunculu çekirdek mekanik (bu sürüm)
3. ⬜ **M2** — Görsel cila: toon-shaded materyaller, zar/satın-alma efektleri
4. ⬜ **M3** — Karakter & zar özelleştirme
5. ⬜ **M4** — Gerçek zamanlı çok oyunculu (Node WebSocket sunucusu)
6. ⬜ **M5** — Harita editörü
7. ⬜ **M6** — Cila & dağıtım (GitHub Pages / hosting)

## Test

```bash
node test/engine.test.js
```

Saf oyun mantığı (tahta, ekonomi, tur durum makinesi) DOM/Three.js'den
bağımsız yazıldığı için Node'da doğrudan test edilebiliyor.
