export interface StatePoint {
  timestamp: string;
  value?: number;
}

export interface StateSegment {
  start: number;
  end: number;
  state: 'producing' | 'stopped' | 'unknown';
}

export function injectionStateTimeline(
  points: StatePoint[],
  hours: number,
  now: number,
  maxGapMs = 90_000
): StateSegment[] {
  const start = now - hours * 3_600_000;
  const readings = points
    .map((point) => ({ at: Date.parse(point.timestamp), value: point.value }))
    .filter(
      (point): point is { at: number; value: number } =>
        Number.isFinite(point.at) &&
        point.at >= start &&
        point.at <= now &&
        (point.value === 0 || point.value === 1)
    )
    .sort((a, b) => a.at - b.at);
  const segments: StateSegment[] = [];
  const append = (from: number, to: number, state: StateSegment['state']) => {
    if (to <= from) return;
    const previous = segments[segments.length - 1];
    if (previous?.state === state && previous.end === from) previous.end = to;
    else segments.push({ start: from, end: to, state });
  };
  let cursor = start;
  for (let index = 0; index < readings.length; index += 1) {
    const current = readings[index];
    append(cursor, current.at, 'unknown');
    const next = readings[index + 1]?.at ?? now;
    const end = Math.min(next, now, current.at + maxGapMs);
    append(current.at, end, current.value === 1 ? 'producing' : 'stopped');
    cursor = end;
  }
  append(cursor, now, 'unknown');
  return segments;
}
