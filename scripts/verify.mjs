/**
 * Uçdan-uca yoxlama (production build üzərində: `next build && next start`).
 *
 *   BASE=http://localhost:3100 ADMIN_TOKEN=... OUT=./shots node scripts/verify.mjs
 *
 * 1. Hər eksperimenti API ilə auditoriya məlumatı ilə doldurur (skriptlə göndərişlər).
 * 2. Telefon (390×844) və proyektor (1920×1080, 1280×720) ekran görüntüləri: gözləmə, giriş, uğur,
 *    auditoriya nəticəsi, açılmış cavab, avtonom rejim və gizli həqiqətin açılması.
 * 3. Avtonom rejimdə hər eksperiment iki dəfə işlədilir: gizli həqiqət və nəticələr fərqli olmalıdır.
 * 4. 1000 sınaq/s-də kadr tezliyi ölçülür.
 * 5. Oflayn yoxlama: ?demo yüklənir, prefetch gözlənilir, brauzer oflayn edilir, hər eksperiment işlədilir.
 * 6. Proyektorda sürüşmə yoxlanılır (scrollHeight ≤ innerHeight).
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID, randomInt } from "node:crypto";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3100";
const TOKEN = process.env.ADMIN_TOKEN ?? "local-test-token";
const OUT = process.env.OUT ?? "shots";
const CODE = process.env.CODE ?? `verify-${Date.now().toString(36)}`;
mkdirSync(OUT, { recursive: true });

const EXPERIMENTS = ["dice", "event-types", "seasons", "venn", "birthday", "monte-carlo", "bayes-test", "random-seq", "ab-test"];
const WITH_REVEAL = new Set(["event-types", "birthday", "bayes-test"]);
const WITH_TRUTH = new Set(["dice", "seasons", "venn", "bayes-test", "ab-test"]);
const report = { code: CODE, checks: [], fps: {}, autonomous: {}, offline: null, scroll: [] };
const check = (name, ok, detail = "") => {
  report.checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` - ${detail}` : ""}`);
};

async function api(pathname, body, headers = {}) {
  const res = await fetch(`${BASE}/api/sessions/${CODE}${pathname}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}
const admin = (body) => api("/admin", body, { "x-admin-token": TOKEN });
const submit = (exp, deviceId, input) => api(`/experiments/${exp}/submissions`, { deviceId, input });

/** İnsana bənzər "təsadüfi" ardıcıllıq: tez-tez dəyişir, uzun seriyalardan qaçır. */
function humanSequence() {
  let s = randomInt(2) ? "G" : "R";
  while (s.length < 20) {
    const last = s[s.length - 1];
    const run = s.length - s.replace(new RegExp(`${last}+$`), "").length;
    const flip = run >= 3 ? 0.95 : 0.62;
    s += Math.random() < flip ? (last === "G" ? "R" : "G") : last;
  }
  return s;
}

async function seed(exp, devices = 30) {
  await admin({ action: "setActive", exp });
  await admin({ action: "setMode", exp, mode: "audience" });
  let accepted = 0;
  for (let d = 0; d < devices; d += 1) {
    const id = randomUUID();
    const send = async (input) => ((await submit(exp, id, input)).status === 201 ? (accepted += 1) : 0);
    switch (exp) {
      case "dice":
        for (let i = 0; i < 6; i += 1) await send({});
        break;
      case "event-types":
        await send({ item: 0, answer: ["mumkunsuz", "mumkunsuz", "tesadufi", "yeqin"][randomInt(4)] });
        break;
      case "seasons":
        await send({ season: ["qis", "yaz", "yay", "payiz"][randomInt(4)] });
        break;
      case "venn": {
        const b = Math.random() < 0.45;
        await send({ a: Math.random() < (b ? 0.75 : 0.4), b });
        break;
      }
      case "birthday":
        await send({ day: 1 + randomInt(28), month: 1 + randomInt(12), guess: ["0-10", "10-30", "10-30", "30-50", "50-70"][randomInt(5)] });
        break;
      case "monte-carlo":
        for (let i = 0; i < 2; i += 1) await send({});
        break;
      case "bayes-test":
        await send({ guess: Math.min(100, Math.max(0, Math.round(70 + 25 * (Math.random() - 0.5) * 2 - (Math.random() < 0.2 ? 60 : 0)))) });
        break;
      case "random-seq":
        await send({ sequence: humanSequence() });
        break;
      case "ab-test":
        for (let i = 0; i < 5; i += 1) {
          const a = await api("/experiments/ab-test/assign", { deviceId: id });
          if (a.status === 200) await send({ clicked: Math.random() < (a.body.variant === "b" ? 0.4 : 0.15) });
        }
        break;
    }
  }
  check(`seed ${exp}`, accepted > 0, `${accepted} accepted`);
}

