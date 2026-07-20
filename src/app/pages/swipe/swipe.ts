// // ─────────────────────────────────────────────────────────────
// // anime-swipe.component.ts
// //
// // SYSTÈME DE POINTS :
// //   Like   → +2 pts par genre de l'animé
// //   Dislike → -1 pt par genre
// //   Unseen  → neutre
// //
// // RECOMMANDATIONS :
// //   Seuil : dès que la somme des points dépasse RECO_THRESHOLD
// //   → on cherche les animés les plus populaires des top-3 genres
// //   → on exclut les animés déjà vus + ceux déjà recommandés
// //   → affichage d'une liste de 3 animés
// //   → après fermeture, le seuil est relevé (évite les répétitions)
// // ─────────────────────────────────────────────────────────────
// import {
//   Component,
//   OnInit,
//   OnDestroy,
//   inject,
//   signal,
//   computed,
//   ChangeDetectionStrategy,
//   ElementRef,
//   ViewChild,
//   NgZone,
// } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { RouterModule } from '@angular/router';
// import { TenraiService } from '../../services/tenrai.service';
// import { StorageService } from '../../services/storage.service';
// import { Anime } from '../../models/anime.model';
// import { SwipeDecision } from '../../models/user.model';

// // ── Constantes ────────────────────────────────────────────────
// const RECO_THRESHOLD = 10; // pts totaux avant déclenchement d'une reco
// const RECO_COUNT = 3; // nb d'animés recommandés
// const RECO_FETCH = 12; // nb d'animés fetched pour filtrage
// const BATCH_SIZE = 10; // animés chargés par lot
// const SWIPE_MIN_DIST = 80; // px min pour valider un swipe (CSS scroll)
// const POINTS_LIKE = 2;
// const POINTS_DISLIKE = -1;

// interface GenreScore {
//   id: number;
//   name: string;
//   points: number;
// }
// interface SwipeSession {
//   genreScores: Map<number, GenreScore>;
//   totalPoints: number;
//   nextRecoAt: number; // seuil pour la prochaine recommandation
//   shownAnimeIds: Set<number>;
//   shownRecoIds: Set<number>;
// }

// @Component({
//   selector: 'app-swipe',
//   standalone: true,
//   imports: [CommonModule, RouterModule],
//   templateUrl: './swipe.html',
//   styleUrl: './swipe.scss',
//   changeDetection: ChangeDetectionStrategy.OnPush,
// })
// export class AnimeSwipeComponent implements OnInit, OnDestroy {
//   private tenrai = inject(TenraiService);
//   private storage = inject(StorageService);
//   private ngZone = inject(NgZone);

//   // ── State signals ─────────────────────────────────────────
//   readonly queue = signal<Anime[]>([]); // animés en attente
//   readonly currentAnime = signal<Anime | null>(null);
//   readonly isLoading = signal(true);
//   readonly isFetching = signal(false); // chargement silencieux
//   readonly error = signal<string | null>(null);
//   readonly decision = signal<SwipeDecision | null>(null); // animation en cours
//   readonly showReco = signal(false);
//   readonly recoList = signal<Anime[]>([]);
//   readonly isLoadingReco = signal(false);
//   readonly swipeCount = signal(0);

//   // ── Session locale (points genres) ────────────────────────
//   private session: SwipeSession = {
//     genreScores: new Map(),
//     totalPoints: 0,
//     nextRecoAt: RECO_THRESHOLD,
//     shownAnimeIds: new Set(),
//     shownRecoIds: new Set(),
//   };

//   // ── Refs pour swipe tactile ────────────────────────────────
//   @ViewChild('swipeContainer') swipeContainerRef!: ElementRef<HTMLDivElement>;

//   // Suivi du pointer (fallback PC + mobile unifiés)
//   private pointerStart = { x: 0, y: 0 };
//   private isDragging = false;
//   private currentDrag = 0; // px courant du drag
//   private animationId = 0;

//   private destroyFns: Array<() => void> = [];

//   // ── Computed ──────────────────────────────────────────────
//   readonly topGenres = computed((): GenreScore[] =>
//     [...this.session.genreScores.values()]
//       .filter((g) => g.points > 0)
//       .sort((a, b) => b.points - a.points)
//       .slice(0, 3),
//   );

