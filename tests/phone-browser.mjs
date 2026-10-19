import { chromium, expect } from "@playwright/test";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { createGame, jobs } from "../src/game.js";

await mkdir("artifacts", { recursive: true });
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser = await chromium.launch({
  headless: true,
  ...(existsSync(chrome) ? { executablePath: chrome } : {}),
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const state = () =>
  page.evaluate(
    () => JSON.parse(localStorage.getItem("little-repair-shop-v2")).game,
  );
const profile = () =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem("little-repair-shop-v2")),
  );
async function closeLesson() {
  await page.waitForTimeout(180);
  if (await page.getByRole("dialog").count())
    await page.getByRole("button", { name: "关闭窗口" }).click();
}
async function tool(name) {
  await page.locator(".tools button").filter({ hasText: name }).click();
  await closeLesson();
}
async function marker(id) {
  const m = page.locator(`.mechanic-marker[data-kind="${id}"]`);
  await expect(m).toBeVisible();
  await m.scrollIntoViewIfNeeded();
  await page.waitForTimeout(100);
  const b = await m.boundingBox();
  return {
    x: b.x + b.width / 2,
    y: b.y + b.height / 2,
    ax: Number(await m.getAttribute("data-axis-x")),
    ay: Number(await m.getAttribute("data-axis-y")),
  };
}
async function drag(p, q) {
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(q.x, q.y, { steps: 24 });
  await page.mouse.up();
  await page.waitForTimeout(180);
}
const phase = (p) =>
  expect(page.locator(".keyboard-lesson")).toHaveAttribute("data-phase", p);