async function noScroll(page, label) {
  const dims = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: window.innerHeight, sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  const ok = dims.sh <= dims.ih + 1 && dims.sw <= dims.iw + 1;
  report.scroll.push({ label, ...dims, ok });
  if (!ok) check(`no scroll ${label}`, false, JSON.stringify(dims));
  return ok;
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}

async function projectorPage(browser, viewport, query = "?admin") {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await context.addInitScript((token) => sessionStorage.setItem("hl:admin-token", token), TOKEN);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${BASE}/s/${CODE}${query}`);
  return { context, page, errors };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function engineSpeed(page, label) {
  await page.getByRole("radio", { name: label, exact: true }).click();
}

async function takeawayText(page) {
  return (await page.locator(".takeaway").textContent().catch(() => null)) ?? "";
}

async function measureFps(page, ms = 3000) {
  return page.evaluate(
    (duration) =>
      new Promise((resolve) => {
        let frames = 0;
        let longest = 0;
        let last = performance.now();
        const start = last;
        const tick = (now) => {
          frames += 1;
          longest = Math.max(longest, now - last);
          last = now;
          if (now - start < duration) requestAnimationFrame(tick);
          else resolve({ fps: (frames * 1000) / (now - start), longestFrameMs: longest });
        };
        requestAnimationFrame(tick);
      }),
    ms,
  );
}

const browser = await chromium.launch();

// ---------- Telefon: gözləmə ekranı ----------
await admin({ action: "setActive", exp: null });
const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const phone = await phoneContext.newPage();
await phone.goto(`${BASE}/j/${CODE}`);
await phone.getByText("Növbəti eksperimenti gözləyin").waitFor();
await shot(phone, "phone-00-waiting");
check("phone waiting screen", true);

// ---------- Auditoriya rejimi: hər eksperiment ----------
for (const [i, exp] of EXPERIMENTS.entries()) {
  const tag = `${String(i + 1).padStart(2, "0")}-${exp}`;
  await seed(exp);

  // Telefon: giriş ekranı və bir real UI göndərişi
  await phone.waitForTimeout(3200);
  await shot(phone, `phone-${tag}-input`);
  const phoneOk = await (async () => {
    try {
      switch (exp) {
        case "dice":
          await phone.getByRole("button", { name: /Zəri at/ }).click();
          await phone.getByText("Sizin atışınız").waitFor();
          break;
        case "event-types":
          await phone.getByRole("button", { name: "Mümkünsüz" }).click();
          await phone.getByText("Cavabınız qeydə alındı").waitFor();
          break;
        case "seasons":
          await phone.getByRole("button", { name: "Payız" }).click();
          await phone.getByText("Sizin hadisəniz").waitFor();
          break;
        case "venn":
          await phone.locator("label.choice").nth(0).click();
          await phone.locator("label.choice").nth(3).click();
          await phone.getByRole("button", { name: "Cavabı göndər" }).click();
          await phone.getByText("Sizin nəticəniz bu bölgəyə düşdü").waitFor();
          break;
        case "birthday":
          await phone.locator("label.choice").nth(1).click();
          await phone.locator(".date-row input").fill("14");
          await phone.locator(".date-row select").selectOption("3");
          await phone.getByRole("button", { name: "Göndər" }).click();
          await phone.getByText("Sizin tarixiniz").waitFor();
          break;
        case "monte-carlo":
          await phone.getByRole("button", { name: /100 nöqtə at/ }).click();
          await phone.getByText("Son atış").waitFor();
          break;
        case "bayes-test":
          await phone.locator('input[type="range"]').fill("35");
          await phone.getByRole("button", { name: /göndər/ }).click();
          await phone.getByText("Sizin təxmininiz").waitFor();
          break;
        case "random-seq":
          for (const c of "GRGGRRGRGRRGGGRGRRGR") await phone.getByRole("button", { name: c, exact: true }).click();
          await phone.getByRole("button", { name: "Göndər" }).click();
          await phone.getByText("Sizin ardıcıllığınız").waitFor();
          break;
        case "ab-test":
          await phone.locator(".ad-card").waitFor();
          await shot(phone, `phone-${tag}-input`);
          await phone.getByRole("button", { name: "Klik et" }).click();
          await phone.waitForTimeout(800);
          break;
      }
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  })();
  await shot(phone, `phone-${tag}-success`);
  check(`phone submit ${exp}`, phoneOk);

  // Proyektor: auditoriya nəticəsi
  for (const vp of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }]) {
    const { context, page, errors } = await projectorPage(browser, vp);
    await page.waitForFunction(() => window.__hlPrefetched === true);
    await page.waitForFunction(() => window.__hlPrefetched === true);
  await page.locator(".qr-dock button").click().catch(() => undefined);
    await page.waitForTimeout(2500);
    await shot(page, `proj-${vp.width}-${tag}-audience`);
    await noScroll(page, `${vp.width} ${exp} audience`);
    if (WITH_REVEAL.has(exp)) {
      await page.getByRole("button", { name: "Cavabı göstər" }).click();
      await page.waitForTimeout(1500);
      await shot(page, `proj-${vp.width}-${tag}-revealed`);
      await noScroll(page, `${vp.width} ${exp} revealed`);
      await page.getByRole("button", { name: "Cavabı gizlət" }).click();
      await page.waitForTimeout(600);
    }
    check(`projector ${vp.width} ${exp} no page errors`, errors.length === 0, errors.join("; "));
    await context.close();
  }
}

// Telefon: avtonom bildirişi
await admin({ action: "setActive", exp: "venn" });
await admin({ action: "setMode", exp: "venn", mode: "auto" });
await phone.waitForTimeout(3200);
await shot(phone, "phone-10-autonomous-notice");
check("phone autonomous notice", (await phone.getByText("Bu eksperiment avtonom işləyir").count()) > 0);

// ---------- Avtonom rejim: hər eksperiment iki dəfə ----------
for (const [i, exp] of EXPERIMENTS.entries()) {
  const tag = `${String(i + 1).padStart(2, "0")}-${exp}`;
  await admin({ action: "setActive", exp });
  await admin({ action: "setMode", exp, mode: "auto" });
  const runs = [];
  for (const vp of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }]) {
    const { context, page, errors } = await projectorPage(browser, vp);
    await page.waitForFunction(() => window.__hlPrefetched === true);
    await page.waitForFunction(() => window.__hlPrefetched === true);
  await page.locator(".qr-dock button").click().catch(() => undefined);
    await page.waitForFunction(() => window.__hlPrefetched === true);
    await engineSpeed(page, "1 000/s");
    await page.getByRole("button", { name: "Başlat", exact: true }).click();
    const fps = await measureFps(page, 3000);
    if (vp.width === 1920) report.fps[exp] = fps;
    await page.waitForTimeout(1000);
    await shot(page, `proj-${vp.width}-${tag}-auto-running`);
    await noScroll(page, `${vp.width} ${exp} auto`);
    await page.getByRole("button", { name: "Dayandır", exact: true }).click();
    const before = await takeawayText(page);
    if (WITH_TRUTH.has(exp)) {
      await page.getByRole("button", { name: "Gizli parametri göstər" }).click();
      await page.waitForTimeout(500);
      await shot(page, `proj-${vp.width}-${tag}-auto-revealed`);
      await noScroll(page, `${vp.width} ${exp} auto revealed`);
    }
    if (exp === "birthday" || exp === "bayes-test" || exp === "event-types") {
      await page.getByRole("button", { name: "Cavabı göstər" }).click().catch(() => undefined);
    }
    const after = await takeawayText(page);
    const key = [...(await page.locator(".key-value").allTextContents()), ...(await page.locator(".sequence").allTextContents())];
    runs.push({ before, after, key: key.join(" | ") });
    // İkinci qaçış: yeni gizli həqiqət
    await page.getByRole("button", { name: "Yenidən başlat" }).click();
    check(`auto ${vp.width} ${exp} no page errors`, errors.length === 0, errors.join("; "));
    await context.close();
  }
  const differ = runs[0].key !== runs[1].key || runs[0].after !== runs[1].after;
  report.autonomous[exp] = runs;
  check(`auto ${exp} results differ between runs`, differ);
  if (WITH_TRUTH.has(exp)) check(`auto ${exp} reveal mentions hidden truth`, runs.every((r) => /Gizli/.test(r.after)), runs.map((r) => r.after.slice(0, 90)).join(" || "));
  await admin({ action: "setMode", exp, mode: "audience" });
}

// "Hər ikisi" rejimi (A/B): auditoriya klikləri mühərrikə ötürülür
{
  await admin({ action: "setActive", exp: "ab-test" });
  await admin({ action: "setMode", exp: "ab-test", mode: "both" });
  const { context, page } = await projectorPage(browser, { width: 1920, height: 1080 });
  await page.waitForFunction(() => window.__hlPrefetched === true);
  await page.locator(".qr-dock button").click().catch(() => undefined);
  await page.waitForFunction(() => window.__hlPrefetched === true);
  await engineSpeed(page, "100/s");
  await page.getByRole("button", { name: "Başlat", exact: true }).click();
  await page.waitForTimeout(4000);
  await shot(page, "proj-1920-09-ab-test-both");
  check("ab-test both mode shows audience table", (await page.getByText("Auditoriya (real kliklər)").count()) > 0);
  await context.close();
}

// ---------- Oflayn demo yoxlaması ----------
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const failed = [];
  const errors = [];
  page.on("requestfailed", (r) => failed.push(r.url()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${BASE}/s/${CODE}?demo`);
  await page.waitForFunction(() => window.__hlPrefetched === true);
  await page.waitForLoadState("networkidle");
  await context.setOffline(true);
  const failedBefore = failed.length;
  for (const exp of EXPERIMENTS) {
    await page.locator(".control-select select").selectOption(exp);
    await engineSpeed(page, "1 000/s");
    await page.getByRole("button", { name: "Başlat", exact: true }).click();
    await page.waitForTimeout(1200);
    await page.getByRole("button", { name: "Dayandır", exact: true }).click();
    const notices = await page.locator(".notice").count();
    if (notices > 0) errors.push(`${exp}: ${await page.locator(".notice").first().textContent()}`);
    await shot(page, `offline-1280-${exp}`);
  }
  const offlineFailures = failed.slice(failedBefore);
  report.offline = { failedRequests: offlineFailures, errors };
  check("offline demo: no failed requests", offlineFailures.length === 0, offlineFailures.join(", "));
  check("offline demo: no error states", errors.length === 0, errors.join("; "));
  await context.close();
}

await browser.close();
const failures = report.checks.filter((c) => !c.ok);
writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(`\n${report.checks.length - failures.length}/${report.checks.length} checks passed. FPS @1000/s:`);
for (const [exp, f] of Object.entries(report.fps)) console.log(`  ${exp}: ${f.fps.toFixed(1)} fps, longest frame ${f.longestFrameMs.toFixed(0)} ms`);
process.exit(failures.length === 0 ? 0 : 1);
