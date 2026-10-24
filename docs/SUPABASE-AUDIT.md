# VANTRA — audit Supabase, 21. 10. 2026

> Historický stav pred opravami. Aktuálny audit a aplikované zmeny sú v [SECURITY-AUDIT-2026-10-22.md](SECURITY-AUDIT-2026-10-22.md). Nasledujúce počty a nálezy opisujú 21. október, nie súčasný stav.

Audit bol iba na čítanie. Kontrolované boli reálne katalógy databázy, RLS, granty, indexy, obmedzenia, definície funkcií a triggerov, nastavenia Storage, agregované počty a aplikácia. Žiadne cloudové pravidlo, účet ani súbor sa pri audite nemenili. Nešlo o záťažový test ani test cudzieho účtu.

## Reálny stav

| Oblasť | Stav |
|---|---|
| Databáza vrátane interných schém | 11 553 939 bajtov, približne 11,0 MiB |
| Štyri verejné aplikačné tabuľky vrátane indexov | 196 608 bajtov, 192 KiB |
| Používatelia / profily / whitelist | 1 / 1 / 1 |
| Watchlist / história | 3 / 4 záznamy |
| Záznamy bez user_id alebo media_type v týchto dvoch tabuľkách | 0 |
| Storage avatars | 2 súbory, spolu 107 321 bajtov podľa metadát |
| Vlastníctvo avatarov | 1 súbor má platného vlastníka, 1 nemá owner_id |

Kapacita databázy teraz nie je problém. Aktuálne dokumentovaný Free limit databázy je 500 MB. Z pg_database_size však nemožno odvodiť kompletnú fakturáciu, mesačný egress alebo deň resetu kvót. Tieto údaje sa musia čítať z Usage/Billing organizácie, nie odhadnúť z počtu používateľov.

## Čo je dobre

- Všetky štyri aplikačné tabuľky majú zapnuté RLS. Watchlist, história a profil majú podmienku vlastníctva. Whitelist má blokujúcu politiku.
- Primárne kľúče, cudzie kľúče a ON DELETE CASCADE sú konzistentné: auth.users → profiles → watchlist/history.
- Unikátny index `(user_id, tmdb_id, media_type)` bráni duplikátom a pomáha pri kontrole položky používateľa. Ďalší samostatný index user_id by teraz zbytočne duplikoval jeho ľavý prefix.
- Povolené typy movie/tv/anime kontroluje CHECK. Samotný CHECK však nezakazuje NULL.
- TMDB katalóg sa načítava mimo Supabase a server ho cachuje na hodinu. V databáze sa neskladujú videá ani celý filmový katalóg.

## Opravy podľa priority

**1. Avatary — najdôležitejšia konkrétna chyba.** INSERT/UPDATE/DELETE kontrolujú iba bucket avatars. Každý prihlásený používateľ tak podľa politík môže zasiahnuť do cudzieho súboru. SELECT povoľuje aj verejné listovanie metadát. Oprava má porovnávať `owner_id` s prihláseným používateľom a nové súbory umiestňovať do jeho UUID priečinka. Verejné URL obrázkov môžu zostať funkčné. Jeden existujúci súbor bez vlastníka treba osobitne identifikovať; audit ho neprivlastnil ani nezmazal.

**2. Nahrávanie a spotreba Storage.** Bucket nemá vlastný limit veľkosti ani zoznam MIME typov; naďalej môže platiť globálny limit projektu. Návrh nastavuje bucket na JPEG/PNG/WebP do 2 MiB. V lokálnej aplikácii sa obrázok zmenší na maximálne 512 px a skonvertuje na WebP. Nový súbor sa uloží, aktualizuje sa profil a až potom sa odstráni predchádzajúci vlastný súbor. Pri nejasnej chybe uloženia profilu zostanú oba obrázky, aby oneskorená úspešná odpoveď nevytvorila odkaz na zmazaný súbor. Takéto zriedkavé zvyšné súbory možno neskôr bezpečne čistiť po overení referencií.

**3. Interné prihlasovacie funkcie.** check_email_whitelist a handle_new_user sú existujúce SECURITY DEFINER triggery bez pevného search_path. Návrh používa prázdny search_path a úplné názvy tabuliek/funkcií. Zachováva ich potrebné privilégiá pre trigger, ale odoberá priame EXECUTE rolám PUBLIC/anon/authenticated. To isté odobratie EXECUTE patrí rls_auto_enable, ktorý už má pevný search_path. Triggerové funkcie nie sú bežné RPC a nemožno automaticky tvrdiť, že sa ich telo dá úspešne spustiť obyčajným HTTP volaním; varovania si napriek tomu zaslúžia opravu.

