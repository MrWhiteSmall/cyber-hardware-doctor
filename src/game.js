export const parts = {
  ram: {
    name: "内存条",
    en: "MEMORY / RAM",
    spec: "DDR4 · 8 GB · 2666 MHz",
    analogy: "就像你的临时工作台",
    description:
      "CPU 正在使用的数据，会临时放在内存里。断电后这些数据会消失；保存的文件则在硬盘中。",
    tip: "安装时先对齐金手指的缺口，两端均匀按压，确认卡扣锁住。不要用橡皮随意擦拭触点。",
    fault: "一端卡扣未锁紧，内存条没有完全插入。",
    color: "#7aab87",
  },
  cooler: {
    name: "CPU 散热器",
    en: "CPU COOLER",
    spec: "风冷 · 铝制鳍片 · 120 mm",
    analogy: "电脑里的小风扇和散热片",
    description:
      "散热片把 CPU 的热量传出来，风扇推动空气带走热量。鳍片积灰会阻碍气流，让电脑降频，甚至触发保护关机。",
    tip: "清灰前断电，固定风扇叶片，再用短促气流清洁。不要让气流把风扇吹得高速空转。",
    fault: "散热鳍片被灰尘堵住，气流受阻。",
    color: "#b8a080",
  },
  storage: {
    name: "固态硬盘",
    en: "STORAGE / SSD",
    spec: "2.5″ SATA · 512 GB",
    analogy: "保存文件的长期储物柜",
    description:
      "操作系统、照片和游戏都保存在这里。SATA 固态硬盘一般需要数据线和供电线，两者缺一不可。断电不会清除已保存的文件。",
    tip: "SATA 接口有 L 形防呆缺口。对齐方向后插稳，不能硬塞；M.2 硬盘则是另一种安装方式。",
    fault: "SATA 数据线接头松脱，主板无法识别硬盘。",
    color: "#748ca4",
  },
  gpu: {
    name: "显卡",
    en: "GRAPHICS / GPU",
    spec: "PCIe · 6 GB · 双风扇",
    analogy: "专门负责画面的画师",
    description:
      "显卡擅长同时处理大量图形计算，把画面输出到显示器。独立显卡通常插在主板的 PCIe 插槽里。",
    tip: "有独立显卡时，显示器一般接显卡的视频接口。部分显卡还需要额外供电。",
    fault: "显卡连接与外观正常。",
    color: "#85929c",
  },
  motherboard: {
    name: "主板",
    en: "MOTHERBOARD",
    spec: "Micro-ATX · DDR4 · SATA 6 Gb/s",
    analogy: "连接所有零件的交通网络",
    description:
      "CPU、内存、显卡和硬盘通过主板互相通信。插槽的形状和规格决定了哪些零件可以安装。",
    tip: "DDR4 与 DDR5 内存不能互换。选择硬件时要核对主板支持的 CPU 插座、内存代际等规格。",
    fault: "主板没有可见损坏；请继续检查其他部件。",
    color: "#5e8576",
  },
  psu: {
    name: "电源",
    en: "POWER SUPPLY",
    spec: "ATX · 450 W",
    analogy: "把电分配给每个零件的供电站",
    description:
      "电源把市电转换成电脑零件使用的直流电，通过不同线材提供给主板、显卡和硬盘。",
    tip: "新手只检查外部开关与连接线，不要拆开电源外壳：内部电容断电后仍可能储存危险电能。",
    fault: "电源外部连接正常。",
    color: "#858b95",
  },
};

