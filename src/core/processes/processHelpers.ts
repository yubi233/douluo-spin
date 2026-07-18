import type { OptionId, PoolId, SignalId } from '../ids'
import type { DomainEvent, Task } from '../model/contracts'

export function hasSignal(events: readonly DomainEvent[], signal: SignalId): boolean {
  return events.some((event) => event.type === 'signal.emitted' && event.signalId === signal)
}

export function selectedOption(events: readonly DomainEvent[]): OptionId | null {
  return events.find((event): event is Extract<DomainEvent, { type: 'option.selected' }> => event.type === 'option.selected')?.optionId ?? null
}

export function task(id: string, poolId: PoolId, process: string): Task {
  return { id: `task.${id}`, poolId, process }
}
