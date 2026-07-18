export interface ContentIssue {
  path: string
  code: string
  message: string
}

export class ContentValidationError extends Error {
  readonly issues: readonly ContentIssue[]

  constructor(issues: readonly ContentIssue[]) {
    super(`Content validation failed with ${issues.length} issue(s)`)
    this.name = 'ContentValidationError'
    this.issues = issues
  }
}
export class InvalidCommandError extends Error {
  readonly command: string
  readonly phase: string

  constructor(command: string, phase: string) {
    super(`Command ${command} is not accepted in phase ${phase}`)
    this.name = 'InvalidCommandError'
    this.command = command
    this.phase = phase
  }
}

export class NoEligibleOptionError extends Error {
  readonly poolId: string

  constructor(poolId: string) {
    super(`Pool ${poolId} has no eligible option`)
    this.name = 'NoEligibleOptionError'
    this.poolId = poolId
  }
}

export class UnhandledEffectError extends Error {
  readonly effectType: string

  constructor(effectType: string) {
    super(`Effect ${effectType} is not registered`)
    this.name = 'UnhandledEffectError'
    this.effectType = effectType
  }
}

export class ProcessCycleError extends Error {
  readonly steps: number

  constructor(steps: number) {
    super(`Process managers did not stabilize within ${steps} steps`)
    this.name = 'ProcessCycleError'
    this.steps = steps
  }
}

export class ContentVersionMismatch extends Error {
  readonly expected: string
  readonly received: string

  constructor(expected: string, received: string) {
    super(`Content version mismatch: expected ${expected}, received ${received}`)
    this.name = 'ContentVersionMismatch'
    this.expected = expected
    this.received = received
  }
}
