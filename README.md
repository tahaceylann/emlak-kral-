# 🏙️ Emlak Kralı

Business Tour'dan ilham alan, **stilize 3D izometrik**, tarayıcıda oynanan
bir zar/tahta (Monopoly tarzı) oyunu. Kendi orijinal teması ve tahta
düzeniyle — jenerik "zar at, tahtada ilerle, mülk al/kirala" mekaniğini
kullanır.

Şu an **M5 aşamasında**: toon-shading'li, piyon/zar özelleştirmeli, hem
tek cihazda bot'lara karşı hem de **gerçek zamanlı çok oyunculu** (kod ile
oda kur/katıl) oynanabilen, kendi **harita editörünle** kendi tahtanı
tasarlayabildiğin bir prototip. İstemci build aracı/framework gerektirmeyen
vanilla HTML/CSS/JS + Three.js; çok oyunculu için hafif bir Node.js
WebSocket sunucusu var.

## PC'de oynamak (tek tıkla başlat)

Oyun PC (Windows/Mac/Linux) için de ayarlı: geniş ekranda tahta solda büyük,
kontroller sağda sabit bir panelde açılır; fare tekerleğiyle yakınlaştır/
uzaklaş, sürükleyerek kamerayı döndür, **Boşluk** ya da **Enter** ile zar at.

- **Windows**: `start.bat` dosyasına çift tıkla.
- **macOS/Linux**: terminalde `./start.sh` çalıştır (ya da dosyaya çift
  tıkla, bazı sistemlerde terminali otomatik açar).

İkisi de gerekliyse sunucu bağımlılıklarını kurar (`server/npm install`,
sadece ilk çalıştırmada), hem WebSocket sunucusunu hem istemciyi başlatıp
tarayıcını `http://localhost:8080` adresinde otomatik açar. Önkoşul:
[Node.js](https://nodejs.org) ve Python 3 kurulu olmalı (çoğu Mac/Linux'ta
zaten kurulu gelir; Windows'ta [python.org](https://python.org)'dan kurup
kurulumda **"Add python.exe to PATH"** kutusunu işaretlemen yeterli).
Kapatmak için `start.sh`'ın çalıştığı terminalde Ctrl+C, ya da `start.bat`'ın
açtığı iki pencereyi kapat.

## Nasıl oynanır — tek cihaz (bot'lara karşı)

Script'i kullanmak istemiyorsan elle de başlatabilirsin:

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
- Tahtayı parmağınla/fareyle sürükleyerek 3D kamerayı döndürebilirsin;
  PC'de fare tekerleğiyle yakınlaştır/uzaklaş, Boşluk/Enter ile zar at.
- Bir oyuncu dışında herkes iflas edince oyun biter.
- Üst çubuktaki 🎨 **Özelleştir**'e basarak piyon formunu (Klasik Piyon / Küp
  Kule / Elmas) ve zar teması rengini seçebilirsin; seçim `localStorage`'a
  kaydedilir ve bir sonraki oyunda uygulanır.

## Çevrimiçi oynamak (gerçek zamanlı çok oyunculu)

```bash
# 1. terminal — sunucu
cd server && npm install && node server.js

# 2. terminal — istemci
cd client && python3 -m http.server 8080
```

Tarayıcıda `http://localhost:8080` aç, üst çubuktaki 🌐'ye bas:

- **Oda Kur**: sunucu adresi (yerelde `ws://localhost:8081`) ve adını gir,
  5 haneli bir oda kodu üretilir — arkadaşına bu kodu gönder.
- **Kod ile Katıl**: aldığın kodu gir, aynı sunucuya bağlanırsın.
- Ev sahibi hazır olduğunda **Oyunu Başlat**'a basar; dolmayan slotlar bot
  olarak oynar. Sıra sana geldiğinde 🎲 **Zar At** aktif olur.
- Hesaplama tamamen sunucuda yapılır (hile önlemek için) — istemci sadece
  gelen state'i render eder. Bir oyuncunun bağlantısı koparsa sırası
  geldiğinde bot gibi oynamaya devam eder, oyun donmaz.
- Sunucuyu gerçek internete açmak (Railway/Render/Fly.io vb.) kendi
  hesabınla yapman gereken ayrı bir adım — bkz. `server/README.md`.
