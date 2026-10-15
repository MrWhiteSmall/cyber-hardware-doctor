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
  await page.keyboard.press("r");
  await page.waitForTimeout(150);
  p = await marker("ram");
  await drag(p, { x: p.x + p.ax * 3, y: p.y + p.ay * 3 }, true);
  expect((await state()).repairStep).toBe(2);
  await expect(page.locator(".mechanic-hud")).toContainText("对位不正确");
  await page.screenshot({
    path: "artifacts/manual-insertion-blocked.png",
    fullPage: true,
  });
  for (let i = 0; i < 3; i++) await page.keyboard.press("r");
  await page.waitForTimeout(150);
  p = await marker("ram");
  await drag(p, { x: p.x + p.ax * 3, y: p.y + p.ay * 3 }, true);
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
