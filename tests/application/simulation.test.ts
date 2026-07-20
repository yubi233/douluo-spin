import { describe, expect, it } from 'vitest'
import { auditBeastIdentity, auditTraceOrder, simulateJourney } from '@/application/simulation'
import { formatBiography, projectGameView } from '@/application/gameViewModel'
import { v03Content, v03Policies } from '@/content/v03/content'
import { legacyFlow } from '@/content/v03/legacyFlow'

function simulate(seed: string, route: 'human' | 'beast') {
  return simulateJourney(v03Content, v03Policies, { seed, route, maxTurns: 240 })
}

const godOfferPoolIds = new Set([70, 80, 99].map((threshold) => `pool.god-offer.${threshold}`))
const activeFlowPoolIds = new Set([
  ...legacyFlow.pools.map((pool) => pool.activePoolId),
  ...legacyFlow.virtualPools.map((pool) => pool.activePoolId),
  ...godOfferPoolIds,
  ...v03Content.mechanics.pools.keys(),
])
const humanEntryPoolIds = new Set(legacyFlow.entrypoints.human)
const beastEntryPoolIds = new Set(legacyFlow.entrypoints.beast)
const ringPoolIds = new Set(legacyFlow.progression.soulRingByIndex.map((entry) => entry.poolId))
const humanGrowthPoolIds = new Set(legacyFlow.progression.humanGrowthByAge.map((entry) => entry.poolId))

function traceIndex(trace: readonly { poolId: string }[], candidates: ReadonlySet<string>) {
  return trace.findIndex((entry) => candidates.has(entry.poolId))
}

