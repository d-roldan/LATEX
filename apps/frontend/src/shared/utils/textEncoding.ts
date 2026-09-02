const MOJIBAKE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/Ã¢â‚¬â€/g, '-'],
  [/Ã¢â‚¬â€œ/g, '-'],
  [/â€”/g, '-'],
  [/â€“/g, '-'],
  [/â†’/g, '->'],
  [/ÃƒÂ¡/g, 'a'],
  [/ÃƒÂ©/g, 'e'],
  [/ÃƒÂ­/g, 'i'],
  [/ÃƒÂ³/g, 'o'],
  [/ÃƒÂº/g, 'u'],
  [/ÃƒÂ±/g, 'n'],
  [/Ã¡/g, 'a'],
  [/Ã©/g, 'e'],
  [/Ã­/g, 'i'],
  [/Ã³/g, 'o'],
  [/Ãº/g, 'u'],
  [/Ã±/g, 'n'],
  [/Â·/g, '-'],
  [/âž–/g, '-'],
  [/âž•/g, '+'],
  [/âœ…/g, ''],
  [/âœ”/g, ''],
  [/âš ï¸/g, ''],
  [/âšª/g, ''],
  [/â³/g, ''],
  [/â°/g, ''],
  [/â­/g, '*'],
  [/ðŸ”´/g, ''],
  [/ðŸŸ¡/g, ''],
  [/ðŸŸ¢/g, ''],
  [/ðŸ”­/g, ''],
  [/â”€/g, '-']
];

export function repairText(value: string): string {
  return MOJIBAKE_REPLACEMENTS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
}

export function repairTextDeep<T>(value: T): T {
  if (typeof value === 'string') return repairText(value) as T;
  if (Array.isArray(value)) return value.map((item) => repairTextDeep(item)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, repairTextDeep(item)])
    ) as T;
  }
  return value;
}
