# VANTRA — bezpečnosť a efektivita, 22. 10. 2026

Opravy uvedené nižšie sú aplikované na Supabase projekte VANTRA. Kontrola zahŕňala schému, RLS, granty, indexy, triggery, Storage, agregované chyby a dotazy aplikácie. Existujúce účty, heslá, súbory ani používateľské záznamy sa nemenili. Nešlo o penetračný ani záťažový test.

## Výsledok kontrol Supabase

| Advisor | Pred opravou | Po oprave |
|---|---:|---:|
| Bezpečnostné nálezy | 9 | 1 |
| Výkonnostné nálezy | 3 | 0 |

Zostáva **Leaked Password Protection Disabled**. Kontrola hesiel voči únikom je podľa [dokumentácie Supabase](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) dostupná na Pro a vyšších plánoch. Free plán sa nemenil. Nulový počet ostatných nálezov nie je zárukou absencie všetkých zraniteľností.

## Aplikované databázové a Storage opravy

| Oblasť | Nález a oprava |
|---|---|
| Avatary | Pôvodné pravidlá povoľovali prihlásenému používateľovi meniť cudzie súbory. Čítanie metadát, aktualizácia a mazanie teraz vyžadujú jeho `owner_id`; nové uploady aj prvý priečinok zhodný s UUID používateľa. |
| Uploady | Bucket `avatars` má serverový limit **2 MiB** a povoľuje iba **JPEG, PNG a WebP**. Nastavené cez dashboard Storage, overené aj čítaním konfigurácie. |
| Existujúce avatary | Verejné URL obrázkov zostali funkčné. Vlastník môže odstrániť aj svoj starší súbor v koreňovom priečinku; nový klient už ukladá do UUID priečinka. Jeden starší záznam bez vlastníka s nulovou veľkosťou zostal bez zásahu. |
| Interné funkcie | `check_email_whitelist`, `handle_new_user`, `rls_auto_enable` presunuté z `public` do `private`; klientské roly nemajú prístup do schémy ani EXECUTE. Presun zachoval identity funkcií aj väzby triggerov. |
| Bezpečné vykonanie | Auth triggery používajú plne kvalifikované názvy a prázdny `search_path`. Potrebné SECURITY DEFINER oprávnenie zostalo iba na interné operácie triggerov. |
| Granty | Klienti stratili zbytočné TRUNCATE, REFERENCES, TRIGGER a prístup k whitelistu. Profil povoľuje iba čítanie vlastného riadku a aktualizáciu `display_name`, `avatar_url`; nie zmenu identity alebo e-mailu. |
| RLS | Profil, watchlist a história sú obmedzené na `authenticated` a vlastné UUID. `(select auth.uid())` zabraňuje opakovanej evaluácii identifikačnej funkcie pre každý riadok. |
| Integrita | Watchlist/história majú `user_id`, `media_type` NOT NULL. Profil má databázové limity mena 60 znakov a URL avatara 2048 znakov. Existujúce údaje limity spĺňali. |