export const jobs = [
  {
    id: "memory",
    number: "001",
    title: "会亮灯，却没有画面",
    subtitle: "第一次接诊",
    customer: "小林",
    avatar: "林",
    device: "日常学习用台式机",
    quote:
      "「搬了一次家，电脑的风扇还在转，可显示器一直黑屏……我的作业还在里面呢。」",
    symptom: "风扇转动 · 显示器无信号",
    target: "ram",
    reward: 120,
    xp: 80,
    difficulty: "入门",
    duration: "约 5 分钟",
    lesson: "内存安装与开机自检",
    question: "为什么这次重新插好内存，就能恢复开机？",
    answers: [
      "内存保存着所有的作业文件",
      "内存没有插到位，影响了开机自检",
      "内存越松，电脑的散热越好",
    ],
    correct: 1,
    explanation:
      "开机时，主板会检查内存等关键硬件。内存接触不良可能导致自检失败。黑屏也可能由显卡、显示器或线材等原因引起，本工单的检查证据指向内存。",
  },
  {
    id: "cooling",
    number: "002",
    title: "一开游戏，就自动关机",
    subtitle: "给电脑透透气",
    customer: "阿夏",
    avatar: "夏",
    device: "用了三年的游戏电脑",
    quote: "「最近风扇声音像飞机，游戏玩一会儿就关机。是不是该换一台了？」",
    symptom: "风扇噪声大 · 高负载关机",
    target: "cooler",
    reward: 150,
    xp: 100,
    difficulty: "入门",
    duration: "约 4 分钟",
    lesson: "气流、积灰与过热保护",
    question: "用气流给风扇清灰时，为什么要固定叶片？",
    answers: [
      "让灰尘更容易粘回去",
      "风扇本来就不应该转动",
      "避免气流使风扇高速空转",
    ],
    correct: 2,
    explanation:
      "先断电，固定叶片，再用短促气流清洁散热鳍片。过热原因还可能包括接触不良或风扇损坏；本工单通过检查确认是积灰。",
  },
  {
    id: "storage",
    number: "003",
    title: "我的系统，去哪儿了？",
    subtitle: "找回失联的硬盘",
    customer: "老周",
    avatar: "周",
    device: "家庭办公台式机",
    quote:
      "「开机只显示 No bootable device。昨天打扫时挪过机箱，里面的照片还找得回来吗？」",
    symptom: "屏幕提示找不到启动设备",
    target: "storage",
    reward: 140,
    xp: 90,
    difficulty: "入门",
    duration: "约 4 分钟",
    lesson: "SATA 接口与数据存储",
    question: "本工单中的 SATA 固态硬盘，需要哪两种连接？",
    answers: ["数据线和供电线", "两条 HDMI 视频线", "网线和耳机线"],
    correct: 0,
    explanation:
      "2.5 英寸 SATA 硬盘通过数据线与主板通信，通过供电线获取电力。线材松脱不代表数据消失，先检查连接比急着格式化更合理。",
  },
];

export const tools = [
  {
    id: "inspect",
    name: "观察",
    key: "1",
    icon: "Search",
    detail: "先看看，找线索",
  },
  {
    id: "driver",
    name: "螺丝刀",
    key: "2",
    icon: "Wrench",
    detail: "拆装侧板螺丝",
  },
  {
    id: "hand",
    name: "拆装",
    key: "3",
    icon: "Hand",
    detail: "卡扣与零件拆装",
  },
  { id: "air", name: "气吹", key: "4", icon: "Wind", detail: "固定叶片后清灰" },
  { id: "cable", name: "接线", key: "5", icon: "Cable", detail: "连接数据线" },
  {
    id: "oil",
    name: "润滑",
    key: "6",
    icon: "Droplets",
    detail: "给可维护轴承少量润滑",
  },
  {
    id: "meter",
    name: "万用表",
    key: "7",
    icon: "Gauge",
    detail: "断电后测量线路通断",
  },
  {
    id: "puller",
    name: "拔取器",
    key: "8",
    icon: "Grip",
    detail: "按结构选择拔键或拔轴端",
  },
];

