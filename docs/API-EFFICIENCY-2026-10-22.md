# VANTRA — API, efektivita a anime, 22. 10. 2026

Zmeny sú hotové v lokálnom projekte a produkčná verzia beží na `http://localhost:3000`. Nenasadzovalo sa na hosting a nemenila sa databázová schéma. Existujúce bezpečnostné pravidlá z predchádzajúceho auditu zostávajú v platnosti.

## Porovnanie pred a po

Percento znamená `(pred − po) / pred × 100`. Riadky opisujú konkrétne scenáre; percentá sa nesčítavajú a nie sú celkovou mesačnou úsporou.

| Čo sa meralo | Pred | Po | Zníženie | Metóda |
|---|---:|---:|---:|---|
| Volania Supabase `/auth/v1/user` pri troch rovnakých autorizovaných API požiadavkách | 9 | 3 | **66,7 %** | Reálne sieťové počítadlo lokálneho produkčného servera, rovnaká prihlásená relácia |
| Detail titulu → prehrávač: requesty na rovnaké metadáta počas platnosti cache | 2 | 1 | **50 %** | Porovnanie pôvodnej a novej implementácie s deterministickým mock fetch |
| Anime návrhy vyhľadávania → plné výsledky: requesty na prvú stranu | 2 | 1 | **50 %** | Rovnaký kontrolovaný test, zjednotené URL/cache kľúče |
| Desať okamžitých pokusov klienta pri 503 s `Retry-After: 15` | 10 | 1 | **90 %** | Kontrolovaná simulácia výpadku |
| Desať postupných externých requestov počas cooldownu poskytovateľa | 10 | 1 | **90 %** | Kontrolovaný test ochrany upstream volaní; bez zaťažovania živej služby |
| Otvorenie knižnice — z predchádzajúcej dokončenej úpravy | 3 | 2 | **33,3 %** | Stránkovaný dotaz s počtom + HEAD iba druhej kolekcie; nejde o novú úsporu tohto kroku |

Reálne sieťové meranie použilo tri GET navigácie na `/api/stream`: film `438631`, TV `438631` S1 E1 a TV `94997` S2 E3. Počítadlá zaznamenávali iba počty volaní podľa služby a cesty, žiadne hlavičky, tokeny ani telá odpovedí. V danom okne sa nemenili ostatné počítadlá služieb. Je to malý test jednej relácie; presný počet môže závisieť aj od obnovovania cookies/session. Na úrovni kódu sa odstránilo jedno z dvoch duplicitných `getUser()` overení každej API požiadavky. Zostáva autoritatívne overenie v každom API handleri, nie dôvera v používateľský header.

## Čo to znamená pre Free plán

- Menej Supabase Auth requestov znamená menej prenášaných odpovedí a práce na overovanie. **Počet mesačne aktívnych používateľov (MAU) sa tým neznižuje.** Jeden človek zostáva jedným aktívnym používateľom.
- Opätovné použitie metadát šetrí requesty na VANTRA API aj ich overovanie používateľa. Serverová hodinová cache externých katalógov už existovala a zostala zachovaná; táto práca si nepripisuje jej pôvodnú úsporu.
- Ochrana počas výpadku zabraňuje opakovanému márnemu volaniu. Bežná úspešná prevádzka nemá automaticky o 90 % nižšiu spotrebu.
- Vyššie rozlíšenie obrázkov a nové anime náhľady môžu zvýšiť obrazový prenos cez TMDB/AniList a image optimizer hostingu. **Nejde o obrázky uložené v Supabase.** Nová anime grafika pridáva na prvé studené otvorenie mapovaného titulu aj cacheované TMDB požiadavky na artwork/sezónu.
- Celkovú mesačnú úsporu egressu, času servera alebo ceny nemožno poctivo určiť z týchto krátkych testov. Závisí od podielu otvorení prehrávača, vyhľadávaní, opakovaných návštev, obnovy session a výpadkov. Usage panel zostáva označený manuálny snapshot; čísla v ňom neboli zmenené na odhadované úspory.

## Aplikované ochrany

