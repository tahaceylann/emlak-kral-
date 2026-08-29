# Çok oyunculu istemci (M4 — tamamlandı)

`client.js`: WebSocket bağlantısı, oda kur/katıl/başlat, sunucudan gelen
olayları (`move`, `landing`, `state`, `buy_offer`, `room`, ...) `app.js`'e
`on(type, fn)` ile ulaştırır. Oyun mantığının hiçbiri burada yok —
sunucu (`/server`) yetkilidir, bu dosya sadece mesaj taşıyıcısı.

Kullanım detayları için kök `README.md`'deki "Çevrimiçi oynamak" bölümüne
ve `/server/README.md`'ye bakın.
