# Cartine — Coordinate in Abruzzo

Palestra cartografica in italiano con due esercizi, disponibili sia in coordinate geografiche WGS84 sia in UTM WGS84 / 33N (EPSG:32633):

- Coordinate → punto: posizionamento della risposta con un clic sulla mappa.
- Punto → coordinate: lettura del centro di un bersaglio e inserimento delle coordinate.

## Avvio

Richiede Python 3 per il server locale e Node.js 22 per build e test. Non richiede installazione di dipendenze.

```sh
npm run build
npm start
```

Aprire http://127.0.0.1:4173/. La build locale è in `build/`; il codice del sito statico è in `dist/`. Dopo una modifica, ripetere `npm run build` per aggiornare la build servita. Per lavorare direttamente sui sorgenti con il server di sviluppo, usare `npm run dev` al posto di `npm start`.

```sh
npm test
```

## Funzioni

Otto zone di esercizio in Abruzzo, reticolo UTM da 1 km all’interno e cornice geografica sui quattro bordi, formati DMS/DM/DD, tolleranze da 25/50/100 m, confronto grafico della risposta, errore in metri e millimetri sulla carta, risultati locali (ultimi 500 esercizi), comandi da tastiera e interfaccia responsive. La soluzione consultata conta come esercizio saltato. “Cambia” genera un esercizio senza registrare un tentativo.

La mappa usa una scala nominale 1:25.000, mantenuta durante lo spostamento. Il controllo Calibra consente di misurare una linea con un righello e stabilire i pixel per millimetro effettivi del proprio schermo. La calibrazione è riferita al centro della carta; va ripetuta dopo un cambio di monitor o zoom del browser. Il fondo Web Mercator presenta una piccola variazione di scala con la latitudine all’interno del riquadro.

La carta mantiene sempre la stessa impostazione nei due sistemi di esercizio: reticolo chilometrico UTM nell’area cartografica, cornice geografica WGS84 su tutti e quattro i lati. La cornice ha barre alternate ogni 1′ (60″), tacche ogni 10″ e valori di longitudine in alto e in basso, latitudine a sinistra e a destra. Non vengono disegnate linee geografiche interne permanenti. La scelta UTM / Geografiche riguarda le domande e i campi della risposta. Le etichette UTM rimangono all’interno della cornice. Cornice, reticolo e guide vengono ricalcolati dopo spostamenti, ridimensionamenti e calibrazione.

Selezionando **Righello UTM** compare un coordinatometro sui bordi sinistro e inferiore del quadrato chilometrico sotto il cursore. Le tacche sono ogni 25 m (1 mm a 1:25.000), con numeri ogni 200 m; si diradano se la calibrazione lascia poco spazio. È riferito sempre al reticolo UTM, anche negli esercizi geografici. Per le geografiche si usano la cornice, i due righelli normali e le guide temporanee del puntatore.

**Righello cm / mm** è il nuovo strumento predefinito: un righello trasparente da 10 cm con tacche di 1 mm. È indipendente da coordinate, zoom, reticolo, posizione del mouse e area di esercizio; resta sullo schermo mentre sposti la carta. Si trascina dal corpo e ruota liberamente attorno allo zero dal pallino. Sono disponibili angolo numerico, 0° / 90°, ricentraggio e Fissa/Sblocca. Quando è fissato, i clic attraversano il righello e raggiungono la carta. La calibrazione del monitor regola i cm/mm fisici: non è un adattamento alle distanze del reticolo. A parità di calibrazione, la lunghezza rimane identica in tutti gli esercizi. Si ricava manualmente la distanza sul terreno applicando 1:25.000; per gradi/minuti/secondi si usa la proporzione rispetto all’intervallo del reticolo. Tastiera sul righello: frecce per spostare, Q/E per ruotare; Maiusc aumenta il passo. Su schermi stretti parte verticale e mantiene i suoi 10 cm.

Sono disponibili due righelli normali simultanei: giallo e azzurro, entrambi da 10 cm e con tacche di 1 mm. Ognuno conserva posizione, inclinazione e blocco indipendenti e ha una riga di comandi identificata dal colore. Partono perpendicolari per incrociare le letture. Se si sovrappongono, agire sul corpo o sui comandi di uno lo porta davanti all’altro. Fissare entrambi consente di segnare il punto sulla carta attraverso l’incrocio. La calibrazione del monitor vale per entrambi e le graduazioni rimangono indipendenti dal reticolo.

Il puntatore mostra due rette sottili e semitrasparenti, dorata e azzurra, che si incrociano esattamente sotto il cursore e si estendono ai bordi della carta. Sono visibili anche sopra i righelli, senza intercettare clic o trascinamenti. In UTM seguono gli assi locali del reticolo, inclusa la convergenza; nelle geografiche seguono paralleli e meridiani. Con touch seguono l’ultimo tocco, con la tastiera il centro della carta. Non mostrano valori numerici o conversioni automatiche.

La carta non ha riquadri informativi sovrapposti: istruzioni e risultati sono nella barra laterale, scala e calibrazione sotto l’esercizio, attribuzioni e Nord sotto la carta. Gli avvisi sulle tessere compaiono sopra la carta. I punti non aprono etichette flottanti e i controlli non mostrano tooltip automatici.

## Cartografia e librerie

- [Leaflet 1.9.4](https://leafletjs.com/reference.html), BSD-2-Clause, distribuito localmente con licenza in `dist/vendor/`.
- [Proj4js 2.20.2](https://proj4js.org/), MIT, distribuito localmente con licenza in `dist/vendor/`. Ordine in conversione: longitudine/latitudine; Est/Nord.
- [OpenTopoMap](https://opentopomap.org/), base topografica predefinita. Dati OpenStreetMap e SRTM; rappresentazione CC BY-SA 3.0, attribuzione visibile sulla carta.
- [OpenStreetMap](https://www.openstreetmap.org/copyright), base alternativa selezionabile in caso di indisponibilità. Le richieste sono eseguite direttamente dal browser, senza prefetch o scaricamento offline, secondo la [tile usage policy](https://operations.osmfoundation.org/policies/tiles/).
- DM Sans / DM Serif Display tramite Google Fonts, con fallback di sistema.

La carta richiede Internet per le tessere. La base non è una tavoletta IGM ufficiale e non adotta datum storici ED50/Roma40. Il fuso è 33, l’emisfero Nord e la fascia latitudinale T (33T non è il nome EPSG del CRS).

## Pubblicazione

Sito statico privato tramite Sites, configurato da `.openai/hosting.json`.
