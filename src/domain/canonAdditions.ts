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
