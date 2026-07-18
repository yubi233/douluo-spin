export type Brand<T, Name extends string> = T & { readonly __brand: Name }

export type PoolId = Brand<string, 'PoolId'>
export type OptionId = Brand<string, 'OptionId'>
export type EntityId = Brand<string, 'EntityId'>
export type PolicyId = Brand<string, 'PolicyId'>
export type SignalId = Brand<string, 'SignalId'>
export type EndingId = Brand<string, 'EndingId'>
export type TurnId = Brand<string, 'TurnId'>

const STABLE_ID_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/

function createId<T extends string>(value: string, kind: string): T {
  if (!STABLE_ID_PATTERN.test(value)) {
    throw new TypeError(`${kind} must be a stable ASCII identifier: ${value}`)
  }
  return value as T
}

export const poolId = (value: string) => createId<PoolId>(value, 'PoolId')
export const optionId = (value: string) => createId<OptionId>(value, 'OptionId')
export const entityId = (value: string) => createId<EntityId>(value, 'EntityId')
export const policyId = (value: string) => createId<PolicyId>(value, 'PolicyId')
export const signalId = (value: string) => createId<SignalId>(value, 'SignalId')
export const endingId = (value: string) => createId<EndingId>(value, 'EndingId')
export const turnId = (value: string) => createId<TurnId>(value, 'TurnId')
