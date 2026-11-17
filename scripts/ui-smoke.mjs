/* global document, location, window, getComputedStyle */
// Real Chromium/CDP viewport smoke; no test-framework dependency or network CDN.
// Run against a started npm run preview -- --port 4173 server.
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const baseUrl = process.env.DAYDLE_UI_URL ?? "http://127.0.0.1:4173";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function findChrome() {
  for (const bin of [
    process.env.CHROME_BIN,
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
  ]) {
    if (!bin) continue;
    const probe = spawnSync(bin, ["--version"], {
      encoding: "utf8",
      timeout: 3000,
    });
    if (probe.status === 0) return bin;
  }
  throw new Error(
    "Chromium/Chrome unavailable; UI viewport smoke NOT VERIFIED.",
  );
}

function createClient(wsUrl) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl);
    let nextId = 1;
    const pending = new Map();
    socket.addEventListener(
      "open",
      () => {
        resolve({
          send(method, params = {}) {
            return new Promise((ok, fail) => {
              const id = nextId++;
              const timeout = setTimeout(() => {
                pending.delete(id);
                fail(new Error("CDP timeout: " + method));
              }, 12_000);
              pending.set(id, { ok, fail, timeout });
              socket.send(JSON.stringify({ id, method, params }));
            });
          },
          close() {
            socket.close();
          },
        });
      },
      { once: true },
    );
    socket.addEventListener(
      "error",
      () => reject(new Error("Chrome DevTools websocket failed")),
      { once: true },
    );
    socket.addEventListener("message", (message) => {
      const event = JSON.parse(String(message.data));
      if (!event.id) return;
      const item = pending.get(event.id);
      if (!item) return;
      clearTimeout(item.timeout);
      pending.delete(event.id);
      if (event.error) item.fail(new Error(event.error.message));
      else item.ok(event.result ?? {});
    });
  });
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails)
    throw new Error("Browser JS: " + JSON.stringify(result.exceptionDetails));
  return result.result?.value;
}

function browserMetrics() {
  const visible = (selector) =>
    [...document.querySelectorAll(selector)].filter(
      (el) => el.getClientRects().length,
    );
  const header = visible(".arcade-topbar");
  const headerTargets = visible(".arcade-topbar .icon-button");
  const brandBadges = visible(".brand-badge");
  const buttons = visible("button");
  const tabs = visible(".tabbar-link");
  return {
    path: location.pathname,
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    tabCount: tabs.length,
    active: tabs.filter((el) => el.getAttribute("aria-current") === "page")
      .length,
    header: header.length,
    minHeaderTargetWidth: Math.min(
      1000,
      ...headerTargets.map((el) =>
        Math.round(el.getBoundingClientRect().width),
      ),
    ),
    minHeaderTargetHeight: Math.min(
      1000,
      ...headerTargets.map((el) =>
        Math.round(el.getBoundingClientRect().height),
      ),
    ),
    minTabFont: Math.min(
      1000,
      ...tabs.map((el) => Number.parseFloat(getComputedStyle(el).fontSize)),
    ),
    minBrandBadgeFont: Math.min(
      1000,
      ...brandBadges.map((el) =>
        Number.parseFloat(getComputedStyle(el).fontSize),
      ),
    ),
    minButton: Math.min(
      1000,
      ...buttons.map((el) => Math.round(el.getBoundingClientRect().height)),
    ),
    tabMinHeight: Math.min(
      1000,
      ...tabs.map((el) => Math.round(el.getBoundingClientRect().height)),
    ),
    font: document.fonts.check('16px "Plus Jakarta Sans"'),
    theme: getComputedStyle(document.documentElement)
      .getPropertyValue("--surface")
      .trim(),
    hasCDN: [
      ...document.querySelectorAll('link[rel="stylesheet"],script[src]'),
    ].some((el) =>
      /^https?:\/\//.test(
        el.getAttribute("href") ?? el.getAttribute("src") ?? "",
      ),
    ),
  };
}

