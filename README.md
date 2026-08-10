# Côte d'Émeraude → Mont-Saint-Michel

Mappa interattiva: **Saint-Jacut / Cap Fréhel** → Dinard → **Saint-Malo** → **Cancale** → **Mont-Saint-Michel**.

## Live

**https://fmondora.github.io/dinard/**

### Cosa fa
- **Scorri la mappa** → cambiano pin, lista laterale, zona, maree, alba/tramonto
- Chip zona in alto (Fréhel, St-Jacut, Dinard, St-Malo, Cancale, Mont…)
- Zoom out = solo punti principali; zoom in = dettaglio
- Maree Open-Meteo sul **centro della mappa** (si aggiornano spostandoti di ~4+ km)
- Badge spiagge in base alla marea attuale
- Tramonti con golden hour locale

### File
| File | Uso |
|------|-----|
| `index.html` | App web |
| `dinard-google-mymaps.csv` / `.kml` | Import Google My Maps (subset) |
| `places_data.json` | Dataset punti |

### Aggiornare e pubblicare
```bash
git add -A && git commit -m "update" && git push
```


## Guida agente (Émeraude)

- **In mappa:** pulsante 🦞 Guida (chat) — marea/meteo live + logistica bici/EV
- **In Grok:** skill `/emeraude-guide` (`.grok/skills/emeraude-guide/`)
- Contesto ospite: `agent/user_context.yaml` (Dinard, bici senza portabici, auto elettrica)
- Knowledge: `agent/knowledge/*.md`
- Engine: `agent/guide_engine.js`

- **Ciclabili:** filtro 🚴 sulla mappa (Voie Verte Dinard→Dinan + costa Lunaire)
