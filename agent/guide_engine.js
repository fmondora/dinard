/**
 * Émeraude Guide — motore agente client-side
 * Tools live (marea, meteo, POI) + knowledge + contesto ospite Dinard.
 */
(function (global) {
  const TZ = "Europe/Paris";
  const USER = {
    lat: 48.618866,
    lng: -2.037716,
    zona: "Dinard est / Rance",
    bici: true,
    portabici: false,
    ev: true,
    autonomia: 250,
  };

  const KNOWLEDGE = {
    logistica: `Hub Dinard. Bici SOLO da Dinard (no portabici). EV per >15 km. Rientro sera a Dinard. St-Malo: spesso ferry a piedi meglio dell'auto.`,
    marea: `Alta = bagno comodo. Bassa = piscine Prieuré/Bon Secours, rock pools, Grand Bé, parchi ostriche Cancale. Mai isolarsi con marea montante. Baia MSM solo con guida.`,
    bici: `Anelli: Clair de Lune, Écluse–Énogat–Port-Blanc, Saint-Lunaire. No bici a Cancale/Fréhel/MSM.`,
    ev: `Colonnine: Halles Dinard, Barrage Rance, Power Dot/IZIVIA St-Malo, St-Méloir (verso Cancale), Ionity Plouër, DRIVECO St-Briac. Non scendere sotto 20%.`,
    resto: `Local: huîtres in piedi Cancale, halles Dinard, crêperie/brasserie fuori cartolina, Café Plage Énogat, La Passerelle, La Vallée. Special: Didier Méril, Pourquoi Pas ★ (non come "dove mangiano sempre i locali").`,
    rando: `Corte: Clair de Lune, Moulinet, Vicomté, remparts. Mezza: GR34 Dinard–Lunaire, Grouin (EV+piedi), Fréhel–La Latte (EV+piedi), Grand Bé a bassa. Huîtres: balade parcs a bassa marea + marché Houle.`,
    locali_jouny: `Cidrerie Jouny (Tréméreuc, sulla V42): Arnaud 06 64 25 11 73, Elsa 06 01 41 12 70, contact@cidreriedistilleriejouny.fr — WhatsApp/chiamare se chiuso. Consigliano Ferme de la Raudais (Trélat/Taden) ven 16:30–19:00.`,
    eventi: `Brocante Dinard = 1° domenica del mese. Mercati per giorno (mappa). Solidor martedì agosto. Balade huîtres = evento/OT + marea, non GR fisso. Vide-greniers occasionali: verifica manifesto.`,
    naturiste: `Fourberie St-Lunaire: tollerato, vicino in bici/EV corto. Chevrets St-Coulomb: EV ~25–30 min.`,
  };

  const DAY_NAMES = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];

  function parisNow() {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ, weekday: "short", hour: "2-digit", minute: "2-digit",
      day: "numeric", month: "numeric", hour12: false,
    }).formatToParts(new Date());
    const get = (t) => parts.find((p) => p.type === t)?.value;
    const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return {
      day: map[get("weekday")] ?? new Date().getDay(),
      month: parseInt(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, month: "numeric" }).format(new Date()), 10),
      hour: parseInt(get("hour"), 10),
      minute: parseInt(get("minute"), 10),
      label: new Date().toLocaleString("it-IT", { timeZone: TZ, weekday: "long", hour: "2-digit", minute: "2-digit" }),
    };
  }

  function isFirstSunday() {
    const p = parisNow();
    const dayNum = parseInt(
      new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric" }).format(new Date()),
      10
    );
    return p.day === 0 && dayNum <= 7;
  }

  function isSummer(m) {
    return m === 7 || m === 8;
  }

  function gmaps(lat, lng) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }

  function haversineKm(a, b, c, d) {
    const R = 6371, toR = Math.PI / 180;
    const dLat = (c - a) * toR, dLng = (d - b) * toR;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a * toR) * Math.cos(c * toR) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }

  function modeFor(km, { wind = 0, rain = false } = {}) {
    if (km <= 3) return "piedi o bici";
    if (km <= 15 && !rain && wind < 45) return "bici (se vuoi) oppure EV";
    return "EV + piedi sul posto (bici resta a Dinard)";
  }

  function getPlaces() {
    return global.PLACES || global.__EMERAUDE_PLACES || [];
  }

  function searchPlaces({ cat, q, max = 8 } = {}) {
    const places = getPlaces();
    const ql = (q || "").toLowerCase();
    return places
      .filter((p) => {
        if (cat && p.cat !== cat) return false;
        if (!ql) return true;
        return (p.name + " " + (p.desc || "") + " " + (p.place || "")).toLowerCase().includes(ql);
      })
      .slice(0, max);
  }

  function marketsToday() {
    const now = parisNow();
    return getPlaces().filter((p) => {
      if (p.cat !== "market" || !p.days) return false;
      if (!p.days.includes(now.day)) return false;
      if (p.season === "summer" && !isSummer(now.month)) return false;
      return true;
    });
  }

  function brocanteToday() {
    const now = parisNow();
    return getPlaces().filter((p) => {
      if (p.cat !== "brocante") return false;
      if (p.recurrence === "firstSunday") return isFirstSunday();
      if (p.recurrence === "shops") return (p.days || []).includes(now.day);
      if (p.recurrence === "weeklySummer") return isSummer(now.month) && (p.days || []).includes(now.day);
      return (p.days || []).includes(now.day);
    });
  }

  async function fetchTide(lat = USER.lat, lng = USER.lng) {
    const url =
      `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}` +
      `&hourly=sea_level_height_msl&forecast_days=2&timezone=Europe%2FParis`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("marea HTTP " + res.status);
    const data = await res.json();
    const times = data.hourly.time;
    const heights = data.hourly.sea_level_height_msl;
    const extremes = [];
    for (let i = 1; i < heights.length - 1; i++) {
      const a = heights[i - 1], b = heights[i], c = heights[i + 1];
      if (a == null || b == null || c == null) continue;
      if (b > a && b > c) extremes.push({ type: "H", t: times[i], h: b });
      if (b < a && b < c) extremes.push({ type: "L", t: times[i], h: b });
    }
    const now = Date.now();
    const parseT = (iso) => {
      const [d, tm] = iso.split("T");
      const [y, m, day] = d.split("-").map(Number);
      const [hh, mm] = tm.split(":").map(Number);
      return new Date(y, m - 1, day, hh, mm).getTime();
    };
    let idx = 0;
    while (idx < times.length - 1 && parseT(times[idx + 1]) <= now) idx++;
    const hNow = heights[idx];
    const minH = Math.min(...heights.filter((x) => x != null));
    const maxH = Math.max(...heights.filter((x) => x != null));
    const frac = maxH > minH ? (hNow - minH) / (maxH - minH) : 0.5;
    const next = extremes.map((e) => ({ ...e, ts: parseT(e.t) })).find((e) => e.ts > now);
    return { hNow, frac, next, extremes: extremes.slice(0, 6), label: frac >= 0.65 ? "alta/media-alta" : frac <= 0.35 ? "bassa/media-bassa" : "intermedia" };
  }

  async function fetchWeather(lat = USER.lat, lng = USER.lng) {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&current=temperature_2m,weather_code,wind_speed_10m,precipitation` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max` +
      `&forecast_days=5&timezone=Europe%2FParis`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("meteo HTTP " + res.status);
    return res.json();
  }

  function wmo(code) {
    if (code === 0) return "sereno";
    if (code <= 2) return "poco nuvoloso";
    if (code === 3) return "nuvoloso";
    if (code >= 51 && code < 70) return "pioggia";
    if (code >= 80) return "rovesci/temporale";
    return "variabile";
  }

  function detectIntent(text) {
    const t = text.toLowerCase();
    if (/marea|alta marea|bassa marea|coeff/.test(t)) return "tide";
    if (/meteo|piove|tempo|vento|sole|forecast/.test(t)) return "weather";
    if (/nudis|naturis|fourberie|chevrets/.test(t)) return "nude";
    if (/huitre|ostrich|cancale|gourin|parcs? à/.test(t)) return "oyster";
    if (/mang|ristor|cena|pranzo|crêp|crepe|local|fame/.test(t)) return "food";
    if (/mercat|brocant|vide.?grenier|antiqu/.test(t)) return "market";
    if (/rando|cammin|gr\s*34|passeg|sentier|trek|escursion/.test(t)) return "hike";
    if (/bici|bike|cicl/.test(t)) return "bike";
    if (/ricaric|colonnin|ev\b|tesla|ionity|elettric/.test(t)) return "ev";
    if (/tramont|alba|golden|moulinet/.test(t)) return "sunset";
    if (/ferry|saint.?malo|intra.?muros|cézembre|cezembre/.test(t)) return "ferry";
    if (/fr[eé]hel|latte|saint.?cast|jacut/.test(t)) return "west";
    if (/mont.?saint|msm|mont st/.test(t)) return "msm";
    if (/oggi|adesso|2 ore|due ore|pomeriggio|mattina|piano|itiner|cosa faccio|consigli/.test(t)) return "plan";
    if (/chi sei|aiuto|help|cosa sai/.test(t)) return "help";
    return "plan";
  }

  function listPois(pois) {
    if (!pois.length) return "_Nessun POI in archivio per questo filtro._";
    return pois
      .map((p) => {
        const km = haversineKm(USER.lat, USER.lng, p.lat, p.lng).toFixed(1);
        return `• **${p.name}** (${km} km) — ${p.desc || ""} [Maps](${gmaps(p.lat, p.lng)})`;
      })
      .join("\n");
  }

  async function answer(userText) {
    const intent = detectIntent(userText);
    const now = parisNow();
    const lines = [];
    lines.push(`_Base: ${USER.zona} · ${now.label} · bici locale · EV · no portabici_`);
    lines.push("");

    let tide = null, weather = null;
    try {
      if (["tide", "plan", "oyster", "nude", "hike", "sunset", "ferry"].includes(intent)) {
        tide = await fetchTide();
      }
      if (["weather", "plan", "bike", "hike", "west", "msm", "oyster"].includes(intent)) {
        weather = await fetchWeather();
      }
    } catch (e) {
      lines.push(`⚠️ Dati live parziali: ${e.message}`);
      lines.push("");
    }

    const wind = weather?.current?.wind_speed_10m ?? 0;
    const rain = (weather?.current?.precipitation ?? 0) > 0.1 || (weather?.current?.weather_code ?? 0) >= 51;
    const temp = weather?.current?.temperature_2m;

    if (tide) {
      const nx = tide.next
        ? `Prossima ${tide.next.type === "H" ? "alta" : "bassa"} ~${tide.next.t.split("T")[1]} (${tide.next.h.toFixed(1)} m)`
        : "";
      lines.push(`🌊 Marea **${tide.label}** (${tide.hNow.toFixed(2)} m). ${nx}`);
    }
    if (weather?.current) {
      lines.push(`🌤️ ${Math.round(temp)}° · ${wmo(weather.current.weather_code)} · vento ${Math.round(wind)} km/h${rain ? " · pioggia" : ""}`);
    }
    if (tide || weather) lines.push("");

    switch (intent) {
      case "help": {
        lines.push("Sono la **guida Émeraude** del tuo soggiorno a Dinard.");
        lines.push("So di: maree, meteo, spiagge (anche naturiste), rando, mercati/brocante, resto local, huîtres, EV e bici **senza** portabici.");
        lines.push("Prova: *cosa faccio oggi*, *marea*, *Cancale*, *dove mangiare local*, *naturista*, *colonnine*, *Fréhel*.");
        break;
      }
      case "tide": {
        lines.push(KNOWLEDGE.marea);
        lines.push("");
        if (tide?.frac >= 0.65) lines.push("**Ora:** bene per bagno (Écluse, Sillon). Meno ideale per rock pools / Grand Bé.");
        else if (tide?.frac <= 0.35) lines.push("**Ora:** bene per Prieuré piscina, rock pools, sabbia ampia, eventuale Grand Bé (guarda orario risalita!).");
        else lines.push("**Ora:** marea intermedia — buon compromesso.");
        break;
      }
      case "weather": {
        lines.push("**Prossimi giorni:**");
        const d = weather?.daily;
        if (d) {
          for (let i = 0; i < Math.min(5, d.time.length); i++) {
            const name = i === 0 ? "Oggi" : d.time[i].slice(5);
            lines.push(`• ${name}: ${Math.round(d.temperature_2m_min[i])}–${Math.round(d.temperature_2m_max[i])}° · ${wmo(d.weather_code[i])} · pioggia max ${d.precipitation_probability_max?.[i] ?? "—"}% · vento max ${Math.round(d.wind_speed_10m_max?.[i] ?? 0)} km/h`);
          }
        }
        if (wind > 40) lines.push("\nVento sostenuto: evita creste Fréhel lunghe in bici; preferisci mura St-Malo o centro.");
        break;
      }
      case "nude": {
        lines.push(KNOWLEDGE.naturiste);
        lines.push("");
        lines.push(listPois(searchPlaces({ cat: "nude" })));
        lines.push(`\nMezzo: Fourberie → ${modeFor(8, { wind, rain })}; Chevrets → **EV** (niente bici in auto).`);
        break;
      }
      case "oyster": {
        lines.push("**Cancale = EV da Dinard** (bici resta a casa).");
        lines.push(KNOWLEDGE.rando.split("Huîtres:")[1] ? "Huîtres:" + KNOWLEDGE.rando.split("Huîtres:")[1] : KNOWLEDGE.rando);
        if (tide?.frac <= 0.45) lines.push("Marea favorevole a **passeggiata bassa** / vista parchi (solo zone consentite o con guida).");
        else lines.push("Marea non bassissima: **marché huîtres in piedi** comunque ok; balade parchi meglio vicino alla bassa.");
        lines.push("");
        lines.push(listPois(searchPlaces({ q: "cancale" }).concat(searchPlaces({ cat: "oyster" })).slice(0, 8)));
        lines.push("\nRicarica se residuale basso: Power Dot St-Méloir o rapida St-Malo al ritorno.");
        break;
      }
      case "food": {
        lines.push(KNOWLEDGE.resto);
        lines.push("");
        lines.push(listPois(searchPlaces({ cat: "food" })));
        lines.push("\n" + listPois(searchPlaces({ cat: "oyster", max: 3 })));
        break;
      }
      case "market": {
        lines.push(`**${DAY_NAMES[now.day]}** — mercati in calendario:`);
        const mt = marketsToday();
        lines.push(mt.length ? listPois(mt) : "_Nessun mercato tipico oggi (o solo estate)._");
        const br = brocanteToday();
        lines.push("\n**Brocante oggi:**");
        lines.push(br.length ? listPois(br) : "_Niente brocante fissa oggi._" + (isFirstSunday() ? "" : " (Dinard foire = 1° domenica del mese)"));
        lines.push("\nApri il pannello Mercati sulla mappa per filtrare per giorno.");
        break;
      }
      case "hike": {
        lines.push(KNOWLEDGE.rando);
        lines.push(`\nVento ~${Math.round(wind)} km/h · marea ${tide?.label || "n/d"}.`);
        lines.push("\n**Da casa (piedi/bici):** Clair de Lune, Vicomté, Moulinet, GR34 verso Lunaire.");
        lines.push("**Con EV:** Grouin, Fréhel–La Latte, pezzo St-Malo–Cancale (non l’intero se non allenato).");
        lines.push(listPois(searchPlaces({ cat: "walk" })));
        break;
      }
      case "bike": {
        lines.push(KNOWLEDGE.bici);
        if (rain || wind > 45) lines.push("\n⚠️ Oggi meteo/vento sconsigliano giri lunghi in bici → EV + piedi o piano corto riparato.");
        else lines.push("\n**Idea:** anello Écluse–Énogat–Port-Blanc e caffè a Énogat. Rientro base est.");
        break;
      }
      case "ev": {
        lines.push(KNOWLEDGE.ev);
        lines.push("");
        lines.push(listPois(searchPlaces({ cat: "ev", max: 10 })));
        break;
      }
      case "sunset": {
        lines.push("Tramonti forti: **Moulinet**, Port-Blanc ovest, Décollé, remparts St-Malo (ferry), Cap Fréhel (EV).");
        lines.push(listPois(searchPlaces({ cat: "sunset" })));
        break;
      }
      case "ferry": {
        lines.push("Ferry Dinard ↔ St-Malo ~10 min (Corsaire / Bateaux Rouges). Ideale **senza auto** per Intra-Muros.");
        lines.push("Cézembre: battello giornaliero in stagione, spiaggia a sud.");
        lines.push(listPois(searchPlaces({ cat: "ferry" })));
        break;
      }
      case "west": {
        lines.push("**Ovest (Fréhel / Cast / Jacut) = EV.** Bici no.");
        lines.push(listPois(searchPlaces({ q: "fréhel" }).concat(searchPlaces({ q: "cast" }), searchPlaces({ q: "jacut" })).slice(0, 10)));
        break;
      }
      case "msm": {
        lines.push("**Mont-Saint-Michel = EV** da Dinard. Park La Caserne + navetta. Baia a piedi solo con guida.");
        lines.push("Ricarica: parti pieno; Ionity Plouër se serve CCS 350 kW sul corridoio.");
        lines.push(listPois(searchPlaces({ q: "mont" }).concat(searchPlaces({ q: "caserne" }))));
        break;
      }
      case "plan":
      default: {
        lines.push("### Piano consigliato");
        const mk = marketsToday();
        if (mk.length) {
          lines.push(`**Mattina:** mercato — ${mk.map((p) => p.name.replace(/^🛒\s*/, "")).join(", ")}. Mezzo: ${modeFor(5, { wind, rain })}.`);
        } else if (!rain && wind < 40) {
          lines.push("**Mattina (bici/piedi):** Clair de Lune + Écluse/Énogat. Caffè a Énogat se vuoi vibe meno cartolina.");
        } else {
          lines.push("**Mattina:** Halles Dinard o Intra-Muros in ferry (riparato).");
        }

        if (tide?.frac <= 0.4) {
          lines.push("**Pomeriggio:** marea bassa → Prieuré/piscina, rock pools, o **EV Cancale** huîtres + passeggiata. Altrimenti Grand Bé se sei a St-Malo.");
        } else if (!rain) {
          lines.push("**Pomeriggio:** " + (wind > 40 ? "St-Malo mura / centro (ferry)." : "GR34 verso Lunaire a piedi **oppure** EV Grouin se vuoi raggio lungo."));
        } else {
          lines.push("**Pomeriggio pioggia:** Intra-Muros, caffè, antiquari, halles. EV solo se ti serve ricarica al coperto tipo centro commerciale/parcheggio.");
        }

        lines.push("**Sera:** rientro Dinard · tramonto Moulinet a piedi · cena €€ local (non forzare la stella).");
        lines.push("");
        lines.push(KNOWLEDGE.logistica);
        if (isFirstSunday()) lines.push("\n🏺 **Oggi è 1° domenica del mese** → Foire brocante Dinard 9–19, Esplanade Halles.");
        break;
      }
    }

    lines.push("\n---\nMappa: [fmondora.github.io/dinard](https://fmondora.github.io/dinard/) · maree indicative (non SHOM)");
    return { intent, text: lines.join("\n") };
  }

  global.EmeraudeGuide = {
    USER,
    KNOWLEDGE,
    answer,
    searchPlaces,
    marketsToday,
    fetchTide,
    fetchWeather,
    modeFor,
    parisNow,
  };
})(typeof window !== "undefined" ? window : globalThis);
