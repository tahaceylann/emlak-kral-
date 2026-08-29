# Paylaşılan mantık — ayrı bir kopya yerine tek dosyalar

Başta planlanan "tahta şemasının tek kaynağı" ihtiyacı, `client/engine/*.js`
dosyalarının hem tarayıcıda (`<script>` ile, `window.*Module` global'leri
üzerinden) hem de Node'da (`require()` ile, `module.exports` üzerinden)
çalışacak şekilde yazılmasıyla çözüldü — bkz. her dosyanın sonundaki:

```js
if (typeof module !== "undefined" && module.exports) module.exports = X;
if (typeof window !== "undefined") window.X = X;
```

Bu sayede `server/server.js`, `client/engine/turns.js`'i (ve onun
kullandığı `board.js`/`economy.js`/`cards.js`/`dice.js`'i) doğrudan
require ediyor — ayrı bir kopya tutmaya, dolayısıyla iki tarafın
birbirinden sapma riskine gerek kalmadı. Bu klasör bu yüzden boş
kalıyor; ileride gerçekten istemciye/sunucuya özel olmayan ama her
ikisinin de ihtiyaç duyacağı yeni bir paylaşılan veri (ör. harita
editöründen çıkan tahta JSON şeması, M5) olursa buraya gelebilir.