- Ev sahibi özel bir harita hazırlayıp aktif ettiyse (aşağıya bak), oda
  başlatıldığında o harita otomatik olarak tüm oyunculara senkronize edilir.

## Kendi haritanı tasarlamak (harita editörü)

Üst çubuktaki 📝'ye bas:

- 28 kare sabit; her karenin **tipini** (Mülk/Şans/Vergi/Dinlenme), **ismini**
  ve tipe özgü değerlerini (mülk bölgesi, vergi miktarı, dinlenme bonusu)
  değiştirebilirsin. İlk kare (Başlangıç) sabittir.
- **"Bu haritayı yeni oyunlarda kullan"** kutusunu işaretleyip **Kaydet**'e
  basınca, bir sonraki "Yeniden Başlat"ta (tek cihaz) ya da oda
  başlatıldığında (çevrimiçi) bu harita kullanılır.
- **Paylaşım kodu**: Kaydet'e bastığında kutuya bir kod dolar — kopyalayıp
  arkadaşına gönder, o da kodu yapıştırıp **İçe Aktar**'a basarak aynı
  haritayı kendi tarayıcısına yükleyebilir.
- Harita `localStorage`'da saklanır; **Varsayılana Dön** ile sıfırlanabilir.

## Dosya yapısı

```
start.sh, start.bat  Tek tıkla/komutla sunucu+istemciyi başlatıp tarayıcıyı
                     açan PC script'leri (macOS/Linux, Windows)
client/
  index.html, style.css, app.js   Uygulama kabuğu ve oyun döngüsü orkestrasyonu
  engine/
    board.js       Tahta veri modeli (28 kare, renk grupları, 3D koordinatlar)
    dice.js         Zar atma
    cards.js        Şans kartı destesi
    economy.js      Oyuncu state'i, satın alma/kira/iflas
    turns.js        Saf tur/oyun durum makinesi (DOM'a dokunmaz — test edilebilir)
    pieces.js       Piyon mesh üretimi (3 seçilebilir form: pawn/cube/gem)
    render3d.js      Three.js sahnesi: izometrik ortografik kamera, toon-shading,
                     tahta/piyon render'ı, hareket animasyonu, sürükle-döndür,
                     parçacık efektleri (satın alma/kira/maaş), aktif tur halkası
  net/client.js     WebSocket istemcisi (oda kur/katıl, sunucu olaylarını app.js'e iletir)
  editor/mapEditor.js   Harita editörü mantığı: doğrulama, localStorage,
                        paylaşım kodu encode/decode (form/DOM app.js'te)
  vendor/three.min.js
server/
  server.js, rooms.js, package.json   Yetkili çok oyunculu sunucu (bkz. server/README.md)
shared/              Boş — engine/*.js zaten hem tarayıcıda hem Node'da çalışıyor,
                     ayrı bir kopyaya gerek kalmadı (bkz. shared/README.md)
test/engine.test.js  DOM'suz, saf mantık testleri (`node test/engine.test.js`)
```

## Yol haritası

1. ✅ **M0** — İskelet (PWA kabuğu, boş Three.js sahnesi)
2. ✅ **M1** — Tek oyunculu çekirdek mekanik
3. ✅ **M2** — Görsel cila: toon-shading, satın alma/kira/maaş parçacık
   efektleri, piyon iniş sekmesi, aktif oyuncu halkası, şans kartı toast'ı
4. ✅ **M3** — Karakter & zar özelleştirme
5. ✅ **M4** — Gerçek zamanlı çok oyunculu: Node WebSocket sunucusu, oda
   kur/katıl, sunucu-yetkili tur/ekonomi mantığı, bağlantı kopunca bot
   devralması
6. ✅ **M5** — Harita editörü: 28 karenin tipi/ismi/değerleri düzenlenebilir,
   `localStorage`'a kaydedilir, paylaşım koduyla arkadaşlara aktarılabilir,
   hem tek cihazda hem çevrimiçi odada (sunucuya senkronize) kullanılır
   (bu sürüm)
7. ⬜ **M6** — Cila & dağıtım (GitHub Pages / hosting)

## Test

```bash
node test/engine.test.js
```

Saf oyun mantığı (tahta, ekonomi, tur durum makinesi) DOM/Three.js'den
bağımsız yazıldığı için Node'da doğrudan test edilebiliyor.