describe('v0.3 original-content deterministic journeys', () => {
  it('runs a human journey only through generated original or explicit virtual pools', () => {
    const result = simulate('v03-human-2', 'human')

    expect(result.audit).toEqual({ passed: true, issues: [] })
    expect(result.completed).toBe(true)
    expect(result.state.route).toBe('human')
    expect(result.state.ending).not.toBeNull()
    expect(result.trace.length).toBeGreaterThan(0)
    expect(humanEntryPoolIds.has(result.trace[0]!.poolId as never)).toBe(true)
    expect(result.trace.every((entry) => activeFlowPoolIds.has(entry.poolId as never))).toBe(true)
  })

  it('keeps the original soul-ring sequence ahead of the first human growth task', () => {
    const result = simulate('v03-human-2', 'human')
    const firstRing = traceIndex(result.trace, ringPoolIds)
    const firstGrowth = traceIndex(result.trace, humanGrowthPoolIds)

    expect(firstGrowth).toBeGreaterThanOrEqual(0)
    expect(result.audit.issues.filter((issue) => issue.code === 'invalid-task-order')).toEqual([])

    const growth = result.trace[firstGrowth]!
    const faultyTrace = firstRing >= 0
      ? [growth, ...result.trace.filter((entry) => entry !== growth)]
      : [growth]
    expect(auditTraceOrder('human', faultyTrace, 20)).toContainEqual({
      code: 'invalid-task-order',
      message: 'First growth task ran before initial soul rings were granted',
    })
  })

  it('commits exactly one terminal event and clears the agenda for a real lethal path', () => {
    const result = Array.from({ length: 100 }, (_, index) => simulate(`v03-recovery-human-${String(index + 1).padStart(3, '0')}`, 'human'))
      .find((candidate) => candidate.state.ending?.endingId === 'ending.death')
    expect(result).toBeDefined()
    const lethal = result!
    const terminalEvents = lethal.eventLog.flatMap((batch) => batch.events.filter((event) => event.type === 'run.finished'))

    expect(lethal.state.ending).toEqual({ endingId: 'ending.death', alive: false })
    expect(lethal.state.agenda).toEqual([])
    expect(terminalEvents).toEqual([{ type: 'run.finished', endingId: 'ending.death', alive: false }])
  })

  it('never draws a legacy-incompatible low-level god offer during a full journey', () => {
    const result = simulate('v03-recovery-human-023', 'human')

    expect(result.audit).toEqual({ passed: true, issues: [] })
    const godOffers = result.trace.filter((entry) => entry.poolId.startsWith('pool.god-offer.'))
    expect(godOffers.every((entry) => godOfferPoolIds.has(entry.poolId))).toBe(true)
    expect(godOffers.map((entry) => entry.poolId)).not.toEqual(expect.arrayContaining([
      'pool.god-offer.20',
      'pool.god-offer.30',
      'pool.god-offer.40',
      'pool.god-offer.50',
      'pool.god-offer.60',
    ]))
  })

  it('keeps the inherited god-trial UI regression seed on an ascension path', () => {
    const result = simulate('v03-recovery-human-001', 'human')

    expect(result.audit).toEqual({ passed: true, issues: [] })
    expect(result.state.ending).toEqual({ endingId: 'ending.god-ascension', alive: true })
    expect(result.trace.some((entry) => entry.poolId.startsWith('pool.god-trial.'))).toBe(true)
  })

  it('keeps beast type, species, bloodline and area compatible with original IDs', () => {
    const result = simulate('v03-beast-2', 'beast')

    expect(result.audit.passed).toBe(true)
    expect(result.state.route).toBe('beast')
    expect(beastEntryPoolIds.has(result.trace[0]!.poolId as never)).toBe(true)
    expect(result.state.entities['beast-bloodline'].length).toBeGreaterThanOrEqual(1)
    expect(result.state.entities['beast-bloodline'][0]).toMatch(/^entity\.legacy\.beast-bloodline\./)
    expect(auditBeastIdentity(result.state)).toEqual([])

    const invalid = structuredClone(result.state) as unknown as { entities: Record<string, string[]> }
    invalid.entities['beast-type'] = ['entity.legacy.beast-type.invalid']
    invalid.entities['beast-species'] = ['entity.legacy.beast-species.invalid']
    invalid.entities['beast-bloodline'] = ['entity.legacy.beast-bloodline.invalid']
    invalid.entities['beast-area'] = ['entity.legacy.beast-area.invalid']
    expect(auditBeastIdentity(invalid as never)[0]?.code).toBe('incompatible-beast-identity')
  })

  it('changes a real beast route into transformed human setup before continuing its original journey', () => {
    const result = simulate('v03-recovery-beast-001', 'beast')

    expect(result.audit).toEqual({ passed: true, issues: [] })
    expect(result.state.route).toBe('transformed')
    expect(result.state.progression.beastRouteChoiceResolved).toBe(true)
    expect(result.state.entities['martial-soul']).toHaveLength(1)
    expect(result.trace.some((entry) => humanEntryPoolIds.has(entry.poolId as never))).toBe(true)
    expect(result.trace.every((entry) => activeFlowPoolIds.has(entry.poolId as never))).toBe(true)
  })

  it('repeats a complete journey byte-for-byte for the same seed and commands', () => {
    const first = simulate('v03-recovery-beast-007', 'beast')
    const second = simulate('v03-recovery-beast-007', 'beast')

    expect(JSON.stringify(first.eventLog)).toBe(JSON.stringify(second.eventLog))
    expect(first.state).toEqual(second.state)
  })

  it('projects UI, biography and simulation facts from the same event log', () => {
    const result = simulate('v03-human-2', 'human')
    const view = projectGameView(result.state, result.eventLog, v03Content)
    const biography = formatBiography(view)

    expect(view.route).toBe(result.state.route)
    expect(view.rings).toHaveLength(result.state.progression.rings.length)
    expect(view.logs).toHaveLength(result.trace.length)
    expect(view.martialSoulDetails).toHaveLength(view.martialSouls.length)
    expect(view.highestMartialSoulTier).toBeGreaterThanOrEqual(1)
    expect(view.martialSoulDetails.every((soul) => soul.tierLabel.length > 0)).toBe(true)
    expect(view.ending).toBe(v03Content.presentation.endings.get(result.state.ending!.endingId)?.title)
    expect(biography).toContain(`路线：${result.state.route}`)
    expect(biography).toContain(`终局：${view.ending}`)
    expect(biography).toContain('最高武魂阶位：')
    expect(view.combatPowerBreakdown.total).toBe(view.combatPower)
    expect(biography).toContain(`战力值：${view.combatPower}`)
    expect(biography).toContain('战力公式：round(')
    expect(biography).toContain('战力构成：等级')
    expect(biography.match(/^### 第/gm)).toHaveLength(result.trace.length)
  })
})
