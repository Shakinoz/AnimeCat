# AnimeCat

AnimeCat est une application Angular moderne dédiée à la découverte, la gestion et la recommandation d’animes. Le projet combine une interface riche, des composants standalone, un système de swipe, une authentification locale et un stockage persistant pour offrir une expérience fluide et démonstrative.

## Fonctionnalités principales

- exploration d’animes via une interface catalogue et une page détail,
- navigation fluide avec un header responsive,
- système de swipe pour noter et recommander des animes,
- gestion locale du profil utilisateur et de l’état des animes,
- architecture Angular moderne avec composants standalone et signaux.

## Stack technique

- Angular 21
- Angular Material
- RxJS
- TypeScript
- SCSS
- LocalStorage pour la persistance locale

## Installation

```bash
npm install
```

## Lancer l’application

```bash
npm start
```

Puis ouvrir l’URL suivante dans le navigateur :

```text
http://localhost:4200/
```

## Construire le projet

```bash
npm run build
```

## Tests

```bash
npm test
```

## Structure du projet

- src/app/components : composants UI réutilisables
- src/app/pages : pages principales de l’application
- src/app/services : logique métier et accès aux données
- src/app/models : interfaces et types partagés
- docs : documentation technique du projet
