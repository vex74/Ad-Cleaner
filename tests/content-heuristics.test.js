const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

class FakeElement {
  constructor({ className = "", id = "", role = "", text = "", tagName = "DIV" } = {}) {
    this.tagName = tagName;
    this.className = className;
    this.id = id;
    this.role = role;
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
    if (name === "id") {
      return this.id;
    }
    if (name === "role") {
      return this.role;
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

function loadHeuristics(url = "https://www.zhipin.com/job_detail/example.html") {
  const contentPath = path.join(__dirname, "..", "content.js");
  const source = fs
    .readFileSync(contentPath, "utf8")
    .replace("  init();", "  // init disabled by heuristic tests")
    .replace(
      /\}\)\(\);\s*$/,
      "  globalThis.__adCleanerTestApi = { findAdTarget, shouldApplyCosmeticRule: typeof shouldApplyCosmeticRule === 'function' ? shouldApplyCosmeticRule : undefined };\n})();"
    );
  const parsedUrl = new URL(url);
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
        href: parsedUrl.href,
        hostname: parsedUrl.hostname,
        pathname: parsedUrl.pathname
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

test("protects DNB membership purchase UI from subscription cosmetic rules", () => {
  const { shouldApplyCosmeticRule } = loadHeuristics(
    "https://search.dnbcha.com/vip?from=top_vip_btn"
  );

  assert.equal(typeof shouldApplyCosmeticRule, "function");
  assert.equal(
    shouldApplyCosmeticRule(
      new FakeElement({ className: "vip-card vip-card-active", text: "1年内地VIP 立即开通" }),
      "subscription-selector"
    ),
    false
  );
  assert.equal(
    shouldApplyCosmeticRule(
      new FakeElement({ className: "el-dialog dnb-dialog", role: "dialog", text: "会员支付 同意并支付" }),
      "subscription-selector"
    ),
    false
  );
  assert.equal(
    shouldApplyCosmeticRule(
      new FakeElement({ className: "vip-card", text: "1年内地VIP 立即开通" }),
      "custom-selector"
    ),
    true
  );
});

test("limits DNB membership protection to the exact VIP route", () => {
  const element = new FakeElement({ className: "vip-card", text: "立即开通" });

  for (const url of [
    "https://search.dnbcha.com/vip/orders",
    "https://search.dnbcha.com/VIP",
    "https://search.dnbcha.com/company",
    "https://www.search.dnbcha.com/vip",
    "https://example.com/vip"
  ]) {
    const { shouldApplyCosmeticRule } = loadHeuristics(url);
    assert.equal(shouldApplyCosmeticRule(element, "subscription-selector"), true, url);
  }
});