Object.assign(parts, {
  fanBlade: {
    name: "扇叶与护网",
    en: "FAN / AIRFLOW",
    spec: "5 V USB 桌面风扇 · 可拆护网",
    analogy: "把空气推向你的螺旋桨",
    description:
      "电机带动叶片旋转，形成气流。护网保护手指，也容易积灰；积灰会增加阻力，降低送风效率。",
    tip: "拔掉 USB 电源、固定叶片后再清洁。气吹在电脑里清理散热鳍片，在这里清理护网与叶片。",
    fault: "护网和扇叶有明显积灰，阻碍气流。",
    color: "#94a88b",
  },
  fanMotor: {
    name: "电机轴承",
    en: "MOTOR / BEARING",
    spec: "低压直流电机 · 可维护含油轴承",
    analogy: "让转轴顺畅转动的小关节",
    description:
      "轴承支撑电机转轴。这个教学风扇使用可维护含油轴承，干涩时阻力增大，表现为转动困难、异响。并非所有轴承都可加油。",
    tip: "先断电，确认是可维护结构，再用适用润滑油少量点涂。密封滚珠轴承和损坏电机应按手册更换。",
    fault: "手动转动阻力明显，含油轴承干涩。",
    color: "#a19b83",
  },
  fanCable: {
    name: "USB 供电线",
    en: "USB / POWER CABLE",
    spec: "5 V DC · 可更换线组",
    analogy: "给小风扇送能量的通道",
    description:
      "USB 线把低压电送入风扇。外皮看起来完整，内部导体也可能折断。断电后可用万用表通断档检查独立线材的两端。",
    tip: "两端都与设备断开后，逐根测通断。通断档不能用于带电线路；本游戏不涉及市电电器维修。",
    fault: "线材弯折处异常，需测量确认内部是否断路。",
    color: "#c2936f",
  },
  keycap: {
    name: "键帽与定位板",
    en: "KEYCAP / PLATE",
    spec: "机械键盘 · 十字轴键帽",
    analogy: "你每天按下的小按钮外壳",
    description:
      "键帽传递手指的压力，下面的定位板固定轴体。碎屑积在键帽间隙，会让按键卡顿；这不一定是轴体坏了。",
    tip: "用拔键器两侧均匀垂直提起。长键有卫星轴，新手先从普通单键练习。",
    fault: "键帽下有碎屑，回弹时受到阻碍。",
    color: "#c6b891",
  },
  keySwitch: {
    name: "热插拔轴体",
    en: "SWITCH / HOT-SWAP",
    spec: "3 针机械轴 · 热插拔插座",
    analogy: "把每次按压变成信号的开关",
    description:
      "按下机械轴，内部触点闭合，键盘检测到按键。本机使用热插拔插座，可用拔轴器更换，不需要焊接。普通焊接键盘不能这样直接拔轴。",
    tip: "拔轴端先压住轴体卡扣，再垂直取出。安装前检查针脚，弯针不能硬压。",
    fault: "外观与按压触感正常，需要测量轴体触点来判断。",
    color: "#c69273",
  },
  keyPcb: {
    name: "接口子板与排线",
    en: "PCB / RIBBON CABLE",
    spec: "USB-C 子板 · FFC 排线锁扣",
    analogy: "把按键信号送到电脑的小桥梁",
    description:
      "键盘主板扫描按键，通过排线和接口子板把信号送往电脑。排线偏斜或锁扣松开，会让整块键盘失联。",
    tip: "先断开 USB。按连接器结构松开锁扣，对齐触点与插入线，再锁紧；不同 FFC 接口的开启方式不同。",
    fault: "接口子板排线偏斜，连接器锁扣没有锁紧。",
    color: "#779b88",
  },
});

export const chapters = [
  {
    id: "pc",
    number: "01",
    title: "你好，电脑",
    subtitle: "认识零件，学会有证据地排查",
    icon: "Cpu",
    product: "电脑",
    parts: ["ram", "cooler", "storage", "gpu", "motherboard", "psu"],
  },
  {
    id: "fan",
    number: "02",
    title: "风又吹起来了",
    subtitle: "从清洁维护，到测量电路",
    icon: "Fan",
    product: "USB 风扇",
    parts: ["fanBlade", "fanMotor", "fanCable"],
  },
  {
    id: "keyboard",
    number: "03",
    title: "找回敲击的声音",
    subtitle: "练习精细拆装，追踪按键信号",
    icon: "Keyboard",
    product: "机械键盘",
    parts: ["keycap", "keySwitch", "keyPcb"],
  },
];

