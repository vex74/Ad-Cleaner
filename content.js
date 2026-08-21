(function () {
  const STORAGE_KEY = "adCleanerEnabled";
  const SITE_RULES_KEY = "adCleanerSiteRules";
  const CUSTOM_HIDE_RULES_KEY = "adCleanerCustomElementHideRules";
  const SUBSCRIPTION_HIDE_RULES_KEY = "adCleanerSubscriptionElementHideRules";
  const BUILTIN_FILTERING_KEY = "adCleanerBuiltinFilteringEnabled";
  const MARK_ATTR = "data-ad-cleaner-marked";
  const HIDDEN_ATTR = "data-ad-cleaner-hidden";
  const IGNORED_ATTR = "data-ad-cleaner-ignored";
  const UID_ATTR = "data-ad-cleaner-id";
  const REASON_ATTR = "data-ad-cleaner-reason";
  const ENABLED_ATTR = "data-ad-cleaner-enabled";
  const SITE_MODE_ATTR = "data-ad-cleaner-site-mode";
  const PAGE_PROFILE_ATTR = "data-ad-cleaner-page-profile";
  const PANEL_ATTR = "data-ad-cleaner-recovery-panel";
  const PICKER_ATTR = "data-ad-cleaner-picker-ui";
  const PICKER_TARGET_ATTR = "data-ad-cleaner-picker-target";
  const MAX_SELECTOR_LENGTH = 1024;
  const SELECTOR_PER_SITE_SOFT_LIMIT = 300;
  const SCAN_THROTTLE_MS = 120;
  const SCAN_SELECTOR_DEADLINE_MS = 400;
  const SCAN_SELECTOR_MAX_ELEMENTS = 800;
  const i18n = globalThis.AdCleanerI18n;
  const t = (key, values) => i18n?.t?.(key, values) || key;

  const VOID_TAGS = new Set([
    "AREA",
    "BASE",
    "BR",
    "COL",
    "EMBED",
    "HR",
    "IMG",
    "INPUT",
    "LINK",
    "META",
    "PARAM",
    "SOURCE",
    "TRACK",
    "WBR",
    "IFRAME",
    "SCRIPT",
    "STYLE",
    "NOSCRIPT"
  ]);

  const BLOCKED_HOSTS = [
    "doubleclick.net",
    "googlesyndication.com",
    "googletagservices.com",
    "googleadservices.com",
    "adnxs.com",
    "criteo.com",
    "rubiconproject.com",
    "pubmatic.com",
    "openx.net",
    "taboola.com",
    "outbrain.com",
    "teads.tv",
    "moatads.com",
    "quantserve.com",
    "yieldmo.com",
    "zedo.com",
    "casalemedia.com",
    "contextweb.com",
    "amazon-adsystem.com",
    "adform.net",
    "smaato.net",
    "33across.com",
    "gumgum.com",
    "scorecardresearch.com",
    "xandr.com",
    "smartadserver.com",
    "serving-sys.com",
    "adserver.com",
    "adsrvr.org",
    "adkernel.com",
    "sharethrough.com",
    "revcontent.com",
    "mgid.com",
    "nativo.com",
    "connatix.com",
    "indexww.com",
    "mediago.io",
    "criteo.net",
    "adnexus.net",
    "adservice.google.com",
    "adtrafficquality.google",
    "ad.doubleclick.net",
    "pagead2.googlesyndication.com",
    "tpc.googlesyndication.com",
    "appnexus.com",
    "pulsepoint.com",
    "mathtag.com",
    "bluekai.com",
    "turn.com",
    "loopme.com",
    "chartboost.com",
    "applovin.com",
    "ironsrc.com",
    "vungle.com",
    "inmobi.com",
    "mintegral.com",
    "unityads.unity3d.com",
    "moat.com",
    "adroll.com",
    "connect.facebook.net",
    "analytics.twitter.com",
    "ads.linkedin.com",
    "tanx.com",
    "mediav.com",
    "pos.baidu.com",
    "cpro.baidu.com",
    "mobads.baidu.com",
    "cnzz.com",
    "umeng.com",
    "umeng.co",
    "tanx.cn",
    "als.baidu.com",
    "hmma.baidu.com",
    "hotjar.com",
    "amplitude.com",
    "clarity.ms",
    "fullstory.com",
    "adsterra.com",
    "propellerads.com",
    "popads.net",
    "popcash.net",
    "admaven.com",
    "exoclick.com",
    "juicyads.com",
    "trafficjunky.com",
    "adtelligent.com",
    "triplelift.com",
    "buysellads.com",
    "carbonads.com",
    "adsense.com",
    "moatads.com",
    "adtrafficquality.google",
    "adservice.google.com"
  ];

  const AD_KEYWORD_RE =
    /(^|[^a-z0-9])(adsbygoogle|doubleclick|googlesyndication|googletagservices|googleadservices|adnxs|criteo|rubiconproject|pubmatic|openx|taboola|outbrain|teads|moatads|quantserve|yieldmo|zedo|casalemedia|contextweb|amazon-adsystem|adform|smaato|33across|gumgum|scorecardresearch|xandr|smartadserver|serving-sys|adsrvr|adkernel|sharethrough|revcontent|mgid|nativo|connatix|indexww|mediago|adslot|adunit|adserver|adtrafficquality|advert|advertisement|sponsor(?:ed|ship)?|promoted?|promo(?:tion)?|appnexus|pulsepoint|mathtag|bluekai|turn\.com|loopme|chartboost|applovin|ironsrc|vungle|inmobi|mintegral|unityads|moat\.com|adroll|adsterra|propellerads|popads|popcash|admaven|exoclick|juicyads|trafficjunky|adtelligent|triplelift|buysellads|carbonads|adsense|adservice|adcontainer|ad-wrapper|ad-banner|ad-block|google_ad|goog_ads|dfp|gpt-ad|adzone|adzone3|ad_iframe|ad_frame|ad-image|ad-img)([^a-z0-9]|$)/i;
  const CJK_AD_LABEL_RE = /(广告位|广告内容|广告推广|广告横幅|横幅广告|侧栏广告|内联文章广告|视频广告|广告弹窗|广告链接|赞助内容|赞助商|推广内容|推广链接|商业推广|合作推广|推荐广告|广告投放|广告赞助|赞助方|合作赞助)/;
  const AD_LABEL_RE = /(sponsored|promoted|partner content|paid content|brand story|branded content|ad choices|ad label|commercial break|skip ad|广告位|广告内容|广告推广|广告横幅|横幅广告|侧栏广告|内联文章广告|视频广告|广告弹窗|广告链接|赞助内容|赞助商|推广内容|推广链接|商业推广|合作推广|推荐广告|广告投放|广告赞助|赞助方|合作赞助)/i;
  const STRONG_AD_COPY_RE = /(sponsored by|branded content|partner content|advertisement|广告赞助)/i;
  // Bare "ad" / "ads" hits are too ambiguous and tend to false-positive on normal
  // page structure, so only keep more explicit ad-related tokens here.
  const DIRECT_AD_TOKEN_RE = /(^|[^a-z0-9])(ad-slot|ad-container|ad-wrap|ad-banner|ad-block|ad-box|ad-zone|ad-area|advert|advertisement|sponsor(?:ed|ship)?|promo(?:tion)?|dfp|gpt-ad|adsbygoogle)([^a-z0-9]|$)/i;
  const AD_CONTAINER_TAGS = new Set([
    "ARTICLE",
    "ASIDE",
    "DIV",
    "FIGURE",
    "LI",
    "SECTION"
  ]);
  const TEXT_ONLY_TAGS = new Set(["H1", "H2", "H3", "H4", "H5", "H6", "P", "A", "BUTTON", "SPAN"]);
  const TRYBLOCK_BASIC_PAGE_RE = /^\/zh\/adblock-test\/basic\/?$/i;
  const TRYBLOCK_ADBLOCK_TEST_PAGE_RE = /^\/zh\/adblock-test\/(?:basic|intermediate|advanced)\/?$/i;
  const DNB_MEMBERSHIP_PAGE_RE = /^\/vip\/?$/;
  const TRYBLOCK_TEST_MATCHERS = [
    {
      name: "banner",
      patterns: [
        /banner\s+advertisements?/i,
        /banner\s+ad/i,
        /横幅广告/
      ]
    },
    {
      name: "sidebar",
      patterns: [
        /sidebar\s+advertisements?/i,
        /sidebar\s+ad/i,
        /侧栏广告/
      ]
    },
    {
      name: "sponsored",
      patterns: [
        /sponsored\s+content/i,
        /赞助内容/,
        /sponsored\s+by/i,
        /branded\s+content/i,
        /partner\s+content/i
      ]
    },
    {
      name: "inline-article",
      patterns: [
        /inline\s+article\s+ads?/i,
        /in-article\s+ads?/i,
        /内联文章广告/,
        /article\s+ad/i
      ]
    }
  ];

  const CANDIDATE_SELECTOR = [
    "iframe",
    "img",
    "ins",
    "amp-ad",
    "amp-embed",
    "[role=\"article\"]",
    "[data-ad-container]",
    "[data-ad]",
    "[data-ad-slot]",
    "[data-ad-unit]",
    "[data-ad-client]",
    "[data-ad-zone]",
    "[data-ad-zoneid]",
    "[data-dfp]",
    "[data-google-ad]",
    "[id^=\"ad-\"]",
    "[id^=\"ads-\"]",
    "[id$=\"-ad\"]",
    "[id$=\"-ads\"]",
    "[id^=\"google_ad\"]",
    "[id^=\"div-gpt-ad\"]",
    "[class*=\"ad-\"]",
    "[class*=\"ads-\"]",
    "[class*=\"ad_\"]",
    "[class*=\"adslot\"]",
    "[class*=\"adzone\"]",
    "[class*=\"advert\"]",
    "[class*=\"sponsor\"]",
    "[class*=\"promo-\"]",
    "[class*=\"dfp-\"]",
    "[class*=\"gpt-ad\"]",
    "[aria-label]",
    "[id]",
    "[class]",
    "[src]",
    "[href]"
  ].join(",");

  let enabled = true;
  let siteMode = "default";
  let scanQueued = false;
  let scanTimer = null;
  let observer = null;
  let markedCount = 0;
  let lastReportedMetricsKey = "";
  let siteRules = {};
  let customHideRules = {};
  let subscriptionHideRules = {};
  let builtinFilteringEnabled = true;
  let currentHostname = normalizeHostname(window.location.hostname);
  let nextElementId = 0;
  let recoveryPanel = null;
  let pickerOverlay = null;
  let pickerTarget = null;
  let pickerActive = false;
  let pickerMessage = "";
  let lowFalsePositiveMode = false;
  let restoredCount = 0;
  let tryBlockInteractionGuardsInstalled = false;

  init();

  async function init() {
    await i18n?.ready?.();
    i18n?.onChange?.(() => {
      updateAdBadgeLabels();
      renderRecoveryPanel();
      renderPickerOverlayCopy();
    });
    const settings = await readSettings();
    enabled = settings.enabled;
    siteRules = settings.siteRules;
    customHideRules = settings.customHideRules;
    subscriptionHideRules = settings.subscriptionHideRules;
    builtinFilteringEnabled = settings.builtinFilteringEnabled;
    lowFalsePositiveMode = isLowFalsePositivePage();
    siteMode = getSiteMode(siteRules, currentHostname);
    applyRuntimeState();
    document.documentElement.setAttribute(
      PAGE_PROFILE_ATTR,
      lowFalsePositiveMode ? "low-false-positive" : "normal"
    );
    ensureObserved();
    scanDocument();
  }

  function readSettings() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get({
          [STORAGE_KEY]: true,
          [SITE_RULES_KEY]: {},
          [CUSTOM_HIDE_RULES_KEY]: {},
          [SUBSCRIPTION_HIDE_RULES_KEY]: {},
          [BUILTIN_FILTERING_KEY]: true
        }, (items) => {
          resolve({
            enabled: Boolean(items[STORAGE_KEY]),
            siteRules: normalizeSiteRules(items[SITE_RULES_KEY]),
            customHideRules: normalizeHideRules(items[CUSTOM_HIDE_RULES_KEY]),
            subscriptionHideRules: normalizeHideRules(items[SUBSCRIPTION_HIDE_RULES_KEY]),
            builtinFilteringEnabled: items[BUILTIN_FILTERING_KEY] !== false
          });
        });
      } catch {
        resolve({ enabled: true, siteRules: {}, customHideRules: {}, subscriptionHideRules: {}, builtinFilteringEnabled: true });
      }
    });
  }

  function normalizeSiteRules(value) {
    if (!value || typeof value !== "object") {
      return {};
    }

    const normalized = {};
    for (const [key, mode] of Object.entries(value)) {
      const hostname = normalizeHostname(key);
      if (!hostname) {
        continue;
      }

      if (mode === "allow" || mode === "block") {
        normalized[hostname] = mode;
      }
    }

    return normalized;
  }

  function getSiteMode(rules, hostname) {
    return rules[hostname] === "allow" || rules[hostname] === "block" ? rules[hostname] : "default";
  }

  function normalizeHostname(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (!raw) {
      return "";
    }

    try {
      return new URL(raw.includes("://") ? raw : `https://${raw}`).hostname.replace(/^www\./, "");
    } catch {
      const stripped = raw.replace(/^\*\./, "").split(/[/?#]/)[0].replace(/^www\./, "");
      return /^[a-z0-9.-]+$/.test(stripped) ? stripped : "";
    }
  }

  function normalizeHideRules(value) {
    if (!value || typeof value !== "object") {
      return {};
    }

    const normalized = {};
    for (const [key, selectors] of Object.entries(value)) {
      const hostname = normalizeHostname(key);
      if (!hostname) {
        continue;
      }

      const list = Array.isArray(selectors)
        ? selectors
        : typeof selectors === "string"
          ? [selectors]
          : [];

      const safeSelectors = [];
      for (const raw of list) {
        const selector = String(raw || "").trim();
        if (!selector || !isSafeCosmeticSelector(selector)) {
          continue;
        }
        safeSelectors.push(selector);
      }

      normalized[hostname] = Array.from(new Set(safeSelectors)).slice(0, SELECTOR_PER_SITE_SOFT_LIMIT);
    }

    return normalized;
  }

  function isSafeCosmeticSelector(selector) {
    const value = String(selector || "").trim();
    if (!value || value.length > MAX_SELECTOR_LENGTH) {
      return false;
    }

    if (value.includes("</") || value.includes("/>")) {
      return false;
    }

    // Block uBlock-extended pseudo-classes that querySelectorAll cannot parse
    const hasUnsupportedPseudo = /:has-text\(|:matches-css\(|:xpath\(|:style\(|:remove\(|:abp\(|:contains\(|:properties\(|:matches-attr\(|:matches-prop\(/i.test(value);
    if (hasUnsupportedPseudo) {
      return false;
    }

    // Block nested :has() (DoS risk), allow single-level :has() (Chrome 105+)
    const hasCount = (value.match(/:has\(/g) || []).length;
    if (hasCount > 1) {
      return false;
    }

    const openParens = (value.match(/\(/g) || []).length;
    const closeParens = (value.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      return false;
    }

    const openBrackets = (value.match(/\[/g) || []).length;
    const closeBrackets = (value.match(/\]/g) || []).length;
    if (openBrackets !== closeBrackets) {
      return false;
    }

    const selectorDepth = value.split(/>|\+|~/).length + (value.match(/\s+/g) || []).length;
    if (selectorDepth > 20) {
      return false;
    }

    return true;
  }

  function applyRuntimeState() {
    const isActive = isRuntimeActive();

    document.documentElement.toggleAttribute(ENABLED_ATTR, isActive);
    document.documentElement.setAttribute(SITE_MODE_ATTR, siteMode);

    if (!isActive) {
      clearMarks();
      return;
    }

    scanDocument();
  }

  function isRuntimeActive() {
    return siteMode !== "allow" && (enabled || siteMode === "block");
  }

  function ensureObserved() {
    if (observer) {
      return;
    }

    observer = new MutationObserver((mutations) => {
      if (!isRuntimeActive()) {
        return;
      }

      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          scheduleScan();
          break;
        }
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  function scheduleScan() {
    if (scanQueued) {
      return;
    }

    scanQueued = true;
    if (scanTimer) {
      clearTimeout(scanTimer);
    }
    scanTimer = setTimeout(() => {
      scanTimer = null;
      scanQueued = false;
      try {
        scanDocument();
      } catch (error) {
        console.warn("Ad Cleaner scan aborted:", error);
      }
    }, SCAN_THROTTLE_MS);
  }

  function scanDocument() {
    if (!isRuntimeActive() || !document.documentElement) {
      return;
    }

    if (isTryBlockBasicPage()) {
      scanTryBlockBasicPage();
    } else if (isTryBlockIntermediatePage()) {
      scanTryBlockIntermediatePage();
    } else if (isTryBlockAdvancedPage()) {
      scanTryBlockAdvancedPage();
    } else if (shouldRunHeuristics()) {
      const candidates = new Set(
        document.querySelectorAll(CANDIDATE_SELECTOR)
      );

      for (const element of candidates) {
        const target = findAdTarget(element);
        if (target) {
          markElement(target, "heuristic");
        }
      }
    }

    scanSelectorRules(customHideRules, "custom-selector");
    scanSelectorRules(subscriptionHideRules, "subscription-selector");

    markedCount = document.querySelectorAll(`[${MARK_ATTR}="true"]`).length;
    reportPageMetrics();
  }

  function shouldRunHeuristics() {
    return builtinFilteringEnabled && !isTryBlockAdblockTestPage();
  }

  function scanTryBlockBasicPage() {
    if (!builtinFilteringEnabled) {
      return;
    }

    scanTryBlockSelectors([
      ["main .demo-ad.banner", "heuristic:tryblock-banner"],
      ["main .demo-ad.sidebar", "heuristic:tryblock-sidebar"],
      ["main .demo-ad.sponsored", "heuristic:tryblock-sponsored"],
      ["main .demo-ad.inline", "heuristic:tryblock-inline-article"]
    ]);
  }

  function scanTryBlockAdvancedPage() {
    if (!builtinFilteringEnabled) {
      return;
    }

    scanTryBlockSelectors([
      ["main .deceptive-ad", "heuristic:tryblock-deceptive-ad"],
      ["main .redirect-test", "heuristic:tryblock-redirect-chain"],
      ["main .anti-adblock-test", "heuristic:tryblock-anti-adblock"]
    ]);
    installTryBlockInteractionGuards();
  }

  function scanTryBlockIntermediatePage() {
    if (!builtinFilteringEnabled) {
      return;
    }

    scanTryBlockSelectors([
      ["main .dynamic-ad", "heuristic:tryblock-dynamic-ad"],
      ["main .interactive-ad", "heuristic:tryblock-interactive-ad"],
      ["main .floating-ad", "heuristic:tryblock-floating-ad"],
      ["main .video-overlay-ad", "heuristic:tryblock-video-overlay-ad"]
    ]);
  }

  function scanTryBlockSelectors(entries) {
    for (const [selector, reason] of entries) {
      let elements;
      try {
        elements = document.querySelectorAll(selector);
      } catch {
        continue;
      }

      for (const element of elements) {
        if (!(element instanceof Element) || isIgnored(element) || element.closest("[data-ad-cleaner-ui]")) {
          continue;
        }

        markElement(element, reason);
      }
    }
  }

  function installTryBlockInteractionGuards() {
    if (tryBlockInteractionGuardsInstalled) {
      return;
    }

    tryBlockInteractionGuardsInstalled = true;
    document.addEventListener("click", (event) => {
      if (!isTryBlockAdvancedPage() || !isRuntimeActive() || !(event.target instanceof Element)) {
        return;
      }

      if (!event.target.closest(".deceptive-ad, .redirect-test, .anti-adblock-test")) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
  }

  function getTryBlockMatcher(text) {
    for (const matcher of TRYBLOCK_TEST_MATCHERS) {
      if (matcher.patterns.some((pattern) => pattern.test(text))) {
        return matcher;
      }
    }

    return null;
  }

  function findTryBlockTarget(element, matcherName) {
    let current = resolveAdContainer(element);
    let lastSafe = null;

    for (let depth = 0; current && depth < 5; depth += 1) {
      if (!(current instanceof Element)) {
        break;
      }

      if (current.closest?.("[data-ad-cleaner-ui]") || current.hasAttribute(MARK_ATTR)) {
        break;
      }

      if (isTryBlockSafeTarget(current, matcherName)) {
        lastSafe = current;
      }

      if (isTryBlockContainer(current, matcherName)) {
        return current;
      }

      current = current.parentElement;
    }

    return lastSafe;
  }

  function isTryBlockContainer(element, matcherName) {
    if (!(element instanceof Element)) {
      return false;
    }

    const tag = element.tagName;
    if (tag === "BODY" || tag === "HTML" || tag === "MAIN" || tag === "HEADER" || tag === "FOOTER") {
      return false;
    }

    const text = normalize((element.innerText || element.textContent || "").slice(0, 500));
    if (!text || text.length > 500) {
      return false;
    }

    const childCount = element.children ? element.children.length : 0;
    const rect = element.getBoundingClientRect?.();
    if (rect && (rect.width >= window.innerWidth * 0.96 || rect.height >= window.innerHeight * 0.75)) {
      return false;
    }

    if (matcherName === "banner" || matcherName === "sidebar") {
      return childCount <= 6 && /banner|sidebar|advertisement|广告|推广/i.test(text);
    }

    if (matcherName === "sponsored") {
      return childCount <= 8 && /sponsored|赞助|advertisement|partner content|branded content/i.test(text);
    }

    if (matcherName === "inline-article") {
      return childCount <= 10 && /inline|article|广告|推广|sponsored|recommended/i.test(text);
    }

    return false;
  }

  function isTryBlockSafeTarget(element, matcherName) {
    if (!(element instanceof Element)) {
      return false;
    }

    const tag = element.tagName;
    if (!AD_CONTAINER_TAGS.has(tag) && tag !== "DIV" && tag !== "SECTION" && tag !== "ARTICLE" && tag !== "ASIDE" && tag !== "FIGURE" && tag !== "LI") {
      return false;
    }

    const text = normalize((element.innerText || element.textContent || "").slice(0, 360));
    if (!text) {
      return false;
    }

    const childCount = element.children ? element.children.length : 0;
    if (matcherName === "banner" || matcherName === "sidebar") {
      return childCount <= 4 && text.length <= 260;
    }

    if (matcherName === "sponsored") {
      return childCount <= 6 && text.length <= 320;
    }

    if (matcherName === "inline-article") {
      return childCount <= 8 && text.length <= 360;
    }

    return false;
  }

  function scanSelectorRules(ruleMap, reasonPrefix) {
    const selectors = getSelectorsForCurrentSite(ruleMap);
    if (!selectors.length) {
      return;
    }

    const scanDeadline = Date.now() + SCAN_SELECTOR_DEADLINE_MS;
    for (let i = 0; i < selectors.length; i += 1) {
      const selector = selectors[i];
      if (!isSafeCosmeticSelector(selector)) {
        continue;
      }

      if (Date.now() > scanDeadline) {
        break;
      }

      try {
        const elements = document.querySelectorAll(selector);
        const elementCount = elements.length;
        if (elementCount > SCAN_SELECTOR_MAX_ELEMENTS) {
          continue;
        }
        for (const element of elements) {
          if (!(element instanceof Element)) {
            continue;
          }

          if (element.closest("[data-ad-cleaner-ui]")) {
            continue;
          }

          const target = resolveAdContainer(element);
          if (
            target &&
            shouldApplyCosmeticRule(target, reasonPrefix) &&
            !isIgnored(target) &&
            !target.closest(`[${MARK_ATTR}="true"]`)
          ) {
            markElement(target, `${reasonPrefix}:${selector.slice(0, 200)}`);
          }
        }
      } catch {
        continue;
      }
    }
  }

  function getSelectorsForCurrentSite(ruleMap) {
    return selectorsForHost(ruleMap, currentHostname);
  }

  function selectorsForHost(ruleMap, hostname) {
    const selectors = [];
    for (const [ruleHost, ruleSelectors] of Object.entries(ruleMap || {})) {
      if (!hostMatches(ruleHost, hostname)) {
        continue;
      }

      selectors.push(...ruleSelectors);
    }

    return Array.from(new Set(selectors));
  }

  function hostMatches(ruleHost, hostname) {
    return hostname === ruleHost || hostname.endsWith(`.${ruleHost}`);
  }

  function shouldApplyCosmeticRule(element, reasonPrefix) {
    if (!(element instanceof Element)) {
      return false;
    }

    if (reasonPrefix !== "subscription-selector") {
      return true;
    }

    return !isDnbMembershipPage();
  }

  function isDnbMembershipPage() {
    const hostname = String(window.location.hostname || "").toLowerCase();
    const pathname = String(window.location.pathname || "");
    return hostname === "search.dnbcha.com" && DNB_MEMBERSHIP_PAGE_RE.test(pathname);
  }

  function findAdTarget(element) {
    if (!(element instanceof Element)) {
      return null;
    }

    if (isIgnored(element) || element.hasAttribute(MARK_ATTR) || element.closest(`[${MARK_ATTR}="true"]`)) {
      return null;
    }

    if (element.closest("[data-ad-cleaner-ui]")) {
      return null;
    }

    if (lowFalsePositiveMode) {
      return findLowFalsePositiveTarget(element);
    }

    const tag = element.tagName;
    const identityText = normalize(
      [
        element.id,
        element.className,
        element.getAttribute("aria-label"),
        element.getAttribute("title"),
        element.getAttribute("data-testid"),
        element.getAttribute("name"),
        element.getAttribute("alt"),
        element.getAttribute("src"),
        element.tagName !== "A" || isBlockedHost(element.getAttribute("href") || "")
          ? element.getAttribute("href")
          : ""
      ]
        .filter(Boolean)
        .join(" ")
    );
    const content = normalize((element.innerText || element.textContent || "").slice(0, 240));
    const sourceUrl = element.getAttribute("src") || element.getAttribute("href") || "";
    const datasetText = element.dataset
      ? Object.keys(element.dataset)
          .map((key) => `${key} ${String(element.dataset[key])}`)
          .join(" ")
      : "";
    const labelText = normalize([identityText, datasetText, content].filter(Boolean).join(" "));
    const directAdHint = hasExplicitAdHint(element) || (sourceUrl && isBlockedHost(sourceUrl));
    const structuralAdHint = DIRECT_AD_TOKEN_RE.test(normalize([element.className, element.id, datasetText].filter(Boolean).join(" ")));
    let score = 0;
    const strongCopyHit = STRONG_AD_COPY_RE.test(labelText) || STRONG_AD_COPY_RE.test(content);

    if (directAdHint) {
      score += 2;
    }

    if (structuralAdHint) {
      score += 2;
    }

    if (matchesAdKeywords(identityText)) {
      score += 2;
    }

    if (AD_LABEL_RE.test(labelText) || CJK_AD_LABEL_RE.test(labelText)) {
      score += 2;
    }

    if (strongCopyHit) {
      score += 2;
    }

    if (tag === "INS" && /adsbygoogle/i.test(identityText)) {
      score += 3;
    }

    if (tag === "AMP-AD" || tag === "AMP-EMBED") {
      score += 4;
    }

    if (sourceUrl && isBlockedHost(sourceUrl)) {
      score += 4;
    }

    if (tag === "IFRAME") {
      score += 2;
    }

    if (tag === "IMG" && (matchesAdKeywords(identityText) || isBlockedHost(sourceUrl))) {
      score += 2;
    }

    if (element.dataset && Object.keys(element.dataset).some((key) => matchesAdKeywords(key) || matchesAdKeywords(String(element.dataset[key])))) {
      score += 1;
    }

    if (content && (matchesAdKeywords(content) || AD_LABEL_RE.test(content) || CJK_AD_LABEL_RE.test(content))) {
      score += 2;
    }

    if (tag === "A" && (matchesAdKeywords(identityText) || AD_LABEL_RE.test(content))) {
      score += 1;
    }

    if (tag === "DIV" || tag === "SECTION" || tag === "ARTICLE" || tag === "LI" || tag === "FIGURE" || tag === "ASIDE") {
      const hasSponsoredCopy = AD_LABEL_RE.test(content) || CJK_AD_LABEL_RE.test(content) || STRONG_AD_COPY_RE.test(content);
      if (hasSponsoredCopy) {
        score += 2;
      }
    }

    if (TEXT_ONLY_TAGS.has(tag) && !directAdHint && !sourceUrl && !structuralAdHint) {
      return null;
    }

    const minimumScore = lowFalsePositiveMode ? 2 : 4;
    if (score < minimumScore) {
      return null;
    }

    if (
      AD_CONTAINER_TAGS.has(tag) &&
      !directAdHint &&
      score < (lowFalsePositiveMode ? 3 : 5) &&
      !matchesAdKeywords(identityText) &&
      !AD_LABEL_RE.test(labelText) &&
      !CJK_AD_LABEL_RE.test(labelText) &&
      !STRONG_AD_COPY_RE.test(labelText)
    ) {
      return null;
    }

    const target = resolveAdContainer(element);
    if (!target || isTooBroadTarget(target, hasExplicitAdHint(element))) {
      return null;
    }

    return target;
  }

  function findLowFalsePositiveTarget(element) {
    const tag = element.tagName;
    const identityText = normalize(
      [
        element.id,
        element.className,
        element.getAttribute("aria-label"),
        element.getAttribute("title"),
        element.getAttribute("data-testid"),
        element.getAttribute("name"),
        element.getAttribute("alt"),
        element.getAttribute("src"),
        element.tagName !== "A" || isBlockedHost(element.getAttribute("href") || "")
          ? element.getAttribute("href")
          : ""
      ]
        .filter(Boolean)
        .join(" ")
    );
    const content = normalize((element.innerText || element.textContent || "").slice(0, 240));
    const sourceUrl = element.getAttribute("src") || element.getAttribute("href") || "";
    const labelText = normalize([identityText, content].filter(Boolean).join(" "));
    const directHint = hasExplicitAdHint(element);
    const strongCopyHit = STRONG_AD_COPY_RE.test(labelText) || STRONG_AD_COPY_RE.test(content) || AD_LABEL_RE.test(labelText) || CJK_AD_LABEL_RE.test(labelText);
    let score = 0;

    if (sourceUrl && isBlockedHost(sourceUrl)) {
      score += 4;
    }

    if (tag === "IFRAME" || tag === "AMP-AD" || tag === "AMP-EMBED") {
      score += 4;
    }

    if (tag === "INS" && /adsbygoogle/i.test(identityText)) {
      score += 3;
    }

    if (strongCopyHit) {
      score += 3;
    }

    if (matchesAdKeywords(identityText)) {
      score += 2;
    }

    if (directHint) {
      score += 2;
    }

    const minimumScore = directHint || sourceUrl || tag === "IFRAME" || tag === "AMP-AD" || tag === "AMP-EMBED" || tag === "INS" ? 2 : 3;
    if (score < minimumScore) {
      return null;
    }

    if (tag === "SECTION" || tag === "ARTICLE" || tag === "ASIDE" || tag === "DIV" || tag === "FIGURE" || tag === "LI") {
      if (isTooBroadTarget(element, directHint)) {
        return null;
      }

      const childCount = element.children ? element.children.length : 0;
      const textLength = (element.innerText || element.textContent || "").trim().length;
      if (!directHint && (childCount > 8 || textLength > 400)) {
        return null;
      }
    }

    if (tag === "H1" || tag === "H2" || tag === "H3" || tag === "H4" || tag === "H5" || tag === "H6" || tag === "P" || tag === "A" || tag === "BUTTON" || tag === "SPAN" || tag === "IMG" || tag === "IFRAME" || tag === "INS" || tag === "AMP-AD" || tag === "AMP-EMBED") {
      return isTooBroadTarget(element, directHint) ? null : element;
    }

    return isTooBroadTarget(element, directHint) ? null : element;
  }

  function resolveAdContainer(element) {
    if (
      VOID_TAGS.has(element.tagName) ||
      element.tagName === "IFRAME" ||
      element.tagName === "INS" ||
      element.tagName === "AMP-AD" ||
      element.tagName === "AMP-EMBED" ||
      element.hasAttribute("data-ad-container") ||
      element.hasAttribute("data-ad") ||
      element.hasAttribute("data-ad-slot") ||
      element.hasAttribute("data-ad-unit") ||
      element.hasAttribute("data-ad-client")
    ) {
      const container = element.closest("[data-ad-container], [data-ad], [data-ad-slot], [data-ad-unit], [data-ad-client], div, article, section, aside, figure, li, div[role='article']") || element;
      return isTooBroadTarget(container, true) ? element : container;
    }

    return element;
  }

  function markElement(element, reason = "heuristic") {
    if (!(element instanceof Element) || isIgnored(element) || element.hasAttribute(MARK_ATTR) || element.closest("[data-ad-cleaner-ui]")) {
      return;
    }

    if (isTooBroadTarget(element, reason.startsWith("selector:") || reason.startsWith("subscription-selector:") || reason.startsWith("custom-selector:"))) {
      return;
    }

    ensureElementId(element);
    element.setAttribute(MARK_ATTR, "true");
    element.setAttribute(HIDDEN_ATTR, "true");
    element.setAttribute(REASON_ATTR, reason);
    element.classList.add("ad-cleaner-marked");

    if (VOID_TAGS.has(element.tagName)) {
      element.setAttribute("data-ad-cleaner-void", "true");
      return;
    }

    element.setAttribute("data-ad-cleaner-badge", "true");
    element.setAttribute("data-ad-cleaner-badge-label", t("content.badge"));

    const computedPosition = window.getComputedStyle(element).position;
    if (computedPosition === "static") {
      element.style.position = "relative";
      element.setAttribute("data-ad-cleaner-positioned", "true");
    }
  }

  function ensureElementId(element) {
    if (!element.hasAttribute(UID_ATTR)) {
      element.setAttribute(UID_ATTR, String(++nextElementId));
    }

    return element.getAttribute(UID_ATTR);
  }

  function isIgnored(element) {
    return Boolean(
      element.closest?.(`[${IGNORED_ATTR}="true"]`) ||
      element.closest?.(`[${PICKER_ATTR}="true"]`) ||
      element.closest?.(`[data-ad-cleaner-ui="true"]`) ||
      element.hasAttribute?.(IGNORED_ATTR)
    );
  }

  function hideMarkedElements() {
    const marked = document.querySelectorAll(`[${MARK_ATTR}="true"]`);
    for (const element of marked) {
      element.setAttribute(HIDDEN_ATTR, "true");
    }
    markedCount = marked.length;
    reportPageMetrics();
    return markedCount;
  }

  function restoreHiddenElements() {
    const hidden = document.querySelectorAll(`[${HIDDEN_ATTR}="true"]`);
    for (const element of hidden) {
      restoreElement(element, true);
    }
    markedCount = document.querySelectorAll(`[${MARK_ATTR}="true"]`).length;
    reportPageMetrics();
    return hidden.length;
  }

  function clearMarks() {
    const marked = document.querySelectorAll(`[${MARK_ATTR}="true"]`);
    for (const element of marked) {
      clearElementState(element);
    }

    const ignored = document.querySelectorAll(`[${IGNORED_ATTR}="true"]`);
    for (const element of ignored) {
      clearElementState(element);
    }

    hideRecoveryPanel();
    markedCount = 0;
    reportPageMetrics();
  }

  function clearHeuristicMarks() {
    const heuristicMarked = document.querySelectorAll(
      `[${MARK_ATTR}="true"][${REASON_ATTR}^="heuristic"]`
    );

    for (const element of heuristicMarked) {
      clearElementState(element);
    }

    markedCount = document.querySelectorAll(`[${MARK_ATTR}="true"]`).length;
    reportPageMetrics();
  }

  function clearElementState(element) {
    element.removeAttribute(HIDDEN_ATTR);
    element.removeAttribute(MARK_ATTR);
    element.removeAttribute(IGNORED_ATTR);
    element.removeAttribute(REASON_ATTR);
    element.removeAttribute(UID_ATTR);
    element.classList.remove("ad-cleaner-marked");
    element.removeAttribute("data-ad-cleaner-badge");
    element.removeAttribute("data-ad-cleaner-void");
    if (element.getAttribute("data-ad-cleaner-positioned") === "true") {
      element.style.position = "";
      element.removeAttribute("data-ad-cleaner-positioned");
    }
  }

  function restoreElement(element, keepIgnored) {
    element.removeAttribute(HIDDEN_ATTR);
    element.removeAttribute(MARK_ATTR);
    element.removeAttribute(REASON_ATTR);
    element.classList.remove("ad-cleaner-marked");
    element.removeAttribute("data-ad-cleaner-badge");
    element.removeAttribute("data-ad-cleaner-void");
    if (element.getAttribute("data-ad-cleaner-positioned") === "true") {
      element.style.position = "";
      element.removeAttribute("data-ad-cleaner-positioned");
    }

    if (keepIgnored) {
      element.setAttribute(IGNORED_ATTR, "true");
    } else {
      element.removeAttribute(IGNORED_ATTR);
    }
  }

  function getRecoveryEntries() {
    const entries = [];
    const elements = document.querySelectorAll(`[${MARK_ATTR}="true"]`);

    for (const element of elements) {
      const id = element.getAttribute(UID_ATTR) || ensureElementId(element);
      entries.push({
        id,
        label: getElementLabel(element),
        reason: element.getAttribute(REASON_ATTR) || "heuristic",
        element
      });
    }

    return entries;
  }

  function getElementLabel(element) {
    const tag = element.tagName.toLowerCase();
    const text = normalize((element.innerText || element.textContent || "").replace(/\s+/g, " ").slice(0, 180));
    const source = element.getAttribute("src") || element.getAttribute("href") || "";
    const label = [tag];

    if (source) {
      try {
        label.push(new URL(source, window.location.href).hostname);
      } catch {
        label.push(source.slice(0, 48));
      }
    }

    if (text) {
      label.push(text.slice(0, 80));
    }

    return label.filter(Boolean).join(" · ");
  }

  function openRecoveryPanel() {
    if (!recoveryPanel) {
      recoveryPanel = buildRecoveryPanel();
      document.body.appendChild(recoveryPanel);
    }

    recoveryPanel.hidden = false;
    renderRecoveryPanel();
  }

  function hideRecoveryPanel() {
    if (recoveryPanel) {
      recoveryPanel.hidden = true;
    }
  }

  function buildRecoveryPanel() {
    const panel = document.createElement("aside");
    panel.setAttribute(PANEL_ATTR, "true");
    panel.setAttribute("data-ad-cleaner-ui", "true");
    panel.hidden = true;
    panel.innerHTML = `
      <div class="ad-cleaner-panel-shell">
        <header class="ad-cleaner-panel-header">
          <div>
            <div class="ad-cleaner-panel-kicker">${escapeHtml(t("content.recoveryKicker"))}</div>
            <div class="ad-cleaner-panel-title">${escapeHtml(t("content.recoveryTitle"))}</div>
          </div>
          <button type="button" data-action="close">${escapeHtml(t("content.close"))}</button>
        </header>
        <div class="ad-cleaner-panel-toolbar">
          <button type="button" data-action="restore-all">${escapeHtml(t("content.restoreAll"))}</button>
          <button type="button" data-action="rescan">${escapeHtml(t("content.rescan"))}</button>
        </div>
        <div class="ad-cleaner-panel-body" data-role="entries"></div>
      </div>
    `;

    panel.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) {
        return;
      }

      const action = button.getAttribute("data-action");
      if (action === "close") {
        hideRecoveryPanel();
      }

      if (action === "restore-all") {
        restoreAllRecovered();
      }

      if (action === "rescan") {
        scanDocument();
        renderRecoveryPanel();
      }

      if (action === "restore-one") {
        const id = button.getAttribute("data-id");
        if (id) {
          restoreRecoveredById(id);
          renderRecoveryPanel();
        }
      }
    });

    return panel;
  }

  function renderRecoveryPanel() {
    if (!recoveryPanel) {
      return;
    }

    const entries = getRecoveryEntries();
    const body = recoveryPanel.querySelector('[data-role="entries"]');
    if (!body) {
      return;
    }

    if (!entries.length) {
      body.innerHTML = `
        <div class="ad-cleaner-panel-empty">
          ${escapeHtml(t("content.noRecoverable"))}
        </div>
      `;
      return;
    }

    body.innerHTML = entries
      .map((entry) => `
        <div class="ad-cleaner-panel-row">
          <div class="ad-cleaner-panel-meta">
            <div class="ad-cleaner-panel-row-title">${escapeHtml(entry.label)}</div>
            <div class="ad-cleaner-panel-row-sub">${escapeHtml(t("content.reason", { reason: entry.reason }))}</div>
          </div>
          <button type="button" data-action="restore-one" data-id="${escapeAttr(entry.id)}">${escapeHtml(t("content.restore"))}</button>
        </div>
      `)
      .join("");
  }

  function restoreRecoveredById(id) {
    const safeId = String(id || "").trim();
    if (!/^[0-9]+$/.test(safeId)) {
      return;
    }
    const selector = `[${UID_ATTR}="${cssEscape(safeId)}"]`;
    const element = document.querySelector(selector);
    if (!element) {
      return;
    }

    restoreElement(element, true);
    restoredCount += 1;
  }

  function restoreAllRecovered() {
    const elements = document.querySelectorAll(`[${MARK_ATTR}="true"]`);
    let restoredNow = 0;
    for (const element of elements) {
      restoreElement(element, true);
      restoredNow += 1;
    }

    restoredCount += restoredNow;
    markedCount = 0;
    renderRecoveryPanel();
    reportPageMetrics();
  }

  function normalize(value) {
    return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function reportPageMetrics() {
    const hiddenCount = document.querySelectorAll(`[${HIDDEN_ATTR}="true"]`).length;
    const metricsKey = `${markedCount}:${hiddenCount}`;
    if (metricsKey === lastReportedMetricsKey) {
      return;
    }

    lastReportedMetricsKey = metricsKey;
    try {
      const request = chrome.runtime.sendMessage({
        type: "PAGE_METRICS",
        markedCount,
        hiddenCount
      });
      request?.catch?.(() => {});
    } catch {
      // The extension context may disappear during an extension reload.
    }
  }

  function matchesAdKeywords(value) {
    if (!value) {
      return false;
    }

    return AD_KEYWORD_RE.test(value) || CJK_AD_LABEL_RE.test(value);
  }

  function isBlockedHost(url) {
    let hostname = "";
    try {
      hostname = new URL(url, window.location.href).hostname.toLowerCase();
    } catch {
      return false;
    }

    return BLOCKED_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  }

  function hasExplicitAdHint(element) {
    if (!(element instanceof Element)) {
      return false;
    }

    const directHint = [
      element.getAttribute("data-ad"),
      element.getAttribute("data-ad-slot"),
      element.getAttribute("data-ad-unit"),
      element.getAttribute("data-ad-client"),
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.className,
      element.id,
      element.getAttribute("src"),
      element.getAttribute("alt"),
      element.getAttribute("data-testid")
    ]
      .filter(Boolean)
      .join(" ");

    return matchesAdKeywords(directHint) || DIRECT_AD_TOKEN_RE.test(directHint) || AD_LABEL_RE.test(directHint) || CJK_AD_LABEL_RE.test(directHint) || STRONG_AD_COPY_RE.test(directHint);
  }

  function isTooBroadTarget(element, explicitHint) {
    if (!(element instanceof Element)) {
      return true;
    }

    if (element.tagName === "HTML" || element.tagName === "BODY" || element.tagName === "MAIN" || element.tagName === "HEADER" || element.tagName === "FOOTER") {
      return true;
    }

    const rect = element.getBoundingClientRect?.();
    if (!rect) {
      return false;
    }

    const viewportWidth = Math.max(window.innerWidth || 0, document.documentElement?.clientWidth || 0, 1);
    const viewportHeight = Math.max(window.innerHeight || 0, document.documentElement?.clientHeight || 0, 1);
    const viewportArea = viewportWidth * viewportHeight;
    const area = Math.max(rect.width, 0) * Math.max(rect.height, 0);
    const isFullWidth = rect.width >= viewportWidth * 0.92;
    const isTall = rect.height >= viewportHeight * 0.55;
    const isHuge = area >= viewportArea * 0.38;
    const isTopLevelWrapper = element.parentElement === document.body || element.parentElement === document.documentElement;
    const textLength = (element.innerText || element.textContent || "").trim().length;
    const childCount = element.children ? element.children.length : 0;

    if (explicitHint) {
      return area >= viewportArea * 0.5 || (isFullWidth && isTall && textLength > 220);
    }

    if (isHuge || (isFullWidth && isTall) || (isTopLevelWrapper && textLength > 300 && childCount > 2)) {
      return true;
    }

    return false;
  }

  function setEnabled(nextValue) {
    enabled = Boolean(nextValue);
    applyRuntimeState();
  }

  function setSiteRules(nextRules) {
    siteRules = normalizeSiteRules(nextRules);
    siteMode = getSiteMode(siteRules, currentHostname);
    applyRuntimeState();
  }

  function setCustomHideRules(nextRules) {
    customHideRules = normalizeHideRules(nextRules);
    if (isRuntimeActive()) {
      scanDocument();
    }
  }

  function setSubscriptionHideRules(nextRules) {
    subscriptionHideRules = normalizeHideRules(nextRules);
    if (isRuntimeActive()) {
      scanDocument();
    }
  }

  function setBuiltinFiltering(nextValue) {
    const nextEnabled = Boolean(nextValue);
    if (builtinFilteringEnabled === nextEnabled) {
      return;
    }

    builtinFilteringEnabled = nextEnabled;
    if (!isRuntimeActive()) {
      return;
    }

    if (!builtinFilteringEnabled) {
      clearHeuristicMarks();
    }

    scanDocument();
  }

  function isLowFalsePositivePage() {
    const hostname = normalizeHostname(window.location.hostname);
    const pathname = String(window.location.pathname || "");
    return hostname === "tryblock.org" && pathname.startsWith("/zh/adblock-test/");
  }

  function isTryBlockAdblockTestPage() {
    const hostname = normalizeHostname(window.location.hostname);
    const pathname = String(window.location.pathname || "");
    return hostname === "tryblock.org" && TRYBLOCK_ADBLOCK_TEST_PAGE_RE.test(pathname);
  }

  function isTryBlockBasicPage() {
    return isTryBlockAdblockTestPage() && TRYBLOCK_BASIC_PAGE_RE.test(window.location.pathname || "");
  }

  function isTryBlockAdvancedPage() {
    const hostname = normalizeHostname(window.location.hostname);
    const pathname = String(window.location.pathname || "");
    return hostname === "tryblock.org" && /^\/zh\/adblock-test\/advanced\/?$/i.test(pathname);
  }

  function isTryBlockIntermediatePage() {
    const hostname = normalizeHostname(window.location.hostname);
    const pathname = String(window.location.pathname || "");
    return hostname === "tryblock.org" && /^\/zh\/adblock-test\/intermediate\/?$/i.test(pathname);
  }

  chrome.storage?.onChanged?.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }

    if (changes[STORAGE_KEY]) {
      setEnabled(changes[STORAGE_KEY].newValue);
    }

    if (changes[SITE_RULES_KEY]) {
      setSiteRules(changes[SITE_RULES_KEY].newValue);
    }

    if (changes[CUSTOM_HIDE_RULES_KEY]) {
      setCustomHideRules(changes[CUSTOM_HIDE_RULES_KEY].newValue);
    }

    if (changes[SUBSCRIPTION_HIDE_RULES_KEY]) {
      setSubscriptionHideRules(changes[SUBSCRIPTION_HIDE_RULES_KEY].newValue);
    }

    if (changes[BUILTIN_FILTERING_KEY]) {
      setBuiltinFiltering(changes[BUILTIN_FILTERING_KEY].newValue);
    }
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message.type !== "string") {
      return;
    }

    if (message.type === "GET_STATUS") {
      reportPageMetrics();
      const tryBlockBasicPage = isTryBlockBasicPage();
      const tryBlockIntermediatePage = isTryBlockIntermediatePage();
      const tryBlockAdvancedPage = isTryBlockAdvancedPage();
      sendResponse({
        ok: true,
        enabled,
        markedCount,
        hiddenCount: document.querySelectorAll(`[${HIDDEN_ATTR}="true"]`).length,
        builtinFilteringEnabled,
        lowFalsePositiveMode,
        pageProfile: tryBlockBasicPage ? t("content.tryBasic") : tryBlockIntermediatePage ? t("content.tryIntermediate") : tryBlockAdvancedPage ? t("content.tryAdvanced") : lowFalsePositiveMode ? t("content.lowFalsePositive") : t("content.standard"),
        heuristicMarkedCount: document.querySelectorAll(`[${MARK_ATTR}="true"][${REASON_ATTR}^="heuristic"]`).length,
        customSelectorMarkedCount: document.querySelectorAll(`[${MARK_ATTR}="true"][${REASON_ATTR}^="custom-selector:"]`).length,
        subscriptionMarkedCount: document.querySelectorAll(`[${MARK_ATTR}="true"][${REASON_ATTR}^="subscription-selector:"]`).length,
        restoredCount
      });
      return;
    }

    if (message.type === "SCAN") {
      scanDocument();
      sendResponse({ ok: true, markedCount });
      return;
    }

    if (message.type === "CLEAN") {
      const cleaned = hideMarkedElements();
      sendResponse({ ok: true, cleaned });
      return;
    }

    if (message.type === "RESTORE") {
      const restored = restoreHiddenElements();
      sendResponse({ ok: true, restored });
      return;
    }

    if (message.type === "SHOW_RECOVERY_PANEL") {
      openRecoveryPanel();
      sendResponse({ ok: true, recoveredCount: getRecoveryEntries().length });
      return;
    }

    if (message.type === "START_ELEMENT_PICKER") {
      startElementPicker();
      sendResponse({ ok: true, active: pickerActive });
      return;
    }

    if (message.type === "HIDE_RECOVERY_PANEL") {
      hideRecoveryPanel();
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "RESTORE_RECOVERY_ITEM") {
      if (typeof message.id === "string") {
        restoreRecoveredById(message.id);
        renderRecoveryPanel();
      }
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "RESTORE_ALL_RECOVERY_ITEMS") {
      restoreAllRecovered();
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "SET_ENABLED") {
      setEnabled(Boolean(message.enabled));
      if (typeof message.enabled === "boolean") {
        chrome.storage.local.set({ [STORAGE_KEY]: message.enabled });
      }
      sendResponse({ ok: true, enabled });
      return;
    }

    if (message.type === "SET_SITE_MODE") {
      const nextRules = { ...siteRules };
      if (message.mode === "allow" || message.mode === "block") {
        nextRules[currentHostname] = message.mode;
      } else {
        delete nextRules[currentHostname];
      }
      chrome.storage.local.set({ [SITE_RULES_KEY]: nextRules });
      setSiteRules(nextRules);
      sendResponse({ ok: true, siteMode });
      return;
    }
  });

  function startElementPicker() {
    if (pickerActive) {
      setPickerMessage(t("content.pickerAlready"));
      return;
    }

    pickerActive = true;
    pickerMessage = "";

    if (!pickerOverlay) {
      pickerOverlay = buildPickerOverlay();
      document.body.appendChild(pickerOverlay);
    } else {
      pickerOverlay.hidden = false;
    }

    document.documentElement.setAttribute("data-ad-cleaner-picker-active", "true");
    setPickerMessage(t("content.pickerStarted"));

    document.addEventListener("mousemove", handlePickerHover, true);
    document.addEventListener("click", handlePickerClick, true);
    window.addEventListener("keydown", handlePickerKeydown, true);
  }

  function stopElementPicker(message = "") {
    pickerActive = false;
    clearPickerTarget();
    document.removeEventListener("mousemove", handlePickerHover, true);
    document.removeEventListener("click", handlePickerClick, true);
    window.removeEventListener("keydown", handlePickerKeydown, true);
    document.documentElement.removeAttribute("data-ad-cleaner-picker-active");

    if (pickerOverlay) {
      pickerOverlay.hidden = true;
    }

    if (message) {
      setPickerMessage(message);
      window.setTimeout(() => {
        if (!pickerActive && pickerOverlay) {
          hidePickerMessage();
        }
      }, 1800);
    } else {
      hidePickerMessage();
    }
  }

  function handlePickerHover(event) {
    if (!pickerActive) {
      return;
    }

    if (event.target instanceof Element && event.target.closest?.(`[${PICKER_ATTR}="true"]`)) {
      return;
    }

    const element = getPickableElement(event.target);
    if (!element || element === pickerTarget) {
      return;
    }

    setPickerTarget(element);
  }

  function handlePickerClick(event) {
    if (!pickerActive) {
      return;
    }

    if (event.target instanceof Element && event.target.closest?.(`[${PICKER_ATTR}="true"]`)) {
      return;
    }

    const element = getPickableElement(event.target);
    if (!element) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setPickerMessage(t("content.pickerVisibleOnly"));
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    commitPickerSelection(element);
  }

  function handlePickerKeydown(event) {
    if (!pickerActive) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      stopElementPicker(t("content.pickerExited"));
    }
  }

  function getPickableElement(target) {
    if (!(target instanceof Element)) {
      return null;
    }

    if (target.closest?.(`[${PICKER_ATTR}="true"]`) || target.closest?.("[data-ad-cleaner-ui]")) {
      return null;
    }

    return resolveAdContainer(target);
  }

  function setPickerTarget(element) {
    clearPickerTarget();
    pickerTarget = element;
    pickerTarget.setAttribute(PICKER_TARGET_ATTR, "true");
  }

  function clearPickerTarget() {
    if (pickerTarget) {
      pickerTarget.removeAttribute(PICKER_TARGET_ATTR);
      pickerTarget = null;
    }
  }

  function commitPickerSelection(element) {
    const selector = buildSelectorForElement(element);
    if (!selector) {
      stopElementPicker(t("content.selectorFailed"));
      return;
    }

    saveManualSelector(selector)
      .then(() => {
        setPickerMessage(t("content.selectorSaved", { selector }));
        scanDocument();
        renderRecoveryPanel();
        stopElementPicker(t("content.savedToSite"));
      })
      .catch((error) => {
        stopElementPicker(t("content.saveFailed", { error: String(error?.message || error) }));
      });
  }

  function saveManualSelector(selector) {
    const rawSelector = String(selector || "").trim();
    if (!rawSelector || !isSafeCosmeticSelector(rawSelector)) {
      return Promise.reject(new Error(t("content.invalidSelector")));
    }

    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get({ [CUSTOM_HIDE_RULES_KEY]: {} }, (items) => {
          const error = chrome.runtime.lastError;
          if (error) {
            reject(error);
            return;
          }

          const nextRules = normalizeHideRules(items[CUSTOM_HIDE_RULES_KEY]);
          const current = new Set(nextRules[currentHostname] || []);
          current.add(rawSelector);
          nextRules[currentHostname] = Array.from(current).slice(0, SELECTOR_PER_SITE_SOFT_LIMIT);

          chrome.storage.local.set({ [CUSTOM_HIDE_RULES_KEY]: nextRules }, () => {
            const setError = chrome.runtime.lastError;
            if (setError) {
              reject(setError);
              return;
            }

            customHideRules = nextRules;
            resolve();
          });
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  function buildSelectorForElement(element) {
    if (!(element instanceof Element)) {
      return "";
    }

    const candidates = [];
    const uniqueId = buildIdSelector(element);
    if (uniqueId) {
      candidates.push(uniqueId);
    }

    for (const selector of buildDirectAttributeSelectors(element)) {
      candidates.push(selector);
    }

    const path = [];
    let current = element;
    while (current && current instanceof Element) {
      const segment = buildSelectorSegment(current);
      if (!segment) {
        break;
      }

      path.unshift(segment);
      const combined = path.join(" > ");
      candidates.push(combined);
      if (isUniqueSelector(combined)) {
        return combined;
      }

      if (current === document.body || current === document.documentElement) {
        break;
      }

      current = current.parentElement;
      if (path.length > 6) {
        break;
      }
    }

    for (const selector of candidates) {
      if (isUniqueSelector(selector)) {
        return selector;
      }
    }

    return candidates[0] || "";
  }

  function buildIdSelector(element) {
    const id = element.getAttribute("id");
    if (!id) {
      return "";
    }

    const selector = `#${cssEscape(id)}`;
    return isUniqueSelector(selector) ? selector : "";
  }

  function buildDirectAttributeSelectors(element) {
    const tag = element.tagName.toLowerCase();
    const attrs = [
      "data-testid",
      "data-test",
      "data-qa",
      "data-ad",
      "data-ad-slot",
      "data-ad-unit",
      "aria-label",
      "title",
      "name",
      "alt",
      "role"
    ];
    const selectors = [];

    for (const attr of attrs) {
      const value = element.getAttribute(attr);
      if (!value) {
        continue;
      }

      const exact = `[${attr}="${escapeCssString(value)}"]`;
      const tagExact = `${tag}${exact}`;
      if (isUniqueSelector(exact)) {
        selectors.push(exact);
      }
      if (isUniqueSelector(tagExact)) {
        selectors.push(tagExact);
      }
    }

    return selectors;
  }

  function buildSelectorSegment(element) {
    const idSelector = buildIdSelector(element);
    if (idSelector) {
      return idSelector;
    }

    const directSelectors = buildDirectAttributeSelectors(element);
    if (directSelectors.length) {
      return directSelectors[0];
    }

    const tag = element.tagName.toLowerCase();
    const parent = element.parentElement;
    if (!parent) {
      return tag;
    }

    const siblings = Array.from(parent.children).filter((child) => child.tagName === element.tagName);
    if (siblings.length <= 1) {
      return tag;
    }

    const index = siblings.indexOf(element) + 1;
    return `${tag}:nth-of-type(${index})`;
  }

  function isUniqueSelector(selector) {
    if (!selector) {
      return false;
    }

    try {
      return document.querySelectorAll(selector).length === 1;
    } catch {
      return false;
    }
  }

  function cssEscape(value) {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
      return CSS.escape(String(value));
    }

    return String(value).replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`);
  }

  function escapeCssString(value) {
    const raw = String(value || "");
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
      return CSS.escape(raw).replace(/\n/g, "\\A ");
    }
    return raw
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\A ")
      .replace(/\r/g, "\\D ")
      .replace(/\t/g, "\\9 ")
      .replace(/'/g, "\\'")
      .replace(/\f/g, "\\C ");
  }

  function buildPickerOverlay() {
    const panel = document.createElement("div");
    panel.setAttribute(PICKER_ATTR, "true");
    panel.innerHTML = `
      <div class="ad-cleaner-picker-shell">
        <div class="ad-cleaner-picker-title" data-role="picker-title">${escapeHtml(t("content.pickerTitle"))}</div>
        <div class="ad-cleaner-picker-copy" data-role="picker-copy">${escapeHtml(t("content.pickerCopy"))}</div>
        <div class="ad-cleaner-picker-message" data-role="message"></div>
        <button type="button" class="ad-cleaner-picker-cancel" data-action="cancel">${escapeHtml(t("content.cancel"))}</button>
      </div>
    `;

    panel.addEventListener("click", (event) => {
      const button = event.target.closest?.("button[data-action='cancel']");
      if (!button) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      stopElementPicker(t("content.pickerCanceled"));
    });

    return panel;
  }

  function setPickerMessage(message) {
    pickerMessage = message;
    if (!pickerOverlay) {
      return;
    }

    const node = pickerOverlay.querySelector('[data-role="message"]');
    if (node) {
      node.textContent = message;
    }
  }

  function updateAdBadgeLabels() {
    for (const element of document.querySelectorAll('[data-ad-cleaner-badge="true"]')) {
      element.setAttribute("data-ad-cleaner-badge-label", t("content.badge"));
    }
  }

  function renderPickerOverlayCopy() {
    if (!pickerOverlay) {
      return;
    }
    const title = pickerOverlay.querySelector('[data-role="picker-title"]');
    const copy = pickerOverlay.querySelector('[data-role="picker-copy"]');
    const cancel = pickerOverlay.querySelector("button[data-action='cancel']");
    if (title) title.textContent = t("content.pickerTitle");
    if (copy) copy.textContent = t("content.pickerCopy");
    if (cancel) cancel.textContent = t("content.cancel");
  }

  function hidePickerMessage() {
    pickerMessage = "";
    if (!pickerOverlay) {
      return;
    }

    const node = pickerOverlay.querySelector('[data-role="message"]');
    if (node) {
      node.textContent = "";
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
  }
})();
