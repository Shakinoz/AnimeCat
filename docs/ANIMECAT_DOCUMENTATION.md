# AnimeCat — Documentation technique

## Vue d'ensemble

AnimeCat est une application Angular standalone (components standalone) qui consomme l'API Tenrai (miroir Jikan v4) pour afficher et gérer une collection d'animes. Le projet contient :

- Pages principales : `Home`, `Catalogue`, `Detail`, `Swipe`, `Profil`, `Sign`, `Login`.
- Composants réutilisables : `Header`, `Searchbar`, `AnimeCard`, `Button`, `FormInput`, `NotificationToast`.
- Services : `TenraiService` (accès API), `StorageService` (LocalStorage + auth + swipe scores), `NotificationService` (toasts).
- Modèles/interfaces centralisés dans `src/app/models`.

---

## Structure des dossiers

- `src/app/pages/` : pages (routées) de l'application.
- `src/app/components/` : composants réutilisables (standalone).
- `src/app/services/` : services singleton injectables.
- `src/app/models/` : interfaces et types partagés.
- `src/assets/` : images et ressources statiques.

---

## Pages (résumé et comment modifier)

### `Home` (src/app/pages/home)

- Récupère plusieurs listes (top, saison actuelle, populaires) via `TenraiService`.
- Utilise `AnimeCard` pour afficher chaque carte.
- Pour changer la source des données, modifiez les appels à `TenraiService` (méthodes `getTopAiring`, `getMostPopular`, `getCurrentSeason`).

### `Catalogue` (src/app/pages/catalogue-page)

- Page de recherche et filtres.
- Les filtres et la pagination construisent un objet `SearchParams` envoyé à `TenraiService.searchAdvanced()`.
- `applyLocalFilters()` trie localement la liste reçue; si vous voulez tri côté serveur, modifiez `searchAdvanced` pour accepter d'autres paramètres.
- UI : la sidebar contient des groupes de filtres — si vous réutilisez ces blocs ailleurs, envisagez de créer un composant `FilterGroup`.

### `Detail` (src/app/pages/detail-page)

- Affiche la fiche complète d'un animé en appelant `TenraiService.getById(id)`.
- Gère les sections personnages, recommandations via `getCharacters` et `getRecommendations`.

### `Swipe` (src/app/pages/swipe)

- Interface de découverte par gestures (like/dislike/skip + undo).
- Logique principale :
  - `like` : `StorageService.updateAnimeStatus(mal_id, 'plan_to_watch')` + `StorageService.applyGenreDeltas(...)`.
  - `dislike` : `StorageService.addRejected(mal_id)` + `StorageService.applyGenreDeltas(...)` (négatif).
  - `skip` : neutre.
  - `undo` : inverse le dernier delta et restaure l'état antérieur.
- Les scores de genres sont stockés dans LocalStorage sous la clé `anime-cat-genre-scores`.

### `Profil`, `Sign`, `Login`

- `StorageService` gère l'auth local (LocalStorage). Voir `register`, `login`, `logout`.
- Les pages utilisent ces méthodes pour modifier le `currentUser` dans LocalStorage.

---

## Composants (détails)

### `Header` (src/app/components/header)

- Contient le logo, la barre de recherche (`Searchbar`) et les liens de navigation.
- `handleLogout()` utilise `StorageService.logout()` et affiche une notification via `NotificationService.show()`.

### `Searchbar` (src/app/components/searchbar)

- Utilise un `FormControl` et `valueChanges` pour faire des recherches live via `TenraiService.searchByName()`.
- Implémente `debounceTime`, `distinctUntilChanged` et `switchMap` pour limiter les requêtes.
- Le résultat est affiché dans un autocomplete et la sélection navigue vers la page `Detail`.

### `AnimeCard` (src/app/components/anime-card)

- Composant autonome affichant la vignette, le titre, genres et actions (bookmark, seen).
- Utilise `TenraiService.getCoverUrl()` et `getGenresLabel()` pour centraliser l'affichage.
- `toggleStatus` met à jour le statut via `StorageService` et notifie via `NotificationService`.

### `AnimeActions` (src/app/components/anime-actions)

- Petit composant réutilisable pour les actions présentes sur une carte (`Plan to watch`, `Seen`).
- Vérifie l'authenticité via `StorageService.isAuthenticated()` et utilise `StorageService.updateAnimeStatus()` / `removeAnime()` pour appliquer les changements.

### `SelectFilter` (src/app/components/select-filter)

- Composant générique léger pour remplacer les `<select>` récurrents dans la sidebar.
- Expose `@Input() options`, `@Input() value` et `@Output() valueChange`.

### `FilterGroup` (src/app/components/filter-group)

- Wrapper structurel pour regrouper un label et un contrôle de filtre (input/select/list).

### `GenreCheckboxList` (src/app/components/genre-checkbox-list)

