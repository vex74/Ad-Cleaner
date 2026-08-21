importScripts("i18n.js");

const i18n = globalThis.AdCleanerI18n;
const t = (key, values) => i18n?.t?.(key, values) || key;
const readyI18n = () => i18n?.ready?.() || Promise.resolve();

const SITE_RULES_KEY = "adCleanerSiteRules";
const SUBSCRIPTIONS_KEY = "adCleanerSubscriptions";
const COMPILATION_HIDE_RULES_KEY = "adCleanerSubscriptionElementHideRules";
const SUBSCRIPTION_STATS_KEY = "adCleanerSubscriptionStats";
const SUBSCRIPTION_CACHE_KEY = "adCleanerSubscriptionCache";
const RULE_OWNERS_KEY = "adCleanerDynamicRuleOwners";
const BUILTIN_FILTERING_KEY = "adCleanerBuiltinFilteringEnabled";
const CORE_BLOCKLIST_RULESET_ID = "core-blocklist";
const PRIVACY_COVERAGE_RULESET_ID = "privacy-coverage";
const ALWAYS_ACTIVE_RULESET_ID = "always-active";
const DYNAMIC_ALLOW_RULE_BASE = 1_000_000;
const DYNAMIC_SUB_RULE_BASE = 2_000_000;
const DYNAMIC_RULE_CEILING = 3_000_000;
const MAX_DYNAMIC_RULES = 30000;
const MAX_COMPILED_SUBSCRIPTION_RULES = 29000;
const MAX_SUBSCRIPTION_RESPONSE_BYTES = 5 * 1024 * 1024;
const SUBSCRIPTION_FETCH_TIMEOUT_MS = 10000;
const MAX_DOMAINS_PER_COMPACT_RULE = 500;
const BADGE_BACKGROUND_COLOR = "#ff5d65";
const BADGE_REFRESH_INTERVAL_MS = 5000;
const RULE_MATCH_CACHE_INTERVAL_MS = 30000;
const pageMetricsByTab = new Map();
const badgeRefreshTimes = new Map();
const ruleMatchCache = new Map();
let syncInFlight = null;
const REQUEST_RESOURCE_TYPES = [
  "sub_frame",
  "script",
  "image",
  "stylesheet",
  "xmlhttprequest",
  "font",
  "media",
  "object",
  "ping",
  "websocket",
  "other"
];

chrome.runtime.onInstalled.addListener(() => {
  queueSyncDynamicRules()
    .catch(reportSyncError)
    .finally(() => refreshBadgesForOpenTabs().catch(reportBadgeError));
});

chrome.runtime.onStartup.addListener(() => {
  queueSyncDynamicRules()
    .catch(reportSyncError)
    .finally(() => refreshBadgesForOpenTabs().catch(reportBadgeError));
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  refreshBadgeForTab(tabId).catch(reportBadgeError);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    badgeRefreshTimes.delete(tabId);
    ruleMatchCache.delete(tabId);
    clearBadgeForTab(tabId).catch(reportBadgeError);
    return;
  }

  if (changeInfo.status === "complete") {
    refreshBadgeForTab(tabId).catch(reportBadgeError);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  pageMetricsByTab.delete(tabId);
  badgeRefreshTimes.delete(tabId);
  ruleMatchCache.delete(tabId);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") {
    return;
  }

  if (changes[SITE_RULES_KEY] || changes[SUBSCRIPTIONS_KEY] || changes[BUILTIN_FILTERING_KEY]) {
    queueSyncDynamicRules().catch(reportSyncError);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "GET_RULE_MATCHES") {
    getRuleMatchesWithFallback(message.tabId)
      .then(async (result) => {
        await updateBadgeForTab(message.tabId, result);
        sendResponse(result);
      })
      .catch((error) => sendResponse({ ok: false, error: String(error?.message || error) }));
    return true;
  }

  if (message?.type === "PAGE_METRICS") {
    const tabId = Number(sender?.tab?.id);
    if (Number.isInteger(tabId) && tabId >= 0) {
      const metrics = {
        markedCount: Math.max(0, Number(message.markedCount) || 0),
        hiddenCount: Math.max(0, Number(message.hiddenCount) || 0)
      };
      pageMetricsByTab.set(tabId, metrics);
      ruleMatchCache.delete(tabId);
      updateBadgeForTab(tabId, buildPageMatchResult(tabId)).catch(reportBadgeError);
    }
    sendResponse({ ok: true });
    return;
  }

  if (message?.type !== "SYNC_RULES") {
    return;
  }

  queueSyncDynamicRules()
    .then((result) => sendResponse({
      ok: true,
      stats: result.subscriptionStats,
      dynamicRuleStats: result.dynamicRuleStats
    }))
    .catch((error) => sendResponse({ ok: false, error: String(error?.message || error) }));

  return true;
});

function queueSyncDynamicRules() {
  if (!syncInFlight) {
    syncInFlight = syncDynamicRules().finally(() => {
      syncInFlight = null;
    });
  }

  return syncInFlight;
}

