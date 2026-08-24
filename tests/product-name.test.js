const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");

function read(fileName) {
  return fs.readFileSync(path.join(root, fileName), "utf8");
}

test("user-facing product name is unified", () => {
  const manifest = JSON.parse(read("manifest.json"));
  assert.equal(manifest.name, "广告清理工具-Ad-Cleaner");
  assert.equal(manifest.action.default_title, "广告清理工具-Ad-Cleaner");

  for (const fileName of ["options.html", "popup.html", "privacy.html", "README.md"]) {
    const source = read(fileName);
    assert.match(source, /广告清理工具-Ad-Cleaner/);
  }

  const i18n = read("i18n.js");
  assert.match(i18n, /广告清理工具-Ad-Cleaner/);
  assert.match(i18n, /Ad Cleaner Tool-Ad-Cleaner/);
});
