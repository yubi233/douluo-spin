export interface OptionRequirements {
  minAge?: number
  maxAge?: number
  minLevel?: number
  maxLevel?: number
  genders?: readonly string[]
  storyStages?: readonly string[]
}

export interface WheelOption {
  id: string
  name: string
  enabled?: boolean
  weight?: number
  requirements?: OptionRequirements
}

export interface WheelPool {
  id: string
  name: string
  description?: string | null
  options: WheelOption[]
  tags: string[]
}

export interface WheelTag {
  id: string
  name: string
  color?: string
}

export interface WheelData {
  version: number
  exportDate: string
  decisions: WheelPool[]
  tags: WheelTag[]
}

export type Route = 'human' | 'beast' | 'transformed'
export type StartRoute = Route | 'random'

export type MachineValue =
  | 'idle'
  | 'routeSelection'
  | 'humanSetup'
  | 'beastSetup'
  | 'humanAdventure'
  | 'beastAdventure'
  | 'transformedSetup'
  | 'transformedAdventure'
  | 'godTrial'
  | 'rolling'
  | 'ending'

export type StableMachineValue = Exclude<MachineValue, 'rolling'>

export type TaskHandler =
  | 'race'
  | 'gender'
  | 'appearance'
  | 'martialType'
  | 'martialSoulCategory'
  | 'martialSoul'
  | 'specialChance'
  | 'specialTalent'
  | 'growthChance'
  | 'growth'
  | 'age'
  | 'period'
  | 'initialPower'
  | 'faction'
  | 'humanTime'
  | 'humanEncounter'
  | 'ring'
  | 'ringSpecies'
  | 'bone'
  | 'domain'
  | 'godTier'
  | 'godDeity'
  | 'godReward'
  | 'beastPeriod'
  | 'beastGender'
  | 'beastRealm'
  | 'beastType'
  | 'beastSpecies'
  | 'beastArea'
  | 'beastRoute'
  | 'beastGrowth'
  | 'beastEncounter'
  | 'tribulation'
  | 'beastEvolution'
  | 'story'

export interface RollTask {
  id: string
  tag: string
  pool: string
  handler: TaskHandler
  meta?: Record<string, string | number | boolean>
}

export interface ChronicleEntry {
  id: string
  step: number
  title: string
  text: string
  tone: 'normal' | 'good' | 'bad' | 'major'
  time: string
}

export interface SoulRing {
  index: number
  years: number
  description: string
}

export interface BeastContext {
  cultivation: number
  species: string
  type: string
  area: string
  bloodlines: string[]
  laws: string[]
  pendingTribulation: number | null
}

export interface GodTrial {
  tier: string
  deity: string
  completed: number
  total: number
}

export interface GameSettings {
  softenText: boolean
  spinDuration: number
}

export interface GameContext {
  seed: string
  rng: number
  route: Route | null
  name: string
  step: number
  age: number | null
  tangAge: number | null
  gender: string
  appearance: string
  level: number
  maxLevel: number
  faction: string
  branch: 1 | 2 | 3 | null
  martialSoulTypes: string[]
  martialSouls: string[]
  talents: string[]
  traits: string[]
  domains: string[]
  rings: SoulRing[]
  soulBones: string[]
  beast: BeastContext | null
  godTrial: GodTrial | null
  queue: RollTask[]
  activeTask: RollTask | null
  lastPool: string
  lastOptionId?: string
  lastResult: string
  lastProbability: number | null
  logs: ChronicleEntry[]
  flags: Record<string, string | number | boolean>
  alive: boolean
  ending: string
  resumeState: StableMachineValue | null
  settings: GameSettings
}

export interface MachineState {
  value: MachineValue
  context: GameContext
}

export type MachineEvent =
  | { type: 'OPEN_START' }
  | { type: 'CANCEL_START' }
  | { type: 'START'; route: StartRoute; seed: string }
  | { type: 'ROLL' }
  | { type: 'RESOLVE'; option: WheelOption; probability: number }
  | { type: 'FINISH'; reason: string }
  | { type: 'RESET' }
  | { type: 'RESTORE'; state: MachineState }

export interface TransitionResult {
  state: MachineState
  accepted: boolean
  reason?: string
}
