import type { DomainEvent, GameState } from '../model/contracts'
import { ProcessCycleError } from '../model/errors'
import { reduceEvents } from '../reducer/reducer'

export interface ProcessManager {
  readonly id: string
  react(state: GameState, events: readonly DomainEvent[]): readonly DomainEvent[]
}

export interface SettledEvents {
  readonly state: GameState
  readonly events: readonly DomainEvent[]
}

export function settleProcesses(
  state: GameState,
  initialEvents: readonly DomainEvent[],
  managers: readonly ProcessManager[],
  maxSteps = 32,
): SettledEvents {
  let projected = state
  let pending = [...initialEvents]
  const events: DomainEvent[] = []
  for (let step = 0; pending.length > 0; step += 1) {
    if (step >= maxSteps) throw new ProcessCycleError(maxSteps)
    projected = reduceEvents(projected, pending)
    events.push(...pending)
    if (projected.phase === 'ended') {
      pending = []
      continue
    }
    pending = managers.flatMap((manager) => manager.react(projected, pending))
  }
  return { state: projected, events }
}