async function syncDynamicRules() {
  const items = await chrome.storage.local.get({
    [SITE_RULES_KEY]: {},
    [SUBSCRIPTIONS_KEY]: [],
    [BUILTIN_FILTERING_KEY]: true,
    [SUBSCRIPTION_CACHE_KEY]: {},
    [COMPILATION_HIDE_RULES_KEY]: {}
  });

  const builtinFilteringEnabled = items[BUILTIN_FILTERING_KEY] !== false;
  const siteRules = normalizeSiteRules(items[SITE_RULES_KEY]);
  const subscriptions = normalizeSubscriptions(items[SUBSCRIPTIONS_KEY]);
  const allowRules = buildAllowRules(siteRules);
  const subscriptionResult = await compileSubscriptions(
    subscriptions,
    Math.max(0, Math.min(MAX_COMPILED_SUBSCRIPTION_RULES, MAX_DYNAMIC_RULES - allowRules.length)),
    items[SUBSCRIPTION_CACHE_KEY],
    items[COMPILATION_HIDE_RULES_KEY]
  );

  try {
    await syncBuiltinRuleset(builtinFilteringEnabled);
  } catch (error) {
    console.error("Failed to sync built-in ruleset:", error);
  }

  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existingRules
    .filter((rule) => isDynamicRuleId(rule.id))
    .map((rule) => rule.id);

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules: []
  });

  const desiredRules = [...allowRules, ...subscriptionResult.blockRules];
  const addedRuleIds = await addDynamicRulesSafely(desiredRules);

  const dynamicRuleStats = {
    desired: desiredRules.length,
    added: addedRuleIds.length,
    skipped: desiredRules.length - addedRuleIds.length,
    truncatedRuleCount: subscriptionResult.truncatedRuleCount || 0,
    skippedRuleIds: desiredRules
      .filter((rule) => !addedRuleIds.includes(rule.id))
      .map((rule) => rule.id),
    subscriptionCount: subscriptions.length,
    activeSubscriptionCount: Object.values(subscriptionResult.subscriptionStats).filter((item) => item.status === "active").length,
    errorSubscriptionCount: Object.values(subscriptionResult.subscriptionStats).filter((item) => item.status === "error").length,
    emptySubscriptionCount: Object.values(subscriptionResult.subscriptionStats).filter((item) => item.status === "empty").length
  };

  await chrome.storage.local.set({
    [COMPILATION_HIDE_RULES_KEY]: subscriptionResult.hideRules,
    [SUBSCRIPTION_STATS_KEY]: subscriptionResult.subscriptionStats,
    [SUBSCRIPTION_CACHE_KEY]: subscriptionResult.subscriptionCache,
    [RULE_OWNERS_KEY]: subscriptionResult.ruleOwners,
    adCleanerDynamicRuleStats: dynamicRuleStats
  });

  return { ...subscriptionResult, dynamicRuleStats };
}

async function addDynamicRulesSafely(rules) {
  const addedRuleIds = [];

  async function addBatch(batch) {
    if (!batch.length) {
      return;
    }

    try {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [],
        addRules: batch
      });
      addedRuleIds.push(...batch.map((rule) => rule.id));
      return;
    } catch (error) {
      if (batch.length === 1) {
        console.warn("Skipping invalid dynamic rule:", batch[0], error);
        return;
      }

      const midpoint = Math.floor(batch.length / 2);
      await addBatch(batch.slice(0, midpoint));
      await addBatch(batch.slice(midpoint));
    }
  }

  await addBatch(rules);
  return addedRuleIds;
}

async function getRuleMatches(tabId) {
  await readyI18n();
  const numericTabId = Number(tabId);
  if (!Number.isInteger(numericTabId) || numericTabId < 0) {
    return { ok: false, error: t("background.tabUnavailable") };
  }

  if (typeof chrome.declarativeNetRequest.getMatchedRules !== "function") {
    return { ok: false, error: t("background.diagnosticsUnsupported") };
  }

  const [matchResult, ownerResult] = await Promise.all([
    chrome.declarativeNetRequest.getMatchedRules({ tabId: numericTabId }),
    chrome.storage.local.get({ [RULE_OWNERS_KEY]: {} })
  ]);
  const owners = ownerResult[RULE_OWNERS_KEY] || {};
  const matches = Array.isArray(matchResult?.matchedRules) ? matchResult.matchedRules : [];
  const details = matches.map((entry) => {
    const ruleId = Number(entry.ruleId);
    const owner = owners[String(ruleId)];
    return {
      ruleId,
      source: owner ? "subscription" : ruleId >= DYNAMIC_ALLOW_RULE_BASE ? "dynamic" : "builtin",
      subscriptionName: owner?.name || "",
      subscriptionId: owner?.id || ""
    };
  });

  return {
    ok: true,
    total: details.length,
    builtin: details.filter((item) => item.source === "builtin").length,
    subscription: details.filter((item) => item.source === "subscription").length,
    dynamic: details.filter((item) => item.source === "dynamic").length,
    subscriptions: Array.from(new Set(details.filter((item) => item.subscriptionName).map((item) => item.subscriptionName))),
    details
  };
}

async function refreshBadgeForTab(tabId) {
  const numericTabId = Number(tabId);
  const lastRefresh = badgeRefreshTimes.get(numericTabId) || 0;
  if (Date.now() - lastRefresh < BADGE_REFRESH_INTERVAL_MS) {
    return;
  }

  badgeRefreshTimes.set(numericTabId, Date.now());
  const result = await getRuleMatchesWithFallback(tabId);
  await updateBadgeForTab(tabId, result);
}

async function refreshBadgesForOpenTabs() {
  const tabs = await chrome.tabs.query({});
  await Promise.allSettled(
    tabs
      .map((tab) => tab.id)
      .filter((tabId) => Number.isInteger(tabId) && tabId >= 0)
      .map((tabId) => refreshBadgeForTab(tabId))
  );
}

