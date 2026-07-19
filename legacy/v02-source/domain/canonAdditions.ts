import type { OptionRequirements } from './types'

export const CANONICAL_POOL_ADDITIONS: Readonly<Record<string, readonly string[]>> = {
  兽武魂: [
    '六翼天使',
    '独角火暴龙',
    '疾风双头狼',
    '金鹰',
    '雷蛛',
    '雷鹰',
    '光明女神蝶',
  ],
  器武魂: [
    '七宝石武魂',
    '太阳花',
    '治疗权杖',
    '赤炎荆棘',
  ],
  翼类魂兽初始池子: [
    '暗金三头蝙蝠王',
    '血蝙蝠',
  ],
  猫科类魂兽初始池子: [
    '鬼虎',
    '斑斓猫',
    '暗魔邪神虎',
  ],
  犬科魂兽初始池子: ['幽冥狼'],
  蛇类魂兽初始池子: [
    '九节翡翠',
    '十首烈阳蛇',
    '曼陀罗蛇',
    '风尾鸡冠蛇',
  ],
  虫蛹类魂兽初始池子: [
    '人面魔蛛',
    '人面蛛皇',
    '地穴魔蛛',
    '千钧蚁皇',
    '大地之王',
    '粉红女郎',
    '粉红娘娘',
  ],
  精神类魂兽初始池子: [
    '镜影兽',
    '银英兽',
    '震天吼',
  ],
  猿猴类魂兽初始池子: [
    '三为一体狼猿',
    '泰坦雪魔王',
    '碧海灵猿',
    '血红狒狒',
  ],
  植物系魂兽初始池子: [
    '蓝银王',
    '鬼藤',
    '碧磷七绝花',
  ],
  '海魂兽初始池子（默认全部带水属性，血脉融合则叠加）': [
    '海蝰蛇',
    '邪魔虎鲸王',
  ],
}

export const ANIME_EXPANDED_MARTIAL_SOULS: Readonly<Record<string, readonly string[]>> = {
  兽武魂: ['青鸾神鸟', '烈焰雄狮'],
  器武魂: ['光翎神弓'],
}

export const CROSSOVER_BEAST_MARTIAL_SOULS = [
  '守鹤',
  '又旅',
  '矶抚',
  '孙悟空',
  '穆王',
  '犀犬',
  '重明',
  '牛鬼',
  '九喇嘛',
] as const

export const CROSSOVER_BODY_MARTIAL_SOULS = [
  '轮回眼',
  '白眼',
  '写轮眼',
  '净眼',
] as const

export const FIREARM_MARTIAL_SOULS = [
  { name: '98k狙击枪', weight: 10 },
  { name: '沙漠之鹰', weight: 15 },
  { name: '巴雷特狙击枪', weight: 8 },
  { name: 'AK47', weight: 10 },
  { name: '电磁步枪', weight: 5 },
  { name: 'RPG', weight: 5 },
  { name: '东风导弹', weight: 3 },
  { name: '等离子焚化枪', weight: 5 },
  { name: '火焰喷射器', weight: 5 },
] as const

export const FIREARM_MARTIAL_SOUL_NAMES = new Set<string>(FIREARM_MARTIAL_SOULS.map((option) => option.name))

export const FIREARM_STORY_POOL_NAME = '枪械武魂专属剧情池'

export const FIREARM_STORY_OPTIONS = [
  { name: '你在边境伏击中以超远射程越级击杀魂宗，等级+1，获得【远程猎杀】称号', weight: 18 },
  { name: '你用电磁步枪贯穿高阶魂尊的护体魂力，越级击杀对手，获得【电磁贯穿】称号', weight: 15 },
  { name: '你在巷战中以沙漠之鹰近身反杀强敌，获得【近距爆发】称号', weight: 15 },
  { name: '你以持续火力压制强敌后成功撤离，获得【火力压制】称号', weight: 14 },
  { name: '你拆解魂导残骸校准武魂弹道，获得【弹道校准】称号', weight: 14 },
  { name: '你击穿万年魂兽的弱点，获得一块适配魂骨', weight: 8 },
  { name: '你误判枪械后坐力而重伤撤离，等级-1', weight: 8 },
  { name: '东风导弹武魂引发异常魂力波动，你被高阶势力盯上', weight: 8 },
] as const

export const SHREK_MENTOR_ENTRY_POOL_NAME = '高龄剧情1:是否以客卿导师身份介入史莱克学院（25岁+限定）'

