const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function readProjectFile(fileName) {
  return fs.readFileSync(path.join(__dirname, "..", fileName), "utf8");
}

test("extension pages expose a shared theme control", () => {
  for (const fileName of ["options.html", "popup.html"]) {
    const html = readProjectFile(fileName);
    assert.match(html, /data-theme-toggle/);
    assert.match(html, /<script src="theme\.js"><\/script>/);
  }

  const manifest = JSON.parse(readProjectFile("manifest.json"));
  assert.ok(manifest.content_scripts[0].js.includes("theme.js"));
});

function loadTheme({ preference = "system", systemDark = false } = {}) {
  const button = {
    dataset: {},
    attributes: {},
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    addEventListener(type, handler) {
      if (type === "click") {
        this.click = handler;
      }
    }
  };
  const document = {
    documentElement: { dataset: {} },
    querySelectorAll(selector) {
      return selector === "[data-theme-toggle]" ? [button] : [];
    }
  };
  const chrome = {
    runtime: { lastError: null },
    storage: {
      local: {
        get(defaults, callback) {
          callback({ ...defaults, adCleanerThemePreference: preference });
        },
        set(values, callback) {
          preference = values.adCleanerThemePreference;
          callback();
        }
      },
      onChanged: { addListener() {} }
    }
  };
  const matchMedia = () => ({ matches: systemDark, addEventListener() {} });
  const context = { chrome, document, matchMedia, console, globalThis: null };
  context.globalThis = context;
  vm.runInNewContext(readProjectFile("theme.js"), context, { filename: "theme.js" });
  return { button, document, theme: context.AdCleanerTheme };
}

test("theme control follows the system and cycles manual overrides", async () => {
  const { button, document, theme } = loadTheme({ systemDark: false });
  await theme.ready();
  theme.bindThemeToggles(document, (key) => key);

  assert.equal(theme.getPreference(), "system");
  assert.equal(document.documentElement.dataset.theme, "light");
  assert.equal(button.textContent, "theme.system");

  await button.click();
  assert.equal(theme.getPreference(), "dark");
  assert.equal(document.documentElement.dataset.theme, "dark");

  await button.click();
  assert.equal(theme.getPreference(), "light");
  assert.equal(document.documentElement.dataset.theme, "light");

  await button.click();
  assert.equal(theme.getPreference(), "system");
});
