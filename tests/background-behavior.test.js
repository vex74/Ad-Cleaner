const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function createEvent() {
  const listeners = [];
  return {
    listeners,
    addListener(listener) {
      listeners.push(listener);
    }
  };
}

function loadBackground(fetchImpl = async () => ({ ok: true })) {
  const backgroundPath = path.join(__dirname, "..", "background.js");
  const source = `${fs.readFileSync(backgroundPath, "utf8")}\n\nglobalThis.__adCleanerTestApi = { events, badgeRefreshTimes, ruleMatchCache, compileSubscriptions };`;
  const events = {
    installed: createEvent(),
    startup: createEvent(),
    activated: createEvent(),
    updated: createEvent(),
    removed: createEvent(),
    storageChanged: createEvent(),
    message: createEvent()
  };
  const chrome = {
    runtime: {
      onInstalled: events.installed,
      onStartup: events.startup,
      onMessage: events.message
    },
    tabs: {
      onActivated: events.activated,
      onUpdated: events.updated,
      onRemoved: events.removed,
      query: async () => [],
      sendMessage: async () => ({ ok: false })
    },
    storage: {
      onChanged: events.storageChanged,
      local: {
        get: async () => ({}),
        set: async () => {}
      }
    },
    declarativeNetRequest: {
      getMatchedRules: async () => ({ matchedRules: [] }),
      getDynamicRules: async () => [],
      updateDynamicRules: async () => {},
      updateEnabledRulesets: async () => {}
    },
    action: {
      setBadgeText: async () => {},
      setBadgeBackgroundColor: async () => {},
      setTitle: async () => {}
    }
  };
  const context = {
    AbortController,
    URL,
    URLSearchParams,
    console,
    fetch: fetchImpl,
    setTimeout,
    clearTimeout,
    importScripts: () => {},
    chrome,
    events,
    globalThis: null
  };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: backgroundPath });
  return context.__adCleanerTestApi;
}

test("clears tab refresh throttle when navigation starts", () => {
  const { events, badgeRefreshTimes, ruleMatchCache } = loadBackground();
  badgeRefreshTimes.set(7, Date.now());
  ruleMatchCache.set(7, { timestamp: Date.now(), result: { ok: true } });

  events.updated.listeners[0](7, { status: "loading" });

  assert.equal(badgeRefreshTimes.has(7), false);
  assert.equal(ruleMatchCache.has(7), false);
});

test("invalidates fallback diagnostics when page metrics change", () => {
  const { events, ruleMatchCache } = loadBackground();
  ruleMatchCache.set(11, { timestamp: Date.now(), result: { ok: true, source: "page", total: 1 } });
  const sendResponse = () => {};

  events.message.listeners[0]({ type: "PAGE_METRICS", markedCount: 4, hiddenCount: 3 }, { tab: { id: 11 } }, sendResponse);

  assert.equal(ruleMatchCache.has(11), false);
});

test("restores only the failed subscription's cached cosmetic rules", async () => {
  const first = loadBackground();
  const initial = await first.compileSubscriptions([
    { id: "sub-a", name: "A", sourceType: "text", source: "example.com##.ad-a", enabled: true },
    { id: "sub-b", name: "B", sourceType: "text", source: "example.com##.ad-b", enabled: true }
  ]);

  const second = loadBackground(async () => {
    throw new Error("network unavailable");
  });
  const result = await second.compileSubscriptions([
    { id: "sub-a", name: "A", sourceType: "text", source: "example.com##.new-a", enabled: true },
    { id: "sub-b", name: "B", sourceType: "url", source: "https://filters.example/b.txt", enabled: true }
  ], 29000, initial.subscriptionCache, initial.hideRules);

  assert.deepEqual(JSON.parse(JSON.stringify(result.hideRules)), {
    "example.com": [".new-a", ".ad-b"]
  });
});
