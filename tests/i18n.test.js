const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadI18n(initialLanguage = "zh-CN") {
  const source = fs.readFileSync(path.join(__dirname, "..", "i18n.js"), "utf8");
  const storage = { adCleanerLanguage: initialLanguage };
  const changedListeners = [];
  const chrome = {
    runtime: { lastError: null },
    storage: {
      local: {
        get(defaults, callback) {
          callback({ ...defaults, ...storage });
        },
        set(values, callback) {
          Object.assign(storage, values);
          callback();
        }
      },
      onChanged: {
        addListener(listener) {
          changedListeners.push(listener);
        }
      }
    }
  };
  const context = { chrome, console, globalThis: null };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: "i18n.js" });
  return { i18n: context.AdCleanerI18n, storage, changedListeners };
}

test("defaults to Chinese and falls back to Chinese for missing English keys", async () => {
  const { i18n } = loadI18n("invalid-language");

  await i18n.ready();
  assert.equal(i18n.getLanguage(), "zh-CN");
  assert.equal(i18n.t("status.invalidHostname"), "请输入有效域名");
});

test("persists English selection and interpolates translated messages", async () => {
  const { i18n, storage } = loadI18n();

  await i18n.ready();
  await i18n.setLanguage("en");

  assert.equal(storage.adCleanerLanguage, "en");
  assert.equal(i18n.t("background.httpError", { status: 503 }), "Request failed: HTTP 503");
  assert.equal(i18n.t("status.countUnit"), "rules");
  assert.equal(i18n.t("status.loadFailedShort"), "Load failed");
});