const repairPlans = {
  memory: [
    { text: "打开内存插槽两端的卡扣", tool: "hand" },
    { text: "沿插槽法线方向，平直取出松动的内存", tool: "hand" },
    { text: "对齐缺口，再沿插槽方向手动压入内存", tool: "hand" },
    { text: "检查并逐个锁紧两端卡扣", tool: "hand" },
  ],
  cooling: [
    { text: "用手固定散热风扇的叶片", tool: "hand" },
    { text: "使用气吹，短促吹走鳍片里的积灰", tool: "air" },
  ],
  storage: [
    { text: "轻推较宽的 SATA 供电接头，确认已经到位", tool: "hand" },
    {
      text: "按锁扣取出松动的数据接头，对齐 L 形缺口插稳，再轻拉检查",
      tool: "cable",
    },
  ],
};
jobs.forEach((j, i) =>
  Object.assign(j, {
    chapter: "pc",
    rank: i + 1,
    difficulty: ["入门", "基础", "进阶"][i],
    steps: repairPlans[j.id],
    needs: i === 1 ? ["air"] : i === 2 ? ["cable"] : [],
  }),
);
jobs.push(
  {
    id: "fan-dust",
    number: "004",
    chapter: "fan",
    rank: 1,
    title: "风变小了",
    subtitle: "老工具的新用法",
    customer: "阿禾",
    avatar: "禾",
    device: "5 V USB 桌面风扇",
    quote:
      "「小风扇还在转，但风越来越小。它陪我读过好几个夏天，想让它再用久一点。」",
    symptom: "转动正常 · 送风微弱",
    target: "fanBlade",
    reward: 160,
    xp: 100,
    difficulty: "基础",
    duration: "约 4 分钟",
    lesson: "气吹在不同设备上的应用",
    needs: ["air"],
    steps: [
      { text: "固定风扇叶片，防止气流带动空转", tool: "hand" },
      { text: "用气吹清理护网与叶片的积灰", tool: "air" },
    ],
    question: "同样用气吹，修电脑和修风扇有什么共同点？",
    answers: [
      "都要先断电，并固定叶片",
      "都应该把风扇吹到最快",
      "都不需要观察灰尘在哪里",
    ],
    correct: 0,
    explanation:
      "同一工具可以用于不同结构。电脑主要清理散热鳍片，风扇主要清理护网与叶片；断电和固定叶片的原则相同。",
  },
  {
    id: "fan-bearing",
    number: "005",
    chapter: "fan",
    rank: 2,
    title: "吱呀作响的小风扇",
    subtitle: "不只是清灰",
    customer: "米米",
    avatar: "米",
    device: "可维护轴承的 USB 风扇",
    quote: "「擦干净了还是有异响，叶片用手轻拨也不太顺。能不能帮我看看？」",
    symptom: "转动阻力大 · 轴承异响",
    target: "fanMotor",
    reward: 190,
    xp: 120,
    difficulty: "进阶",
    duration: "约 5 分钟",
    lesson: "区分积灰与轴承阻力",
    needs: ["oil"],
    steps: [
      { text: "轻拨转轴，确认轴承存在异常阻力", tool: "hand" },
      { text: "打开此型号轴承的维护盖", tool: "driver" },
      { text: "向可维护轴承少量点涂适用润滑油", tool: "oil" },
      { text: "盖回维护盖，手动确认转动顺畅", tool: "hand" },
    ],
    question: "所有风扇出现异响，都可以直接加油吗？",
    answers: [
      "可以，油加得越多越好",
      "不可以，要先确认轴承类型和维护方式",
      "只要不转了，就往电路板上倒油",
    ],
    correct: 1,
    explanation:
      "只有适合维护的结构才可按说明少量润滑。密封轴承、破损叶片或损坏电机，通常需要按设备手册更换相应零件。",
  },
  {
    id: "fan-cable",
    number: "006",
    chapter: "fan",
    rank: 3,
    title: "看不见的断点",
    subtitle: "从观察走向测量",
    customer: "小陆",
    avatar: "陆",
    device: "5 V USB 风扇 · 可拆线组",
    quote:
      "「昨天还有风，今天彻底不动了。线的外皮看着没破，我实在找不到问题。」",
    symptom: "完全不转 · 供电线曾反复弯折",
    target: "fanCable",
    reward: 230,
    xp: 150,
    difficulty: "挑战",
    duration: "约 6 分钟",
    lesson: "万用表通断档与内部断路",
    needs: ["meter", "cable"],
    steps: [
      { text: "断开供电线两端，使线材与设备分离", tool: "hand" },
      { text: "用通断档测量线材两端：无蜂鸣，确认断路", tool: "meter" },
      { text: "取下断路线组，连接新的 5 V USB 线组", tool: "cable" },
      { text: "再次测量：蜂鸣，确认新线导通", tool: "meter" },
    ],
    question: "本关使用万用表通断档时，正确做法是什么？",
    answers: [
      "插着 USB 电源直接测",
      "切到电流档，跨接供电两端",
      "断电并分离线材两端，再测量通断",
    ],
    correct: 2,
    explanation:
      "通断档用于断电线路。分离线材可以避免其他电路形成回路，影响判断。本关读数为教学模拟，不涉及带电测量。",
  },
  {
    id: "keyboard-clean",
    number: "007",
    chapter: "keyboard",
    rank: 1,
    title: "被饼干屑卡住的按键",
    subtitle: "精细拆装第一课",
    customer: "豆豆",
    avatar: "豆",
    device: "热插拔机械键盘 · 普通单键",
    quote:
      "「上次吃完饼干，这个键按下去就不太弹回来。别告诉我要换整把键盘吧！」",
    symptom: "单键卡顿 · 回弹不顺",
    target: "keycap",
    reward: 180,
    xp: 110,
    difficulty: "基础",
    duration: "约 4 分钟",
    lesson: "拔键器与键帽下的清洁",
    needs: ["puller", "air"],
    steps: [
      { text: "用拔键端夹住键帽，两侧均匀垂直提起", tool: "puller" },
      { text: "短促气吹，清理键帽下的碎屑", tool: "air" },
      { text: "对齐十字轴，装回键帽并检查回弹", tool: "hand" },
    ],
    question: "一个按键回弹不顺，应该首先怎么做？",
    answers: [
      "直接换整把键盘",
      "先检查是否有碎屑阻挡，再判断轴体",
      "带电往缝隙里倒水",
    ],
    correct: 1,
    explanation:
      "同样是按键异常，原因可以是物理卡顿、轴体触点损坏，也可以是主板问题。观察到的碎屑，是本工单的关键证据。",
  },
  {
    id: "keyboard-switch",
    number: "008",
    chapter: "keyboard",
    rank: 2,
    title: "按下了，却没回应",
    subtitle: "同一把工具，两种用法",
    customer: "安安",
    avatar: "安",
    device: "3 针热插拔机械键盘",
    quote: "「这个键按着挺正常，字却时有时无。清洁过也没有改善。」",
    symptom: "单键漏字 · 触感正常",
    target: "keySwitch",
    reward: 240,
    xp: 150,
    difficulty: "进阶",
    duration: "约 6 分钟",
    lesson: "轴体触点与热插拔更换",
    needs: ["puller", "meter", "switch-kit"],
    steps: [
      { text: "用拔键端垂直取下故障键的键帽", tool: "puller" },
      { text: "改用拔轴端，压住卡扣后取出热插拔轴体", tool: "puller" },
      { text: "用通断档检查拆下的轴体：按压后导通不稳定", tool: "meter" },
      { text: "检查新轴针脚，对齐插座安装并装回键帽", tool: "hand" },
    ],
    question: "拔键帽与拔轴体，可以完全用同样的方法吗？",
    answers: [
      "可以，越用力越好",
      "不可以，拔轴需使用拔轴端释放卡扣，并确认支持热插拔",
      "只有键帽有电路，需要焊接",
    ],
    correct: 1,
    explanation:
      "二合一拔取器有两种工作端。拔键端提起键帽，拔轴端释放轴体卡扣。焊接式键盘不支持这样直接拔轴。",
  },
  {
    id: "keyboard-ribbon",
    number: "009",
    chapter: "keyboard",
    rank: 3,
    title: "整把键盘都失联了",
    subtitle: "沿着信号找问题",
    customer: "小白",
    avatar: "白",
    device: "USB-C 子板式机械键盘",
    quote: "「换过外部线材也没用，电脑完全认不到键盘。上次拆壳后它就这样了。」",
    symptom: "全键无响应 · 外部线材已排除",
    target: "keyPcb",
    reward: 280,
    xp: 180,
    difficulty: "挑战",
    duration: "约 6 分钟",
    lesson: "排线锁扣与连接路径",
    needs: ["cable", "meter"],
    steps: [
      { text: "用通断档检查已分离的外部线材：导通正常", tool: "meter" },
      { text: "按结构释放 FFC 连接器的锁扣", tool: "hand" },
      { text: "对齐触点与插入线，重新连接排线", tool: "cable" },
      { text: "锁紧连接器，轻拉确认排线固定", tool: "hand" },
    ],
    question: "整把键盘失联、外部线材已排除，下一步该怎么查？",
    answers: [
      "把所有键帽都换成新的",
      "逐个更换全部轴体",
      "沿连接路径检查接口子板、排线与锁扣",
    ],
    correct: 2,
    explanation:
      "单键故障与全键失联指向不同范围。排除外部线材后，沿信号和供电路径检查内部连接，比随意更换所有零件更有效。",
  },
);