**4. Nadbytočné granty a integrita.** Klientske roly majú aj TRUNCATE/REFERENCES/TRIGGER a authenticated granty na whitelist. Blokujúce RLS dnes whitelist chráni, granty však netreba. RLS nepokrýva TRUNCATE; Data API pritom bežne nevystavuje ľubovoľný SQL/TRUNCATE príkaz. Návrh ponechá len potrebné CRUD práva, pri profiles len SELECT/UPDATE. Doplnenie NOT NULL pre user_id/media_type spevní integritu bez mazania dát; kontrolované existujúce riadky sú v poriadku.

**5. Whitelist má presný účel.** BEFORE INSERT trigger blokuje registráciu nového nepovoleného emailu. Odstránenie emailu z whitelistu samo osebe nezruší existujúci účet alebo jeho relácie. Pri odoberaní prístupu treba riešiť účet a relácie, nie spoliehať sa na tento registračný trigger. Porovnanie emailov je teraz presné a rozlišuje veľkosť písmen; normalizáciu treba zaviesť spolu s kontrolou existujúcich hodnôt.

Advisor pôvodne ukazoval 0 errors / 10 warnings: dve search_path, šesť EXECUTE, verejné listovanie a ochranu pred uniknutými heslami. V tomto read-only kroku zostávajú nezmenené. Dostupnosť ochrany hesiel pre konkrétny plán treba overiť pred zmenou nastavenia.

## Efektivita pre Free plán

Teraz by pridávanie indexov na každú kolónku výkon nezlepšilo. Pri raste knižnice najprv stránkovať watchlist/históriu, vyberať konkrétne stĺpce a používať stabilné poradie s id. Potom zmerať dopyty a podľa potreby pridať `(user_id, added_at DESC, id DESC)` a `(user_id, last_watched DESC, id DESC)`. Súčasný profil načítava celé dva zoznamy naraz; pri 3/4 riadkoch je to lacné, pri tisícoch bude vhodná zmena. Štatistiky tabuľiek sa môžu resetovať a ich n_live_tup nie je presný počet.

História má zámerne jeden riadok na titul. Nevie evidovať všetky pozreté epizódy. Pre budúci overhaul patrí stav epizód do samostatnej tabuľky s unikátnym kľúčom používateľ/provider/titul/sezóna/epizóda; anime identita musí naďalej rozlišovať AniList a MAL. Hodnotenia, poznámky a priečinky pridať až s hotovou funkciou. Titulky a video dáta neukladať do Postgresu, priebeh prehrávania nezapisovať každú sekundu a nezapínať nepotrebný Realtime.

## Pripravený ďalší krok

Súbor SUPABASE-HARDENING-REVIEW.sql obsahuje konkrétny návrh s predvoleným ROLLBACK. Nie je aplikovaný, nie je migráciou a nebol vykonaný na izolovanej databáze. Pred nasadením treba otestovať whitelisted/nepovolenú registráciu, existujúce prihlásenie, vlastné CRUD a zamietnutie cudzieho účtu, nové avatary aj starý vlastný avatar, verejný download a zamietnuté listovanie/veľké súbory. Následne znovu skontrolovať Advisor a zachytiť overený stav migráciou.

## Lokálne overenie aplikácie

Pribudla samostatná autentifikovaná stránka /preview. Zachováva aktuálne populárny obsah, používa reálne TMDB dáta a odkazuje na existujúce detaily. Obsahuje prepínač hero titulu, filtre, posuvné kolekcie, vyhľadávanie, mobilnú navigáciu, hover/focus efekty a reduced-motion podporu. Pôvodná /home ostala dostupná. Anime má rovnaké miesto v navigácii; funkčný nový anime katalóg ani vlastný prehrávač sa týmto náhľadom nepredstierajú. AniList bol pri predchádzajúcom overení dočasne vypnutý.

Lokálna oprava avatarov a profilu pridáva kontrolu výsledku zápisov. Testy pokrývajú zlyhanie uploadu/uloženia a poradie bezpečného čistenia. Cloudový upload ani registráciu audítor nespúšťal. Celý overhaul ďalších stránok ešte nie je hotový.

## Zdroje

- [Vlastníctvo súborov](https://supabase.com/docs/guides/storage/security/ownership)
- [Storage RLS a upsert](https://supabase.com/docs/guides/storage/security/access-control)
- [Limity súborov](https://supabase.com/docs/guides/storage/uploads/file-limits)
- [Veľkosť databázy a disk](https://supabase.com/docs/guides/platform/database-size)
- [PostgreSQL CREATE POLICY](https://www.postgresql.org/docs/current/sql-createpolicy.html) — pri ALL/UPDATE sa chýbajúce WITH CHECK dedí z USING; profil teda nebol označený ako otvorený iba pre chýbajúci explicitný WITH CHECK.
