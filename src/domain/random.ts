export function hashSeed(seed: string): number {
  let hash = 2166136261 >>> 0
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash || 0x9e3779b9
}

export function nextRandom(current: number): { value: number; state: number } {
  let state = current >>> 0
  state ^= state << 13
  state ^= state >>> 17
  state ^= state << 5
  state >>>= 0
  return { value: state / 0x100000000, state }
}

export function createSeed(): string {
  const stamp = Date.now().toString(36)
  const entropy = Math.random().toString(36).slice(2, 9)
  return `${stamp}-${entropy}`
}