export const market = [
  {
    id: "air",
    name: "精密气吹",
    price: 60,
    chapter: "pc",
    icon: "Wind",
    description: "清理散热鳍片、护网和键帽间隙。短促气流，先固定叶片。",
  },
  {
    id: "cable",
    name: "接线与替换线套件",
    price: 80,
    chapter: "pc",
    icon: "Cable",
    description: "含教学用 SATA、低压 USB 线组与排线。对齐防呆结构，切勿硬塞。",
  },
  {
    id: "oil",
    name: "轴承维护套装",
    price: 100,
    chapter: "fan",
    icon: "Droplets",
    description: "细嘴点油工具与适用润滑油，只维护确认可加油的含油轴承。",
  },
  {
    id: "meter",
    name: "数字万用表",
    price: 180,
    chapter: "fan",
    icon: "Gauge",
    description: "解锁断电通断测量。本试玩版只模拟通断档，不进行带电测量。",
  },
  {
    id: "puller",
    name: "二合一拔键拔轴器",
    price: 120,
    chapter: "keyboard",
    icon: "Grip",
    description: "拔键端提键帽，拔轴端释放轴体卡扣。同一工具，按结构切换用法。",
  },
  {
    id: "switch-kit",
    name: "热插拔轴体套件",
    price: 160,
    chapter: "keyboard",
    icon: "Package",
    description: "教学键盘兼容的 3 针替换轴体。先检查针脚，再对齐插座。",
  },
];
export const starterTools = ["inspect", "driver", "hand"];
export const chapterOf = (job) => chapters.find((c) => c.id === job.chapter);
export const unlocked = (id, completed) => {
  const index = jobs.findIndex((j) => j.id === id);
  return index === 0 || (index > 0 && completed.includes(jobs[index - 1].id));
};
export const chapterUnlocked = (id, completed) =>
  unlocked(jobs.find((j) => j.chapter === id).id, completed);