//   // ─────────────────────────────────────────────────────────
//   // LIFECYCLE
//   // ─────────────────────────────────────────────────────────
//   ngOnInit(): void {
//     this.loadBatch();
//   }

//   ngOnDestroy(): void {
//     this.destroyFns.forEach((fn) => fn());
//     cancelAnimationFrame(this.animationId);
//   }

//   // ─────────────────────────────────────────────────────────
//   // CHARGEMENT DES ANIMÉS
//   // ─────────────────────────────────────────────────────────
//   private loadBatch(page = 1): void {
//     if (this.isFetching()) return;
//     this.isFetching.set(true);

//     // Priorité : si on a des genres likés → getByGenres ; sinon top airing
//     const topIds = this.topGenres().map((g) => g.id);
//     const fetch$ =
//       topIds.length >= 1
//         ? this.tenrai.getByGenres(topIds.slice(0, 2), page, BATCH_SIZE)
//         : this.tenrai.getTopAiring(page, BATCH_SIZE);

//     fetch$.subscribe({
//       next: (res) => {
//         const fresh = res.data.filter(
//           (a) =>
//             !this.session.shownAnimeIds.has(a.mal_id) && !this.storage.swipedIds().has(a.mal_id),
//         );
//         this.queue.update((q) => [...q, ...fresh]);
//         fresh.forEach((a) => this.session.shownAnimeIds.add(a.mal_id));

//         if (!this.currentAnime()) this.advance();
//         this.isLoading.set(false);
//         this.isFetching.set(false);
//       },
//       error: () => {
//         this.error.set('Impossible de charger les animés. Réessaie plus tard.');
//         this.isLoading.set(false);
//         this.isFetching.set(false);
//       },
//     });
//   }

//   private advance(): void {
//     const [next, ...rest] = this.queue();
//     this.currentAnime.set(next ?? null);
//     this.queue.set(rest);
//     // Précharger quand la file est presque vide
//     if (rest.length < 3) this.loadBatch(Math.ceil(this.swipeCount() / BATCH_SIZE) + 1);
//   }

//   // ─────────────────────────────────────────────────────────
//   // DÉCISIONS SWIPE
//   // ─────────────────────────────────────────────────────────
//   decide(d: SwipeDecision): void {
//     const anime = this.currentAnime();
//     if (!anime || this.decision() !== null) return;

//     this.decision.set(d);
//     this.updateGenreScores(anime, d);
//     this.swipeCount.update((n) => n + 1);

//     // Persister dans StorageService
//     this.storage.recordSwipe({
//       animeId: anime.mal_id,
//       animeTitleEn: this.tenrai.getDisplayTitle(anime),
//       decision: d,
//       genreIds: anime.genres.map((g) => g.mal_id),
//     });

//     // Attendre l'animation avant de passer au suivant
//     setTimeout(() => {
//       this.decision.set(null);
//       this.resetCardPosition();
//       this.advance();
//       this.checkRecoTrigger();
//     }, 400);
//   }

//   private updateGenreScores(anime: Anime, d: SwipeDecision): void {
//     if (d === 'unseen') return;
//     const delta = d === 'like' ? POINTS_LIKE : POINTS_DISLIKE;

//     for (const genre of anime.genres) {
//       const existing = this.session.genreScores.get(genre.mal_id);
//       if (existing) {
//         existing.points += delta;
//       } else {
//         this.session.genreScores.set(genre.mal_id, {
//           id: genre.mal_id,
//           name: genre.name,
//           points: delta,
//         });
//       }
//     }

//     // Recalcul total (seulement les positifs)
//     this.session.totalPoints = [...this.session.genreScores.values()].reduce(
//       (sum, g) => sum + Math.max(0, g.points),
//       0,
//     );
//   }

//   // ─────────────────────────────────────────────────────────
//   // RECOMMANDATIONS
//   // ─────────────────────────────────────────────────────────
//   private checkRecoTrigger(): void {
//     if (this.session.totalPoints >= this.session.nextRecoAt && this.topGenres().length > 0) {
//       this.triggerReco();
//     }
//   }

//   private triggerReco(): void {
//     this.showReco.set(true);
//     this.isLoadingReco.set(true);
//     const genreIds = this.topGenres().map((g) => g.id);

