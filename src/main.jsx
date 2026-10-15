import React, { useEffect, useReducer, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Wrench,
  BookOpen,
  ClipboardList,
  NotebookPen,
  ArrowUpRight,
  ArrowRight,
  ChevronRight,
  Search,
  Hand,
  Wind,
  Cable,
  Check,
  CheckCheck,
  CircleHelp,
  Power,
  ShieldCheck,
  Clock3,
  X,
  Volume2,
  VolumeX,
  Lightbulb,
  Cpu,
  MemoryStick,
  HardDrive,
  Fan,
  CircuitBoard,
  Zap,
  Trophy,
  RotateCcw,
  PackageCheck,
  Mail,
  Sparkles,
  ShoppingBag,
  LockKeyhole,
  Droplets,
  Gauge,
  Grip,
  Package,
  Keyboard,
  Mouse,
  Gamepad2,
  Smartphone,
  Tv,
  Refrigerator,
  Microwave,
  Car,
  Plane,
  Map,
} from "lucide-react";
import Workbench from "./Workbench.jsx";
import {
  parts,
  jobs,
  tools,
  createGame,
  objective,
  transition,
  progress,
  chapters,
  market,
  starterTools,
  unlocked,
  chapterUnlocked,
  chapterOf,
} from "./game.js";
import { toolLessons } from "./tutorials.js";
import { roadmap } from "./roadmap.js";
import { isDirectAction, supportsDirectJob } from "./DirectPC.js";
import "./styles.css";

const STORE = "little-repair-shop-v2";
const icons = {
  Search,
  Wrench,
  Hand,
  Wind,
  Cable,
  Droplets,
  Gauge,
  Grip,
  Package,
  Cpu,
  Fan,
  Keyboard,
  Lightbulb,
  Mouse,
  Gamepad2,
  Smartphone,
  Tv,
  Refrigerator,
  Microwave,
  Car,
  Plane,
};
const partIcons = {
  ram: MemoryStick,
  cooler: Fan,
  storage: HardDrive,
  gpu: Cpu,
  motherboard: CircuitBoard,
  psu: Zap,
  fanBlade: Fan,
  fanMotor: Cpu,
  fanCable: Cable,
  keycap: Keyboard,
  keySwitch: Grip,
  keyPcb: CircuitBoard,
};
const balance = (p) =>
  200 +
  jobs
    .filter((j) => p.completed.includes(j.id))
    .reduce((sum, j) => sum + j.reward, 0) -
  p.purchased.reduce(
    (sum, id) => sum + (market.find((m) => m.id === id)?.price || 0),
    0,
  );