export const SHREK_MENTOR_ENTRY_OPTIONS = [
  { name: '是，你本就在史莱克任教，转任学院大赛导师', weight: 100 },
  { name: '是，接受弗兰德邀请，成为史莱克学院客卿导师（40+级限定）', weight: 50 },
  { name: '是，受大师邀请担任实战与战术导师，不占用学员名额（40+级限定）', weight: 35 },
  { name: '否，你保持现有身份，不介入史莱克学院教学', weight: 15 },
] as const

export const SHREK_MENTOR_TOURNAMENT_POOL_NAME = '高龄剧情2:魂师学院大赛导师经历（25岁+限定）'

export const SHREK_MENTOR_TOURNAMENT_OPTIONS = [
  { name: '你作为领队导师带领史莱克完成预选赛，全程只指挥学员作战', weight: 35 },
  { name: '你担任实战导师，修正七怪配合，帮助队伍晋级总决赛', weight: 35 },
  { name: '你以客卿导师身份坐镇赛场，阻止高阶魂师干预学生比赛', weight: 20 },
  { name: '你与大师在执教理念上发生分歧，退出临场指挥但仍保留导师身份', weight: 10 },
] as const

export const SHREK_MENTOR_REUNION_POOL_NAME = '高龄剧情3:七怪重聚时期的导师经历（客卿导师限定）'

export const SHREK_MENTOR_REUNION_OPTIONS = [
  { name: '七怪重返学院后，你与弗兰德共同检验众人的五年成长', weight: 35 },
  { name: '你站到教师一方参与切磋，只负责压阵并制止失控攻击', weight: 30 },
  { name: '你以客卿导师身份复盘七怪配合，没有占用八怪成员位置', weight: 25 },
  { name: '七怪重聚时你正在处理原势力事务，只在事后返回学院', weight: 10 },
] as const

export type FactionStoryId =
  | 'shrek'
  | 'wuhun'
  | 'academy'
  | 'xingluo'
  | 'qibao'
  | 'mercenary'
  | 'haishen'
  | 'sect'

export type FactionStoryStage = 'junior' | 'youth' | 'adult' | 'elite' | 'leader'

export interface FactionStoryCheckpoint {
  id: FactionStoryStage
  minAge: number
  maxAge?: number
  minLevel?: number
}

export interface FactionStoryOption {
  name: string
  weight: number
  requirements: OptionRequirements
}

export interface FactionStoryDefinition {
  id: FactionStoryId
  name: string
  aliases: readonly string[]
  poolName: string
  description: string
  options: readonly FactionStoryOption[]
}

export const FACTION_STORY_CHECKPOINTS: readonly FactionStoryCheckpoint[] = [
  { id: 'junior', minAge: 6, maxAge: 11 },
  { id: 'youth', minAge: 12, maxAge: 17 },
  { id: 'adult', minAge: 18 },
  { id: 'elite', minAge: 18, minLevel: 50 },
  { id: 'leader', minAge: 18, minLevel: 70 },
]

type FactionStoryBeat = readonly [FactionStoryStage, string, string, string]

const FACTION_STORY_STAGE_LABELS: Record<FactionStoryStage, string> = {
  junior: '启蒙期·6-11岁',
  youth: '成长期·12-17岁',
  adult: '担当期·18岁+',
  elite: '精英职责·18岁+·50级+',
  leader: '领队职责·18岁+·70级+',
}

function factionStoryOption(
  stage: FactionStoryStage,
  name: string,
  weight: number,
  gender?: '男' | '女',
): FactionStoryOption {
  const checkpoint = FACTION_STORY_CHECKPOINTS.find((candidate) => candidate.id === stage)
  if (!checkpoint) throw new Error(`未知势力剧情阶段：${stage}`)
  return {
    name,
    weight,
    requirements: {
      minAge: checkpoint.minAge,
      ...(checkpoint.maxAge == null ? {} : { maxAge: checkpoint.maxAge }),
      ...(checkpoint.minLevel == null ? {} : { minLevel: checkpoint.minLevel }),
      ...(gender ? { genders: [gender] } : {}),
      storyStages: [stage],
    },
  }
}

function factionSuffix(stage: FactionStoryStage, factionTitle: string): string {
  switch (stage) {
    case 'junior': return `，获得【${factionTitle}新秀】称号`
    case 'youth': return '，等级+1'
    case 'adult': return '，等级+1'
    case 'elite': return `，等级+1，获得【${factionTitle}精英】称号`
    case 'leader': return `，等级+2，获得【${factionTitle}领袖】称号`
  }
}