async function updateBadgeForTab(tabId, result) {
  await readyI18n();
  const numericTabId = Number(tabId);
  if (!Number.isInteger(numericTabId) || numericTabId < 0) {
    return;
  }

  if (!result?.ok) {
    await clearBadgeForTab(numericTabId);
    return;
  }

  const total = Math.max(0, Number(result.total) || 0);
  const text = total === 0 ? "" : total > 999 ? "999+" : String(total);
  const title = result.source === "page"
    ? (total ? t("background.pageTitleHidden", { count: total }) : t("background.pageTitleEmpty"))
    : (total ? t("background.networkTitleBlocked", { count: total }) : t("background.networkTitleEmpty"));
  await chrome.action.setBadgeText({ tabId: numericTabId, text });
  await chrome.action.setBadgeBackgroundColor({
    tabId: numericTabId,
    color: BADGE_BACKGROUND_COLOR
  });
  await chrome.action.setTitle({
    tabId: numericTabId,
    title
  });
}

async function getRuleMatchesWithFallback(tabId) {
  const numericTabId = Number(tabId);
  const cached = ruleMatchCache.get(numericTabId);
  if (cached && Date.now() - cached.timestamp < RULE_MATCH_CACHE_INTERVAL_MS) {
    return cached.result;
  }

  try {
    const result = await getRuleMatches(tabId);
    if (result?.ok) {
      const networkResult = { ...result, source: "network" };
      ruleMatchCache.set(numericTabId, { timestamp: Date.now(), result: networkResult });
      return networkResult;
    }
  } catch (error) {
    console.warn("Network rule diagnostics unavailable, using page metrics:", error);
  }

  try {
    const pageStatus = await chrome.tabs.sendMessage(Number(tabId), { type: "GET_STATUS" });
    if (pageStatus?.ok) {
      const metrics = {
        markedCount: Math.max(0, Number(pageStatus.markedCount) || 0),
        hiddenCount: Math.max(0, Number(pageStatus.hiddenCount) || 0)
      };
      pageMetricsByTab.set(Number(tabId), metrics);
    }
  } catch {
    // Pages without the content script keep the zero-count fallback.
  }

  const fallbackResult = buildPageMatchResult(tabId);
  ruleMatchCache.set(numericTabId, { timestamp: Date.now(), result: fallbackResult });
  return fallbackResult;
}

function buildPageMatchResult(tabId) {
  const numericTabId = Number(tabId);
  const metrics = pageMetricsByTab.get(numericTabId) || { markedCount: 0, hiddenCount: 0 };
  return {
    ok: true,
    source: "page",
    total: metrics.hiddenCount || metrics.markedCount,
    builtin: 0,
    subscription: 0,
    dynamic: 0,
    subscriptions: [],
    details: []
  };
}

async function clearBadgeForTab(tabId) {
  const numericTabId = Number(tabId);
  if (!Number.isInteger(numericTabId) || numericTabId < 0) {
    return;
  }

  await chrome.action.setBadgeText({ tabId: numericTabId, text: "" });
  await chrome.action.setTitle({
    tabId: numericTabId,
    title: "Ad Cleaner"
  });
}

async function syncBuiltinRuleset(enabled) {
  if (typeof chrome.declarativeNetRequest.updateEnabledRulesets !== "function") {
    return;
  }

  // The tiny safety ruleset must stay active even when the broader built-in
  // filtering is disabled, so the manual ad-block test checks still work.
  await chrome.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: [
      ALWAYS_ACTIVE_RULESET_ID,
      ...(enabled ? [CORE_BLOCKLIST_RULESET_ID, PRIVACY_COVERAGE_RULESET_ID] : [])
    ],
    disableRulesetIds: enabled ? [] : [CORE_BLOCKLIST_RULESET_ID, PRIVACY_COVERAGE_RULESET_ID]
  });
}

function buildAllowRules(siteRules) {
  return Object.entries(siteRules)
    .filter(([, mode]) => mode === "allow")
    .map(([hostname], index) => ({
      id: DYNAMIC_ALLOW_RULE_BASE + index + 1,
      priority: 1000,
      action: {
        type: "allowAllRequests"
      },
      condition: {
        initiatorDomains: [hostname],
        resourceTypes: ["main_frame", "sub_frame"]
      }
    }));
}

function isDynamicRuleId(ruleId) {
  return Number.isInteger(ruleId) && ruleId >= DYNAMIC_ALLOW_RULE_BASE && ruleId < DYNAMIC_RULE_CEILING;
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

function normalizeSubscriptions(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => normalizeSubscription(item, index))
    .filter(Boolean);
}

function normalizeSubscription(item, index) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const enabled = item.enabled !== false;
  const source = String(item.source || "").trim();
  if (!source) {
    return null;
  }

  const sourceType = item.sourceType === "text" || !normalizeSubscriptionUrl(source) ? "text" : "url";

  return {
    id: typeof item.id === "string" && item.id ? item.id : `sub-${index + 1}`,
    name: String(item.name || source).trim().slice(0, 120),
    sourceType,
    source,
    enabled
  };
}

