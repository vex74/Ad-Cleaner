const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const manifestPath = path.join(__dirname, "..", "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

test("store release uses the next review version", () => {
  assert.equal(manifest.version, "0.9.27");
});

test("store release requests only permissions used by the extension", () => {
  assert.equal(manifest.permissions.includes("activeTab"), false);
  assert.equal(manifest.permissions.includes("tabs"), false);
});

test("store release keeps declarative network blocking enabled", () => {
  assert.ok(manifest.permissions.includes("declarativeNetRequest"));
  const ruleSets = manifest.declarative_net_request?.rule_resources || [];
  assert.deepEqual(
    ruleSets.map((item) => [item.id, item.enabled]),
    [
      ["core-blocklist", true],
      ["privacy-coverage", true],
      ["always-active", true]
    ]
  );
});

test("store release has a concise single-purpose description", () => {
  assert.ok(manifest.description.length <= 132);
  assert.match(manifest.description, /^双语广告清理扩展：/);
  assert.match(manifest.description, /\/ Bilingual ad cleaner:/);
});

test("extension pages use an explicit restrictive content security policy", () => {
  const policy = manifest.content_security_policy?.extension_pages || "";
  assert.match(policy, /script-src 'self'/);
  assert.match(policy, /object-src 'none'/);
  assert.match(policy, /frame-ancestors 'none'/);
});

test("content security policy permits user-selected subscription downloads", () => {
  const policy = manifest.content_security_policy?.extension_pages || "";
  assert.match(policy, /connect-src https: http:/);
});