//     this.tenrai.getByGenres(genreIds, 1, RECO_FETCH).subscribe({
//       next: (res) => {
//         const filtered = res.data.filter(
//           (a) =>
//             !this.session.shownAnimeIds.has(a.mal_id) &&
//             !this.session.shownRecoIds.has(a.mal_id) &&
//             !this.storage.swipedIds().has(a.mal_id),
//         );

//         // Tri par score descendant + prendre les 3 meilleurs
//         const top3 = filtered.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, RECO_COUNT);

//         top3.forEach((a) => this.session.shownRecoIds.add(a.mal_id));
//         this.recoList.set(top3);
//         this.isLoadingReco.set(false);

//         // Relever le prochain seuil (+RECO_THRESHOLD) pour varier les déclenchements
//         this.session.nextRecoAt += RECO_THRESHOLD;
//       },
//       error: () => this.isLoadingReco.set(false),
//     });
//   }

//   closeReco(): void {
//     this.showReco.set(false);
//     this.recoList.set([]);
//   }

//   // ─────────────────────────────────────────────────────────
//   // ANIMATION DRAG (Pointer Events — desktop + mobile unifié)
//   // Inspiré de la technique scroll-snap du dev.to article mais
//   // adapté en pointer events pour Angular (pas d'ontouchend HTML)
//   // ─────────────────────────────────────────────────────────
//   onPointerDown(e: PointerEvent): void {
//     if (this.decision() !== null) return;
//     this.isDragging = true;
//     this.pointerStart = { x: e.clientX, y: e.clientY };
//     this.currentDrag = 0;
//     (e.target as HTMLElement).setPointerCapture(e.pointerId);
//   }

//   onPointerMove(e: PointerEvent): void {
//     if (!this.isDragging) return;
//     const dx = e.clientX - this.pointerStart.x;
//     const dy = e.clientY - this.pointerStart.y;
//     // Ignorer si le mouvement est plutôt vertical
//     if (Math.abs(dy) > Math.abs(dx) * 1.5) return;
//     this.currentDrag = dx;
//     this.applyDragTransform(dx);
//   }

//   onPointerUp(e: PointerEvent): void {
//     if (!this.isDragging) return;
//     this.isDragging = false;
//     const dx = this.currentDrag;

//     if (dx > SWIPE_MIN_DIST) this.decide('like');
//     else if (dx < -SWIPE_MIN_DIST) this.decide('dislike');
//     else this.resetCardPosition();

//     this.currentDrag = 0;
//   }

//   private applyDragTransform(dx: number): void {
//     const el = this.getCardEl();
//     if (!el) return;
//     const rotate = dx * 0.06;
//     el.style.transform = `translateX(${dx}px) rotate(${rotate}deg)`;
//     el.style.transition = 'none';

//     // Indicateurs de feedback
//     const like = el.querySelector('.swipe-card__like') as HTMLElement;
//     const dislike = el.querySelector('.swipe-card__dislike') as HTMLElement;
//     if (like) like.style.opacity = String(Math.min(1, dx / SWIPE_MIN_DIST));
//     if (dislike) dislike.style.opacity = String(Math.min(1, -dx / SWIPE_MIN_DIST));
//   }

//   private resetCardPosition(): void {
//     const el = this.getCardEl();
//     if (!el) return;
//     el.style.transform = '';
//     el.style.transition = '';
//     const like = el.querySelector('.swipe-card__like') as HTMLElement;
//     const dislike = el.querySelector('.swipe-card__dislike') as HTMLElement;
//     if (like) like.style.opacity = '0';
//     if (dislike) dislike.style.opacity = '0';
//   }

//   private getCardEl(): HTMLElement | null {
//     return document.querySelector('.swipe-card') as HTMLElement | null;
//   }

//   // ─────────────────────────────────────────────────────────
//   // UTILS template
//   // ─────────────────────────────────────────────────────────
//   cover(a: Anime) {
//     return this.tenrai.getCoverUrl(a);
//   }
//   title(a: Anime) {
//     return this.tenrai.getDisplayTitle(a);
//   }
//   genres(a: Anime) {
//     return a.genres
//       .slice(0, 4)
//       .map((g) => g.name)
//       .join(', ');
//   }

//   onImgError(e: Event): void {
//     (e.target as HTMLImageElement).src = 'assets/img/placeholder.webp';
//   }

//   trackById(_: number, a: Anime) {
//     return a.mal_id;
//   }
// }