async function compileSubscriptions(subscriptions, maxRuleCount = MAX_COMPILED_SUBSCRIPTION_RULES, previousCache = {}, previousHideRules = {}) {
  await readyI18n();
  const blockRules = [];
  const hideRules = {};
  const subscriptionStats = {};
  const subscriptionCache = { ...(previousCache || {}) };
  const ruleOwners = {};
  const subscriptionRuleBuckets = [];
  let nextRuleId = DYNAMIC_SUB_RULE_BASE + 1;
  let truncatedRuleCount = 0;

  for (const subscription of subscriptions) {
    if (!subscription.enabled) {
      subscriptionStats[subscription.id] = {
        id: subscription.id,
        name: subscription.name,
        enabled: false,
        status: "disabled",
        message: t("background.closed"),
        ruleCount: 0,
        hideCount: 0
      };
      continue;
    }

    const loadResult = await loadSubscriptionText(subscription);
    if (!loadResult.text) {
      const cached = subscriptionCache[subscription.id];
      const cachedRules = Array.isArray(cached?.blockRules)
        ? cached.blockRules.map((rule) => ({
          ...rule,
          id: nextRuleId++
        })).filter((rule) => rule && rule.condition && rule.action)
        : [];
      blockRules.push(...cachedRules);
      subscriptionRuleBuckets.push({ id: subscription.id, rules: cachedRules.slice() });
      for (const rule of cachedRules) {
        ruleOwners[String(rule.id)] = {
          id: subscription.id,
          name: cached?.name || subscription.name
        };
      }
      mergeHideRules(hideRules, cached?.hideRules);
      subscriptionStats[subscription.id] = {
        id: subscription.id,
        name: subscription.name,
        enabled: true,
        status: "error",
        message: cachedRules.length
          ? t("background.usingPrevious", { error: loadResult.errorMessage || t("background.loadFailed") })
          : loadResult.errorMessage || t("background.loadFailed"),
        ruleCount: cachedRules.length,
        rawRuleCount: Number(cached?.rawRuleCount || cachedRules.length),
        unsupportedRuleCount: Number(cached?.unsupportedRuleCount || 0),
        addedRuleCount: 0,
        hideCount: Number(cached?.hideCount || 0)
      };
      continue;
    }

    const parsedMetadata = parseSubscriptionMetadata(loadResult.text);
    const compiled = parseFilterText(loadResult.text, nextRuleId);
    nextRuleId = compiled.nextRuleId;
    blockRules.push(...compiled.blockRules);
    subscriptionRuleBuckets.push({ id: subscription.id, rules: compiled.blockRules.slice() });
    truncatedRuleCount += compiled.truncatedRuleCount;
    for (const rule of compiled.blockRules) {
      ruleOwners[String(rule.id)] = {
        id: subscription.id,
        name: parsedMetadata.title || subscription.name
      };
    }
    mergeHideRules(hideRules, compiled.hideRules);
    subscriptionCache[subscription.id] = {
      name: parsedMetadata.title || subscription.name,
      blockRules: compiled.blockRules,
      hideRules: compiled.hideRules,
      rawRuleCount: compiled.rawRuleCount,
      unsupportedRuleCount: compiled.unsupportedRuleCount,
      hideCount: Object.values(compiled.hideRules).reduce((total, list) => total + list.length, 0)
    };
    subscriptionStats[subscription.id] = {
      id: subscription.id,
      name: parsedMetadata.title || subscription.name,
      enabled: true,
      status: compiled.blockRules.length || Object.keys(compiled.hideRules).length ? "active" : "empty",
      message: compiled.blockRules.length || Object.keys(compiled.hideRules).length ? t("background.active") : t("background.emptyRules"),
      ruleCount: compiled.blockRules.length,
      rawRuleCount: compiled.rawRuleCount,
      unsupportedRuleCount: compiled.unsupportedRuleCount,
      addedRuleCount: 0,
      truncatedRuleCount: compiled.truncatedRuleCount || 0,
      hideCount: Object.values(compiled.hideRules).reduce((total, list) => total + list.length, 0),
      title: parsedMetadata.title,
      description: parsedMetadata.description,
      version: parsedMetadata.version,
      updatedAtText: parsedMetadata.updatedAtText,
      updateIntervalText: parsedMetadata.updateIntervalText,
      sourceSummary: parsedMetadata.sourceSummary
    };
  }

  const limitedBlockRules = [];
  let bucketIndex = 0;
  while (limitedBlockRules.length < maxRuleCount && subscriptionRuleBuckets.some((bucket) => bucket.rules.length)) {
    const bucket = subscriptionRuleBuckets[bucketIndex % subscriptionRuleBuckets.length];
    if (bucket.rules.length) {
      limitedBlockRules.push(bucket.rules.shift());
    }
    bucketIndex += 1;
  }

  truncatedRuleCount += Math.max(0, blockRules.length - limitedBlockRules.length);
  const limitedRuleIds = new Set(limitedBlockRules.map((rule) => String(rule.id)));
  for (const ruleId of Object.keys(ruleOwners)) {
    if (!limitedRuleIds.has(ruleId)) {
      delete ruleOwners[ruleId];
    }
  }

  const addedRuleCounts = {};
  for (const rule of limitedBlockRules) {
    const owner = ruleOwners[String(rule.id)];
    if (owner) {
      addedRuleCounts[owner.id] = (addedRuleCounts[owner.id] || 0) + 1;
    }
  }
  for (const stats of Object.values(subscriptionStats)) {
    stats.addedRuleCount = addedRuleCounts[stats.id] || 0;
    if (stats.status === "active" && stats.addedRuleCount < stats.ruleCount) {
      stats.message = t("background.activeWithCount", { count: stats.addedRuleCount });
    }
  }

  return {
    blockRules: limitedBlockRules,
    hideRules,
    subscriptionStats,
    ruleOwners,
    truncatedRuleCount,
    subscriptionCache
  };
}

