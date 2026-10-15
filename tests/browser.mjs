import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { jobs, market, tools, objective, chapterOf } from "../src/game.js";

await mkdir("artifacts", { recursive: true });
const systemChrome =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser = await chromium.launch({
  headless: true,
  ...(existsSync(systemChrome) ? { executablePath: systemChrome } : {}),
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1120 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const state = () =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem("little-repair-shop-v2")),
  );
const closeTutorial = async () => {
  await page.waitForTimeout(120);
  const dialog = page.getByRole("dialog");
  if (
    (await dialog.count()) &&
    (await dialog.locator("#modal-title").textContent()) ===
      "新发现，先认识一下"
  )
    await dialog.getByRole("button", { name: "关闭窗口" }).click();
};
await page.goto("http://127.0.0.1:5188", { waitUntil: "domcontentloaded" });
await expect(page.locator(".scene-host canvas")).toBeVisible();
await page.getByRole("button", { name: "辅助教学", exact: true }).click();
await page.screenshot({
  path: "artifacts/workbench-desktop.png",
  fullPage: true,
});
await page.getByRole("button", { name: /维修工单/ }).click();
await expect(page.locator(".job-card").nth(1)).toBeDisabled();
await page.getByRole("button", { name: "关闭窗口" }).click();
for (const [index, job] of jobs.entries()) {
  if (index) {
    await page.getByRole("button", { name: /维修工单/ }).click();
    await page
      .locator(".chapter-tabs button")
      .filter({ hasText: `CH.${chapterOf(job).number}` })
      .click();
    await page.locator(".job-card").filter({ hasText: job.title }).click();
    await closeTutorial();
  }
  for (const id of job.needs) {
    const saved = await state();
    if (saved.purchased.includes(id)) continue;
    await page.getByRole("button", { name: "装备市场", exact: true }).click();
    await page
      .locator(".market-grid article")
      .filter({ hasText: market.find((m) => m.id === id).name })
      .getByRole("button", { name: "购买装备" })
      .click();
    await expect
      .poll(async () => (await state()).purchased.includes(id))
      .toBe(true);
    await page.getByRole("button", { name: "关闭窗口" }).click();
  }
  let iterations = 0;
  while (!(await state()).game.delivered && iterations++ < 45) {
    await closeTutorial();
    let s = (await state()).game,
      goal = objective(s);
    if (goal.action === "quiz") {
      if (!(await page.getByRole("dialog").count()))
        await page.getByTestId("primary-action").click();
      await page.locator(".quiz-options button").nth(job.correct).click();
      await page.getByRole("button", { name: "学会了，准备交付" }).click();
      continue;
    }
    if (["inspect", "repair"].includes(goal.action))
      await page
        .locator(".part-selector button")
        .filter({
          hasText:
            job.target === "cooler"
              ? "散热器"
              : (await import("../src/game.js")).parts[job.target].name,
        })
        .click();
    if (goal.tool && s.tool !== goal.tool) {
      await page
        .locator(".tools button")
        .filter({ hasText: tools.find((t) => t.id === goal.tool).name })
        .click();
      await closeTutorial();
    }
    await page.getByTestId("primary-action").click();
    if (goal.action !== "deliver")
      await expect
        .poll(async () => {
          const next = (await state()).game;
          return JSON.stringify(next) !== JSON.stringify(s);
        })
        .toBe(true);
    await closeTutorial();
  }
  const saved = await state();
  expect(saved.game.delivered).toBe(true);
  expect(saved.completed).toHaveLength(index + 1);
  if (index === 0) {
    await page.screenshot({
      path: "artifacts/first-repair-complete.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "关闭窗口" }).click();
    const before = await state();
    await page.reload();
    await expect.poll(async () => (await state()).completed.length).toBe(1);
    expect((await state()).game.delivered).toBe(before.game.delivered);
  }
  if (await page.getByRole("dialog").count())
    await page.getByRole("button", { name: "关闭窗口" }).click();
  if (index === 3)
    await page.screenshot({
      path: "artifacts/fan-workbench.png",
      fullPage: true,
    });
  if (index === 6)
    await page.screenshot({
      path: "artifacts/keyboard-workbench.png",
      fullPage: true,
    });
  console.log(`PASS ${job.number} ${job.title}`);
}
await page.getByRole("button", { name: "装备市场", exact: true }).click();
await page.screenshot({
  path: "artifacts/equipment-market.png",
  fullPage: true,
});
await page.getByRole("button", { name: "关闭窗口" }).click();
await page.getByRole("button", { name: /维修工单/ }).click();
await page.locator(".chapter-tabs button").first().click();
await page.locator(".job-card").first().click();
await closeTutorial();
const completedBefore = (await state()).completed;
expect(completedBefore).toHaveLength(9);
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({
  path: "artifacts/workbench-mobile.png",
  fullPage: true,
});
expect(
  await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  ),
).toBe(true);
await page.getByRole("button", { name: "硬件图鉴", exact: true }).click();
await page
  .locator(".book-tabs button")
  .filter({ hasText: "USB 供电线" })
  .click();
await expect(page.locator(".book-article h3")).toHaveText("USB 供电线");
await page.getByRole("button", { name: "关闭窗口" }).click();
expect(errors).toEqual([]);
const final = await state();
console.log(
  JSON.stringify(
    {
      completed: final.completed.length,
      purchased: final.purchased,
      errors,
      artifacts: "artifacts/",
    },
    null,
    2,
  ),
);
await page.setViewportSize({ width: 1440, height: 1120 });
await page.getByRole("button", { name: /维修工单/ }).click();
await page.locator(".roadmap-entry").click();
await expect(page.locator(".roadmap-grid>button")).toHaveCount(12);
await expect(page.locator(".roadmap-grid>button.available")).toHaveCount(3);
await page.screenshot({ path: "artifacts/chapter-map.png", fullPage: true });
await page
  .locator(".roadmap-grid>button")
  .filter({ hasText: "微波炉" })
  .click();
await expect(page.locator(".lesson-hero h3")).toHaveText("微波炉");
await expect(page.locator(".lesson-chapter-steps>div")).toHaveCount(3);
await page.setViewportSize({ width: 390, height: 844 });
expect(
  await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  ),
).toBe(true);
await page.getByRole("button", { name: "关闭窗口" }).click();
if (await page.locator(".toast").count())
  await page.getByRole("button", { name: "关闭提示" }).click();
await page.screenshot({
  path: "artifacts/workbench-mobile.png",
  fullPage: true,
});
expect(errors).toEqual([]);
await browser.close();
