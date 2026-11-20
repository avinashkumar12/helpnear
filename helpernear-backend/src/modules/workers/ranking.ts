export type WorkerSort = 'relevance' | 'distance' | 'rating';

/** Workers inactive for longer than this are hidden from search results. */
export const STALE_HIDE_DAYS = 30;

export function staleCutoff(): Date {
  return new Date(Date.now() - STALE_HIDE_DAYS * 24 * 60 * 60 * 1000);
}

export function parseSort(value?: string): WorkerSort {
  return value === 'distance' || value === 'rating' ? value : 'relevance';
}

interface Rankable {
  distance: number | null;
  averageRating: number;
  reviewCount: number;
  isVerified: boolean;
  status: string;
  lastActiveAt: Date;
}

/**
 * Relevance score (higher is better). Combines rating, proximity,
 * availability, recent activity and verification.
 */
export function relevanceScore(w: Rankable, radiusKm: number): number {
  // Rating: 0-5, dampened for workers with very few reviews
  const confidence = Math.min(w.reviewCount, 5) / 5;
  const rating = w.averageRating * (0.4 + 0.6 * confidence);

  // Proximity: 0-5 (closer is better); neutral when distance is unknown
  const proximity =
    w.distance == null || radiusKm <= 0
      ? 2.5
      : 5 * Math.max(0, 1 - w.distance / radiusKm);

  const availability = w.status === 'AVAILABLE' ? 2 : 0;
  const hoursIdle = (Date.now() - new Date(w.lastActiveAt).getTime()) / 3_600_000;
  const activity = hoursIdle <= 24 ? 1.5 : hoursIdle <= 24 * 7 ? 0.5 : 0;
  const verified = w.isVerified ? 1 : 0;

  return rating + proximity + availability + activity + verified;
}

export function sortWorkers<T extends Rankable>(
  list: T[],
  sort: WorkerSort,
  radiusKm: number,
): T[] {
  const copy = [...list];
  if (sort === 'distance') {
    return copy.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
  }
  if (sort === 'rating') {
    return copy.sort(
      (a, b) => b.averageRating - a.averageRating || b.reviewCount - a.reviewCount,
    );
  }
  return copy.sort((a, b) => relevanceScore(b, radiusKm) - relevanceScore(a, radiusKm));
}
