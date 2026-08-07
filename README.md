# Dinard — mappa interattiva

Guida locale per Dinard e Côte d'Émeraude: spiagge, maree, tramonti, mercati, ristoranti, ferry, colonnine EV.

## Live

**https://fmondora.github.io/dinard/**

I dati si aggiornano da soli nel browser:
- **Maree** — Open-Meteo Marine API (previsione ~3 giorni, refresh ogni 5 min)
- **Alba / tramonto / golden hour** — calcolati sul posto (SunCalc)
- **Badge spiagge** — consiglio favorevole/sfavorevole in base alla marea attuale

## Offline / file

| File | Uso |
|------|-----|
| `index.html` / `dinard-mappa.html` | Mappa interattiva |
| `dinard-google-mymaps.csv` | Import in [Google My Maps](https://www.google.com/mymaps) |
| `dinard-mappa.kml` | Import My Maps / Google Earth |

## Sviluppo locale

Apri `index.html` nel browser (serve internet per le maree).

```bash
# opzionale: server locale
python3 -m http.server 8080
# → http://localhost:8080
```
