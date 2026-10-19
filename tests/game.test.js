import test from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  transition,
  objective,
  jobs,
  market,
  starterTools,
  unlocked,
  chapterUnlocked,
  chapterOf,
} from "../src/game.js";

const inventory = [...starterTools, ...market.map((m) => m.id)];
function run(s, action, value, equipment = inventory) {
  const result = transition(s, action, value, equipment);
  assert.equal(result.ok, true, `${s.jobId}/${action}: ${result.message}`);
  return result.state;
}
for (const job of jobs)
  test(`完整维修与知识验证：${job.title}`, () => {
    let s = createGame(job.id),
      count = 0;
    while (!s.delivered && count++ < 45) {
      const goal = objective(s);
      if (goal.tool) s = run(s, "tool", goal.tool);
      if (["inspect", "repair"].includes(goal.action))
        s = run(s, "select", job.target);
      s = run(s, goal.action, goal.action === "quiz" ? job.correct : undefined);
    }
    assert.equal(s.delivered, true);
    assert.equal(s.tested, true);
    assert.equal(s.panelOpen, false);
    assert.equal(s.unplugged, false);
    assert.equal(s.screws, 4);
    assert.equal(s.quizPassed, true);
    assert.equal(s.mistakes, 0);
    assert.equal(
      transition(s, "deliver", undefined, inventory).ok,
      false,
      "不能重复交付",
    );
  });
test("带电拆机、跳过检查和提前测试会被阻止", () => {
  const s = createGame();
  for (const action of [
    "unscrew",
    "open",
    "inspect",
    "repair",
    "test",
    "deliver",
  ]) {
    const result = transition(s, action, undefined, inventory);
    assert.equal(result.ok, false, action);
    assert.equal(result.state.fixed, false);
    assert.equal(result.state.tested, false);
  }
});
test("新工具必须购买，维修必须选对对象", () => {
  assert.equal(transition(createGame(), "tool", "air", starterTools).ok, false);
  let s = createGame();
  while (objective(s).action !== "inspect") {
    const g = objective(s);
    if (g.tool) s = run(s, "tool", g.tool);
    s = run(s, g.action);
  }
  s = run(s, "tool", "inspect");
  s = run(s, "select", "ram");
  s = run(s, "inspect");
  s = run(s, "select", "gpu");
  s = run(s, "tool", "hand");
  assert.equal(transition(s, "repair", undefined, inventory).ok, false);
  assert.equal(s.repairStep, 0);
});
test("章节顺序与采购预算能够完整推进，不会因强制采购卡关", () => {
  const completed = [],
    purchased = [];
  let coins = 200;
  for (const [i, job] of jobs.entries()) {
    assert.equal(unlocked(job.id, completed), true);
    assert.equal(chapterUnlocked(job.chapter, completed), true);
    if (jobs[i + 1] && !jobs[i + 1].unlockAfter)
      assert.equal(unlocked(jobs[i + 1].id, completed), false);
    for (const id of job.needs)
      if (!purchased.includes(id)) {
        const item = market.find((m) => m.id === id);
        assert.equal(chapterUnlocked(item.chapter, completed), true);
        assert.ok(coins >= item.price, `${job.title} 应买得起 ${item.name}`);
        coins -= item.price;
        purchased.push(id);
      }
    completed.push(job.id);
    coins += job.reward;
    assert.ok(chapterOf(job).parts.includes(job.target));
  }
  assert.equal(completed.length, 10);
  assert.equal(coins, 1370);
});

test("手机入门在键盘清洁后开放，不拆屏或外壳，完成前不能接电", () => {
  assert.equal(unlocked("phone-charge", []), false);
  assert.equal(unlocked("phone-charge", ["keyboard-clean"]), true);
  assert.equal(chapterUnlocked("phone", ["keyboard-clean"]), true);
  let s = createGame("phone-charge");
  assert.equal(transition(s, "inspect", undefined, inventory).ok, false);
  s = run(run(s, "unplug"), "ground");
  assert.equal(objective(s).action, "inspect");
  for (const a of ["unscrew", "open", "plug", "test"])
    assert.equal(transition(s, a, undefined, inventory).ok, false);
  s = run(run(s, "select", "phonePort"), "inspect");
  for (let i = 0; i < 4; i++) {
    s = run(s, "tool", objective(s).tool);
    s = run(s, "repair");
    assert.equal(s.fixed, i === 3);
    assert.equal(s.screws, 4);
    assert.equal(s.panelOpen, false);
  }
  assert.equal(objective(s).action, "plug");
});

test("单键清洁只拆键帽，保持外壳和螺丝完整；旧外壳存档也能继续", () => {
  let s = createGame("keyboard-clean");
  assert.equal(transition(s, "inspect", undefined, inventory).ok, false);
  s = run(s, "unplug");
  s = run(s, "ground");
  assert.equal(objective(s).action, "inspect");
  assert.equal(transition(s, "unscrew", undefined, inventory).ok, false);
  s = run(s, "select", "keycap");
  s = run(s, "inspect");
  for (let i = 0; i < 3; i++) {
    s = run(s, "tool", objective(s).tool);
    s = run(s, "repair");
  }
  assert.equal(s.panelOpen, false);
  assert.equal(s.screws, 4);
  assert.equal(objective(s).action, "plug");
  let old = {
    ...createGame("keyboard-clean"),
    unplugged: true,
    grounded: true,
    panelOpen: true,
    screws: 0,
    repairStep: 2,
    inspected: ["keycap"],
    selected: "keycap",
    tool: "hand",
  };
  old = run(old, "repair");
  assert.equal(old.panelOpen, false);
  assert.equal(old.screws, 4);
  assert.equal(objective(old).action, "plug");
});
