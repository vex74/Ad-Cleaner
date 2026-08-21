const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadI18n() {
  const source = fs.readFileSync(path.join(__dirname, "..", "i18n.js"), "utf8");
  const chrome = {
    runtime: { lastError: null },
    storage: {
      local: {
        get(defaults, callback) {
          callback(defaults);
        },
        set(values, callback) {
          callback();
        }
      },
      onChanged: { addListener() {} }
    }
  };
  const context = { chrome, console, globalThis: null };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: "i18n.js" });
  return context.AdCleanerI18n;
}

function getTranslationKeys() {
  const sourceFiles = ["options.js", "popup.js", "content.js", "background.js"];
  return new Set(sourceFiles.flatMap((file) => {
    const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    return Array.from(source.matchAll(/\bt\("([a-zA-Z0-9_.]+)"/g), (match) => match[1]);
  }));
}

test("every runtime translation key resolves in Chinese and English", async () => {
  const i18n = loadI18n();
  await i18n.ready();
  const keys = getTranslationKeys();

  for (const language of ["zh-CN", "en"]) {
    await i18n.setLanguage(language);
    for (const key of keys) {
      assert.notEqual(i18n.t(key), key, `${language} is missing ${key}`);
    }
  }
});