async function visit(client, pathname, viewport) {
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.width < 700 ? 2 : 1,
    mobile: viewport.width < 700,
  });
  await client.send("Page.navigate", { url: baseUrl + pathname });
  let ready = false;
  for (let i = 0; i < 90; i++) {
    const state = await evaluate(
      client,
      "({path:location.pathname, ready:document.readyState, app:!!document.querySelector('.app')})",
    );
    if (state?.path === pathname && state.ready === "complete" && state.app) {
      ready = true;
      break;
    }
    await sleep(100);
  }
  if (!ready) throw new Error("Browser route did not load: " + pathname);
  await evaluate(client, "document.fonts.ready.then(() => true)");
  const result = await evaluate(
    client,
    "(" + browserMetrics.toString() + ")()",
  );
  if (
    result.width !== viewport.width ||
    result.scrollWidth > result.width + 1
  ) {
    throw new Error(
      "Horizontal overflow/viewport mismatch: " + JSON.stringify(result),
    );
  }
  const kind = pathname.startsWith("/auth")
    ? "blank"
    : ["/lineup", "/history", "/how-it-works", "/notifications", "/games/wordle"].includes(
          pathname,
        )
      ? "stack"
      : "tab";
  if (
    result.tabCount !== (kind === "tab" ? 5 : 0) ||
    result.header !== (kind === "blank" ? 0 : 1) ||
    result.active !== (kind === "tab" ? 1 : 0) ||
    result.minButton < 44 ||
    (result.header > 0 &&
      (result.minHeaderTargetWidth < 44 ||
        result.minHeaderTargetHeight < 44)) ||
    (result.tabCount > 0 &&
      (result.tabMinHeight < 44 || result.minTabFont < 11)) ||
    result.minBrandBadgeFont < 11 ||
    !result.font ||
    result.theme !== "#051424" ||
    result.hasCDN
  ) {
    throw new Error("Arcade shell assertion failed: " + JSON.stringify(result));
  }
  if (pathname === "/history" && viewport.width === 393) {
    const privacy = await evaluate(
      client,
      '({login:!!document.querySelector(\'a[href="/auth"]\'),privateRows:document.querySelectorAll(".history-entry").length,filter:!!document.querySelector("#history-game")})',
    );
    if (!privacy.login || privacy.privateRows !== 0 || privacy.filter) {
      throw new Error("Signed-out History leaked private controls: " + JSON.stringify(privacy));
    }
  }
  if (pathname === "/today" && viewport.width === 393) {
    await evaluate(client, 'document.querySelector(".paste-global").click()');
    await sleep(150);
    const dialog = await evaluate(
      client,
      '({open:!!document.querySelector(\'[role="dialog"][aria-modal="true"]\'),input:!!document.querySelector("#paste-input"),guestLogin:!!document.querySelector(\'.paste-dialog a[href="/auth"]\'),saveButton:[...document.querySelectorAll(".paste-dialog button")].some(x=>x.textContent.includes("Submit result"))})',
    );
    if (!dialog.open || !dialog.input || !dialog.guestLogin || dialog.saveButton) {
      throw new Error("Guest Paste contract failed: " + JSON.stringify(dialog));
    }
    await client.send("Input.dispatchKeyEvent", {
      type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27,
    });
    await client.send("Input.dispatchKeyEvent", {
      type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27,
    });
    await sleep(150);
    const closed = await evaluate(client, '({open:!!document.querySelector(".paste-dialog"),focus:document.activeElement?.classList.contains("paste-global")})');
    if (closed.open || !closed.focus) {
      throw new Error("Paste Escape/focus restoration failed: " + JSON.stringify(closed));
    }
  }
  console.log(
    "UI-SMOKE PASS",
    viewport.width + "x" + viewport.height,
    pathname,
    kind,
  );
}

const directory = mkdtempSync(join(tmpdir(), "daydle-cdp-"));
let chrome;
let client;
try {
  chrome = spawn(
    findChrome(),
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--no-first-run",
      "--disable-background-networking",
      "--user-data-dir=" + directory,
      "--remote-debugging-port=0",
      "--window-size=1024,768",
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  let port;
  // Some shared CI hosts take longer to initialize headless Chrome.
  // Report early process exit instead of misclassifying a startup crash as timeout.
  let exitReason = null;
  chrome.once("exit", (code, signal) => {
    exitReason = { code, signal };
  });
  for (let i = 0; i < 250; i++) {
    if (exitReason)
      throw new Error(
        "Chromium exited during startup: " + JSON.stringify(exitReason),
      );
    try {
      port = Number(
        readFileSync(join(directory, "DevToolsActivePort"), "utf8").split(
          "\n",
        )[0],
      );
      if (port > 0) break;
    } catch {
      /* Chrome not ready */
    }
    await sleep(100);
  }
  if (!port)
    throw new Error(
      "Chromium DevTools did not become ready within 25 seconds.",
    );
  const pages = await (
    await fetch("http://127.0.0.1:" + port + "/json/list")
  ).json();
  const page = pages.find((item) => item.type === "page");
  if (!page?.webSocketDebuggerUrl) throw new Error("No Chrome page target");
  client = await createClient(page.webSocketDebuggerUrl);
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  try {
    await client.send("Emulation.setSafeAreaInsetsOverride", {
      insets: { top: 59, right: 0, bottom: 34, left: 0 },
    });
  } catch {
    console.log(
      "Chrome lacks safe-area emulation; on-device safe area still NOT VERIFIED.",
    );
  }
  for (const viewport of [
    { width: 320, height: 740 },
    { width: 393, height: 852 },
    { width: 1024, height: 768 },
  ]) {
    const paths =
      viewport.width === 393
        ? [
            "/today",
            "/games",
            "/lineup",
            "/history",
            "/statistics",
            "/friends",
            "/account",
            "/auth",
            "/how-it-works",
            "/notifications",
            "/games/wordle",
          ]
        : ["/today", "/games", "/auth"];
    for (const pathname of paths) await visit(client, pathname, viewport);
  }
  console.log(
    "UI-SMOKE: 17 route/viewport checks passed (Chromium, not Safari).",
  );
} finally {
  client?.close();
  chrome?.kill("SIGKILL");
  rmSync(directory, { recursive: true, force: true });
}
