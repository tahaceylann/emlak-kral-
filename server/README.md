# Sunucu — gerçek zamanlı çok oyunculu (M4)

Node.js + [`ws`](https://www.npmjs.com/package/ws) ile yazılmış, yetkili
(authoritative) WebSocket sunucusu. Tur/ekonomi mantığının tek kaynağı
olsun diye **`/client/engine/*.js` dosyalarını doğrudan require eder** —
mantık istemci ve sunucuda ayrı ayrı yazılıp birbirinden sapmıyor.

## Çalıştırma

```bash
cd server
npm install
node server.js
# varsayılan port 8081 (PORT ortam değişkeniyle değiştirilebilir)
```

İstemci tarafında (`client/`) üst çubuktaki 🌐 butonundan sunucu adresini
gir (yerelde `ws://localhost:8081`), "Oda Kur" ya da bir kodla "Katıl".

## Nasıl çalışır

- `rooms.js`: oda/slot yönetimi (5 karakterlik kod, en fazla 4 slot).
- `server.js`: WebSocket mesaj protokolü + oyun döngüsü. Host "Oyunu
  Başlat"a bastığında boş slotlar bot olur (`client/engine/turns.js`'teki
  `botShouldBuy` aynen kullanılır). Her adımda (`move` → `landing` →
  `state`) sunucu tüm odaya broadcast yapar; istemci sadece animasyon/HUD
  günceller, hesaplamayı tekrar yapmaz.
- Bir insan oyuncunun bağlantısı oyun sırasında koparsa, o slot sırası
  geldiğinde otomatik olarak bot gibi oynamaya devam eder (oyun donmaz).

## Dağıtım (deploy)

Bu klasör herhangi bir Node.js barındırma platformunda (Railway, Render,
Fly.io, bir VPS...) çalıştırılabilir — özel bir yapılandırma gerekmez,
sadece `npm install && node server.js` ve `PORT` ortam değişkenini
platformun verdiği port'a ayarlamak yeterli. Gerçek internete açık bir
dağıtım, hesap/kimlik bilgileri gerektirdiği için kullanıcının kendi
adımı olarak bırakıldı — bu depo sadece kodu hazır tutuyor.

İstemci ayrı bir yerde (ör. GitHub Pages) barındırılıyorsa, oradaki 🌐
modalından sunucunun tam `wss://...` adresini girmek yeterli.
