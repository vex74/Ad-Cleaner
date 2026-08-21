const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

function readStyle(fileName) {
  return fs.readFileSync(path.join(__dirname, "..", fileName), "utf8");
}

test("all extension surfaces use the shared dark sci-fi theme", () => {
  const optionsStyle = readStyle("options.css");
  const popupStyle = readStyle("popup.css");
  const contentStyle = readStyle("content.css");

  for (const style of [optionsStyle, popupStyle]) {
    assert.match(style, /color-scheme:\s*dark/);
    assert.match(style, /#060b14/);
    assert.match(style, /#4fd4ff/);
    assert.match(style, /html\[data-theme="light"\]/);
  }

  assert.match(contentStyle, /#060b14/);
  assert.match(contentStyle, /#4fd4ff/);
  assert.match(contentStyle, /html\[data-theme="light"\]/);
  assert.match(optionsStyle, /body::before/);
  assert.match(optionsStyle, /\.card\.accent/);
  assert.match(popupStyle, /\.count-card/);
  assert.match(contentStyle, /\.ad-cleaner-picker-shell/);
  assert.match(contentStyle, /\.ad-cleaner-panel-shell/);
});
