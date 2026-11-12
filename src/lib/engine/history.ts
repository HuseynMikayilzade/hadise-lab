/**
 * Yaddaşı məhdud yaxınlaşma tarixçəsi: ən çox `capacity` nöqtə saxlanılır.
 * Dolduqda hər ikinci nöqtə atılır və addım (stride) ikiqat artır - bütün n diapazonu əhatə olunur.
 */
export interface History<P> {
  points: P[];
  stride: number;
  counter: number;
  capacity: number;
}

export function createHistory<P>(capacity = 500): History<P> {
  return { points: [], stride: 1, counter: 0, capacity };
}

export function recordHistory<P>(history: History<P>, point: P): void {
  history.counter += 1;
  if (history.counter % history.stride !== 0) return;
  history.points.push(point);
  if (history.points.length >= history.capacity) {
    history.points = history.points.filter((_, i) => i % 2 === 1);
    history.stride *= 2;
  }
}
