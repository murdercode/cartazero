# Cartine — Coordinate in Abruzzo

Palestra cartografica in italiano con due esercizi, disponibili sia in coordinate geografiche WGS84 sia in UTM WGS84 / 33N (EPSG:32633):

- Coordinate → punto: posizionamento della risposta con un clic sulla mappa.
- Punto → coordinate: lettura del centro di un bersaglio e inserimento delle coordinate.

## Avvio

Richiede Python 3 per il server locale e Node.js 22 per i test. Non richiede installazione di dipendenze.

```sh
npm run dev
```

Aprire http://127.0.0.1:4173/. Il sito statico è interamente in `dist/`.

```sh
npm test
```

## Funzioni

Otto zone di esercizio in Abruzzo, reticolo UTM da 1 km o geografico da 1′, formati DMS/DM/DD, tolleranze da 25/50/100 m, confronto grafico della risposta, errore in metri e millimetri sulla carta, risultati locali (ultimi 500 esercizi), comandi da tastiera e interfaccia responsive. La soluzione consultata conta come esercizio saltato. “Cambia” genera un esercizio senza registrare un tentativo.

La mappa usa una scala nominale 1:25.000, mantenuta durante lo spostamento. Il controllo Calibra consente di misurare una linea con un righello e stabilire i pixel per millimetro effettivi del proprio schermo. La calibrazione è riferita al centro della carta; va ripetuta dopo un cambio di monitor o zoom del browser. Il fondo Web Mercator presenta una piccola variazione di scala con la latitudine all’interno del riquadro.

## Cartografia e librerie

- [Leaflet 1.9.4](https://leafletjs.com/reference.html), BSD-2-Clause, distribuito localmente con licenza in `dist/vendor/`.
- [Proj4js 2.20.2](https://proj4js.org/), MIT, distribuito localmente con licenza in `dist/vendor/`. Ordine in conversione: longitudine/latitudine; Est/Nord.
- [OpenTopoMap](https://opentopomap.org/), base topografica predefinita. Dati OpenStreetMap e SRTM; rappresentazione CC BY-SA 3.0, attribuzione visibile sulla carta.
- [OpenStreetMap](https://www.openstreetmap.org/copyright), base alternativa selezionabile in caso di indisponibilità. Le richieste sono eseguite direttamente dal browser, senza prefetch o scaricamento offline, secondo la [tile usage policy](https://operations.osmfoundation.org/policies/tiles/).
- DM Sans / DM Serif Display tramite Google Fonts, con fallback di sistema.

La carta richiede Internet per le tessere. La base non è una tavoletta IGM ufficiale e non adotta datum storici ED50/Roma40. Il fuso è 33, l’emisfero Nord e la fascia latitudinale T (33T non è il nome EPSG del CRS).

## Pubblicazione

Sito statico privato tramite Sites, configurato da `.openai/hosting.json`.
