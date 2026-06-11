# Roadmapa implementace

Tasky pro **TimePrice v1.0** — Chrome extension (MV3), která na e-shopech převádí ceny na čas potřebný k jejich vydělání. „30 000 Kč" → „30 h" při sazbě 1000 Kč/h.

Procházet shora dolů; pořadí respektuje dependency. **Plně funkční extension na běžných i React/Vue webech je po dokončení tasku 08.** Tasky 09–10 dotahují kontrolu a přesnost na top eshopech, 11–14 hardening a release readiness.

Diskutovaná architektura a design rozhodnutí jsou zafixované v jednotlivých task dokumentech a v [`AGENTS.md`](../AGENTS.md). Pokud něco není ve Scope tasku, je to záměr — viz „Mimo scope" níže.

## Zafixovaná rozhodnutí (z grill-me session)

| Oblast | Rozhodnutí |
|---|---|
| Detekce | **CZK only**, generický engine + tenké site-adaptéry pro top CZ eshopy |
| Build | **WXT** (MV3, Vite, file-based manifest, HMR, cross-browser ready) |
| Zobrazení | **In-place** náhrada textu, původní cena v tooltipu na hover |
| Sazba | Volná **čistá** hodinovka (presety 500/1000/1500 + custom), žádný daňový engine |
| Jednotka | **Smart auto-scaling** (min / hod / pracovní dny), pluggable konvertor |
| Detekce cen | Vyžadovat **měnovou kotvu** (`Kč` / `CZK` / `,-`) |
| Slevy | Konvertovat **obě** ceny, zachovat přeškrtnutí |
| DOM | **In-place mutace** text nodeů + idempotentní guard, re-aplikace při re-renderu |
| Monetizace | MVP **100 % free/local**; monetizace jen design dokument (task 15), nestaví se |
| Popup UI | **Svelte** (content engine = vanilla TS) |
| Prohlížeče | **Chrome-first**, kód cross-browser ready (WXT polyfill) |
| Default | Běžet **všude** + global/per-site toggle + **blocklist** citlivých domén |

## v1.0 — Foundation & infra

1. [01 — Scaffolding (WXT, TS, Svelte, lint, Vitest, struktura)](01-scaffolding.md)
2. [02 — Settings model + storage layer (`chrome.storage.sync`)](02-settings-and-storage.md)
3. [03 — Popup: onboarding sazby + live preview (Svelte)](03-popup-rate-onboarding.md)

## v1.0 — Konverzní jádro (pure, bez DOM)

4. [04 — Price parser (CZK formáty, měnová kotva, normalizace)](04-price-parser.md)
5. [05 — Time converter + smart unit formatter (pluggable `Converter`)](05-time-converter.md)

## v1.0 — Content engine (DOM)

6. [06 — DOM scanner (TreeWalker, kandidáti cen)](06-dom-scanner.md)
7. [07 — In-place mutator + reverzibilita + hover tooltip](07-mutator-and-tooltip.md)
8. [08 — MutationObserver + idempotentní guard (SPA, infinite scroll)](08-mutation-observer.md)

## v1.0 — Kontrola & přesnost

9. [09 — Global + per-site toggle + blocklist citlivých domén](09-toggles-and-blocklist.md)
10. [10 — Site adapter framework + první adaptéry (Alza, Mall, Datart, CZC, Notino)](10-site-adapters.md)

## v1.0 — Hardening & release

11. [11 — Performance hardening (batching, idle, viewport-first, caps)](11-performance-hardening.md)
12. [12 — Privacy & minimalizace oprávnění + privacy policy](12-privacy-and-permissions.md)
13. [13 — Ikony + Chrome Web Store listing assets](13-icons-and-store-listing.md)
14. [14 — E2E testy na fixturách + QA matice + release checklist](14-e2e-and-release.md)

## Future — design dokumenty (NEIMPLEMENTOVAT v MVP)

> Tyto tasky existují jako technický návrh, aby architektura MVP nešla proti budoucnosti. Žádný z nich se ve v1.0 nestaví — slouží jako zafixovaný plán a kontrola, že abstrakce (Converter, adapter registry, settings schema) jsou připravené.

15. [15 — Monetizace: free/premium, Stripe, license keys, abuse protection (design)](15-monetization-design.md)
16. [16 — Pluggable metriky: pracovní dny, % příjmu, spoření (design)](16-future-metrics.md)
17. [17 — Vlastní panely / insights (Hlídač Shopů styl, design)](17-future-panels.md)
18. [18 — Multi-currency (design)](18-future-multicurrency.md)
19. [19 — Firefox + Edge release (design)](19-future-firefox-edge.md)

## Mimo scope úplně (ani jako design)

- **Sběr dat.** Žádné analytics, telemetry, crash reporting, ads, remote SDK. Privacy claim je „TimePrice nic neposílá ven, vše běží lokálně" a držíme ho napříč celou roadmapou. Jakýkoliv network call v content/background scriptu je porušení a musí mít explicitní user approval (týká se i budoucí monetizace — viz task 15, který to řeší license-key-first, ne always-online).
- **Daňový engine / hrubá → čistá sazba.** Uživatel zadává čistou hodinovku ručně. Žádné modelování CZ daní (křehké, mění se zákony).
- **Automatická detekce měny u holých čísel.** Bez měnové kotvy se nekonvertuje (task 04). „Ceny bez měny" jsou vědomě out — jediná výjimka je explicitní CSS selektor v site-adaptéru (task 10).
- **Přepisování cen v `<canvas>` a rasterových obrázcích.** Nelze spolehlivě číst ani přepsat. SVG s textovými `<text>` uzly je v limitované míře v scope (scanner je projde), `<canvas>` ne. Dokumentováno jako known limitation.
- **Mutace cen ve `<input>`/`<textarea>` hodnotách.** Needitujeme uživatelův vstup (košík, množství). Pouze read-only zobrazené ceny.
- **Server-side / cloud cokoliv.** Žádný backend ve v1.0.

## Workflow

- Práce na `main`, incremental commits, gitmoji prefix (`✨`, `🐛`, `📝`, `💄`, `📸`, `👷`, `🧹`, `🚧`, `✅`, `⚡️`).
- Každý task se commituje jedním nebo více commity. Velký task (04, 07, 08, 10) klidně 3–5 commitů.
- Po dokončení **klíčových tasků** (04, 05, 07, 08, 10) spustit `npx vitest run` + lint a u DOM tasků manuální smoke test na reálné Alze před closing commitem.
- Testy se píšou *uvnitř* příslušného tasku, ne v samostatném „Tests" tasku. Pure jádro (04, 05) má povinné unit testy; DOM tasky mají fixture-based testy v tasku 14.

## Reference

- Keymoji task style: `~/Development/Keymoji/tasks/`
- WXT dokumentace: <https://wxt.dev>
- MV3 content scripts: <https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts>
- `MutationObserver` API: <https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver>
- `TreeWalker` API: <https://developer.mozilla.org/en-US/docs/Web/API/Document/createTreeWalker>
- Chrome Web Store policies: <https://developer.chrome.com/docs/webstore/program-policies>
