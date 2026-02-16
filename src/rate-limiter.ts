/**
 * Queue-based rate limiter for Linear API.
 * Linear allows 5000 req/hr (~83/min). We cap at 80/min for safety.
 */

const MAX_REQUESTS_PER_MINUTE = 80;
const WINDOW_MS = 60_000;

const timestamps: number[] = [];
const queue: Array<{ resolve: () => void }> = [];
let drainTimer: ReturnType<typeof setTimeout> | null = null;

function drainQueue(): void {
  while (queue.length > 0) {
    const now = Date.now();
    // Remove timestamps older than the window
    while (timestamps.length > 0 && timestamps[0]! < now - WINDOW_MS) {
      timestamps.shift();
    }
    if (timestamps.length >= MAX_REQUESTS_PER_MINUTE) {
      // Schedule retry when the oldest timestamp expires
      const waitMs = timestamps[0]! + WINDOW_MS - now + 10;
      drainTimer = setTimeout(drainQueue, waitMs);
      return;
    }
    const entry = queue.shift()!;
    timestamps.push(now);
    entry.resolve();
  }
  drainTimer = null;
}

export async function rateLimited<T>(fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  // Remove expired timestamps
  while (timestamps.length > 0 && timestamps[0]! < now - WINDOW_MS) {
    timestamps.shift();
  }

  if (timestamps.length < MAX_REQUESTS_PER_MINUTE) {
    timestamps.push(now);
    return fn();
  }

  // Queue the request
  await new Promise<void>((resolve) => {
    queue.push({ resolve });
    if (!drainTimer) {
      const waitMs = timestamps[0]! + WINDOW_MS - now + 10;
      drainTimer = setTimeout(drainQueue, waitMs);
    }
  });

  return fn();
}

export function getRateLimiterStats(): { pending: number; used: number; limit: number } {
  const now = Date.now();
  while (timestamps.length > 0 && timestamps[0]! < now - WINDOW_MS) {
    timestamps.shift();
  }
  return {
    pending: queue.length,
    used: timestamps.length,
    limit: MAX_REQUESTS_PER_MINUTE,
  };
}