export function createGame(jobId = "memory") {
  return {
    jobId,
    unplugged: false,
    grounded: false,
    screws: 4,
    panelOpen: false,
    inspected: [],
    selected: null,
    repairStep: 0,
    fixed: false,
    tested: false,
    quizPassed: false,
    delivered: false,
    tool: "inspect",
    mistakes: 0,
    log: ["工单已接收。先读一读客户描述，再动手检查。"],
  };
}

export function objective(s) {
  const job = jobs.find((j) => j.id === s.jobId);
  const pc = job.chapter === "pc",
    cover = pc ? "机箱侧板" : job.chapter === "fan" ? "风扇前护网" : "设备外壳";
  if (s.delivered)
    return {
      text: "工单已完成，去看看下一位客人吧",
      action: "next",
      label: "挑选下一张工单",
      tool: null,
    };
  if (s.tested && !s.quizPassed)
    return {
      text: "维修成功！用一道小题记住今天的知识",
      action: "quiz",
      label: "完成维修小测",
      tool: null,
    };
  if (s.quizPassed)
    return {
      text: "一切正常，把设备交还给客人吧",
      action: "deliver",
      label: "交付设备",
      tool: null,
    };
  if (!s.fixed && !s.unplugged)
    return {
      text: pc ? "动手前，先关闭电源并拔掉电源线" : "拆装前，先断开 USB 供电",
      action: "unplug",
      label: pc ? "关闭电源并拔线" : "拔下 USB 电源线",
      tool: null,
    };
  if (!s.fixed && !s.grounded)
    return {
      text: "戴好防静电腕带，保护敏感的电子零件",
      action: "ground",
      label: "戴好防静电腕带",
      tool: null,
    };
  if (!s.fixed && s.screws > 0)
    return {
      text: `卸下${cover}的固定螺丝，还剩 ${s.screws} 颗`,
      action: "unscrew",
      label: "卸下一颗螺丝",
      tool: "driver",
    };
  if (!s.fixed && !s.panelOpen)
    return {
      text: `螺丝已取下，现在可以移开${cover}了`,
      action: "open",
      label: `移开${cover}`,
      tool: "hand",
    };
  if (!s.fixed && !s.inspected.includes(job.target))
    return {
      text: "点击零件观察，寻找与症状有关的线索",
      action: "inspect",
      label: "检查选中的零件",
      tool: "inspect",
    };
  if (!s.fixed) {
    const step = job.steps[s.repairStep];
    return {
      text: step.text,
      action: "repair",
      label: step.text,
      tool: step.tool,
    };
  }
  if (s.panelOpen)
    return {
      text: `零件已修复，装回${cover}`,
      action: "close",
      label: `装回${cover}`,
      tool: "hand",
    };
  if (s.screws < 4)
    return {
      text: `装回固定螺丝，还剩 ${4 - s.screws} 颗`,
      action: "screw",
      label: "装回一颗螺丝",
      tool: "driver",
    };
  if (s.unplugged)
    return {
      text: "外壳装好了，接回电源线",
      action: "plug",
      label: "接回电源线",
      tool: null,
    };
  return {
    text: pc
      ? "按下电源键，验证维修结果"
      : job.chapter === "fan"
        ? "通电检查转动、送风和异响"
        : "连接电脑，检查按键输入与设备识别",
    action: "test",
    label: pc ? "开机验证" : "通电验证",
    tool: null,
  };
}

