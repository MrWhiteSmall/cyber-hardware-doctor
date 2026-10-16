import { chromium, expect } from "@playwright/test";
import { existsSync } from "node:fs";
import { createGame, market } from "../src/game.js";
import { mkdir } from "node:fs/promises";
import { runKeyboardRepair } from "./keyboard-browser.mjs";

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
  let p;
  const keyboardOnly = process.argv.includes("--keyboard");
  const cableOnly = process.argv.includes("--cable");
  const bearingOnly = process.argv.includes("--bearing");
  const fanOnly = process.argv.includes("--fan");
  if (!keyboardOnly && !fanOnly && !bearingOnly && !cableOnly) {
    const storageOnly = process.argv.includes("--storage");
    if (!storageOnly) {
      await page.goto("http://127.0.0.1:5188", {
        waitUntil: "domcontentloaded",
      });
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
      p = await marker("cover");
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
      await expect(
        page.getByRole("button", { name: "沿槽推入" }),
      ).toHaveAttribute("aria-pressed", "true");
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
      await expect(page.locator(".alignment-status")).toContainText(
        "位置需微调",
      );
      for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowLeft");
      await expect(page.locator(".alignment-status.ready")).toBeVisible();
      p = await marker("ram");
      await drag(p, { x: p.x + 18, y: p.y - 15 });
      await expect(page.locator(".alignment-status")).toContainText(
        "位置需微调",
      );
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
      await expect(
        page.getByRole("button", { name: "向左微调" }),
      ).toBeInViewport();
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
      expect(
        await page.locator('.dust-marker[data-cleared="true"]').count(),
      ).toBe(0);
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
    } else {
      await page.goto("http://127.0.0.1:5188");
      await page.evaluate(
        (game) =>
          localStorage.setItem(
            "little-repair-shop-v2",
            JSON.stringify({
              version: 2,
              game,
              completed: ["memory", "cooling"],
              purchased: ["air"],
              learned: ["ram", "cooler"],
              seen: ["chapter:pc"],
            }),
          ),
        createGame("storage"),
      );
      await page.reload();
    }
    if (!storageOnly) {
      await closeLesson();
      await page.getByRole("button", { name: /维修工单/ }).click();
      await page
        .locator(".job-card")
        .filter({ hasText: "我的系统，去哪儿了？" })
        .click();
      await closeLesson();
    }
    await page.getByRole("button", { name: "装备市场", exact: true }).click();
    await page
      .locator(".market-grid article")
      .filter({ hasText: market.find((item) => item.id === "cable").name })
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
      .filter({ hasText: "固态硬盘" })
      .click();
    await tool("观察");
    await page.getByTestId("primary-action").click();
    await closeLesson();
    await expect(page.getByTestId("primary-action")).toBeDisabled();
    await tool("拆装");
    p = await marker("sata-power");
    await drag(p, { x: p.x - p.ax * 0.4, y: p.y - p.ay * 0.4 });
    expect((await state()).repairStep).toBe(0);
    p = await marker("sata-power");
    await drag(p, { x: p.x + p.ax * 0.3, y: p.y + p.ay * 0.3 });
    await expect.poll(async () => (await state()).repairStep).toBe(1);
    await tool("接线");
    p = await marker("sata-data");
    await drag(p, { x: p.x + p.ax, y: p.y + p.ay });
    await expect(page.locator(".connector-lesson")).toHaveAttribute(
      "data-phase",
      "release",
    );
    await expect(page.locator(".mechanic-hud")).toContainText("锁扣仍在阻挡");
    p = await marker("sata-clip");
    await page.mouse.click(p.x, p.y);
    await expect(page.locator(".connector-lesson")).toHaveAttribute(
      "data-phase",
      "release",
    );
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.waitForTimeout(500);
    await page.mouse.move(p.x + p.ax * 1.1, p.y + p.ay * 1.1, { steps: 22 });
    await page.mouse.up();
    await expect(page.locator(".connector-lesson")).toHaveAttribute(
      "data-phase",
      "insert",
    );
    expect((await state()).fixed).toBe(false);
    await page.keyboard.press("r");
    p = await marker("sata-data");
    await drag(p, { x: p.x + p.ax * 1.5, y: p.y + p.ay * 1.5 });
    await expect(page.locator(".mechanic-hud")).toContainText("对位不正确");
    for (let i = 0; i < 3; i++) await page.keyboard.press("r");
    for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowDown");
    await expect(page.locator(".alignment-status")).toContainText("位置需微调");
    p = await marker("sata-data");
    await drag(p, { x: p.x + p.ax * 1.5, y: p.y + p.ay * 1.5 });
    expect((await state()).fixed).toBe(false);
    for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowUp");
    await expect(page.locator(".alignment-status.ready")).toBeVisible();
    p = await marker("sata-data");
    await page.mouse.click(p.x, p.y);
    await expect(page.locator(".connector-lesson")).toHaveAttribute(
      "data-phase",
      "insert",
    );
    await page.screenshot({
      path: "artifacts/manual-sata.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.waitForTimeout(150);
    await page.locator(".scene-shell").scrollIntoViewIfNeeded();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    p = await marker("sata-data");
    expect(
      await page.evaluate(
        ({ x, y }) => document.elementFromPoint(x, y)?.tagName,
        p,
      ),
    ).toBe("CANVAS");
    await page.screenshot({
      path: "artifacts/manual-sata-mobile.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.waitForTimeout(150);
    await page.locator(".scene-shell").scrollIntoViewIfNeeded();
    p = await marker("sata-data");
    const socketBefore = await marker("sata-guide");
    const initialGap = Math.hypot(p.x - socketBefore.x, p.y - socketBefore.y);
    expect(initialGap).toBeGreaterThan(30);
    await expect(page.locator(".connector-state")).toContainText("尚未连接");
    await drag(p, { x: p.x + p.ax * 0.35, y: p.y + p.ay * 0.35 });
    p = await marker("sata-data");
    const socketAfter = await marker("sata-guide");
    expect(
      Math.hypot(
        socketAfter.x - socketBefore.x,
        socketAfter.y - socketBefore.y,
      ),
    ).toBeLessThan(1);
    expect(Math.hypot(p.x - socketAfter.x, p.y - socketAfter.y)).toBeLessThan(
      initialGap - 10,
    );
    expect((await state()).fixed).toBe(false);
    await drag(p, { x: p.x + p.ax * 1.5, y: p.y + p.ay * 1.5 });
    await expect(page.locator(".connector-lesson")).toHaveAttribute(
      "data-phase",
      "verify",
    );
    expect((await state()).fixed).toBe(false);
    p = await marker("sata-data");
    await page.mouse.click(p.x, p.y);
    expect((await state()).fixed).toBe(false);
    await drag(p, { x: p.x + p.ax * 0.3, y: p.y + p.ay * 0.3 });
    await expect.poll(async () => (await state()).fixed).toBe(true);
    console.log(
      "PASS third job: power seating, latch-held extraction, keyed orientation, fine alignment, deliberate insertion and retention check",
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
    await page.locator(".quiz-options button").nth(0).click();
    await page.getByRole("button", { name: "学会了，准备交付" }).click();
    await page.getByTestId("primary-action").click();
    await expect.poll(async () => (await state()).delivered).toBe(true);
    expect(errors).toEqual([]);
    console.log(
      "PASS complete third direct repair, reassembly, quiz and delivery",
    );
  }
  if (fanOnly) {
    await page.goto("http://127.0.0.1:5188");
    await page.evaluate(
      (game) =>
        localStorage.setItem(
          "little-repair-shop-v2",
          JSON.stringify({
            version: 2,
            game,
            completed: ["memory", "cooling", "storage"],
            purchased: ["air", "cable"],
            learned: ["ram", "cooler", "storage"],
            seen: ["chapter:pc", "chapter:fan"],
          }),
        ),
      createGame("fan-dust"),
    );
    await page.reload();
  } else if (
    !keyboardOnly &&
    !cableOnly &&
    !bearingOnly &&
    !process.argv.includes("--storage")
  ) {
    await closeLesson();
    await page.getByRole("button", { name: /维修工单/ }).click();
    await page
      .locator(".chapter-tabs button")
      .filter({ hasText: "CH.02" })
      .click();
    await page.locator(".job-card").filter({ hasText: "风变小了" }).click();
    await closeLesson();
  }
  if (
    !keyboardOnly &&
    !cableOnly &&
    !bearingOnly &&
    (fanOnly || !process.argv.includes("--storage"))
  ) {
    await expect(
      page.getByRole("button", { name: "3D 手动实操", exact: true }),
    ).toHaveClass("active");
    await page.getByTestId("primary-action").click();
    await page.getByTestId("primary-action").click();
    await expect(page.getByTestId("primary-action")).toBeDisabled();
    await tool("拆装");
    p = await marker("screw");
    await page.mouse.click(p.x, p.y);
    expect((await state()).screws).toBe(4);
    await tool("螺丝刀");
    await turn(true, 0.7);
    expect((await state()).screws).toBe(4);
    for (let i = 4; i > 0; i--) {
      await turn(false);
      await expect.poll(async () => (await state()).screws).toBe(i - 1);
    }
    await tool("拆装");
    p = await marker("cover");
    await drag(p, { x: p.x - p.ay * 0.6, y: p.y + p.ax * 0.6 });
    expect((await state()).panelOpen).toBe(false);
    p = await marker("cover");
    await drag(p, { x: p.x + p.ax * 1.3, y: p.y + p.ay * 1.3 });
    expect((await state()).panelOpen).toBe(false);
    await expect(page.locator(".mechanic-hud")).toContainText("向左");
    p = await marker("cover");
    await drag(p, { x: p.x + p.ax * 3.5, y: p.y + p.ay * 3.5 });
    await expect.poll(async () => (await state()).panelOpen).toBe(true);
    await page
      .locator(".part-selector button")
      .filter({ hasText: "扇叶与护网" })
      .click();
    await tool("观察");
    await page.getByTestId("primary-action").click();
    await closeLesson();
    await expect(page.getByTestId("primary-action")).toBeDisabled();
    await tool("拆装");
    p = await marker("fan-hold");
    await page.mouse.click(p.x, p.y);
    expect((await state()).repairStep).toBe(0);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.waitForTimeout(850);
    await page.mouse.up();
    await expect.poll(async () => (await state()).repairStep).toBe(1);
    await tool("气吹");
    async function puff(i, ms = 300) {
      const p = await marker(`dust${i}`);
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      await page.waitForTimeout(ms);
      await page.mouse.up();
      await page.waitForTimeout(120);
    }
    await puff(0, 1100);
    await expect(page.locator('[data-kind="dust0"]')).toHaveAttribute(
      "data-cleared",
      "false",
    );
    await puff(0);
    await puff(4);
    await page.reload();
    await expect(page.locator(".mechanic-hud")).toContainText(
      "护网 0 / 4 · 叶片 0 / 5",
    );
    expect((await state()).repairStep).toBe(1);
    for (let i = 0; i < 5; i++) await puff(i);
    await expect(page.locator(".mechanic-hud")).toContainText(
      "护网 4 / 4 · 叶片 1 / 5",
    );
    expect((await state()).fixed).toBe(false);
    await page.screenshot({ path: "artifacts/manual-fan.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.waitForTimeout(200);
    await page.locator(".scene-shell").scrollIntoViewIfNeeded();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    for (let i = 5; i < 9; i++) {
      const m = await marker(`dust${i}`);
      expect(
        await page.evaluate(
          ({ x, y }) => document.elementFromPoint(x, y)?.tagName,
          m,
        ),
      ).toBe("CANVAS");
    }
    await page.screenshot({
      path: "artifacts/manual-fan-mobile.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.waitForTimeout(200);
    await page.locator(".scene-shell").scrollIntoViewIfNeeded();
    for (let i = 5; i < 9; i++) await puff(i);
    await expect.poll(async () => (await state()).fixed).toBe(true);
    await tool("拆装");
    await page.getByRole("button", { name: /沿槽推入/ }).click();
    p = await marker("cover");
    await drag(p, { x: p.x + p.ax * 1.3, y: p.y + p.ay * 1.3 });
    expect((await state()).panelOpen).toBe(true);
    await expect(page.locator(".mechanic-hud")).toContainText("螺孔尚未对齐");
    await page.getByRole("button", { name: "平移对位", exact: true }).click();
    for (let i = 0; i < 4; i++) {
      p = await marker("cover");
      const g = await marker("cover-guide");
      await drag(p, { x: g.x - p.ax, y: g.y - p.ay });
    }
    await expect(page.locator(".alignment-status.ready")).toBeVisible();
    expect((await state()).panelOpen).toBe(true);
    await page.getByRole("button", { name: /沿槽推入/ }).click();
    p = await marker("cover");
    await drag(p, { x: p.x + p.ax * 1.4, y: p.y + p.ay * 1.4 });
    await expect.poll(async () => (await state()).panelOpen).toBe(false);
    await tool("螺丝刀");
    for (let i = 0; i < 4; i++) {
      await turn(true);
      await expect.poll(async () => (await state()).screws).toBe(i + 1);
    }
    await page.getByTestId("primary-action").click();
    await page.getByTestId("primary-action").click();
    await page.locator(".quiz-options button").nth(0).click();
    await page.getByRole("button", { name: "学会了，准备交付" }).click();
    await page.getByTestId("primary-action").click();
    await expect.poll(async () => (await state()).delivered).toBe(true);
    expect(errors).toEqual([]);
    console.log(
      "PASS fourth job: screw turning, axial guard extraction before moving aside, hold blades, clean 4 guard and 5 blade patches, reload recovery, mobile, deliberate reassembly and delivery",
    );
  }
  if (
    !keyboardOnly &&
    !cableOnly &&
    (bearingOnly || (!fanOnly && !process.argv.includes("--storage")))
  ) {
    if (bearingOnly) {
      await page.goto("http://127.0.0.1:5188");
      await page.evaluate(
        (game) =>
          localStorage.setItem(
            "little-repair-shop-v2",
            JSON.stringify({
              version: 2,
              game,
              completed: ["memory", "cooling", "storage", "fan-dust"],
              purchased: ["air", "cable"],
              learned: ["ram", "cooler", "storage", "fanBlade"],
              seen: ["chapter:pc", "chapter:fan"],
            }),
          ),
        createGame("fan-bearing"),
      );
      await page.reload();
    } else {
      await closeLesson();
      await page.getByRole("button", { name: /维修工单/ }).click();
      await page
        .locator(".chapter-tabs button")
        .filter({ hasText: "CH.02" })
        .click();
      await page
        .locator(".job-card")
        .filter({ hasText: "吱呀作响的小风扇" })
        .click();
      await closeLesson();
    }
    await page.getByRole("button", { name: "装备市场", exact: true }).click();
    await page
      .locator(".market-grid article")
      .filter({ hasText: market.find((item) => item.id === "oil").name })
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
    await drag(p, { x: p.x + p.ax * 1.3, y: p.y + p.ay * 1.3 });
    p = await marker("cover");
    await drag(p, { x: p.x + p.ax * 3.5, y: p.y + p.ay * 3.5 });
    await expect.poll(async () => (await state()).panelOpen).toBe(true);
    await page
      .locator(".part-selector button")
      .filter({ hasText: "电机轴承" })
      .click();
    await tool("观察");
    await page.getByTestId("primary-action").click();
    await closeLesson();
    await tool("气吹");
    p = await marker("bearing-spin");
    await page.mouse.click(p.x, p.y);
    expect((await state()).repairStep).toBe(0);
    await tool("拆装");
    p = await marker("bearing-spin");
    await page.mouse.click(p.x, p.y);
    expect((await state()).repairStep).toBe(0);
    async function spinBearing() {
      const p = await marker("bearing-spin"),
        c = await marker("bearing-hub"),
        a = Math.atan2(p.y - c.y, p.x - c.x),
        r = Math.hypot(p.x - c.x, p.y - c.y);
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      for (let i = 1; i <= 24; i++) {
        const angle = a + (i * 0.8) / 24;
        await page.mouse.move(
          c.x + Math.cos(angle) * r,
          c.y + Math.sin(angle) * r,
        );
      }
      await page.mouse.up();
    }
    await spinBearing();
    await expect
      .poll(async () => (await state()).repairStep, { timeout: 10000 })
      .toBe(1);
    await expect(page.locator(".bearing-lesson")).toHaveAttribute(
      "data-phase",
      "open",
    );
    p = await marker("bearing-plug");
    await drag(p, { x: p.x + p.ax * 0.8, y: p.y + p.ay * 0.8 });
    expect((await state()).repairStep).toBe(1);
    p = await marker("bearing-plug");
    await drag(p, { x: p.x + p.ax * 0.85, y: p.y + p.ay * 0.85 });
    await expect.poll(async () => (await state()).repairStep).toBe(2);
    await tool("润滑");
    p = await marker("bearing-oil");
    await page.mouse.click(p.x, p.y);
    expect((await state()).repairStep).toBe(2);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.waitForTimeout(850);
    await page.mouse.up();
    await expect(page.locator(".mechanic-hud")).toContainText("挤压太久");
    expect((await state()).repairStep).toBe(2);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.waitForTimeout(200);
    await page.mouse.move(p.x + 30, p.y, { steps: 5 });
    await page.mouse.up();
    expect((await state()).repairStep).toBe(2);
    await page.screenshot({
      path: "artifacts/manual-bearing.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.waitForTimeout(200);
    await page.locator(".scene-shell").scrollIntoViewIfNeeded();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    p = await marker("bearing-oil");
    expect(
      await page.evaluate(
        ({ x, y }) => document.elementFromPoint(x, y)?.tagName,
        p,
      ),
    ).toBe("CANVAS");
    await page.screenshot({
      path: "artifacts/manual-bearing-mobile.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.waitForTimeout(200);
    await page.locator(".scene-shell").scrollIntoViewIfNeeded();
    await page.reload();
    await expect.poll(async () => (await state()).repairStep).toBe(2);
    await expect(page.locator(".bearing-lesson")).toHaveAttribute(
      "data-phase",
      "oil",
    );
    await tool("润滑");
    p = await marker("bearing-oil");
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.waitForTimeout(250);
    await page.mouse.up();
    await expect.poll(async () => (await state()).repairStep).toBe(3);
    expect((await state()).fixed).toBe(false);
    await tool("拆装");
    await page.getByRole("button", { name: /沿槽推入/ }).click();
    p = await marker("bearing-plug");
    await drag(p, { x: p.x + p.ax * 0.8, y: p.y + p.ay * 0.8 });
    await expect(page.locator(".mechanic-hud")).toContainText("胶塞还没对孔");
    await page.getByRole("button", { name: "平移对位", exact: true }).click();
    for (let i = 0; i < 4; i++) {
      p = await marker("bearing-plug");
      const g = await marker("bearing-port");
      await drag(p, { x: g.x - p.ax * 0.55, y: g.y - p.ay * 0.55 });
    }
    await expect(page.locator(".alignment-status.ready")).toBeVisible();
    expect((await state()).fixed).toBe(false);
    await page.getByRole("button", { name: /沿槽推入/ }).click();
    p = await marker("bearing-plug");
    await drag(p, { x: p.x + p.ax * 0.85, y: p.y + p.ay * 0.85 });
    await expect(page.locator(".bearing-lesson")).toHaveAttribute(
      "data-phase",
      "after",
    );
    expect((await state()).fixed).toBe(false);
    await page.screenshot({
      path: "artifacts/manual-bearing-after.png",
      fullPage: true,
    });
    await spinBearing();
    await expect
      .poll(async () => (await state()).fixed, { timeout: 10000 })
      .toBe(true);
    await page.getByRole("button", { name: "平移对位", exact: true }).click();
    for (let i = 0; i < 4; i++) {
      p = await marker("cover");
      const g = await marker("cover-guide");
      await drag(p, { x: g.x - p.ax, y: g.y - p.ay });
    }
    await expect(page.locator(".alignment-status.ready")).toBeVisible();
    await page.getByRole("button", { name: /沿槽推入/ }).click();
    p = await marker("cover");
    await drag(p, { x: p.x + p.ax * 1.4, y: p.y + p.ay * 1.4 });
    await expect.poll(async () => (await state()).panelOpen).toBe(false);
    await tool("螺丝刀");
    for (let i = 0; i < 4; i++) {
      await turn(true);
      await expect.poll(async () => (await state()).screws).toBe(i + 1);
    }
    await page.getByTestId("primary-action").click();
    await page.getByTestId("primary-action").click();
    await page.locator(".quiz-options button").nth(1).click();
    await page.getByRole("button", { name: "学会了，准备交付" }).click();
    await page.getByTestId("primary-action").click();
    await expect.poll(async () => (await state()).delivered).toBe(true);
    expect(errors).toEqual([]);
    console.log(
      "PASS fifth job: manual guard, dry spin and coast, rear plug extraction, reject quick/long/drifting oil, one short oil drop, explicit sealing and lubricated spin, reload, mobile and delivery",
    );
  }

  if (
    !keyboardOnly &&
    (cableOnly ||
      (!fanOnly && !bearingOnly && !process.argv.includes("--storage")))
  ) {
    if (cableOnly) {
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
              ],
              purchased: ["air", "cable", "oil"],
              learned: ["ram", "cooler", "storage", "fanBlade", "fanMotor"],
              seen: ["chapter:pc", "chapter:fan"],
            }),
          ),
        createGame("fan-cable"),
      );
      await page.reload();
    } else {
      await closeLesson();
      await page.getByRole("button", { name: /维修工单/ }).click();
      await page
        .locator(".chapter-tabs button")
        .filter({ hasText: "CH.02" })
        .click();
      await page
        .locator(".job-card")
        .filter({ hasText: "看不见的断点" })
        .click();
      await closeLesson();
    }
    await page.getByRole("button", { name: "装备市场", exact: true }).click();
    await page
      .locator(".market-grid article")
      .filter({ hasText: market.find((item) => item.id === "meter").name })
      .getByRole("button", { name: "购买装备" })
      .click();
    await page.getByRole("button", { name: "关闭窗口" }).click();
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
    await drag(p, { x: p.x + p.ax * 1.3, y: p.y + p.ay * 1.3 });
    p = await marker("cover");
    await drag(p, { x: p.x + p.ax * 3.5, y: p.y + p.ay * 3.5 });
    await expect.poll(async () => (await state()).panelOpen).toBe(true);
    await page
      .locator(".part-selector button")
      .filter({ hasText: "USB 供电线" })
      .click();
    await tool("观察");
    await page.getByTestId("primary-action").click();
    await closeLesson();
    await tool("万用表");
    p = await marker("wire-unplug");
    await drag(p, { x: p.x + p.ax, y: p.y + p.ay });
    expect((await state()).repairStep).toBe(0);
    await tool("拆装");
    p = await marker("wire-unplug");
    await page.mouse.click(p.x, p.y);
    expect((await state()).repairStep).toBe(0);
    await drag(p, { x: p.x + p.ax * 1.2, y: p.y + p.ay * 1.2 });
    await expect.poll(async () => (await state()).repairStep).toBe(1);
    await tool("万用表");
    async function moveProbe(id, targetId) {
      const start = await marker(`probe-${id}`),
        end = await marker(targetId);
      await drag(start, end);
    }
    async function measure(net) {
      await moveProbe("red", `wire-a-${net}`);
      await moveProbe("black", `wire-b-${net}`);
      await page.waitForTimeout(750);
    }
    await measure("plus");
    await expect(page.getByTestId("meter-reading")).toHaveText("—");
    await page.getByRole("button", { name: "V⎓", exact: true }).click();
    await expect(page.getByTestId("meter-reading")).toHaveText("选通断档");
    await page.getByRole("button", { name: "Ω / 蜂鸣", exact: true }).click();
    await page
      .getByRole("button", { name: "蜂鸣声音：关", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "关闭操作音效", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "关闭操作音效", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "蜂鸣声音：关", exact: true }),
    ).toBeVisible();
    await page.waitForTimeout(700);
    await expect(page.locator(".meter-evidence")).toContainText(
      "A+ ↔ B+：未测",
    );
    // No stored conductor result until the instrument has passed a tip-short self-test.
    await moveProbe("red", "probe-black");
    await expect(page.locator(".meter-evidence .verified")).toContainText(
      "短接表笔自检",
    );
    await moveProbe("red", "wire-a-plus");
    await moveProbe("black", "wire-b-minus");
    await page.waitForTimeout(700);
    await expect(page.locator(".mechanic-hud")).toContainText("不同导体");
    await expect(page.locator(".meter-evidence")).toContainText(
      "A+ ↔ B+：未测",
    );
    // Exact contact placement matters: a tip released in free space must stay there.
    p = await marker("probe-red");
    await drag(p, { x: p.x, y: p.y - 24 });
    await page.waitForTimeout(650);
    expect((await state()).repairStep).toBe(1);
    await measure("plus");
    p = await marker("probe-red");
    await page.getByRole("button", { name: "微调红笔", exact: true }).click();
    await page.keyboard.press("ArrowRight");
    const adjusted = await marker("probe-red");
    expect(adjusted.x).toBeGreaterThan(p.x);
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(650);
    await expect(page.locator(".meter-evidence")).toContainText("A+ ↔ B+：OL");
    await expect(page.getByTestId("meter-beep")).toContainText("无蜂鸣");
    await page.screenshot({
      path: "artifacts/manual-cable-open.png",
      fullPage: true,
    });
    await page.reload();
    await expect(page.locator(".cable-lesson")).toHaveAttribute(
      "data-phase",
      "diagnose",
    );
    await expect(page.locator(".meter-evidence")).toContainText(
      "A+ ↔ B+：未测",
    );
    await page.getByRole("button", { name: "Ω / 蜂鸣", exact: true }).click();
    await moveProbe("red", "probe-black");
    await expect(page.locator(".meter-evidence .verified")).toBeVisible();
    await measure("plus");
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.waitForTimeout(200);
    await page.locator(".scene-shell").scrollIntoViewIfNeeded();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    for (const id of [
      "probe-red",
      "probe-black",
      "wire-a-minus",
      "wire-b-minus",
    ]) {
      const at = await marker(id);
      expect(
        await page.evaluate(
          ({ x, y }) => document.elementFromPoint(x, y)?.tagName,
          at,
        ),
      ).toBe("CANVAS");
    }
    await page.screenshot({
      path: "artifacts/manual-cable-mobile.png",
      fullPage: true,
    });
    // Actually measure a conductor at phone width, instead of only checking layout.
    await measure("minus");
    await moveProbe("red", "rack-red");
    await moveProbe("black", "rack-black");
    await expect.poll(async () => (await state()).repairStep).toBe(2);
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.waitForTimeout(200);
    await page.locator(".scene-shell").scrollIntoViewIfNeeded();
    await tool("接线");
    p = await marker("wire-carry");
    await drag(p, { x: p.x + p.ax * 1.8, y: p.y + p.ay * 1.8 });
    await expect(page.locator(".cable-lesson")).toHaveAttribute(
      "data-phase",
      "prepare",
    );
    p = await marker("wire-carry");
    await drag(p, { x: p.x + p.ax * 1.02, y: p.y + p.ay * 1.02 });
    await expect.poll(async () => (await state()).repairStep).toBe(3);
    expect((await state()).fixed).toBe(false);
    await page.reload();
    await expect(page.locator(".cable-lesson")).toHaveAttribute(
      "data-phase",
      "retest",
    );
    await tool("万用表");
    await page.getByRole("button", { name: "Ω / 蜂鸣", exact: true }).click();
    await moveProbe("red", "probe-black");
    await expect(page.locator(".meter-evidence .verified")).toBeVisible();
    await measure("plus");
    await expect(page.locator(".meter-evidence")).toContainText(
      "A+ ↔ B+：0.3 Ω",
    );
    await expect(page.getByTestId("meter-beep")).toContainText("蜂鸣 · 低电阻");
    await measure("minus");
    await moveProbe("red", "rack-red");
    await moveProbe("black", "rack-black");
    await expect(page.locator(".cable-lesson")).toHaveAttribute(
      "data-phase",
      "insert",
    );
    expect((await state()).fixed).toBe(false);
    await tool("接线");
    await page.getByRole("button", { name: "平移对位", exact: true }).click();
    for (let i = 0; i < 7; i++) await page.keyboard.press("ArrowRight");
    await page.getByRole("button", { name: /沿槽推入/ }).click();
    p = await marker("wire-plug");
    await drag(p, { x: p.x + p.ax * 1.1, y: p.y + p.ay * 1.1 });
    await expect(page.locator(".mechanic-hud")).toContainText("插座会阻挡");
    expect((await state()).fixed).toBe(false);
    await page.getByRole("button", { name: "平移对位", exact: true }).click();
    for (let i = 0; i < 7; i++) await page.keyboard.press("ArrowLeft");
    await expect(page.locator(".alignment-status.ready")).toBeVisible();
    await page.screenshot({
      path: "artifacts/manual-cable-connect.png",
      fullPage: true,
    });
    // Position alignment and mouse-up do not install the connector.
    expect((await state()).fixed).toBe(false);
    await page.getByRole("button", { name: /沿槽推入/ }).click();
    p = await marker("wire-plug");
    await drag(p, { x: p.x + p.ax * 1.1, y: p.y + p.ay * 1.1 });
    await expect(page.locator(".cable-lesson")).toHaveAttribute(
      "data-phase",
      "source",
    );
    expect((await state()).fixed).toBe(false);
    p = await marker("wire-plug");
    await drag(p, { x: p.x + p.ax * 1.1, y: p.y + p.ay * 1.1 });
    await expect(page.locator(".cable-lesson")).toHaveAttribute(
      "data-phase",
      "retain",
    );
    expect((await state()).fixed).toBe(false);
    p = await marker("wire-retain");
    await drag(p, { x: p.x + p.ax * 0.2, y: p.y + p.ay * 0.2 });
    await expect.poll(async () => (await state()).fixed).toBe(true);
    await tool("拆装");
    await page.getByRole("button", { name: "平移对位", exact: true }).click();
    for (let i = 0; i < 4; i++) {
      p = await marker("cover");
      const g = await marker("cover-guide");
      await drag(p, { x: g.x - p.ax, y: g.y - p.ay });
    }
    await expect(page.locator(".alignment-status.ready")).toBeVisible();
    await page.getByRole("button", { name: /沿槽推入/ }).click();
    p = await marker("cover");
    await drag(p, { x: p.x + p.ax * 1.4, y: p.y + p.ay * 1.4 });
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
      "PASS sixth job: manual guard, isolation, meter mode and tip-short self-test, actual probe contacts, reject cross-net/air readings, old open and good return, reload, mobile measurement, new-cable retest before connecting, no snap, two deliberate insertions, retention and delivery",
    );
  }
  if (
    keyboardOnly ||
    !process.argv
      .slice(2)
      .some((flag) =>
        ["--storage", "--fan", "--bearing", "--cable"].includes(flag),
      )
  )
    await runKeyboardRepair({
      page,
      state,
      marker,
      drag,
      tool,
      closeLesson,
      errors,
      only: keyboardOnly,
    });
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