async function observe(id, ms = 750) {
  const p = await marker(id);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
  await page.waitForTimeout(180);
}
try {
  await page.goto("http://127.0.0.1:5188");
  await page.evaluate(
    ({ game, completed }) =>
      localStorage.setItem(
        "little-repair-shop-v2",
        JSON.stringify({
          version: 2,
          game,
          completed,
          purchased: ["air", "cable", "oil", "meter", "puller"],
          learned: [],
          seen: [],
        }),
      ),
    {
      game: {
        ...createGame("keyboard-clean"),
        delivered: true,
        fixed: true,
        tested: true,
        quizPassed: true,
        repairStep: 3,
      },
      completed: jobs.slice(0, 7).map((j) => j.id),
    },
  );
  await page.reload();
  await page.getByRole("button", { name: "看下一张工单" }).click();
  await page
    .locator(".chapter-tabs button")
    .filter({ hasText: "CH.04" })
    .click();
  await expect(page.locator(".chapter-description")).toContainText("筹备中");
  await page
    .locator(".job-card")
    .filter({ hasText: "充电，要找个角度？" })
    .click();
  await closeLesson();
  await expect(page.locator("canvas").first()).toBeVisible();
  await page.getByTestId("primary-action").click();
  await page.getByTestId("primary-action").click();
  await page
    .locator(".part-selector button")
    .filter({ hasText: "USB-C 充电接口" })
    .click();
  await page.getByTestId("primary-action").click();
  await closeLesson();
  await expect(page.getByTestId("primary-action")).toBeDisabled();
  expect((await state()).screws).toBe(4);
  expect((await state()).panelOpen).toBe(false);
  await page.screenshot({ path: "artifacts/phone-start.png", fullPage: true });
  let p = await marker("phone-plug");
  await drag(p, { x: p.x + p.ax, y: p.y + p.ay });
  await expect(page.locator(".mechanic-hud")).toContainText("先选择");
  await tool("接线");
  p = await marker("phone-plug");
  await page.mouse.click(p.x, p.y);
  await phase("extract");
  const length = Math.hypot(p.ax, p.ay);
  await drag(p, {
    x: p.x - (p.ay / length) * 45,
    y: p.y + (p.ax / length) * 45,
  });
  await phase("extract");
  await expect(page.locator(".mechanic-hud")).toContainText("不要横掰");
  p = await marker("phone-plug");
  await drag(p, { x: p.x + p.ax * 1.3, y: p.y + p.ay * 1.3 });
  await phase("park");
  expect((await state()).repairStep).toBe(0);
  p = await marker("phone-plug");
  await drag(p, { x: p.x + p.ax * 1.4, y: p.y + p.ay * 1.4 });
  await expect.poll(async () => (await state()).repairStep).toBe(1);
  await tool("观察");
  await observe("phone-port-check", 80);
  await expect(page.locator(".mechanic-hud")).toContainText("快速点击");
  await observe("phone-port-check");
  await expect(page.locator('[data-kind="phone-port-check"]')).toHaveAttribute(
    "data-cleared",
    "true",
  );
  await page.reload();
  await expect(page.locator('[data-kind="phone-port-check"]')).toHaveAttribute(
    "data-cleared",
    "false",
  );
  await observe("phone-port-check");
  await expect(page.locator(".mechanic-hud")).toContainText("舌片完整");
  await observe("phone-cable-check");
  await expect.poll(async () => (await state()).repairStep).toBe(2);
  await tool("接线");
  await page.getByRole("button", { name: /沿轴插入/ }).click();
  p = await marker("phone-plug");
  await drag(p, { x: p.x + p.ax * 1.3, y: p.y + p.ay * 1.3 });
  await expect(page.locator(".mechanic-hud")).toContainText("位置尚未对准");
  expect((await state()).repairStep).toBe(2);
  await page.getByRole("button", { name: "平移对位", exact: true }).click();
  for (let i = 0; i < 5; i++) {
    p = await marker("phone-plug");
    const g = await marker("phone-socket");
    await drag(p, { x: g.x - p.ax * 1.05, y: g.y - p.ay * 1.05 });
  }
  await expect(page.locator(".alignment-status.ready")).toBeVisible();
  expect((await state()).repairStep).toBe(2);
  // Restoring the camera preserves the freely aligned connector pose.
  await page.getByRole("button", { name: "手机近景", exact: true }).click();
  await page.screenshot({ path: "artifacts/phone-align.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.waitForTimeout(250);
  await page.locator(".scene-shell").scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "artifacts/phone-mobile.png", fullPage: true });
  await page.getByRole("button", { name: /沿轴插入/ }).click();
  p = await marker("phone-plug");
  expect(
    await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.tagName,
      p,
    ),
  ).toBe("CANVAS");
  await drag(p, { x: p.x + p.ax * 1.4, y: p.y + p.ay * 1.4 });
  await expect.poll(async () => (await state()).repairStep).toBe(3);
  expect((await state()).fixed).toBe(false);
  await page.reload();
  await phase("retain");
  p = await marker("phone-plug");
  await page.mouse.click(p.x, p.y);
  expect((await state()).fixed).toBe(false);
  await drag(p, { x: p.x + p.ax * 0.2, y: p.y + p.ay * 0.2 });
  await expect.poll(async () => (await state()).fixed).toBe(true);
  await page.getByTestId("primary-action").click();
  await page.getByTestId("primary-action").click();
  await page.locator(".quiz-options button").nth(1).click();
  await page.getByRole("button", { name: "学会了，准备交付" }).click();
  const before = await profile();
  await page.getByTestId("primary-action").click();
  await expect.poll(async () => (await state()).delivered).toBe(true);
  const after = await profile();
  expect(after.completed).toContain("phone-charge");
  expect(after.completed.length).toBe(before.completed.length + 1);
  expect(after.purchased).toEqual(before.purchased);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: "artifacts/phone-delivered.png",
    fullPage: true,
  });
  console.log(
    "PASS phone: unlock after seventh job, no case removal, actual extraction and parking, two evidence checks, reload, wrong-tool and sideways rejection, no snapping, deliberate mobile insertion, retention, charging validation and rewarded delivery; no browser errors",
  );
} catch (e) {
  await page.screenshot({
    path: "artifacts/phone-failure.png",
    fullPage: true,
  });
  console.log(await state());
  throw e;
} finally {
  await browser.close();
}
