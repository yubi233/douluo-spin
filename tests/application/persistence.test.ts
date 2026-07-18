import { describe, expect, it } from 'vitest'
import { GameService } from '@/application/gameService'
import { parseSave, serializeSave } from '@/application/persistence'
import { v03Content, v03Policies } from '@/content/v03/content'
import { ContentVersionMismatch } from '@/core/model/errors'

function playedService() {
  const service = new GameService(v03Content, v03Policies)
  service.dispatch({ type: 'run.start', route: 'human', seed: 'save-v03' })
  for (let index = 0; index < 6; index += 1) service.dispatch({ type: 'turn.spin' })
  return service
}

describe('v0.3 event-log persistence', () => {
  it('replays a save to the same state and continues deterministically', () => {
    const original = playedService()
    const restored = new GameService(v03Content, v03Policies)
    const document = parseSave(serializeSave(v03Content.manifest.contentVersion, original.eventLog), v03Content.manifest.contentVersion)
    restored.restore(document.batches)
    expect(restored.state).toEqual(original.state)
    expect(restored.eventLog).toEqual(original.eventLog)
    expect(restored.dispatch({ type: 'turn.spin' })).toEqual(original.dispatch({ type: 'turn.spin' }))
  })

  it('rejects a content-version mismatch without modifying the active service', () => {
    const service = playedService()
    const before = service.state
    const value = serializeSave(v03Content.manifest.contentVersion, service.eventLog).replaceAll(v03Content.manifest.contentVersion, 'v0.3.other')
    expect(() => parseSave(value, v03Content.manifest.contentVersion)).toThrow(ContentVersionMismatch)
    expect(service.state).toEqual(before)
  })

  it('rejects modified events, RNG receipts and turn identifiers', () => {
    const service = playedService()
    const valid = serializeSave(v03Content.manifest.contentVersion, service.eventLog)
    const modifiedEvent = valid.replace('option.selected', 'option.changed')
    expect(() => parseSave(modifiedEvent, v03Content.manifest.contentVersion)).toThrow(/checksum/)

    const document = parseSave(valid, v03Content.manifest.contentVersion)
    const batches = structuredClone(document.batches) as unknown as Array<{ turnId: string; rngBefore: number }>
    batches[1]!.rngBefore += 1
    const restored = new GameService(v03Content, v03Policies)
    expect(() => restored.restore(batches as unknown as typeof document.batches)).toThrow(/RNG receipt mismatch/)
    expect(restored.state.phase).toBe('idle')

    batches[1]!.rngBefore -= 1
    batches[1]!.turnId = 'turn.999999'
    expect(() => restored.restore(batches as unknown as typeof document.batches)).toThrow(/Turn receipt mismatch/)
    expect(restored.state.phase).toBe('idle')
  })
})