1. **Jedno API overenie používateľa.** Proxy ponecháva API handlerom ich vlastnú autentifikáciu a obnovu cookies. Všetky existujúce API handlery vrátane owner usage stále overujú používateľa. API odpovede sú `private, no-store`; verejné CDN cacheovanie relácie sa nezapína.
2. **Validácia pred sieťovými volaniami.** Povolené typy/parametre, maximálna dĺžka vyhľadávania 120 znakov, konečné hranice strán/ID/epizód, zamietnutie duplicitných a neznámych parametrov. Neplatné vstupy vrátia 400 bez Auth/katalógového volania.
3. **Obmedzenie frekvencie mediálnych API.** Token bucket podľa overeného používateľského UUID: počiatočný burst 120, dopĺňanie 2 tokeny za sekundu. Prekročenie vráti 429 a `Retry-After`. Maximálne 4 096 záznamov v pamäti, bez nových databázových zápisov. Nepoužíva neoverený IP header na identitu.
4. **Výpadky externých katalógov.** TMDB má deadline 12 sekúnd, AniList 15 sekúnd. Zdieľané súbežné studené požiadavky, najviac 32 rozpracovaných kľúčov na poskytovateľa v procese, cooldown 1–60 sekúnd podľa typu chyby/`Retry-After`. Neúspech sa neuloží ako úspešné dáta. Odpoveď 503 umožňuje opakovanie po pauze; automatická retry slučka sa nespúšťa.
5. **Klientsky cooldown a cache.** Rešpektuje 429/503 s `Retry-After`; úspešné už uložené stránky zostávajú čitateľné. Spoločný URL builder zjednotil anime návrhy a plné výsledky. Prehrávač aj anime epizódy využívajú existujúcu obmedzenú cache verejných metadát. Profil, relácia a knižnica do nej nepatria.

Pamäťové rate limit/cooldown ochrany sú **lokálne pre bežiacu serverovú inštanciu**, po reštarte sa resetujú. Pri viacerých procesoch/serverless inštanciách nejde o jeden globálny limit. Sú ochranou aplikácie a katalógov, nie náhradou za hostingový firewall/DDoS ochranu. Autentifikácia sa vykoná ešte pred účtovým limitom; ten preto sám neblokuje všetky možné náklady na Auth pri útoku. Pri verejnom nasadení treba nastaviť aj pravidlá na hranici hostingu.

## Anime a kvalita obrázkov

Pribudli logá titulov, kvalitné TMDB pozadia a karty epizód s náhľadom a názvom. AniList zostáva zdrojom hodnotenia, identity a dostupnosti; MAL zostáva ID pre poskytovateľov prehrávania. Používa sa lokálny serverový snapshot 6 961 mapovaní, žiadne vyhľadávanie podľa podobného názvu pri každom otvorení. Podrobnosti a zdroje sú v [ANIME-ARTWORK.md](ANIME-ARTWORK.md).

Overené na skutočných dátach: **Frieren 28/28 priradených náhľadov**, **Attack on Titan 25/25**. Frieren stránka zobrazuje logo, načítané kvalitnejšie pozadie, názvy a obrázky epizód. „Show more episodes“ odhalí všetkých 28 kariet bez ďalšieho katalógového dotazu. Ak chýba presná zhoda/obrázok, náhradná grafika je označená „Series artwork“ alebo „Preview unavailable“; negarantuje sa úplné pokrytie všetkých anime.

## Validácia

**60 testov úspešných**, ESLint bez chýb, produkčný webpack build úspešný. Nové testy pokrývajú vstupy, limity, izoláciu účtových kvót, bounded queue, súbežné requesty, cooldown a zotavenie, zdieľanie metadát aj odmietnutie nesprávneho anime couru/dátumu. Neprihlásené platné požiadavky TMDB/AniList/stream/usage vrátili 401; príliš dlhé vyhľadávanie 400; odpovede zostali `private, no-store`.

Kontrolované v prihlásenej aplikácii: stream URL API, anime detail/logo, dostupné náhľady a rozbalenie epizód. Pri kontrole sa neotváralo video ani nevytvárali nové záznamy histórie. Dočasné sieťové počítadlo bolo po meraní vypnuté; aplikácia beží štandardne.
