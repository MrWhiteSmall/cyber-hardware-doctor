import { expect } from "@playwright/test";
import { createGame, market } from "../src/game.js";

export async function runKeyboardRepair({
  page,
  state,
  marker,
  drag,
  tool,
  closeLesson,
  errors,
  only,
}) {
  if (only) {
    await page.goto("http://127.0.0.1:5188");
    await page.evaluate(
      (game) =>
        localStorage.setItem(
          "little-repair-shop-v2",
          JSON.stringify({
            version: 2,
            game,
            completed: [
              "memory",
              "cooling",
              "storage",
              "fan-dust",
              "fan-bearing",
              "fan-cable",
            ],
            purchased: ["air", "cable", "oil", "meter"],
            learned: [
              "ram",
              "cooler",
              "storage",
              "fanBlade",
              "fanMotor",
              "fanCable",
            ],
            seen: ["chapter:pc", "chapter:fan", "chapter:keyboard"],
          }),
        ),
      createGame("keyboard-clean"),
    );
    await page.reload();
  } else {
    await page.getByRole("button", { name: "看下一张工单" }).click();
    await page
      .locator(".chapter-tabs button")
      .filter({ hasText: "CH.03" })
      .click();
    await page
      .locator(".job-card")
      .filter({ hasText: "被饼干屑卡住的按键" })
      .click();
    await closeLesson();
  }
  await page.getByRole("button", { name: "装备市场", exact: true }).click();
  await page
    .locator(".market-grid article")
    .filter({ hasText: market.find((item) => item.id === "puller").name })
    .getByRole("button", { name: "购买装备" })
    .click();
  await page.getByRole("button", { name: "关闭窗口" }).click();
  await page.getByTestId("primary-action").click();
  await page.getByTestId("primary-action").click();
  expect((await state()).screws).toBe(4);
  expect((await state()).panelOpen).toBe(false);
  await page
    .locator(".part-selector button")
    .filter({ hasText: "键帽与定位板" })
    .click();
  await page.getByTestId("primary-action").click();
  await closeLesson();
  await expect(page.getByTestId("primary-action")).toBeDisabled();
  await tool("拔取器");
  await page.getByRole("button", { name: "拔轴端", exact: true }).click();
  let p = await marker("key-puller");
  await drag(p, { x: p.x + p.ax * 0.25, y: p.y + p.ay * 0.25 });
  await expect(page.locator(".mechanic-hud")).toContainText("工作端不对");
  expect((await state()).repairStep).toBe(0);
  await page.getByRole("button", { name: "钢丝拔键端", exact: true }).click();
  p = await marker("key-puller");
  await page.mouse.click(p.x, p.y);
  await expect(page.locator(".keyboard-lesson")).toHaveAttribute(
    "data-phase",
    "engage",
  );
  await drag(p, { x: p.x + p.ax * 0.24, y: p.y + p.ay * 0.24 });
  await expect(page.locator(".keyboard-lesson")).toHaveAttribute(
    "data-phase",
    "lift",
  );
  p = await marker("key-cap");
  // Sideways force must not extract the cap.
  const len = Math.hypot(p.ax, p.ay);
  await drag(p, { x: p.x - (p.ay / len) * 40, y: p.y + (p.ax / len) * 40 });
  await expect(page.locator(".keyboard-lesson")).toHaveAttribute(
    "data-phase",
    "lift",
  );
  await expect(page.locator(".mechanic-hud")).toContainText("偏离轴线");
  p = await marker("key-cap");
  await drag(p, { x: p.x + p.ax * 0.85, y: p.y + p.ay * 0.85 });
  await expect(page.locator(".keyboard-lesson")).toHaveAttribute(
    "data-phase",
    "park",
  );
  expect((await state()).repairStep).toBe(0);
  p = await marker("key-cap");
  await drag(p, { x: p.x + p.ax * 0.9, y: p.y + p.ay * 0.9 });
  await expect.poll(async () => (await state()).repairStep).toBe(1);
  await tool("气吹");
  async function puff(i, ms = 300) {
    const at = await marker(`dust${i}`);
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.waitForTimeout(ms);
    await page.mouse.up();
    await page.waitForTimeout(140);
  }
  await puff(0, 1100);
  await expect(page.locator('[data-kind="dust0"]')).toHaveAttribute(
    "data-cleared",
    "false",
  );
  await puff(0);
  await expect(page.locator(".mechanic-hud")).toContainText("1 / 4");
  await page.reload();
  await expect(page.locator(".mechanic-hud")).toContainText("0 / 4");
  await page.screenshot({
    path: "artifacts/manual-keyboard-clean.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.waitForTimeout(220);
  await page.locator(".scene-shell").scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  for (let i = 0; i < 4; i++) {
    const at = await marker(`dust${i}`);
    expect(
      await page.evaluate(
        ({ x, y }) => document.elementFromPoint(x, y)?.tagName,
        at,
      ),
    ).toBe("CANVAS");
  }
  await puff(0);
  await page.screenshot({
    path: "artifacts/manual-keyboard-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.waitForTimeout(220);
  await page.locator(".scene-shell").scrollIntoViewIfNeeded();
  for (let i = 1; i < 4; i++) await puff(i);
  await expect.poll(async () => (await state()).repairStep).toBe(2);
  await tool("拆装");
  await page.getByRole("button", { name: /沿轴压入/ }).click();
  p = await marker("key-cap");
  await drag(p, { x: p.x + p.ax * 0.9, y: p.y + p.ay * 0.9 });
  await expect(page.locator(".mechanic-hud")).toContainText("十字轴尚未对准");
  await page.getByRole("button", { name: "平移对位", exact: true }).click();
  // Axial separation means the fixed stem and moving cap project to different pixels.
  for (let i = 0; i < 4; i++) {
    p = await marker("key-cap");
    const guide = await marker("key-stem");
    await drag(p, { x: guide.x - p.ax * 0.68, y: guide.y - p.ay * 0.68 });
  }
  await expect(page.locator(".alignment-status.ready")).toBeVisible();
  expect((await state()).fixed).toBe(false);
  await page.screenshot({
    path: "artifacts/manual-keyboard-align.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /沿轴压入/ }).click();
  p = await marker("key-cap");
  await drag(p, { x: p.x + p.ax * 0.9, y: p.y + p.ay * 0.9 });
  await expect(page.locator(".keyboard-lesson")).toHaveAttribute(
    "data-phase",
    "press",
  );
  expect((await state()).fixed).toBe(false);
  p = await marker("key-press");
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(400);
  await expect(page.locator(".mechanic-hud")).toContainText("回弹 0 / 3");
  for (let i = 0; i < 3; i++) {
    p = await marker("key-press");
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.move(p.x + p.ax * 0.12, p.y + p.ay * 0.12, { steps: 12 });
    expect((await state()).fixed).toBe(false);
    await page.mouse.up();
    await page.waitForTimeout(450);
    if (i < 2)
      await expect(page.locator(".mechanic-hud")).toContainText(
        `回弹 ${i + 1} / 3`,
      );
  }
  await expect.poll(async () => (await state()).fixed).toBe(true);
  expect((await state()).screws).toBe(4);
  expect((await state()).panelOpen).toBe(false);
  await page.getByTestId("primary-action").click();
  await page.getByTestId("primary-action").click();
  await page.locator(".quiz-options button").nth(1).click();
  await page.getByRole("button", { name: "学会了，准备交付" }).click();
  await page.getByTestId("primary-action").click();
  await expect.poll(async () => (await state()).delivered).toBe(true);
  expect(errors).toEqual([]);
  console.log(
    "PASS seventh job: no shell removal, correct puller end, engage before lifting, reject side force, park cap, four crumb regions, reload and mobile cleaning, fixed stem alignment without snap, deliberate seating, three actual press/release returns, quiz and delivery",
  );
}