function factionStoryBeats(factionTitle: string, ...beats: FactionStoryBeat[]): FactionStoryOption[] {
  return beats.flatMap(([stage, general, male, female]) => {
    const suffix = factionSuffix(stage, factionTitle)
    const generalWeight = stage === 'leader' ? 28 : stage === 'elite' ? 32 : 36
    const genderWeight = stage === 'leader' ? 14 : stage === 'elite' ? 16 : 18
    const label = FACTION_STORY_STAGE_LABELS[stage]
    return [
      factionStoryOption(stage, `【${label}】${general}${suffix}`, generalWeight),
      factionStoryOption(stage, `【男性路线·${label}】${male}${suffix}`, genderWeight, '男'),
      factionStoryOption(stage, `【女性路线·${label}】${female}${suffix}`, genderWeight, '女'),
    ]
  })
}

export const FACTION_STORY_DEFINITIONS: readonly FactionStoryDefinition[] = [
  {
    id: 'shrek',
    name: '史莱克学院',
    aliases: ['史莱克'],
    poolName: '势力专属剧情：史莱克学院',
    description: '围绕怪物学院的训练、团队磨合、执教和高阶护校职责展开。',
    options: factionStoryBeats('史莱克',
      ['junior', '你在晨练场完成魂力控制考核，得到一份针对武魂短板的训练记录', '你和男学员组成临时双人组，在负重跑中学会分担魂力消耗', '你和女学员互换辅助与主攻位置，找到更适合自己的出手节奏'],
      ['youth', '学院把你编入跨系小队，你在实战课中承担一次关键补位', '你在男学员的擂台挑战中守住最后一轮，获得进阶训练资格', '你在女学员主导的配合测验中拆解对手节奏，赢得队友信任'],
      ['adult', '你协助学院整理学员魂环风险档案，开始承担正式教学或护校事务', '你带男学员完成夜间山路拉练，用一次撤退判断避免队伍受伤', '你带女学员完成协同救援演练，以清晰指令稳住失控魂力'],
      ['elite', '你受托审查高年级实战考核，在关键时刻叫停一场失控对决', '你担任男学员对抗课的压阵者，逼出一名学员藏起的战术缺口', '你主持女学员战术复盘，让原本互不服气的小队重新配合'],
      ['leader', '你代表学院处理外部挑衅，以规则和实力保住学院学员名额', '你在男学员面前示范如何收力取胜，纠正他们对强攻的误解', '你为女学员争取平等实战席位，并亲自完成一次护场'],
    ),
  },
  {
    id: 'wuhun',
    name: '武魂殿',
    aliases: ['武魂殿'],
    poolName: '势力专属剧情：武魂殿',
    description: '围绕分殿培养、任务执行、辖区秩序与高阶决策展开。',
    options: factionStoryBeats('武魂殿',
      ['junior', '分殿安排你复核觉醒记录，你发现一名平民孩子的武魂潜力被低估', '你与男学员完成队列和基础魂技配合，学会服从任务节奏', '你与女学员轮流担任记录员，在细节里找出一次考核偏差'],
      ['youth', '你进入精英训练小组，需要在纪律与同伴之间做一次取舍', '你在男学员排名赛中拒绝违规补刀，保住自己的任务评价', '你在女学员负责的追踪课上找回失联目标，得到教官认可'],
      ['adult', '你被派往地方分殿处理魂师纠纷，第一次独立写下处置意见', '你带男队员完成夜巡，把一场冲突控制在动手之前', '你带女队员清查伪造补贴记录，为平民魂师追回资源'],
      ['elite', '你奉命调查异常魂力波动，凭借现场痕迹阻止一场伏击', '你在男队员面前完成一次无伤制伏，重建队伍执行信心', '你带女队员穿过封锁区，把受困魂师安全带回分殿'],
      ['leader', '辖区分殿因资源分配起争执，你以实力和证据压下双方私斗', '你替男队员承担一次问责，再要求他们用战果证明判断', '你支持女队员主持分殿考核，让能力而非出身决定晋升'],
    ),
  },
  {
    id: 'academy',
    name: '天斗学院体系',
    aliases: ['诺丁', '天斗', '索托', '蓝霸', '五元素', '初级学院'],
    poolName: '势力专属剧情：天斗学院体系',
    description: '适用于天斗、蓝霸、五元素、诺丁、索托等学院路线。',
    options: factionStoryBeats('天斗',
      ['junior', '学院安排你参加基础联考，你靠稳定魂力控制通过第一次分班', '你和男同学一起修复训练器材，学会在逞强前先确认安全', '你和女同学共同完成药草辨认课，帮小队避开一次错误用药'],
      ['youth', '你参加学院交流赛，以一次主动换位挽回被压制的小队', '你在男学员强攻课中收住最后一击，反而赢得导师评价', '你在女学员协作课中串联两名陌生队友，完成关键反制'],
      ['adult', '你开始负责一门基础课程，把自己的修炼失误写进学员守则', '你带男学员完成野外课堂，及时终止冒进的猎魂计划', '你带女学员完成急救演练，让队伍在高压下保持分工'],
      ['elite', '学院委托你带队参加地区考核，你用稳妥打法拿下关键分数', '你纠正男学员只顾单挑的习惯，让小队完成连续配合', '你为女学员争取独立出战机会，并在场边护住节奏'],
      ['leader', '多所学院联合考核时，你负责协调规则，避免弱校学员被排挤', '你在男导师争执中拿出完整伤亡记录，定下统一标准', '你支持女导师进入评审席，用公开结果终结流言'],
    ),
  },
  {
    id: 'xingluo',
    name: '星罗学院体系',
    aliases: ['星罗'],
    poolName: '势力专属剧情：星罗学院体系',
    description: '围绕星罗学院的淘汰、边境纪律与皇室体系展开。',
    options: factionStoryBeats('星罗',
      ['junior', '你在边境训练营学习辨认军令，第一次明白迟疑也会拖累同伴', '你和男学员轮换背负补给，在体力见底前完成规定路程', '你和女学员完成隐蔽接力，用安静配合躲开巡查老师'],
      ['youth', '学院淘汰赛提前开始，你在保住队友与争取名次间做出选择', '你在男学员对抗里顶住挑衅，用规则拿回被扣的分数', '你在女学员伏击课中反向追踪对手，扭转了局面'],
      ['adult', '你协助边境学院维持秩序，第一次处理不服从命令的队员', '你带男队员进行夜间换防，在误报中稳住全队', '你带女队员护送补给，用分散行动避开截击'],
      ['elite', '边境出现魂兽异动，你率先封住缺口，为学院争取撤离时间', '你让男队员放下争功，按既定顺序完成防线轮换', '你指挥女队员救出受伤学员，守住撤离队尾'],
      ['leader', '皇室演武前有人试图修改名单，你用证据与实力守住队伍资格', '你告诫男队员胜负之外还有军纪，逼他们重做整队训练', '你为女队员争取指挥权，并让她们用战绩回应质疑'],
    ),
  },
  {
    id: 'qibao',
    name: '七宝琉璃宗',
    aliases: ['七宝琉璃宗'],
    poolName: '势力专属剧情：七宝琉璃宗',
    description: '围绕宗门辅助、护卫、商路与议事责任展开。',
    options: factionStoryBeats('七宝琉璃',
      ['junior', '宗门让你整理药材和魂导账册，你从一处错漏中保住整批补给', '你与男弟子轮流护送器材，学会用站位而非蛮力解决争执', '你与女弟子完成辅助演练，第一次把魂力精准送到队友身上'],
      ['youth', '你随宗门商队出行，必须在护卫和货物之间排定优先级', '你在男弟子护卫试炼中主动断后，守住队伍撤离路线', '你在女弟子辅助试炼中补上关键增幅，让队友完成翻盘'],
      ['adult', '宗门将一段商路交给你巡查，你查出有人借名截留魂师补贴', '你带男护卫处理商路冲突，以克制避免事态升级', '你带女弟子谈下补给协作，让前线不再断药'],
      ['elite', '宗门重要车队受伏，你用魂力掩护带回核心账册', '你让男护卫分段接敌，避免他们陷入无谓消耗', '你组织女弟子完成伤员接力，把损失压到最低'],
      ['leader', '宗门议事因资源倾斜争执不下，你提出可核查的分配方案', '你要求男护卫公开损耗记录，用事实结束资历之争', '你支持女弟子进入商路决策，让她们掌握自己的资源'],
    ),
  },
  {
    id: 'mercenary',
    name: '佣兵团',
    aliases: ['佣兵团'],
    poolName: '势力专属剧情：佣兵团',
    description: '围绕委托、野外生存、队伍信誉与带队责任展开。',
    options: factionStoryBeats('佣兵',
      ['junior', '佣兵团只让你做后勤，你却靠地图标记帮队伍避开一处险地', '你与男学徒轮流清点补给，学会在出发前承认准备不足', '你与女学徒练习包扎和辨毒，为一次意外受伤提前做好准备'],
      ['youth', '你接到第一份正式委托，在报酬与队友安全之间拒绝冒险路线', '你在男佣兵比试中放弃赌命打法，仍靠耐心完成目标', '你在女佣兵负责的搜救中保持冷静，找到被困委托人'],
      ['adult', '你开始带一支小队接任务，第一次为队员误判承担赔偿', '你带男佣兵穿过沼泽，及时叫停危险的强行突破', '你带女佣兵护送商队，以耐心谈判避开无谓冲突'],
      ['elite', '高额委托疑似陷阱，你用现场痕迹判断出雇主隐瞒的风险', '你压住男佣兵争功冲动，让队伍按退路完成收尾', '你带女佣兵完成夜间救援，把重伤者送回营地'],
      ['leader', '多支佣兵队为任务归属冲突，你拿出完整证据保住团里信誉', '你为男佣兵设立伤亡底线，结束用命换名声的风气', '你让女佣兵参与委托定价，用实际战绩争取话语权'],
    ),
  },
  {
    id: 'haishen',
    name: '海神岛',
    aliases: ['海神岛'],
    poolName: '势力专属剧情：海神岛',
    description: '围绕海域训练、岛防、潮汐考验与守护责任展开。',
    options: factionStoryBeats('海神',
      ['junior', '你在浅潮区练习感知水流，提前发现一名同伴被暗流卷走', '你和男学员轮流守望礁石，在潮声里练习传递简短指令', '你和女学员完成潮汐采样，找出一处不该靠近的危险水域'],
      ['youth', '岛内试炼要求你护住队友补给，不能只追求个人速度', '你在男学员潜水课中留出余力，救回体力透支的同伴', '你在女学员潮汐阵课中补全缺口，让队伍平安返岸'],
      ['adult', '你协助巡查岛外航线，第一次独立判断何时该封闭港口', '你带男岛民演练海难救援，按顺序救出全部伤员', '你带女岛民整理避风点物资，确保撤离时不会断粮'],
      ['elite', '海域出现异常魂兽，你守住外礁并为岛内争取布防时间', '你让男队员分批追击，避免他们被潮汐带离阵线', '你组织女队员完成海上接力，把受伤巡守者带回岛内'],
      ['leader', '岛防部署出现分歧，你以潮汐记录和战力判断定下守备顺序', '你要求男队员把救援优先于战功，重写巡守纪律', '你支持女队员负责港口指挥，以结果打消外来者质疑'],
    ),
  },
  {
    id: 'sect',
    name: '宗门',
    aliases: ['宗门'],
    poolName: '势力专属剧情：宗门',
    description: '适用于宗门子弟路线，围绕族规、历练、执事与宗门利益展开。',
    options: factionStoryBeats('宗门',
      ['junior', '族中长辈让你抄录武魂谱，你从旧注中找到一条适合自己的训练法', '你和男弟子轮流守住练功场，把一次争执变成正式切磋', '你和女弟子整理药浴配方，避免一名族人因剂量错误受伤'],
      ['youth', '首次外出历练时，你发现同门隐瞒伤势，必须调整全队路线', '你在男弟子比试中收住杀招，用结果赢得对方承认', '你在女弟子协作试炼中补上防线，让队友完成任务'],
      ['adult', '宗门让你暂代外务执事，你查清一笔被人做过手脚的资源账', '你带男弟子护送族人出行，用克制避免一场宗门冲突', '你带女弟子处理外务交接，用清单堵住对方推诿'],
      ['elite', '宗门矿脉受到窥伺，你带队守住入口并留下追查线索', '你让男弟子轮换防守，避免他们因逞强出现空档', '你组织女弟子转移重要账册，保住宗门后续谈判底气'],
      ['leader', '宗门内部因继承与资源争执，你拿出证据让各房回到规则内', '你要求男弟子为自己的承诺负责，压下用资历抢位的风气', '你支持女弟子参与长老议事，让宗门不再错过能做事的人'],
    ),
  },
]

export function factionStoryDefinitionFor(affiliation: string): FactionStoryDefinition | undefined {
  return FACTION_STORY_DEFINITIONS.find((definition) =>
    definition.aliases.some((alias) => affiliation.includes(alias)),
  )
}