function initial() {
  const fresh = {
    game: createGame(),
    completed: [],
    learned: [],
    purchased: [],
    seen: [],
    event: null,
  };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE));
    if (saved?.version === 2 && jobs.some((j) => j.id === saved.game?.jobId)) {
      const s = saved.game,
        base = createGame(s.jobId);
      if (
        Object.keys(base).every(
          (k) => k === "selected" || typeof s[k] === typeof base[k],
        ) &&
        Array.isArray(s.inspected) &&
        Array.isArray(s.log) &&
        Number.isInteger(s.screws) &&
        s.screws >= 0 &&
        s.screws <= 4 &&
        Number.isInteger(s.repairStep) &&
        s.repairStep >= 0 &&
        s.repairStep <= jobs.find((j) => j.id === s.jobId).steps.length &&
        (s.selected === null || parts[s.selected]) &&
        tools.some((t) => t.id === s.tool)
      ) {
        return {
          ...fresh,
          game: {
            ...s,
            inspected: s.inspected.filter((id) => parts[id]),
            log: s.log.filter((x) => typeof x === "string").slice(-30),
          },
          completed: Array.isArray(saved.completed)
            ? [
                ...new Set(
                  saved.completed.filter((id) => jobs.some((j) => j.id === id)),
                ),
              ]
            : [],
          learned: Array.isArray(saved.learned)
            ? [...new Set(saved.learned.filter((id) => parts[id]))]
            : [],
          purchased: Array.isArray(saved.purchased)
            ? [
                ...new Set(
                  saved.purchased.filter((id) =>
                    market.some((m) => m.id === id),
                  ),
                ),
              ]
            : [],
          seen: Array.isArray(saved.seen)
            ? saved.seen.filter((x) => typeof x === "string")
            : [],
        };
      }
    }
  } catch {
    /* A missing or invalid save starts a fresh shop. */
  }
  return fresh;
}
function reducer(profile, a) {
  if (a.type === "seen")
    return { ...profile, seen: [...new Set([...profile.seen, a.id])] };
  if (a.type === "buy") {
    const item = market.find((m) => m.id === a.id);
    if (!item || profile.purchased.includes(a.id)) return profile;
    if (
      !chapterUnlocked(item.chapter, profile.completed) ||
      balance(profile) < item.price
    )
      return {
        ...profile,
        event: {
          message: "还没有满足购买条件，继续完成工单赚取维修费吧。",
          ok: false,
          serial: Date.now(),
        },
      };
    return {
      ...profile,
      purchased: [...profile.purchased, item.id],
      event: {
        message: `${item.name}已放进工具箱。`,
        ok: true,
        serial: Date.now(),
      },
    };
  }
  if (a.type === "job") {
    if (!unlocked(a.id, profile.completed)) return profile;
    return {
      ...profile,
      game: createGame(a.id),
      event: {
        message: "新工单已放到工作台，开始接诊吧。",
        ok: true,
        serial: Date.now(),
      },
    };
  }
  const result = transition(profile.game, a.action, a.value, [
    ...starterTools,
    ...profile.purchased,
  ]);
  return {
    ...profile,
    game: result.state,
    learned:
      a.action === "inspect" && result.ok
        ? [...new Set([...profile.learned, result.state.selected])]
        : profile.learned,
    completed:
      a.action === "deliver" && result.ok
        ? [...new Set([...profile.completed, result.state.jobId])]
        : profile.completed,
    event: result.message
      ? {
          message: result.message,
          ok: result.ok,
          serial: (profile.event?.serial || 0) + 1,
          discovery:
            a.action === "inspect" &&
            result.ok &&
            !profile.learned.includes(result.state.selected)
              ? result.state.selected
              : null,
        }
      : profile.event,
  };
}
function App() {
  const [profile, dispatch] = useReducer(reducer, undefined, initial);
  const [modal, setModal] = useState(null),
    [encyclopediaPart, setEncyclopediaPart] = useState("ram");
  const [exploded, setExploded] = useState(false),
    [showLabels, setShowLabels] = useState(true),
    [hint, setHint] = useState(false),
    [muted, setMuted] = useState(true),
    [toast, setToast] = useState(null),
    [quizChoice, setQuizChoice] = useState(null),
    [saveError, setSaveError] = useState(false);
  const [chapterTab, setChapterTab] = useState("pc"),
    [guide, setGuide] = useState(null);
  const [plannedChapter, setPlannedChapter] = useState(roadmap[0]);
  const [manual, setManual] = useState(true);
  const { game, completed, learned } = profile;
  const job = jobs.find((j) => j.id === game.jobId),
    goal = objective(game),
    selected = parts[game.selected];
  const chapter = chapterOf(job),
    inventory = [...starterTools, ...profile.purchased];
  const direct = manual && supportsDirectJob(game.jobId);
  const visibleTools = tools.filter(
    (t) =>
      starterTools.includes(t.id) ||
      inventory.includes(t.id) ||
      job.needs.includes(t.id),
  );
  const earned = jobs.filter((j) => completed.includes(j.id));
  const xp = earned.reduce((sum, j) => sum + j.xp, 0),
    coins = balance(profile);
  const act = (action, value) => dispatch({ type: "act", action, value });
  useEffect(() => {
    try {
      localStorage.setItem(
        STORE,
        JSON.stringify({
          version: 2,
          game,
          completed,
          learned,
          purchased: profile.purchased,
          seen: profile.seen,
        }),
      );
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  }, [game, completed, learned, profile.purchased, profile.seen]);
  useEffect(() => {
    if (!profile.event) return;
    setToast(profile.event);
    if (profile.event.discovery) {
      setGuide({ type: "part", id: profile.event.discovery });
      setModal("tutorial");
    }
    const timer = setTimeout(() => setToast(null), 5200);
    return () => clearTimeout(timer);
  }, [profile.event]);
  useEffect(() => {
    if (game.tested && !game.quizPassed) {
      setQuizChoice(null);
      setModal("quiz");
    }
  }, [game.tested]);
  useEffect(() => {
    if (game.delivered) setModal("success");
  }, [game.delivered]);
  useEffect(() => {
    const handler = (e) => {
      if (["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
      if (e.key === "Escape") {
        setModal(null);
        return;
      }
      if (modal) return;
      const t = visibleTools.find((t) => t.key === e.key);
      if (t) selectTool(t.id);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [modal, game.jobId, profile.purchased, profile.seen]);
  function selectTool(id) {
    if (!inventory.includes(id)) {
      setModal("market");
      return;
    }
    act("tool", id);
    const lessonId = `tool:${id}:${["puller", "meter"].includes(id) ? job.id : chapter.id}`;
    if (!profile.seen.includes(lessonId)) {
      dispatch({ type: "seen", id: lessonId });
      setGuide({ type: "tool", id });
      setModal("tutorial");
    }
  }
  function playClick() {
    if (muted) return;
    try {
      const audio = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audio.createOscillator(),
        gain = audio.createGain();
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.frequency.setValueAtTime(660, audio.currentTime);
      gain.gain.setValueAtTime(0.035, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.08);
      oscillator.start();
      oscillator.stop(audio.currentTime + 0.09);
      oscillator.onended = () => audio.close();
    } catch {
      /* Sound is optional. */
    }
  }
  function primary() {
    if (direct && isDirectAction(game)) return;
    playClick();
    if (goal.action === "quiz") {
      setModal("quiz");
      return;
    }
    if (goal.action === "next") {
      setModal("jobs");
      return;
    }
    act(goal.action);
  }
  function startJob(id) {
    if (!unlocked(id, completed)) return;
    dispatch({ type: "job", id });
    setModal(null);
    setHint(false);
    setExploded(false);
    const nextChapter = chapterOf(jobs.find((j) => j.id === id));
    if (!profile.seen.includes(`chapter:${nextChapter.id}`)) {
      dispatch({ type: "seen", id: `chapter:${nextChapter.id}` });
      setGuide({ type: "chapter", id: nextChapter.id });
      setModal("tutorial");
    }
  }
  const steps = [
    {
      title: "安全准备",
      sub: "断开电源，做好静电防护",
      done: game.grounded,
      active: !game.grounded,
    },
    {
      title: "打开外壳",
      sub: "取下螺丝，移开外壳",
      done: game.panelOpen || game.fixed,
      active: game.grounded && !game.panelOpen && !game.fixed,
    },
    {
      title: "检查与维修",
      sub: "寻找线索，处理故障",
      done: game.fixed,
      active: game.panelOpen && !game.fixed,
    },
    {
      title: "开机验证",
      sub: "装回外壳，验证维修结果",
      done: game.tested,
      active: game.fixed && !game.tested,
    },
  ];
  return (
    <div className="app">
      <header className="topbar">
        <a href="#" className="brand" onClick={(e) => e.preventDefault()}>
          <span className="brand-mark">
            <Wrench size={23} strokeWidth={2.2} />
          </span>
          <div>
            <strong>
              小小修理铺<span className="brand-dot">.</span>
            </strong>
            <small>LITTLE REPAIR SHOP</small>
          </div>
        </a>
        <nav aria-label="主要导航">
          <button
            className={!modal ? "active" : ""}
            onClick={() => setModal(null)}
          >
            <Wrench size={16} />
            工作台
          </button>
          <button
            className={modal === "jobs" ? "active" : ""}
            onClick={() => setModal("jobs")}
          >
            <ClipboardList size={16} />
            维修工单
            <span className="nav-count">{jobs.length - completed.length}</span>
          </button>
          <button
            className={modal === "market" ? "active" : ""}
            onClick={() => setModal("market")}
          >
            <ShoppingBag size={16} />
            装备市场
          </button>
          <button
            className={modal === "book" ? "active" : ""}
            onClick={() => setModal("book")}
          >
            <BookOpen size={16} />
            硬件图鉴
          </button>
          <button
            className={modal === "notes" ? "active" : ""}
            onClick={() => setModal("notes")}
          >
            <NotebookPen size={16} />
            我的笔记
          </button>
        </nav>
        <div className="profile">
          <div className="xp-label">
            <span>
              Lv.{1 + Math.floor(xp / 150)}{" "}
              <b>{xp >= 150 ? "见习修理师" : "修理学徒"}</b>
            </span>
            <div className="xp-track">
              <i style={{ width: `${(xp % 150) / 1.5}%` }} />
            </div>
          </div>
          <span className="profile-avatar">你</span>
        </div>
      </header>
      <main>
        <div className="page-intro">
          <div>
            <div className="eyebrow">
              <span className="open-dot" /> 修理铺营业中{" "}
              <span className="slash">/</span> MAKE THINGS WORK AGAIN
            </div>
            <h1>
              每个小故障，都有新发现<span>。</span>
            </h1>
            <p>不懂硬件也没关系。第一件修好的设备，就从这里开始。</p>
          </div>
          <div className="shop-stats">
            <div>
              <span>已修复设备</span>
              <strong>
                {String(completed.length).padStart(2, "0")}
                <small> 台</small>
              </strong>
            </div>
            <i />
            <div>
              <span>修理铺资金</span>
              <strong>
                <small>¥ </small>
                {coins.toLocaleString()}
              </strong>
            </div>
            <span className="shop-stamp">
              修好
              <br />
              如初<small>EST. 2026</small>
            </span>
          </div>
        </div>
        <div className="operation-mode">
          <span>
            <Hand size={14} />
            操作方式
          </span>
          <button
            className={direct ? "active" : ""}
            disabled={!supportsDirectJob(game.jobId)}
            onClick={() => {
              setManual(true);
              setExploded(false);
            }}
          >
            3D 手动实操
          </button>
          <button
            className={!direct ? "active" : ""}
            onClick={() => setManual(false)}
          >
            辅助教学
          </button>
          <small>
            {game.jobId === "memory"
              ? "手动旋拧、释放卡扣、轴向拔插；对齐不会自动连接。"
              : game.jobId === "cooling"
                ? "手动旋拧、移开侧板、固定叶片、逐处气吹清灰。"
                : game.jobId === "storage"
                  ? "区分供电与数据接口；按锁扣拔出、对准缺口推入，再检查固定。"
                  : game.jobId === "fan-dust"
                    ? "旋拧护网螺丝、向外拉脱定位柱并移开护网；固定叶片，分别清洁后手动复装。"
                    : "本关目前为辅助教学；前四关已开放手动实操。"}
          </small>
        </div>
        <div className="workspace">
          <aside className="order-panel">
            <div className="section-top">
              <span>
                <ClipboardList size={15} />
                当前工单
              </span>
              <span className="mono">#{job.number}</span>
            </div>
            <div className="chapter-indicator">
              CH.{chapter.number} / {chapter.title}
              <span>{job.rank} / 3</span>
            </div>
            <div className="order-heading">
              <span className="tag orange">{job.difficulty}工单</span>
              <span className="time">
                <Clock3 size={12} />
                {job.duration}
              </span>
              <h2>{job.title}</h2>
              <p>{job.device}</p>
            </div>
            <div className="customer-note">
              <div className="customer">
                <span>{job.avatar}</span>
                <div>
                  <b>{job.customer}的留言</b>
                  <small>刚刚送到店里</small>
                </div>
                <Mail size={15} />
              </div>
              <p>{job.quote}</p>
              <div className="note-fold" />
            </div>
            <div className="symptom">
              <span>故障现象</span>
              <p>
                <span />
                {job.symptom}
              </p>
            </div>
            <div className="repair-steps">
              <div className="small-heading">
                维修路线<span>{steps.filter((s) => s.done).length} / 4</span>
              </div>
              {steps.map((s, i) => (
                <div
                  key={s.title}
                  className={`repair-step ${s.done ? "done" : ""} ${s.active ? "current" : ""}`}
                >
                  <span className="step-number">
                    {s.done ? <Check size={13} /> : `0${i + 1}`}
                  </span>
                  <div>
                    <b>{s.title}</b>
                    <p>{s.sub}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="reward">
              <span>工单报酬</span>
              <strong>
                ¥ {job.reward}
                <small>+{job.xp} XP</small>
              </strong>
            </div>
            <button
              className="text-button all-jobs"
              onClick={() => setModal("jobs")}
            >
              查看全部工单
              <ArrowUpRight size={15} />
            </button>
          </aside>
          <section className="bench-panel" aria-label="维修工作台">
            <div className="bench-header">
              <div>
                <span className="bench-tab" />
                <b>01 号工作台</b>
                <span className="device-label">
                  {chapter.id === "pc"
                    ? "DESKTOP PC"
                    : chapter.id === "fan"
                      ? "USB FAN"
                      : "MECHANICAL KEYBOARD"}
                </span>
              </div>
              <span className={`power-status ${game.unplugged ? "safe" : ""}`}>
                <span />
                {game.tested
                  ? "设备运行正常"
                  : game.unplugged
                    ? "电源已断开"
                    : "电源已连接"}
              </span>
            </div>
            <div className="scene-area">
              <div className="scene-top-note">
                <span className="mono">LRS — {job.number}</span>
                <small>
                  {game.panelOpen
                    ? "外壳已打开 · 可检查内部零件"
                    : "选择工具，开始你的维修"}
                </small>
              </div>
              <Workbench
                game={game}
                act={act}
                exploded={exploded}
                setExploded={setExploded}
                showLabels={showLabels}
                setShowLabels={setShowLabels}
                direct={direct}
                onFallback={() => setManual(false)}
              />
              <div className="part-selector" aria-label="选择零件">
                {chapter.parts.map((id) => {
                  const p = parts[id],
                    Icon = partIcons[id];
                  return (
                    <button
                      key={id}
                      className={game.selected === id ? "selected" : ""}
                      onClick={() => act("select", id)}
                      title={p.name}
                    >
                      <Icon size={13} />
                      {p.name.replace("CPU ", "")}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="tool-tray">
              <div className="tool-title">
                <Wrench size={14} />
                <span>
                  工具台<small>选对工具，再动手</small>
                </span>
              </div>
              <div className="tools" role="group" aria-label="维修工具">
                {visibleTools.map((t) => {
                  const Icon = icons[t.icon];
                  return (
                    <button
                      key={t.id}
                      className={`${game.tool === t.id ? "selected" : ""} ${!inventory.includes(t.id) ? "locked-tool" : ""}`}
                      onClick={() => {
                        playClick();
                        selectTool(t.id);
                      }}
                      aria-pressed={game.tool === t.id}
                      title={t.detail}
                    >
                      <span className="tool-key">
                        {inventory.includes(t.id) ? (
                          t.key
                        ) : (
                          <LockKeyhole size={9} />
                        )}
                      </span>
                      <Icon size={22} strokeWidth={1.5} />
                      <span>{t.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="action-area">
              {job.needs.some((id) => !inventory.includes(id)) && (
                <button
                  className="equipment-needed"
                  onClick={() => setModal("market")}
                >
                  <ShoppingBag size={14} />
                  本关需要新装备：
                  {job.needs
                    .filter((id) => !inventory.includes(id))
                    .map((id) => market.find((m) => m.id === id)?.name)
                    .join("、")}
                  <ArrowUpRight size={14} />
                </button>
              )}
              <div className="action-info">
                <span className="instruction-icon">
                  <ArrowRight size={17} />
                </span>
                <div>
                  <small>下一步 · YOUR MOVE</small>
                  <p>{goal.text}</p>
                </div>
                <button
                  className="hint-button"
                  onClick={() => setHint(!hint)}
                  title="显示操作提示"
                  aria-label="显示操作提示"
                >
                  <Lightbulb size={17} />
                </button>
              </div>
              {hint && (
                <p className="hint-text">
                  {goal.tool
                    ? `先在工具台选择「${tools.find((t) => t.id === goal.tool).name}」。`
                    : ""}
                  {goal.action === "inspect"
                    ? `线索：这张工单与${parts[job.target].name}有关，选中它再点击检查。`
                    : goal.action === "repair"
                      ? direct
                        ? ["cooling", "fan-dust"].includes(game.jobId)
                          ? "在叶片标记上长按固定，再换气吹，对准每处积灰短按约半秒并松开。"
                          : game.jobId === "storage"
                            ? "先用拆装工具轻推供电接头；再用接线工具按住数据接头的金属锁扣约半秒，保持按住沿箭头拔出，重新对位推入并轻拉检查。"
                            : "选择拆装工具，在 3D 视图中沿结构操作；对齐后要主动推入。"
                        : `选中${parts[job.target].name}，点击下方按钮完成操作。`
                      : direct && isDirectAction(game)
                        ? "按 3D 视图中的旋转或平移提示，实际操作零件。"
                        : "点击下方按钮，完成这一步操作。"}
                </p>
              )}
              <button
                className="primary-action"
                onClick={primary}
                data-testid="primary-action"
                disabled={direct && isDirectAction(game)}
              >
                {goal.action === "test" ? (
                  <Power size={16} />
                ) : goal.action === "deliver" ? (
                  <PackageCheck size={16} />
                ) : (
                  <Wrench size={15} />
                )}
                {direct && isDirectAction(game)
                  ? "在 3D 工作台上完成此操作"
                  : goal.label}
                <ArrowRight size={16} />
              </button>
            </div>
          </section>
          <aside className="knowledge-panel">
            <div className="section-top">
              <span>
                <Search size={15} />
                零件观察
              </span>
              <span className="live-dot" />
            </div>
            {selected ? (
              <>
                <div
                  className="component-illustration"
                  style={{ "--part-color": selected.color }}
                >
                  <PartDrawing id={game.selected} />
                  <span className="part-no">
                    PART /{" "}
                    {String(
                      Object.keys(parts).indexOf(game.selected) + 1,
                    ).padStart(2, "0")}
                  </span>
                </div>
                <div className="part-details">
                  <span className="eyebrow">{selected.en}</span>
                  <h2>{selected.name}</h2>
                  <span className="spec">{selected.spec}</span>
                  <div className="analogy">
                    <Lightbulb size={15} />
                    <span>{selected.analogy}</span>
                  </div>
                  <p>{selected.description}</p>
                  <button
                    className="text-button"
                    onClick={() => {
                      setEncyclopediaPart(game.selected);
                      setModal("book");
                    }}
                  >
                    在图鉴中了解更多
                    <ArrowUpRight size={13} />
                  </button>
                </div>
                <div
                  className={`inspection-result ${game.inspected.includes(game.selected) ? "inspected" : ""}`}
                >
                  <span>
                    {game.inspected.includes(game.selected) ? (
                      <CheckCheck size={15} />
                    ) : (
                      <Search size={15} />
                    )}
                    {game.inspected.includes(game.selected)
                      ? "观察记录"
                      : "动手检查"}
                  </span>
                  <p>
                    {game.inspected.includes(game.selected)
                      ? game.selected === job.target
                        ? selected.fault
                        : "外观及连接未发现与本次故障有关的异常。"
                      : game.panelOpen
                        ? "选中「观察」工具，检查这个零件。"
                        : "先断电并打开外壳，看看它的实际情况。"}
                  </p>
                  {game.panelOpen && (
                    <button onClick={() => act("inspect")}>
                      检查{selected.name}
                      <ArrowRight size={13} />
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="empty-inspector">
                  <div className="empty-graphic">
                    <Search size={37} strokeWidth={1} />
                    <span className="orbit orbit-one" />
                    <span className="orbit orbit-two" />
                    <i>+</i>
                    <b>+</b>
                  </div>
                  <h3>认识你的{chapter.product}</h3>
                  <p>
                    点击设备上的零件标签，
                    <br />
                    看看它叫什么、有什么用。
                  </p>
                  <span className="tag">没有基础，也可以开始</span>
                </div>
                <div className="beginner-note">
                  <span>
                    <Lightbulb size={16} />
                    修理师的小习惯
                  </span>
                  <p>
                    先观察，再判断。
                    <br />
                    不要一看到黑屏，就急着换显卡。
                  </p>
                  <small>好的维修，从找到证据开始。</small>
                </div>
              </>
            )}
            <div className="notebook-link">
              <div className="notebook-icon">
                <NotebookPen size={22} strokeWidth={1.4} />
              </div>
              <div>
                <b>把知识装进口袋</b>
                <p>
                  已认识 {learned.length} / {Object.keys(parts).length} 个零件
                </p>
              </div>
              <button
                onClick={() => setModal("notes")}
                aria-label="打开我的笔记"
              >
                <ArrowUpRight size={17} />
              </button>
            </div>
          </aside>
        </div>
        <div className="under-workspace">
          <span>
            <ShieldCheck size={14} />
            安心试错，这是你的练习工作台。
          </span>
          <span>
            <span className="save-dot" />
            {saveError ? "当前浏览器无法存档" : "进度已自动保存在本机"}
            <span className="divider">|</span>
            <button onClick={() => setModal("help")}>
              <CircleHelp size={13} />
              新手指南
            </button>
          </span>
        </div>
        <div className="bottom-note">
          <span className="mini-wrench">
            <Wrench size={14} />
          </span>
          <p>拆开的是设备，装回的是好奇心。</p>
          <span>一间小铺，慢慢学会修理。</span>
          <button
            onClick={() => setMuted(!muted)}
            aria-label={muted ? "开启操作音效" : "关闭操作音效"}
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>
      </main>
      {toast && (
        <div role="status" className={`toast ${toast.ok ? "" : "warning"}`}>
          {toast.ok ? <Check size={16} /> : <Lightbulb size={16} />}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} aria-label="关闭提示">
            <X size={14} />
          </button>
        </div>
      )}
      {modal && (
        <Modal
          key={modal}
          title={
            {
              roadmap: "完整章节地图",
              plan: "下一段修理旅程",
              market: "修理师的装备市场",
              tutorial: "新发现，先认识一下",
              jobs: "章节与维修工单",
              book: "硬件图鉴",
              notes: "我的维修笔记",
              help: "欢迎来到小小修理铺",
              quiz: "修好了，也学会了",
              success: "又一件设备，重获新生。",
            }[modal]
          }
          subtitle={
            {
              roadmap: "从身边的小物件，一路认识更复杂的机械世界。",
              plan: "章节设计预览 · 尚未开放试玩",
              market: "把赚来的维修费，换成解决新问题的能力。",
              tutorial: "先理解原理，再带着新知识动手。",
              jobs: "三个章节，九次修理。从认识零件到独立排查。",
              book: "用熟悉的比喻，理解陌生的零件。",
              notes: "你亲手检查过的零件，会记录在这里。",
              help: "跟着工单，把第一件设备修好。",
              quiz: "只要一道小题，把今天的知识留下来。",
              success: "谢谢你，用耐心找到了问题。",
            }[modal]
          }
          onClose={() => setModal(null)}
        >
          {modal === "jobs" && (
            <>
              <button
                className="roadmap-entry"
                onClick={() => setModal("roadmap")}
              >
                <Map size={20} />
                <div>
                  <b>不止修电脑：12 章修理世界</b>
                  <span>鼠标、灯具、手柄、手机、家电、汽车与飞机……</span>
                </div>
                <ArrowUpRight size={17} />
              </button>
              <div className="chapter-tabs">
                {chapters.map((c) => {
                  const Icon = icons[c.icon],
                    open = chapterUnlocked(c.id, completed);
                  return (
                    <button
                      key={c.id}
                      className={chapterTab === c.id ? "active" : ""}
                      onClick={() => setChapterTab(c.id)}
                    >
                      <span>
                        CH.{c.number}
                        {!open && <LockKeyhole size={12} />}
                      </span>
                      <Icon size={25} />
                      <b>{c.title}</b>
                      <small>
                        {
                          jobs.filter(
                            (j) =>
                              j.chapter === c.id && completed.includes(j.id),
                          ).length
                        }{" "}
                        / 3 已完成
                      </small>
                    </button>
                  );
                })}
              </div>
              <p className="chapter-description">
                {chapters.find((c) => c.id === chapterTab).subtitle}
              </p>
              <div className="job-list">
                {jobs
                  .filter((j) => j.chapter === chapterTab)
                  .map((j) => {
                    const open = unlocked(j.id, completed);
                    return (
                      <button
                        disabled={!open}
                        className={`job-card ${j.id === game.jobId ? "current-job" : ""} ${!open ? "locked-job" : ""}`}
                        key={j.id}
                        onClick={() => startJob(j.id)}
                      >
                        <span className="job-card-number">{j.number}</span>
                        <div>
                          <span className="tag">
                            {j.difficulty} · {j.lesson}
                          </span>
                          <h3>{j.title}</h3>
                          <p>
                            {j.customer} · {j.duration} · ¥{j.reward}
                          </p>
                        </div>
                        <span className="job-card-state">
                          {completed.includes(j.id) ? (
                            <>
                              <Check size={16} />
                              已完成 · 可重玩
                            </>
                          ) : !open ? (
                            <>
                              <LockKeyhole size={14} />
                              先通过上一关
                            </>
                          ) : j.id === game.jobId ? (
                            "重新接诊"
                          ) : (
                            "接下工单"
                          )}
                          {open && <ArrowRight size={16} />}
                        </span>
                      </button>
                    );
                  })}
                <p className="modal-footnote">
                  每过一关，解锁下一关。切换或重新接诊会重置当前拆装进度；知识和装备会保留，重复维修不重复发放奖励。
                </p>
              </div>
            </>
          )}
          {modal === "market" && (
            <>
              <div className="market-wallet">
                <ShoppingBag size={24} />
                <div>
                  <small>你的维修基金</small>
                  <b>¥ {coins}</b>
                </div>
                <span>工具和教学套件为永久装备，无重复消耗。</span>
              </div>
              <div className="market-grid">
                {market.map((item) => {
                  const Icon = icons[item.icon],
                    owned = inventory.includes(item.id),
                    open = chapterUnlocked(item.chapter, completed);
                  return (
                    <article key={item.id} className={owned ? "owned" : ""}>
                      <div className="market-icon">
                        <Icon size={30} strokeWidth={1.3} />
                        {owned && (
                          <span>
                            <Check size={12} />
                          </span>
                        )}
                      </div>
                      <span className="eyebrow">
                        CH.{chapters.find((c) => c.id === item.chapter).number}{" "}
                        EQUIPMENT
                      </span>
                      <h3>{item.name}</h3>
                      <p>{item.description}</p>
                      <div>
                        <strong>¥ {item.price}</strong>
                        <button
                          disabled={owned || !open || coins < item.price}
                          onClick={() => dispatch({ type: "buy", id: item.id })}
                        >
                          {owned
                            ? "已放入工具箱"
                            : !open
                              ? "章节解锁后购买"
                              : coins < item.price
                                ? "维修费不足"
                                : "购买装备"}
                          {!owned && open && coins >= item.price && (
                            <ArrowRight size={13} />
                          )}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
              <p className="modal-footnote">
                观察工具、螺丝刀和基础拆装为初始装备。购入新工具后，首次在每个工单中使用时会出现用途与原理教学。
              </p>
            </>
          )}
          {modal === "tutorial" && guide && (
            <Lesson
              guide={guide}
              chapter={chapter}
              job={job}
              onClose={() => setModal(null)}
            />
          )}
          {modal === "roadmap" && (
            <>
              <div className="roadmap-summary">
                <Map size={22} />
                <span>12 章成长地图 · 当前开放 3 章 / 9 关</span>
                <small>地图为长期课程顺序，试玩从电脑章开始。</small>
              </div>
              <div className="roadmap-grid">
                {roadmap.map((c) => {
                  const Icon = icons[c.icon];
                  return (
                    <button
                      key={c.id}
                      className={c.playable ? "available" : ""}
                      onClick={() => {
                        if (c.playable) {
                          setChapterTab(c.playable);
                          setModal("jobs");
                        } else {
                          setPlannedChapter(c);
                          setModal("plan");
                        }
                      }}
                    >
                      <span className="roadmap-number">
                        {c.order}
                        <small>{c.playable ? "已制作" : "筹备中"}</small>
                      </span>
                      <Icon size={28} strokeWidth={1.4} />
                      <span className="tag">{c.tier}</span>
                      <h3>{c.category}</h3>
                      <p>{c.focus}</p>
                      <span className="roadmap-link">
                        {c.playable ? "查看本章工单" : "查看章节设计"}
                        <ArrowUpRight size={13} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {modal === "plan" && (
            <div className="lesson">
              <div className="lesson-hero">
                {React.createElement(icons[plannedChapter.icon], {
                  size: 46,
                  strokeWidth: 1.3,
                })}
                <span>CHAPTER PLAN / {plannedChapter.order}</span>
                <h3>{plannedChapter.category}</h3>
                <p>{plannedChapter.focus}</p>
              </div>
              <div className="lesson-chapter-steps">
                {plannedChapter.levels.map((title, i) => (
                  <div key={title}>
                    <span>0{i + 1}</span>
                    <b>{title}</b>
                    <small>筹备中</small>
                  </div>
                ))}
              </div>
              <div className="lesson-block">
                <b>将认识的装备</b>
                <p>{plannedChapter.equipment}</p>
              </div>
              <div className="lesson-block tip">
                <b>这章的学习边界</b>
                <p>{plannedChapter.boundary}</p>
              </div>
              <button
                className="primary-action"
                onClick={() => setModal("roadmap")}
              >
                回到章节地图
                <ArrowRight size={16} />
              </button>
            </div>
          )}
          {modal === "book" && (
            <div className="book-layout">
              <div className="book-tabs">
                {Object.entries(parts).map(([id, p]) => {
                  const Icon = partIcons[id];
                  return (
                    <button
                      key={id}
                      className={encyclopediaPart === id ? "active" : ""}
                      onClick={() => setEncyclopediaPart(id)}
                    >
                      <Icon size={17} />
                      {p.name}
                    </button>
                  );
                })}
              </div>
              <article className="book-article">
                <div
                  className="book-drawing"
                  style={{ "--part-color": parts[encyclopediaPart].color }}
                >
                  <PartDrawing id={encyclopediaPart} />
                </div>
                <span className="eyebrow">{parts[encyclopediaPart].en}</span>
                <h3>{parts[encyclopediaPart].name}</h3>
                <b>{parts[encyclopediaPart].analogy}</b>
                <p>{parts[encyclopediaPart].description}</p>
                <div className="book-tip">
                  <Lightbulb size={18} />
                  <p>{parts[encyclopediaPart].tip}</p>
                </div>
                <p className="source-line">
                  资料依据：
                  <a
                    href="https://en.wikipedia.org/wiki/DIMM"
                    target="_blank"
                    rel="noreferrer"
                  >
                    DIMM
                  </a>{" "}
                  ·{" "}
                  <a
                    href="https://en.wikipedia.org/wiki/Serial_ATA"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Serial ATA
                  </a>{" "}
                  ·{" "}
                  <a
                    href="https://en.wikipedia.org/wiki/Computer_cooling"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Computer cooling
                  </a>
                </p>
              </article>
            </div>
          )}
          {modal === "notes" && (
            <>
              <div className="notes-summary">
                <Trophy size={27} />
                <div>
                  <b>
                    {completed.length} 张工单 · {learned.length} 个零件 · {xp}{" "}
                    XP
                  </b>
                  <p>多观察一个零件，就多理解一点机械世界。</p>
                </div>
              </div>
              {learned.length ? (
                <div className="learned-grid">
                  {learned.map((id) => {
                    const Icon = partIcons[id];
                    return (
                      <button
                        key={id}
                        onClick={() => {
                          setEncyclopediaPart(id);
                          setModal("book");
                        }}
                      >
                        <Icon size={24} />
                        <h3>{parts[id].name}</h3>
                        <p>{parts[id].analogy}</p>
                        <span>
                          翻开这一页
                          <ArrowUpRight size={13} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="notes-empty">
                  <NotebookPen size={36} />
                  <p>你的第一篇维修笔记，还在等你亲手写下。</p>
                  <small>打开设备，用「观察」工具检查一个零件即可收录。</small>
                </div>
              )}
              <div className="log-list">
                <h3>本次维修日志</h3>
                {game.log.map((line, i) => (
                  <p key={i}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    {line}
                  </p>
                ))}
              </div>
            </>
          )}
          {modal === "help" && (
            <div className="help-content">
              <div className="help-big">
                <Wrench size={37} />
                <span>
                  不需要经验，
                  <br />
                  <b>只需要一点好奇心。</b>
                </span>
              </div>
              <ol>
                <li>
                  <b>读工单</b>
                  <p>留意客户遇到的现象，跟着左边的维修路线开始。</p>
                </li>
                <li>
                  <b>选工具，再动手</b>
                  <p>
                    使用工具台或数字键 1–8
                    切换工具。前四关默认手动实操：电脑章练习内存、散热清灰和
                    SATA
                    接线；风扇章首关练习护网拆装、固定叶片和分区清灰。辅助教学可用步骤按钮。
                  </p>
                </li>
                <li>
                  <b>观察是最好的老师</b>
                  <p>
                    拖动旋转机箱，滚轮缩放。点击零件标签或下方的零件名，再用观察工具寻找线索。不确定时，点灯泡获取提示。
                  </p>
                </li>
                <li>
                  <b>修好，还要验证</b>
                  <p>
                    装回外壳和螺丝，接电开机，再完成一道小题。交付后获得经验和报酬。
                  </p>
                </li>
              </ol>
              <p className="help-safety">
                这是简化的学习模拟。设备结构、螺丝数量、卡扣形式各有不同；真实拆装应遵循设备手册。游戏中的断电与防静电步骤值得养成习惯。
              </p>
              <button className="primary-action" onClick={() => setModal(null)}>
                回到工作台
                <ArrowRight size={16} />
              </button>
            </div>
          )}
          {modal === "quiz" && (
            <div className="quiz-content">
              <span className="tag orange">工单 #{job.number} · 维修小测</span>
              <h3>{job.question}</h3>
              <div className="quiz-options">
                {job.answers.map((answer, i) => (
                  <button
                    key={i}
                    disabled={game.quizPassed}
                    className={
                      quizChoice === i
                        ? game.quizPassed
                          ? "correct"
                          : "incorrect"
                        : ""
                    }
                    onClick={() => {
                      setQuizChoice(i);
                      act("quiz", i);
                    }}
                  >
                    <span>{String.fromCharCode(65 + i)}</span>
                    {answer}
                    {game.quizPassed && i === job.correct && (
                      <Check size={17} />
                    )}
                  </button>
                ))}
              </div>
              {quizChoice !== null && !game.quizPassed && (
                <p className="quiz-feedback">
                  还差一点，再想想。这次故障的检查结果会帮助你。
                </p>
              )}
              {game.quizPassed && (
                <div className="quiz-explanation">
                  <ShieldCheck size={24} />
                  <p>{job.explanation}</p>
                </div>
              )}
              <button className="primary-action" onClick={() => setModal(null)}>
                {game.quizPassed ? "学会了，准备交付" : "回到工作台看看"}
                <ArrowRight size={16} />
              </button>
            </div>
          )}
          {modal === "success" && (
            <div className="success-content">
              <div className="success-badge">
                <PackageCheck size={44} strokeWidth={1.3} />
                <Sparkles size={19} />
              </div>
              <h3>「太好了，又能用了！」</h3>
              <p>{job.customer}取走了设备，你也多了一份修理经验。</p>
              <div className="success-rewards">
                <span>
                  <b>¥{job.reward}</b>工单报酬
                </span>
                <span>
                  <b>+{job.xp} XP</b>修理经验
                </span>
                <span>
                  <b>{game.mistakes === 0 ? "细心修理师" : "越试越熟练"}</b>
                  本次评价
                </span>
              </div>
              <p className="modal-footnote">
                首次完成此工单会计入奖励；重玩可以复习知识。
              </p>
              <button
                className="primary-action"
                onClick={() => setModal("jobs")}
              >
                看看下一张工单
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function PartDrawing({ id }) {
  const Icon = partIcons[id];
  return (
    <div className={`part-drawing drawing-${id}`}>
      {id === "ram" ? (
        <div className="ram-stick">
          <span />
          <span />
          <span />
          <span />
          <i />
        </div>
      ) : id === "storage" ? (
        <div className="ssd-drawing">
          <HardDrive size={30} />
          <b>SSD</b>
          <small>512 GB</small>
        </div>
      ) : id === "cooler" ? (
        <div className="cooler-drawing">
          <Fan size={64} strokeWidth={1.3} />
        </div>
      ) : (
        <div className="generic-part">
          <Icon size={57} strokeWidth={1.25} />
        </div>
      )}
    </div>
  );
}
function Lesson({ guide, chapter, job, onClose }) {
  if (guide.type === "chapter") {
    const c = chapters.find((c) => c.id === guide.id),
      Icon = icons[c.icon];
    return (
      <div className="lesson">
        <div className="lesson-hero">
          <Icon size={48} strokeWidth={1.3} />
          <span>CHAPTER {c.number}</span>
          <h3>{c.title}</h3>
          <p>{c.subtitle}</p>
        </div>
        <div className="lesson-chapter-steps">
          {jobs
            .filter((j) => j.chapter === c.id)
            .map((j) => (
              <div key={j.id}>
                <span>0{j.rank}</span>
                <b>{j.lesson}</b>
                <small>{j.difficulty}</small>
              </div>
            ))}
        </div>
        <p className="lesson-rule">
          新工具会教你用法，旧工具也会在新设备上发挥不同作用。逐关解锁，用维修费添置装备。
        </p>
        <button className="primary-action" onClick={onClose}>
          进入工作台
          <ArrowRight size={16} />
        </button>
      </div>
    );
  }
  if (guide.type === "part") {
    const p = parts[guide.id];
    return (
      <div className="lesson">
        <div className="lesson-hero">
          <div className="lesson-part" style={{ "--part-color": p.color }}>
            <PartDrawing id={guide.id} />
          </div>
          <span>NEW DISCOVERY / {p.en}</span>
          <h3>{p.name}</h3>
          <p>{p.analogy}</p>
        </div>
        <div className="lesson-block">
          <b>它是怎么工作的？</b>
          <p>{p.description}</p>
        </div>
        <div className="lesson-block tip">
          <b>动手时记住</b>
          <p>{p.tip}</p>
        </div>
        <button className="primary-action" onClick={onClose}>
          认识了，继续修理
          <ArrowRight size={16} />
        </button>
      </div>
    );
  }
  const t = tools.find((t) => t.id === guide.id),
    lesson = toolLessons[guide.id],
    Icon = icons[t.icon];
  return (
    <div className="lesson">
      <div className="lesson-hero">
        <Icon size={46} strokeWidth={1.2} />
        <span>TOOL LESSON / {chapter.product}</span>
        <h3>{t.name}</h3>
        <p>这次用它做什么，为什么这样用。</p>
      </div>
      <div className="lesson-block">
        <b>原理</b>
        <p>{lesson.principle}</p>
      </div>
      <div className="lesson-block">
        <b>操作方法</b>
        <p>{lesson.method}</p>
      </div>
      <div className="lesson-block tip">
        <b>在这张工单中</b>
        <p>{lesson.contexts[chapter.id] || lesson.method}</p>
        {guide.id === "puller" && job.id === "keyboard-switch" && (
          <p>本关特别注意：第二步要从拔键端换到拔轴端，先压住轴体卡扣。</p>
        )}
      </div>
      <button className="primary-action" onClick={onClose}>
        学会了，试试看
        <ArrowRight size={16} />
      </button>
    </div>
  );
}
function Modal({ title, subtitle, children, onClose }) {
  const ref = React.useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.focus();
    const trap = (e) => {
      if (e.key !== "Tab") return;
      const elements = ref.current?.querySelectorAll(
        'button:not(:disabled), a[href], [tabindex="0"]',
      );
      if (!elements?.length) return;
      const first = elements[0],
        last = elements[elements.length - 1];
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === ref.current)
      ) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trap);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", trap);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        ref={ref}
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">LITTLE REPAIR SHOP / FIELD NOTES</span>
            <h2 id="modal-title">{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button onClick={onClose} aria-label="关闭窗口">
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
