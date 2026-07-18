import type { EndingId } from '../ids'
import type { DomainEvent, EffectSpec, GameState } from '../model/contracts'
import { UnhandledEffectError } from '../model/errors'
import { evaluateNumber, type PolicyRegistry } from '../rules/evaluate'
import { clampStatValue, reduceEvent } from '../reducer/reducer'

export function compileEffects(
  effects: readonly EffectSpec[],
  state: GameState,
  policies: PolicyRegistry,
  endings: ReadonlyMap<EndingId, { readonly alive: boolean }> = new Map(),
): readonly DomainEvent[] {
  let projected = state
  const events: DomainEvent[] = []
  for (const effect of effects) {
    let event: DomainEvent
    switch (effect.type) {
      case 'stat.change': {
        const before = projected.stats[effect.stat]
        event = { type: 'stat.changed', stat: effect.stat, before, after: clampStatValue(effect.stat, before + evaluateNumber(effect.delta, projected, policies)) }
        break
      }
      case 'entity.grant': {
        if (projected.entities[effect.entityType].includes(effect.entityId)) continue
        event = { type: 'entity.granted', entityType: effect.entityType, entityId: effect.entityId }
        break
      }
      case 'entity.revoke': {
        if (!projected.entities[effect.entityType].includes(effect.entityId)) continue
        event = { type: 'entity.revoked', entityType: effect.entityType, entityId: effect.entityId }
        break
      }
      case 'time.advance': {
        const before = projected.stats['tang-age']
        event = { type: 'time.advanced', before, after: clampStatValue('tang-age', before + evaluateNumber(effect.years, projected, policies)) }
        break
      }
      case 'signal.emit': event = { type: 'signal.emitted', signalId: effect.signalId, payload: effect.payload }; break
      case 'run.finish': {
        const ending = endings.get(effect.endingId)
        if (!ending) throw new UnhandledEffectError(`run.finish:${effect.endingId}`)
        event = { type: 'run.finished', endingId: effect.endingId, alive: ending.alive }
        break
      }
      default: throw new UnhandledEffectError((effect as { type: string }).type)
    }
    events.push(event)
    projected = reduceEvent(projected, event)
  }
  return events
}
