const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

class FakeElement {
  constructor({ className = "", text = "", tagName = "DIV" } = {}) {
    this.tagName = tagName;
    this.className = className;
    this.id = "";
    this.dataset = {};
    this.innerText = text;
    this.textContent = text;
    this.children = [];
    this.parentElement = null;
  }

  getAttribute(name) {
    if (name === "class") {
      return this.className;
    }
    return null;
  }

  hasAttribute() {
    return false;
  }

  closest() {
    return null;
  }

  getBoundingClientRect() {
    return { width: 720, height: 120 };
  }
}

function loadHeuristics() {
  const contentPath = path.join(__dirname, "..", "content.js");
  const source = fs
    .readFileSync(contentPath, "utf8")
    .replace("  init();", "  // init disabled by heuristic tests")
    .replace(
      /\}\)\(\);\s*$/,
      "  globalThis.__adCleanerTestApi = { findAdTarget };\n})();"
    );
  const documentElement = { clientWidth: 1440, clientHeight: 900 };
  const context = {
    Element: FakeElement,
    URL,
    chrome: { storage: {}, runtime: { onMessage: { addListener() {} } } },
    document: { documentElement },
    globalThis: null,
    queueMicrotask,
    window: {
      innerWidth: 1440,
      innerHeight: 900,
      location: {
        href: "https://www.zhipin.com/job_detail/example.html",
        hostname: "www.zhipin.com",
        pathname: "/job_detail/example.html"
      }
    }
  };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: contentPath });
  return context.__adCleanerTestApi;
}

test("does not classify BOSS business banners as advertisements", () => {
  const { findAdTarget } = loadHeuristics();

  assert.equal(findAdTarget(new FakeElement({ className: "job-banner", text: "高级前端工程师 公司介绍" })), null);
  assert.equal(findAdTarget(new FakeElement({ className: "company-banner", text: "公司信息与招聘职位" })), null);
});

test("still classifies explicit ad banners", () => {
  const { findAdTarget } = loadHeuristics();
  const adBanner = new FakeElement({ className: "ad-banner", text: "Advertisement" });
  const bannerAd = new FakeElement({ className: "banner-ad", text: "Sponsored content" });

  assert.equal(findAdTarget(adBanner), adBanner);
  assert.equal(findAdTarget(bannerAd), bannerAd);
});

test("does not classify generic commerce or recommendation copy as an advertisement", () => {
  const { findAdTarget } = loadHeuristics();

  for (const text of [
    "猜你喜欢",
    "热门推荐",
    "为您推荐",
    "商务合作",
    "限时优惠，立即购买",
    "Commercial operations"
  ]) {
    const recommendation = new FakeElement({
      className: "recommendation-panel",
      text
    });
    assert.equal(findAdTarget(recommendation), null, text);
  }
});
