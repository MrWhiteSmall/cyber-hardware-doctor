import { chromium, expect } from "@playwright/test";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";

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
async function closeLesson() {
  await page.waitForTimeout(150);
  if (await page.getByRole("dialog").count())
    await page.getByRole("button", { name: "关闭窗口" }).click();
}
async function tool(name) {
  await page.locator(".tools button").filter({ hasText: name }).click();
  await closeLesson();
}
async function marker(kind) {
  const m = page.locator(`.mechanic-marker[data-kind="${kind}"]`);
  await expect(m).toBeVisible();
  await page.waitForTimeout(100);
  const b = await m.boundingBox();
  return {
    x: b.x + b.width / 2,
    y: b.y + b.height / 2,
    ax: Number(await m.getAttribute("data-axis-x")),
    ay: Number(await m.getAttribute("data-axis-y")),
  };
}
async function drag(from, to, shift = false) {
  if (shift) await page.keyboard.down("Shift");
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 22 });
  await page.mouse.up();
  if (shift) await page.keyboard.up("Shift");
  await page.waitForTimeout(140);
}
async function turn(clockwise, turns = 2.08) {
  const p = await marker("screw"),
    r = 27;
  await page.mouse.move(p.x + r, p.y);
  await page.mouse.down();
  for (let i = 1; i <= 85; i++) {
    const a = ((clockwise ? 1 : -1) * Math.PI * 2 * turns * i) / 85;
    await page.mouse.move(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
  }
  await page.mouse.up();
  await page.waitForTimeout(130);
}
try {
  await page.goto("http://127.0.0.1:5188", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".scene-host canvas")).toBeVisible();
  await page.getByTestId("primary-action").click();
  await page.getByTestId("primary-action").click();
  await expect(page.getByTestId("primary-action")).toBeDisabled();
  await tool("螺丝刀");
  await turn(true, 0.7);
  expect((await state()).screws).toBe(4);
  for (let i = 4; i > 0; i--) {
    await turn(false);
    await expect.poll(async () => (await state()).screws).toBe(i - 1);
  }
  console.log("PASS manual screw turning and wrong-direction resistance");
  await tool("拆装");
  let p = await marker("cover");
  await drag(p, { x: p.x + p.ax * 2.1, y: p.y + p.ay * 2.1 });
  await expect.poll(async () => (await state()).panelOpen).toBe(true);
  await page
    .locator(".part-selector button")
    .filter({ hasText: "内存条" })
    .click();
  await tool("观察");
  await page.getByTestId("primary-action").click();
  await closeLesson();
  await tool("拆装");
  for (let i = 0; i < 2; i++) {
    p = await marker(`latch${i}`);
    await drag(p, { x: p.x + p.ax * 0.4, y: p.y + p.ay * 0.4 });
    if (i === 0) expect((await state()).repairStep).toBe(0);
  }
  await expect.poll(async () => (await state()).repairStep).toBe(1);
  p = await marker("ram");
  await drag(p, { x: p.x + p.ax * 2, y: p.y + p.ay * 2 });
  await expect.poll(async () => (await state()).repairStep).toBe(2);
  console.log("PASS release each latch and extract along slot axis");
  p = await marker("ram");
  await page.mouse.click(p.x, p.y);
  expect((await state()).repairStep).toBe(2);
  await expect(page.getByRole("button", { name: "沿槽推入" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // A novice's natural drag should follow the slot, without a hidden Shift requirement.
  await drag(p, { x: p.x + p.ax * 0.3, y: p.y + p.ay * 0.3 });
  expect((await state()).repairStep).toBe(2);
  const progressWidth = () =>
    page
      .locator(".mechanic-progress > i")
      .evaluate((el) => parseFloat(el.style.width));
  expect(await progressWidth()).toBeGreaterThan(10);
  await page.getByRole("button", { name: "平移对位", exact: true }).click();
  // Arrow keys still work after a mode button has keyboard focus.
  for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowRight");
  await expect(page.locator(".alignment-status")).toContainText("位置需微调");
  for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".alignment-status.ready")).toBeVisible();
  p = await marker("ram");
  await drag(p, { x: p.x + 18, y: p.y - 15 });
  await expect(page.locator(".alignment-status")).toContainText("位置需微调");
  await page.getByRole("button", { name: "沿槽推入" }).click();
  p = await marker("ram");
  await drag(p, { x: p.x + p.ax * 3, y: p.y + p.ay * 3 });
  expect((await state()).repairStep).toBe(2);
  await expect(page.locator(".mechanic-hud")).toContainText("对位不正确");
  await page.screenshot({
    path: "artifacts/memory-alignment-guide.png",
    fullPage: true,
  });
  // Recover from actual misalignment with the screen-relative fine controls.
  for (let i = 0; i < 80; i++) {
    if (await page.locator(".alignment-status.ready").count()) break;
    const grip = await marker("ram"),
      guide = await marker("ram-guide");
    const dx = guide.x - grip.x,
      dy = guide.y - grip.y;
    const name =
      Math.abs(dx) > Math.abs(dy)
        ? dx > 0
          ? "向右微调"
          : "向左微调"
        : dy > 0
          ? "向下微调"
          : "向上微调";
    await page.getByRole("button", { name, exact: true }).click();
    await page.waitForTimeout(90);
  }
  await expect(page.locator(".alignment-status.ready")).toBeVisible();
  expect((await state()).repairStep).toBe(2);
  console.log(
    "PASS default axial drag and recover from misalignment without snapping",
  );
  await page.setViewportSize({ width: 390, height: 900 });
  await page.waitForTimeout(150);
  await page.locator(".scene-shell").scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: "向左微调" })).toBeInViewport();
  p = await marker("ram");
  expect(
    await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.tagName,
      p,
    ),
  ).toBe("CANVAS");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "artifacts/memory-controls-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.waitForTimeout(150);
  await page.locator(".scene-shell").scrollIntoViewIfNeeded();
  await page.keyboard.press("r");
  await page.waitForTimeout(150);
  p = await marker("ram");
  await drag(p, { x: p.x + p.ax * 3, y: p.y + p.ay * 3 });
  expect((await state()).repairStep).toBe(2);
  await expect(page.locator(".mechanic-hud")).toContainText("对位不正确");
  await page.screenshot({
    path: "artifacts/manual-insertion-blocked.png",
    fullPage: true,
  });
  for (let i = 0; i < 3; i++) await page.keyboard.press("r");
  await page.getByRole("button", { name: "维修近景" }).click();
  await page.waitForTimeout(150);
  p = await marker("ram");
  await drag(p, { x: p.x + p.ax * 3, y: p.y + p.ay * 3 });
  await expect.poll(async () => (await state()).repairStep).toBe(3);
  for (let i = 0; i < 2; i++) {
    p = await marker(`latch${i}`);
    await drag(p, { x: p.x + p.ax * 0.4, y: p.y + p.ay * 0.4 });
    if (i === 0) expect((await state()).fixed).toBe(false);
  }
  await expect.poll(async () => (await state()).fixed).toBe(true);
  console.log(
    "PASS no auto snap, orientation collision, deliberate insertion and two-latch locking",
  );
  p = await marker("cover");
  const guide = await marker("cover-guide");
  await drag(p, guide);
  expect((await state()).panelOpen).toBe(true);
  p = await marker("cover");
  await drag(p, { x: p.x + p.ax * 3, y: p.y + p.ay * 3 }, true);
  await expect.poll(async () => (await state()).panelOpen).toBe(false);
  await tool("螺丝刀");
  for (let i = 0; i < 4; i++) {
    await turn(true);
    await expect.poll(async () => (await state()).screws).toBe(i + 1);
  }
  await page.getByTestId("primary-action").click();
  await page.getByTestId("primary-action").click();
  await expect(page.locator(".quiz-options")).toBeVisible();
  await page.locator(".quiz-options button").nth(1).click();
  await page.getByRole("button", { name: "学会了，准备交付" }).click();
  await page.getByTestId("primary-action").click();
  await expect.poll(async () => (await state()).delivered).toBe(true);
  expect(errors).toEqual([]);
  console.log("PASS complete direct repair, reassembly and verification");
  await closeLesson();
  await page.getByRole("button", { name: /维修工单/ }).click();
  await page
    .locator(".job-card")
    .filter({ hasText: "一开游戏，就自动关机" })
    .click();
  await closeLesson();
  await page.getByRole("button", { name: "装备市场", exact: true }).click();
  await page
    .locator(".market-grid article")
    .filter({ hasText: "气吹" })
    .getByRole("button", { name: "购买装备" })
    .click();
  await page.getByRole("button", { name: "关闭窗口" }).click();
  await expect(
    page.getByRole("button", { name: "3D 手动实操", exact: true }),
  ).toHaveClass("active");
  await page.getByTestId("primary-action").click();
  await page.getByTestId("primary-action").click();
  await expect(page.getByTestId("primary-action")).toBeDisabled();
  await tool("螺丝刀");
  for (let i = 4; i > 0; i--) {
    await turn(false);
    await expect.poll(async () => (await state()).screws).toBe(i - 1);
  }
  await tool("拆装");
  p = await marker("cover");
  await drag(p, { x: p.x + p.ax * 2.1, y: p.y + p.ay * 2.1 });
  await expect.poll(async () => (await state()).panelOpen).toBe(true);
  await page
    .locator(".part-selector button")
    .filter({ hasText: "散热器" })
    .click();
  await tool("观察");
  await page.getByTestId("primary-action").click();
  await closeLesson();
  await expect(page.getByTestId("primary-action")).toBeDisabled();
  const press = async (kind, duration) => {
    const point = await marker(kind);
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.waitForTimeout(duration);
    await page.mouse.up();
    await page.waitForTimeout(150);
  };
  await tool("气吹");
  await press("fan-hold", 750);
  expect((await state()).repairStep).toBe(0);
  await expect(page.locator(".mechanic-hud")).toContainText("拆装");
  await tool("拆装");
  await press("fan-hold", 40);
  expect((await state()).repairStep).toBe(0);
  await press("fan-hold", 750);
  await expect.poll(async () => (await state()).repairStep).toBe(1);
  await tool("气吹");
  await press("dust0", 1050);
  expect(await page.locator('.dust-marker[data-cleared="true"]').count()).toBe(
    0,
  );
  await expect(page.locator(".mechanic-hud")).toContainText("太久");
  for (let i = 0; i < 6; i++) {
    await press(`dust${i}`, 240);
    if (i < 5) {
      expect((await state()).fixed).toBe(false);
      expect(
        await page.locator('.dust-marker[data-cleared="true"]').count(),
      ).toBe(i + 1);
    }
    if (i === 0) {
      await press("dust0", 240);
      expect(
        await page.locator('.dust-marker[data-cleared="true"]').count(),
      ).toBe(1);
    }
    if (i === 1)
      await page.screenshot({
        path: "artifacts/manual-cooling.png",
        fullPage: true,
      });
  }
  await expect.poll(async () => (await state()).fixed).toBe(true);
  console.log(
    "PASS second job: manual chassis, hold fan, reject wrong tool/long puff, clean six individual regions",
  );
  await tool("拆装");
  p = await marker("cover");
  await drag(p, await marker("cover-guide"));
  expect((await state()).panelOpen).toBe(true);
  p = await marker("cover");
  await drag(p, { x: p.x + p.ax * 3, y: p.y + p.ay * 3 }, true);
  await expect.poll(async () => (await state()).panelOpen).toBe(false);
  await tool("螺丝刀");
  for (let i = 0; i < 4; i++) {
    await turn(true);
    await expect.poll(async () => (await state()).screws).toBe(i + 1);
  }
  await page.getByTestId("primary-action").click();
  await page.getByTestId("primary-action").click();
  await page.locator(".quiz-options button").nth(2).click();
  await page.getByRole("button", { name: "学会了，准备交付" }).click();
  await page.getByTestId("primary-action").click();
  await expect.poll(async () => (await state()).delivered).toBe(true);
  expect(errors).toEqual([]);
  console.log(
    "PASS complete second direct repair, reassembly, quiz and delivery",
  );
} catch (e) {
  await page.screenshot({
    path: "artifacts/direct-failure.png",
    fullPage: true,
  });
  console.log("STATE", await state());
  throw e;
} finally {
  await browser.close();
}