export function transition(state, action, value, inventory = starterTools) {
  const s = { ...state, inspected: [...state.inspected], log: [...state.log] };
  const job = jobs.find((j) => j.id === s.jobId);
  const add = (msg) => {
    s.log = [...s.log, msg].slice(-30);
    return { state: s, message: msg, ok: true };
  };
  const fail = (msg) => {
    s.mistakes++;
    return { state: s, message: msg, ok: false };
  };
  if (action === "tool") {
    if (!inventory.includes(value))
      return fail("这件工具还没购入，去装备市场看看吧。");
    if (tools.some((t) => t.id === value)) s.tool = value;
    return { state: s, ok: true };
  }
  if (action === "select") {
    if (chapterOf(job).parts.includes(value)) s.selected = value;
    return { state: s, ok: true };
  }
  if (action === "inspect") {
    if (!s.panelOpen) return fail("先断电，再打开外壳，才能检查内部零件。");
    if (s.tool !== "inspect") return fail("选中「观察」工具，再检查零件。");
    if (!s.selected) return fail("点击设备里的零件，或者下方的零件名称。");
    if (!s.inspected.includes(s.selected)) s.inspected.push(s.selected);
    return add(
      s.selected === job.target
        ? `发现线索：${parts[s.selected].fault}`
        : `${parts[s.selected].name}：未发现与本次故障相关的异常。`,
    );
  }
  const goal = objective(s);
  if (action !== goal.action) return fail(`先完成这一步：${goal.text}`);
  if (goal.tool && s.tool !== goal.tool)
    return fail(
      `这一步需要「${tools.find((t) => t.id === goal.tool).name}」工具。`,
    );
  if (goal.tool && !inventory.includes(goal.tool))
    return fail("先到装备市场购入这件工具。");
  if (action === "repair" && job.needs.some((id) => !inventory.includes(id)))
    return fail("此工单所需套件尚未备齐，请先到装备市场采购。");
  switch (action) {
    case "unplug":
      s.unplugged = true;
      return add(
        job.chapter === "pc"
          ? "已关机、关闭电源开关并拔下电源线。"
          : "USB 电源已断开，开始低压设备拆装。",
      );
    case "ground":
      s.grounded = true;
      return add(
        "防静电腕带已连接至合适的接地点。现实操作应按设备与腕带说明连接。",
      );
    case "unscrew":
      s.screws--;
      return add(`外壳固定螺丝已取下 ${4 - s.screws}/4 颗。`);
    case "open":
      s.panelOpen = true;
      return add("外壳已放到一旁。现在可以观察内部零件。");
    case "repair": {
      if (s.selected !== job.target)
        return fail(`先选中${parts[job.target].name}，再进行这一步操作。`);
      s.repairStep++;
      s.fixed = s.repairStep >= job.steps.length;
      return add(
        s.fixed
          ? `${parts[job.target].name}已处理完成。装回外壳后，再通电测试。`
          : `${goal.text}，完成。`,
      );
    }
    case "close":
      s.panelOpen = false;
      return add("设备外壳已装回。");
    case "screw":
      s.screws++;
      return add(`外壳螺丝已固定 ${s.screws}/4 颗。`);
    case "plug":
      s.unplugged = false;
      return add("电源线已接回，准备验证。");
    case "test":
      s.tested = true;
      return add(
        job.chapter === "pc"
          ? "POST 自检通过，系统正常启动。维修验证成功！"
          : job.chapter === "fan"
            ? "通电模拟测试通过：转动顺畅、送风正常、没有异常噪声。"
            : "模拟输入测试通过：按键输入与 USB 识别均正常。",
      );
    case "quiz":
      if (value !== job.correct) return fail("再想一想，可以翻一翻硬件图鉴。");
      s.quizPassed = true;
      return add(job.explanation);
    case "deliver":
      s.delivered = true;
      return add(
        `设备已交还给${job.customer}。你完成了一次有证据、有验证的维修！`,
      );
    default:
      return { state, ok: false, message: "请从工单列表选择下一张工单。" };
  }
}

export function progress(s) {
  return [
    s.unplugged || s.fixed,
    s.grounded,
    s.panelOpen || s.fixed,
    s.inspected.includes(jobs.find((j) => j.id === s.jobId).target),
    s.fixed,
    s.tested,
    s.delivered,
  ].filter(Boolean).length;
}