Verejný bucket znamená, že držiteľ URL môže obrázok zobraziť; súkromie obrázkov sa tým nesľubuje. [Verejné doručenie](https://supabase.com/docs/guides/storage/buckets/fundamentals) obrázku je oddelené od oprávnenia meniť súbor. Pri reálnych súboroch sa nepoužívali SQL zápisy do `storage.objects`; [Storage operácie patria API](https://supabase.com/docs/guides/storage/schema/design).

## Efektivita aplikácie

- Knižnica pri otvorení načíta stránku s presným počtom a vykoná samostatný HEAD iba pre druhú kolekciu. Pôvodne počítala obe kolekcie zvlášť a potom opäť aktívnu kolekciu v stránkovanom dotaze: 3 požiadavky → 2. Úprava súkromnej recenzie už neprepočítava obe kolekcie; lokálne odstránenie/čistenie aktualizuje príslušný odznak.
- Stránkovanie zostalo na 18 položkách. Výsledný počet filtrovanej kolekcie neprepisuje celkový počet v odznaku karty.
- Vyrovnávacia pamäť katalógu prijíma iba lokálne `/api/tmdb` a `/api/anilist`; odmieta účtové endpointy aj externé URL ešte pred fetchom. Zostáva časovo aj kapacitne obmedzená a zdieľa súbežné požiadavky.
- Z hooku histórie odstránená nepoužívaná funkcia načítavajúca celú históriu bez limitu. História naďalej používa upsert jedného záznamu na titul, nie zápis pri každej sekunde prehrávania.
- Existujúce jedinečné indexy `(user_id, tmdb_id, media_type)` už pokrývajú filtrovanie podľa používateľa. Pri súčasných malých tabuľkách sa nepridávali duplicitné indexy, ktoré by zvyšovali objem a cenu zápisov. Ďalšie indexovanie má vychádzať z reálnych pomalých dotazov pri raste dát.
- Overovanie používateľa zostalo na `auth.getUser()`; serverová autorizácia sa nenahradila dôverou v klienta. Panel mesačnej spotreby zostáva chránený a používa označený manuálny snapshot; tento audit z neho nerobí živý billing monitoring.

## Overenie a jeho hranice

Databázová zmena najprv prešla úplnou skúškou s rollbackom. Rovnaké testy prešli po aplikovaní opráv. Dve syntetické identity bez hesiel sa vytvorili výlučne v transakcii a následne rollbackli; cudzí reálny účet sa nečítal ani nemenil. Následná kontrola potvrdila nula zostávajúcich testovacích účtov a whitelist záznamov.

Overené na skutočných aplikačných tabuľkách s rolami `authenticated`/`anon` a simulovanými JWT claims:

- Vlastný profil: čítanie a povolená úprava fungujú; cudzí profil, zmena e-mailu a príliš dlhé meno sú blokované.
- Vlastná súkromná recenzia: insert, update, delete fungujú; cudzie čítanie/úprava/mazanie, podvrhnutý vlastník a prevod riadku sú blokované.
- História: vlastný upsert aktualizuje jeden titul a vlastné vymazanie funguje; cudzie zásahy sú blokované.
- Neprihlásený používateľ nemá prístup k profilom, recenziám, histórii ani owner usage. Neoprávnený prihlásený účet neuvidí usage snapshot a nevytvorí si ho pre seba.
- Whitelist odmietne nepovolenú syntetickú registráciu a databázový trigger vytvorí profil povoleným identitám. Automatické zapnutie RLS na novej skúšobnej tabuľke funguje; aj táto tabuľka sa rollbackla.
- Presné nasadené pravidlá avatarov boli skopírované na dočasnú RLS tabuľku: vlastné operácie povolené, cudzie súbory/podvrhnuté vlastníctvo/priečinky blokované. Reálne súbory sa pri tejto skúške nemenili.

Toto **nie je** plný HTTP test registrácie cez Auth ani uploadu dvoch používateľských relácií cez Storage. Databázové testy overujú pravidlá a triggery; nenahrádzajú testy celého toku služby. Existujúca prihlásená relácia a zobrazenie avatara boli následne skontrolované v aplikácii.

Lokálna validácia: **51 testov, ESLint a produkčný webpack build úspešné**. Kontrolované boli aj knižnica, profil, katalóg/vyhľadávanie a chránený usage panel v produkčnej aplikácii na localhoste.

## Záznam nasadenia

- [Aplikované SQL](sql/security-hardening.sql) je jednorazový referenčný skript, nie čakajúca CLI migrácia. Na tomto projekte ho znovu nespúšťať. História Supabase CLI migrácií tým nebola spätne prepísaná.
- [Transakčné overenie](sql/security-verification.sql) používa syntetické dáta a explicitný rollback. Spúšťať iba celý súbor naraz na vyhradenej administrátorskej relácii.
- Starý `SUPABASE-HARDENING-REVIEW.sql` je označený ako historický, nespúšťať ho.

Pri budúcich zmenách grantov, RLS alebo schema triggerov zopakovať kontrolu advisorov a izolácie používateľov. Pri rastúcej knižnici sledovať reálne časy stránkovaných a filtrovaných dotazov pred pridávaním indexov.