- Liste des genres sous forme de cases à cocher, émet `selectedChange`.

### `PaginationControls` (src/app/components/pagination-controls)

- Contrôles Précédent / Suivant réutilisables. Émet `prev` / `next`.

### `Button`, `FormInput`, `NotificationToast`

- Petits composants UI réutilisables. `NotificationToast` lit `NotificationService.visible/message`.

---

## Services (détails et bonnes pratiques)

### `TenraiService` (src/app/services/tenrai.service.ts)

- Centralise tous les appels HTTP vers l'API.
- Méthodes principales : `getTopAiring`, `getMostPopular`, `getTopScore`, `getCurrentSeason`, `getSeason`, `searchByName`, `searchAdvanced`, `getById`, `getCharacters`, `getRecommendations`, `getByGenres`, `getRandom`.
- Normalise les réponses via `normalizeList()` et `extractData()`.
- Toutes les méthodes de liste possèdent un `catchError()` renvoyant un `AnimeListResult` vide pour éviter de casser l'app en cas d'erreur réseau.
- `buildParams()` filtre proprement les valeurs undefined/null/'' avant de construire `HttpParams`.

Conseil : si vous voulez tester sans réseau, mockez `TenraiService` dans vos tests et renvoyez des observables statiques.

### `StorageService` (src/app/services/storage.service.ts)

- Gère la persistance en LocalStorage et la synchronisation cross-onglets (patch sur `Storage.prototype`).
- Méthodes utiles :
  - `updateAnimeStatus`, `removeAnime`, `getAnimeStatus`
  - `getGenreScores`, `applyGenreDeltas` — pour le système Swipe
  - `addRejected`, `removeRejected`, `getRejected`
  - `register`, `login`, `logout`
- Émet `animeStatusChanged$` quand des changements importants surviennent pour permettre aux composants de se rafraîchir.

#### Clés LocalStorage utiles

- `anime-cat-users` : comptes enregistrés
- `anime-cat-current-user` : utilisateur courant (JSON)
- `anime-cat-genre-scores` : map `{ genreId: score }` utilisée par le Swipe
- `anime-cat-rejected` : liste d'IDs rejetés dans le Swipe

### `NotificationService` (src/app/services/notification.service.ts)

- Implémente un toast global via des `signal`s. Utilisez `show(message, isError?, isSuccess?)`.

---

## Modèles / Interfaces

- `user.interface.ts` : `IUser`, `AuthUser`, `AuthResult`.
- `user-anime.interface.ts` : `AnimeStatus`, `IUserAnime`, `ITierList`, `HomeAnime`.
- `anime-list.interface.ts` : `AnimeListResult`, `GenreScoreMap`.
- `search-param.interface.ts` : `SearchParams` (utilisé par `TenraiService.searchAdvanced`).

---

## Bonnes pratiques et recommandations (pour la soutenance TFE)

- Centralisez la logique de transformation d'objets API dans `TenraiService` (`getCoverUrl`, `getDisplayTitle`, `getGenresLabel`) : évite les répétitions.
- Préférez des observables/`signals` pour les états partagés et les composants `standalone` pour faciliter la réutilisabilité.
- Gardez `StorageService` comme unique source de vérité pour l'état local persisté (anime list, genre scores).
- Ajoutez des tests unitaires pour `StorageService` et `TenraiService` en mockant `HttpClient`.

---

## Générer un PDF de la documentation

### Option 1 — Pandoc (recommandée si installée)

```bash
pandoc docs/ANIMECAT_DOCUMENTATION.md -o docs/ANIMECAT_DOCUMENTATION.pdf --pdf-engine=xelatex
```

### Option 2 — Node + package (si vous préférez tout faire avec npm)

Installer une dépendance (exécuté localement par vous) :

```bash
npm install --save-dev markdown-pdf
npx markdown-pdf docs/ANIMECAT_DOCUMENTATION.md -o docs/ANIMECAT_DOCUMENTATION.pdf
```

Remarque : la conversion PDF requiert un outil externe (Pandoc, wkhtmltopdf, ou un package npm) non inclus par défaut dans ce dépôt. Je peux ajouter un script Node pour générer le PDF si vous voulez que j'essaie l'installation ici.

---

## Comment je peux continuer (suggestions)

- Générer automatiquement la documentation PDF (je peux tenter d'installer un convertisseur et générer le PDF ici si vous me l'autorisez).
- Factoriser les blocs UI récurrents (pagination, filtres) en composants réutilisables.
- Ajouter tests unitaires pour `StorageService` et `TenraiService`.
- Ajouter animations/gestes pour `Swipe` (drag/throw) avec `@use-gesture` ou une implémentation native.

---

Si vous voulez que je génère le PDF maintenant dans cet environnement, dites-moi et j'installerai le convertisseur (pandoc ou un package npm) et je lancerai la conversion.