async function loadSubscriptionText(subscription) {
  await readyI18n();
  if (subscription.sourceType === "text") {
    return { text: subscription.source, errorMessage: "" };
  }

  try {
    const sourceUrl = normalizeSubscriptionUrl(subscription.source);
    if (!sourceUrl) {
      return {
        text: "",
        errorMessage: t("background.invalidUrl")
      };
    }

    if (isUnsafeSubscriptionHost(sourceUrl)) {
      return {
        text: "",
        errorMessage: t("background.unsafeHost")
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SUBSCRIPTION_FETCH_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(sourceUrl, {
        signal: controller.signal,
        cache: "no-store",
        credentials: "omit",
        redirect: "follow",
        referrerPolicy: "no-referrer"
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) {
      return {
        text: "",
        errorMessage: t("background.httpError", { status: response.status })
      };
    }

    const contentLength = Number(response.headers.get("content-length") || 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_SUBSCRIPTION_RESPONSE_BYTES) {
      return {
        text: "",
        errorMessage: t("background.tooLarge", { size: Math.round(contentLength / 1024 / 1024) })
      };
    }

    let text = "";
    if (response.body?.getReader) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        received += value.byteLength;
        if (received > MAX_SUBSCRIPTION_RESPONSE_BYTES) {
          reader.releaseLock?.();
          try {
            await response.body.cancel();
          } catch {}
          return {
            text: "",
            errorMessage: t("background.tooLargeStream")
          };
        }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } else {
      text = await response.text();
      if (text.length > MAX_SUBSCRIPTION_RESPONSE_BYTES) {
        return {
          text: "",
          errorMessage: t("background.tooLargeText")
        };
      }
    }

    if (looksLikeHtmlPage(text)) {
      return {
        text: "",
        errorMessage: t("background.htmlResponse")
      };
    }

    return { text, errorMessage: "" };
  } catch (error) {
    console.error(`Failed to load subscription ${subscription.name}:`, error);
    return {
      text: "",
      errorMessage: formatSubscriptionLoadError(error)
    };
  }
}

function parseFilterText(text, ruleIdStart = DYNAMIC_SUB_RULE_BASE + 1) {
  const blockRules = [];
  const hideRules = {};
  const hideExceptions = {};
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  let nextRuleId = ruleIdStart;
  let rawRuleCount = 0;
  let unsupportedRuleCount = 0;
  const badFilterKeys = new Set(
    lines
      .filter((line) => /\$[^\n]*\bbadfilter(?:,|$)/i.test(line))
      .map(normalizeBadFilterKey)
      .filter(Boolean)
  );

  for (const line of lines) {
    if (line.startsWith("!") || line.startsWith("[")) {
      continue;
    }

    if (line.includes("#@#")) {
      const exceptionIndex = line.indexOf("#@#");
      const selector = line.slice(exceptionIndex + 3).trim();
      if (selector && isSupportedCosmeticSelector(selector)) {
        for (const hostname of parseCosmeticHosts(line.slice(0, exceptionIndex))) {
          if (!hideExceptions[hostname]) {
            hideExceptions[hostname] = new Set();
          }
          hideExceptions[hostname].add(selector);
        }
      }
      continue;
    }

    if (line.includes("#?#") || line.includes("#$#")) {
      continue;
    }

    if (line.includes("##")) {
      const separatorIndex = line.indexOf("##");
      const selector = line.slice(separatorIndex + 2).trim();
      if (selector && isSupportedCosmeticSelector(selector)) {
        for (const hostname of parseCosmeticHosts(line.slice(0, separatorIndex))) {
          if (!hideRules[hostname]) {
            hideRules[hostname] = [];
          }
          hideRules[hostname].push(selector);
        }
      }
      continue;
    }

    if (badFilterKeys.has(normalizeBadFilterKey(line))) {
      continue;
    }

    rawRuleCount += 1;
    const blockRule = buildBlockRule(line, nextRuleId);
    if (blockRule) {
      blockRules.push(blockRule);
      nextRuleId += 1;
    } else {
      unsupportedRuleCount += 1;
    }
  }

  const compactedBlockRules = compactDomainBlockRules(blockRules);
  for (const [hostname, selectors] of Object.entries(hideRules)) {
    const exceptions = hideExceptions[hostname];
    hideRules[hostname] = Array.from(new Set(selectors)).filter((selector) => !exceptions?.has(selector));
    if (!hideRules[hostname].length) {
      delete hideRules[hostname];
    }
  }

  return {
    blockRules: compactedBlockRules,
    hideRules,
    nextRuleId,
    rawRuleCount,
    unsupportedRuleCount,
    truncatedRuleCount: 0
  };
}

function compactDomainBlockRules(rules) {
  const compactGroups = new Map();
  const compacted = [];

  for (const rule of rules) {
    const host = getExactDomainFilterHost(rule);
    if (!host) {
      compacted.push(rule);
      continue;
    }

    const condition = rule.condition || {};
    const signature = JSON.stringify({
      action: rule.action,
      priority: rule.priority,
      resourceTypes: condition.resourceTypes || [],
      domainType: condition.domainType || ""
    });
    if (!compactGroups.has(signature)) {
      compactGroups.set(signature, { template: rule, hosts: [], ids: [] });
    }
    const group = compactGroups.get(signature);
    group.hosts.push(host);
    group.ids.push(rule.id);
  }

  for (const group of compactGroups.values()) {
    const uniqueHosts = Array.from(new Set(group.hosts));
    for (let index = 0; index < uniqueHosts.length; index += MAX_DOMAINS_PER_COMPACT_RULE) {
      const hosts = uniqueHosts.slice(index, index + MAX_DOMAINS_PER_COMPACT_RULE);
      const sourceId = group.ids[index] || group.ids[0];
      const condition = { ...group.template.condition };
      delete condition.urlFilter;
      condition.requestDomains = hosts;
      compacted.push({
        ...group.template,
        id: sourceId,
        condition
      });
    }
  }

  return compacted;
}

function getExactDomainFilterHost(rule) {
  if (!rule || rule.action?.type !== "block" && rule.action?.type !== "allow") {
    return "";
  }

  const condition = rule.condition || {};
  const keys = Object.keys(condition).filter((key) => key !== "urlFilter" && key !== "resourceTypes" && key !== "domainType");
  if (keys.length || !condition.urlFilter) {
    return "";
  }

  const match = String(condition.urlFilter).match(/^\|\|([a-z0-9.-]+)\^$/i);
  return match ? match[1].toLowerCase() : "";
}

function normalizeBadFilterKey(line) {
  return String(line || "")
    .trim()
    .replace(/\$badfilter(?=,|$)/ig, "")
    .replace(/(?:^|,)\s*badfilter(?=,|$)/ig, "")
    .replace(/,\s*$/g, "")
    .replace(/\$+/g, "$")
    .toLowerCase();
}

function parseCosmeticHosts(hostPart) {
  return String(hostPart || "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value && !value.startsWith("~"))
    .map(normalizeHostname)
    .filter(Boolean);
}

function isSupportedCosmeticSelector(selector) {
  const value = String(selector || "").trim();
  if (!value || value.length > 1024) {
    return false;
  }

  if (value.includes("</") || value.includes("/>")) {
    return false;
  }

  // Block uBlock-extended pseudo-classes that querySelectorAll cannot parse
  if (/^\+js\(|:has-text\(|:matches-(?:css|attr|property|prop)\(|:xpath\(|:style\(|:remove\(|:abp\(|:contains\(|:properties\(/i.test(value)) {
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

function parseSubscriptionMetadata(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const metadata = {
    title: "",
    description: "",
    version: "",
    updatedAtText: "",
    updateIntervalText: "",
    sourceSummary: ""
  };

  for (const line of lines) {
    const raw = line.replace(/^[!#]+\s*/, "").trim();
    const titleMatch = raw.match(/^(title|name|标题|名称)\s*[:：]\s*(.+)$/i);
    const descriptionMatch = raw.match(/^(description|desc|说明|简介)\s*[:：]\s*(.+)$/i);
    const versionMatch = raw.match(/(?:version|版本)\s*[:：]\s*([0-9A-Za-z._-]+)/i);
    const updatedMatch = raw.match(/(?:updated|last\s*updated|更新时间|更新于)\s*[:：]\s*([^，,]+)/i);
    const intervalMatch = raw.match(/^(update\s*interval|更新周期|每\s*\d+\s*个?\s*小时更新一次)\s*[:：]?\s*(.+)$/i);
    const sourceMatch = raw.match(/^(source|规则源)\s*[:：]\s*(.+)$/i);

    if (titleMatch) {
      metadata.title = titleMatch[2].trim();
      continue;
    }

    if (descriptionMatch && !metadata.description) {
      metadata.description = descriptionMatch[2].trim();
    }

    if (versionMatch && !metadata.version) {
      metadata.version = versionMatch[1].trim();
    }

    if (updatedMatch && !metadata.updatedAtText) {
      metadata.updatedAtText = updatedMatch[1].trim();
    }

    if (intervalMatch && !metadata.updateIntervalText) {
      metadata.updateIntervalText = (intervalMatch[2] || "").trim();
    }

    if (!metadata.updateIntervalText) {
      const intervalHint = raw.match(/每\s*\d+\s*个?\s*小时更新一次/);
      if (intervalHint) {
        metadata.updateIntervalText = intervalHint[0];
      }
    }

    if (sourceMatch && !metadata.sourceSummary) {
      metadata.sourceSummary = sourceMatch[2].trim();
    }

    if (!metadata.description && sourceMatch) {
      metadata.description = raw.split(/(?:source|规则源)\s*[:：]/i)[0].trim().replace(/[。,.，;；]+$/g, "");
    }
  }

  if (!metadata.title) {
    const firstContentLine = lines.find((line) => {
      const raw = line.replace(/^[!#]+\s*/, "").trim();
      return raw && !/^[|@[\]]/.test(raw) && !raw.includes("：") && !raw.includes(":") && !/[|^*#]/.test(raw);
    });

    if (firstContentLine) {
      metadata.title = firstContentLine.replace(/^[!#]+\s*/, "").trim().slice(0, 120);
    }
  }

  if (!metadata.sourceSummary) {
    const sourceLine = lines.find((line) => /^(source|规则源)\s*[:：]/i.test(line.replace(/^[!#]+\s*/, "").trim()));
    if (sourceLine) {
      const sourceMatch = sourceLine.replace(/^[!#]+\s*/, "").match(/^(source|规则源)\s*[:：]\s*(.+)$/i);
      metadata.sourceSummary = sourceMatch ? sourceMatch[2].trim() : "";
    }
  }

  return metadata;
}

function buildBlockRule(filter, index) {
  const normalized = String(filter || "").trim();
  if (!normalized) {
    return null;
  }

  let action = "block";
  let body = normalized;
  if (body.startsWith("@@")) {
    action = "allow";
    body = body.slice(2);
  }

  const optionSplit = body.split("$");
  body = optionSplit[0].trim();
  if (!body) {
    return null;
  }

  if (body.startsWith("/") && body.endsWith("/")) {
    return null;
  }

  const modifiers = parseRuleModifiers(optionSplit.slice(1).join("$"));
  if (modifiers.cosmeticOnly || modifiers.badFilter || modifiers.unsupportedAction) {
    return null;
  }

  const hostsLine = body.match(/^(?:0\.0\.0\.0|127\.0\.0\.1|::1)\s+([a-z0-9.-]+)(?:\s+#.*)?$/i);
  if (hostsLine) {
    body = `||${hostsLine[1]}^`;
  }

  let urlFilter = "";
  if (body.startsWith("||") && body.includes("^")) {
    urlFilter = body;
  } else if (body.startsWith("|http://") || body.startsWith("|https://")) {
    urlFilter = body;
  } else if (body.includes("*") || body.startsWith("http://") || body.startsWith("https://")) {
    urlFilter = body.replace(/\^/g, "");
  } else {
    const host = body.replace(/^\|\|/, "").replace(/\^$/, "");
    if (/^[a-z0-9.-]+$/i.test(host)) {
      urlFilter = `||${host}^`;
    }
  }

  urlFilter = sanitizeUrlFilter(urlFilter);
  if (!urlFilter) {
    return null;
  }

  let resourceTypes = modifiers.resourceTypes || REQUEST_RESOURCE_TYPES;
  if (action === "block") {
    resourceTypes = resourceTypes.filter((type) => type !== "main_frame");
  }
  if (!resourceTypes.length || (action !== "block" && modifiers.removeParams.length)) {
    return null;
  }

  const actionType = modifiers.removeParams.length ? "redirect" : action;
  const condition = {
    urlFilter,
    resourceTypes,
    domainType: modifiers.domainType
  };

  if (modifiers.initiatorDomains?.length) {
    condition.initiatorDomains = modifiers.initiatorDomains;
  }

  if (modifiers.excludedInitiatorDomains?.length) {
    condition.excludedInitiatorDomains = modifiers.excludedInitiatorDomains;
  }

  if (modifiers.requestDomains?.length) {
    condition.requestDomains = modifiers.requestDomains;
  }

  if (modifiers.excludedRequestDomains?.length) {
    condition.excludedRequestDomains = modifiers.excludedRequestDomains;
  }

  const rule = {
    id: index,
    priority: action === "allow" || modifiers.important ? 2000 : 1000,
    action: {
      type: actionType
    },
    condition
  };

  if (!condition.domainType) {
    delete condition.domainType;
  }

  if (modifiers.removeParams.length) {
    rule.action.redirect = {
      transform: {
        removeParams: modifiers.removeParams
      }
    };
  }

  return rule;
}

function parseRuleModifiers(rawOptions) {
  const tokens = String(rawOptions || "")
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  const resourceTypeMap = {
    document: ["main_frame", "sub_frame"],
    subdocument: ["sub_frame"],
    script: ["script"],
    image: ["image"],
    stylesheet: ["stylesheet"],
    xmlhttprequest: ["xmlhttprequest"],
    xhr: ["xmlhttprequest"],
    font: ["font"],
    media: ["media"],
    object: ["object"],
    ping: ["ping"],
    websocket: ["websocket"],
    other: ["other"]
  };
  const positiveTypes = new Set();
  const negativeTypes = new Set();
  const initiatorDomains = [];
  const excludedInitiatorDomains = [];
  const requestDomains = [];
  const excludedRequestDomains = [];
  const removeParams = [];
  let domainType = "";
  let allTypes = false;
  let important = false;
  let cosmeticOnly = false;
  let badFilter = false;
  let unsupportedAction = false;
  const unsupportedActionModifiers = new Set([
    "csp",
    "csp-report-only",
    "cookie",
    "header",
    "jsonprune",
    "permissionset",
    "redirect",
    "redirect-rule",
    "removeheader",
    "replace",
    "set-constant",
    "trusted-replace"
  ]);

  for (const token of tokens) {
    if (token === "all") {
      allTypes = true;
      continue;
    }

    if (token === "third-party" || token === "strict-third-party") {
      domainType = "thirdParty";
      continue;
    }

    if (token === "~third-party" || token === "~strict-third-party") {
      domainType = "firstParty";
      continue;
    }

    if (token === "important") {
      important = true;
      continue;
    }

    if (token === "badfilter") {
      badFilter = true;
      continue;
    }

    if (["elemhide", "generichide", "specifichide", "jsinject", "urlblock", "genericblock"].includes(token)) {
      cosmeticOnly = true;
      continue;
    }

    if (token === "popup") {
      positiveTypes.add("sub_frame");
      continue;
    }

    const typeToken = token.startsWith("~") ? token.slice(1) : token;
    if (resourceTypeMap[typeToken]) {
      const target = token.startsWith("~") ? negativeTypes : positiveTypes;
      for (const resourceType of resourceTypeMap[typeToken]) {
        target.add(resourceType);
      }
      continue;
    }

    const [modifierName, rawValue = ""] = token.split("=");
    if (modifierName === "domain") {
      addDomainValues(rawValue, initiatorDomains, excludedInitiatorDomains);
      continue;
    }

    if (modifierName === "to") {
      addDomainValues(rawValue, requestDomains, excludedRequestDomains);
      continue;
    }

    if (modifierName === "denyallow") {
      for (const value of rawValue.split("|")) {
        const hostname = normalizeHostname(value);
        if (hostname) {
          excludedRequestDomains.push(hostname);
        }
      }
      continue;
    }

    if (modifierName === "removeparam" && rawValue && !rawValue.startsWith("/")) {
      if (/^[a-z0-9_-]+$/i.test(rawValue)) {
        removeParams.push(rawValue);
      }
      continue;
    }

    if (modifierName === "removeparam") {
      unsupportedAction = true;
      continue;
    }

    if (unsupportedActionModifiers.has(modifierName)) {
      unsupportedAction = true;
      continue;
    }

    unsupportedAction = true;
  }

  let resourceTypes = null;
  if (allTypes) {
    resourceTypes = REQUEST_RESOURCE_TYPES;
  } else if (positiveTypes.size) {
    resourceTypes = Array.from(positiveTypes);
  } else if (negativeTypes.size) {
    resourceTypes = REQUEST_RESOURCE_TYPES.filter((type) => !negativeTypes.has(type));
  }

  return {
    resourceTypes,
    domainType,
    initiatorDomains,
    excludedInitiatorDomains,
    requestDomains,
    excludedRequestDomains,
    removeParams: Array.from(new Set(removeParams)),
    important,
    cosmeticOnly,
    badFilter,
    unsupportedAction
  };
}

function addDomainValues(rawValue, positive, negative) {
  for (const value of String(rawValue || "").split("|")) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }

    const isNegative = trimmed.startsWith("~");
    const hostname = normalizeHostname(isNegative ? trimmed.slice(1) : trimmed);
    if (!hostname) {
      continue;
    }

    (isNegative ? negative : positive).push(hostname);
  }
}

function sanitizeUrlFilter(urlFilter) {
  const value = String(urlFilter || "").trim();
  if (!value) {
    return "";
  }

  if (/\s/.test(value)) {
    return "";
  }

  if (value.length > 2048 || /[$\\[\]{}()]/.test(value)) {
    return "";
  }

  if (!/^(\|\||\|)?[a-z0-9*._~:/?&=%^|-]+$/i.test(value)) {
    return "";
  }

  return value;
}

function looksLikeHtmlPage(text) {
  const normalized = String(text || "").trimStart().slice(0, 200).toLowerCase();
  return normalized.startsWith("<!doctype html") || normalized.startsWith("<html") || normalized.includes("<body");
}

function formatSubscriptionLoadError(error) {
  if (error?.name === "AbortError") {
    return t("background.timeout");
  }

  const message = String(error?.message || error || "").trim();
  if (!message) {
    return t("background.failed");
  }

  if (/abort/i.test(message)) {
    return t("background.timeout");
  }

  if (/failed to fetch/i.test(message)) {
    return t("background.blocked");
  }

  return message.length > 120 ? `${message.slice(0, 117)}...` : message;
}

function mergeHideRules(target, source) {
  if (!source || typeof source !== "object") {
    return;
  }

  for (const [hostname, selectors] of Object.entries(source)) {
    if (!Array.isArray(selectors)) {
      continue;
    }

    if (!target[hostname]) {
      target[hostname] = [];
    }

    for (const selector of selectors) {
      if (!target[hostname].includes(selector)) {
        target[hostname].push(selector);
      }
    }
  }
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

function normalizeSubscriptionUrl(source) {
  const raw = String(source || "").trim();
  if (!raw) {
    return "";
  }

  try {
    const url = new URL(raw);
    return /^https?:$/.test(url.protocol) ? url.toString() : "";
  } catch {
    if (/^[a-z0-9.-]+\.[a-z]{2,}(?:[/?#].*)?$/i.test(raw)) {
      return `https://${raw}`;
    }

    return "";
  }
}

function isUnsafeSubscriptionHost(sourceUrl) {
  let hostname = "";
  try {
    hostname = new URL(sourceUrl).hostname.toLowerCase();
  } catch {
    return true;
  }

  if (!hostname) {
    return true;
  }

  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    return true;
  }

  if (hostname === "localhost.localdomain" || hostname.endsWith(".internal")) {
    return true;
  }

  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    const parts = hostname.split(".").map(Number);
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) {
      return true;
    }
    const [a, b] = parts;
    if (a === 0) return true;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a === 203 && b === 0 && parts[2] === 113) return true;
    if (a >= 224) return true;
  }

  if (hostname.includes(":")) {
    const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
    if (normalized.startsWith("::1") || normalized === "::") return true;
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
    if (normalized.startsWith("fe80")) return true;
    if (normalized.startsWith("ff")) return true;
  }

  return false;
}

function reportSyncError(error) {
  console.error("Failed to sync Ad Cleaner rules:", error);
}

function reportBadgeError(error) {
  console.warn("Failed to update Ad Cleaner badge:", error);
}
