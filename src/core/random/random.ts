export function hashSeed(seed: string): number {
  let hash = 2166136261 >>> 0
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  hash += hash << 13
  hash ^= hash >>> 7
  hash += hash << 3
  hash ^= hash >>> 17
  hash += hash << 5
  return hash >>> 0 || 0x9e3779b9
}

export function nextRandom(current: number): { value: number; state: number } {
  const state = (current + 0x6d2b79f5) >>> 0
  let mixed = state
  mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
  return { value: ((mixed ^ (mixed >>> 14)) >>> 0) / 0x100000000, state }
}
