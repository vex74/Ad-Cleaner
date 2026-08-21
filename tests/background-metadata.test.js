const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadMetadataParser() {
  const backgroundPath = path.join(__dirname, "..", "background.js");
  const source = `${fs.readFileSync(backgroundPath, "utf8")}\n\nglobalThis.__adCleanerTestApi = { parseSubscriptionMetadata };`;
  const noopProxy = new Proxy(() => undefined, {
    get: () => noopProxy,
    apply: () => undefined
  });

  const context = {
    AbortController,
    URL,
    URLSearchParams,
    console,
    fetch: async () => ({ ok: true }),
    setTimeout,
    clearTimeout,
    importScripts: () => {},
    chrome: noopProxy,
    globalThis: null
  };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: backgroundPath });
  return context.__adCleanerTestApi.parseSubscriptionMetadata;
}

const parseSubscriptionMetadata = loadMetadataParser();

test("parses subscription source metadata without throwing", () => {
  const metadata = parseSubscriptionMetadata("! Title: Example\n! Source: https://filters.example/list.txt");
  assert.deepEqual(
    { ...metadata },
    {
      title: "Example",
      description: "",
      version: "",
      updatedAtText: "",
      updateIntervalText: "",
      sourceSummary: "https://filters.example/list.txt"
    }
  );

  assert.equal(
    parseSubscriptionMetadata("规则源：AdGuard Chinese filter").sourceSummary,
    "AdGuard Chinese filter"
  );
});

test("does not invent source metadata when the header is absent", () => {
  assert.equal(parseSubscriptionMetadata("! Title: Example").sourceSummary, "");
});
