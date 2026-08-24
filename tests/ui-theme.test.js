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
  assert.match(popupStyle, /\.label\s*\{\s*color:\s*rgba\(151, 220, 255, 0\.78\)/);
  assert.match(popupStyle, /html\[data-theme="light"\]\s+\.label/);
  assert.match(popupStyle, /\.count-card/);
  assert.match(contentStyle, /\.ad-cleaner-picker-shell/);
  assert.match(contentStyle, /\.ad-cleaner-panel-shell/);
});

test("top header controls share a consistent compact capsule layout", () => {
  for (const fileName of ["options.css", "popup.css"]) {
    const style = readStyle(fileName);

    assert.match(style, /\.hero-actions\s*\{[\s\S]*?display:\s*inline-flex;[\s\S]*?gap:\s*6px;/);
    assert.match(style, /\.eyebrow,\s*\.theme-switch,\s*\.language-switch\s*\{[\s\S]*?min-height:\s*30px;[\s\S]*?border-radius:\s*999px;/);
    assert.match(style, /\.eyebrow\s*\{[\s\S]*?margin-bottom:\s*0;[\s\S]*?white-space:\s*nowrap;/);
    assert.match(style, /\.theme-switch button,\s*\.language-switch button\s*\{[\s\S]*?min-height:\s*22px;[\s\S]*?white-space:\s*nowrap;/);
  }
});
