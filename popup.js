const STORAGE_KEY = "adCleanerEnabled";
const BUILTIN_FILTERING_KEY = "adCleanerBuiltinFilteringEnabled";
const SITE_RULES_KEY = "adCleanerSiteRules";
const DYNAMIC_RULE_STATS_KEY = "adCleanerDynamicRuleStats";
const i18n = globalThis.AdCleanerI18n;
const theme = globalThis.AdCleanerTheme;
const t = (key, values) => i18n.t(key, values);

const elements = {
  status: document.getElementById("pageStatus"),
  count: document.getElementById("markedCount"),
  profileStatus: document.getElementById("profileStatus"),
  heuristicCount: document.getElementById("heuristicCount"),
  customHits: document.getElementById("customHits"),
  subscriptionHits: document.getElementById("subscriptionHits"),
  restoredCount: document.getElementById("restoredCount"),
  syncStatus: document.getElementById("syncStatus"),
  networkMatches: document.getElementById("networkMatches"),
  toggle: document.getElementById("enabledToggle"),
  builtinToggle: document.getElementById("builtinToggle"),
  scanBtn: document.getElementById("scanBtn"),
  cleanBtn: document.getElementById("cleanBtn"),
  restoreBtn: document.getElementById("restoreBtn"),
  panelBtn: document.getElementById("panelBtn"),
  pickBtn: document.getElementById("pickBtn"),
  siteHost: document.getElementById("siteHost"),
  siteMode: document.getElementById("siteMode"),
  filterMode: document.getElementById("filterMode"),
  allowSiteBtn: document.getElementById("allowSiteBtn"),
  blockSiteBtn: document.getElementById("blockSiteBtn"),
  clearSiteBtn: document.getElementById("clearSiteBtn"),
  openOptionsBtn: document.getElementById("openOptionsBtn")
};

let siteRules = {};
let builtinFilteringEnabled = true;
let dynamicRuleStats = {};
let currentHostname = "";
let lastStatusResponse = null;

init().catch((error) => {
  elements.status.textContent = t("status.loadFailed", { error: error.message });
});

async function init() {
  await i18n.ready();
  await theme?.ready();
  i18n.bindLanguageSwitchers(document);
  theme?.bindThemeToggles(document, t);
  i18n.apply(document);
  i18n.onChange(() => {
    i18n.apply(document);
    theme?.renderThemeToggles(document, t);
    renderSiteStatus();
    renderFilterMode();
    renderSyncStatus();
    renderStatus(lastStatusResponse);
    refreshStatus();
    refreshRuleMatches();
  });
  const settings = await getStorage();
  const {
    [STORAGE_KEY]: enabled = true,
    [BUILTIN_FILTERING_KEY]: builtinEnabled = true,
    [SITE_RULES_KEY]: savedRules = {},
    [DYNAMIC_RULE_STATS_KEY]: savedDynamicStats = {}
  } = settings;
  siteRules = normalizeSiteRules(savedRules);
  builtinFilteringEnabled = builtinEnabled !== false;
  dynamicRuleStats = normalizeDynamicRuleStats(savedDynamicStats);
  elements.toggle.checked = enabled;
  elements.builtinToggle.checked = builtinFilteringEnabled;
  currentHostname = await getActiveHostname();
  renderFilterMode();

  elements.toggle.addEventListener("change", onToggle);
  elements.builtinToggle.addEventListener("change", onBuiltinToggle);
  elements.scanBtn.addEventListener("click", () => sendToActiveTab({ type: "SCAN" }));
  elements.cleanBtn.addEventListener("click", () => sendToActiveTab({ type: "CLEAN" }));
  elements.restoreBtn.addEventListener("click", () => sendToActiveTab({ type: "RESTORE" }));
  elements.panelBtn.addEventListener("click", () => sendToActiveTab({ type: "SHOW_RECOVERY_PANEL" }));
  elements.pickBtn.addEventListener("click", () => startElementPicker());
  elements.allowSiteBtn.addEventListener("click", () => setCurrentSiteRule("allow"));
  elements.blockSiteBtn.addEventListener("click", () => setCurrentSiteRule("block"));
  elements.clearSiteBtn.addEventListener("click", () => setCurrentSiteRule(null));
  elements.openOptionsBtn.addEventListener("click", () => chrome.runtime.openOptionsPage());

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }

    if (changes[SITE_RULES_KEY]) {
      siteRules = normalizeSiteRules(changes[SITE_RULES_KEY].newValue);
      renderSiteStatus();
    }

    if (changes[BUILTIN_FILTERING_KEY]) {
      builtinFilteringEnabled = changes[BUILTIN_FILTERING_KEY].newValue !== false;
      elements.builtinToggle.checked = builtinFilteringEnabled;
      renderFilterMode();
    }

    if (changes[DYNAMIC_RULE_STATS_KEY]) {
      dynamicRuleStats = normalizeDynamicRuleStats(changes[DYNAMIC_RULE_STATS_KEY].newValue);
      renderSyncStatus();
    }

    if (changes[STORAGE_KEY]) {
      elements.toggle.checked = Boolean(changes[STORAGE_KEY].newValue);
      renderStatus({
        ok: true,
        enabled: Boolean(changes[STORAGE_KEY].newValue),
        markedCount: Number(elements.count.textContent) || 0,
        builtinFilteringEnabled
      });
    }
  });

  await refreshStatus();
  await refreshRuleMatches();
}

function getStorage() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get({
      [STORAGE_KEY]: true,
      [BUILTIN_FILTERING_KEY]: true,
      [SITE_RULES_KEY]: {},
      [DYNAMIC_RULE_STATS_KEY]: {}
    }, (items) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(err);
        return;
      }
      resolve(items);
    });
  });
}

function setStorage(value) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEY]: value }, () => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

function setBuiltinFiltering(value) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [BUILTIN_FILTERING_KEY]: value }, () => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

function saveSiteRules(nextRules) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [SITE_RULES_KEY]: nextRules }, () => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

async function onToggle(event) {
  const nextValue = event.target.checked;
  await setStorage(nextValue);
  const response = await sendToActiveTab({ type: "SET_ENABLED", enabled: nextValue });
  if (response?.ok) {
    renderStatus(response);
  }
}

async function onBuiltinToggle(event) {
  builtinFilteringEnabled = event.target.checked;
  await setBuiltinFiltering(builtinFilteringEnabled);
  renderFilterMode();
  const response = await sendToActiveTab({ type: "GET_STATUS" });
  if (response?.ok) {
    renderStatus(response);
  }
}

async function startElementPicker() {
  const response = await sendToActiveTab({ type: "START_ELEMENT_PICKER" });
  if (response?.ok) {
    elements.status.textContent = response.active ? t("content.pickerAlready") : t("status.unsupported");
  }
}

async function refreshStatus() {
  currentHostname = await getActiveHostname();
  renderSiteStatus();
  const response = await sendToActiveTab({ type: "GET_STATUS" });
  renderStatus(response);
}

async function refreshRuleMatches() {
  if (!elements.networkMatches) {
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    renderRuleMatches({ ok: false });
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_RULE_MATCHES", tabId: tab.id });
    renderRuleMatches(response);
  } catch {
    renderRuleMatches({ ok: false });
  }
}

function renderRuleMatches(response) {
  if (!elements.networkMatches) {
    return;
  }

  if (!response?.ok) {
    elements.networkMatches.textContent = t("status.unavailableShort");
    return;
  }

  const total = Number(response.total || 0);
  const subscription = Number(response.subscription || 0);
  const builtin = Number(response.builtin || 0);
  elements.networkMatches.textContent = response.source === "page"
    ? t("status.pageElements", { count: total })
    : t("status.networkMatches", { count: total, subscription, builtin });
}

function renderStatus(response) {
  lastStatusResponse = response || null;
  if (!response || response.ok === false) {
    elements.status.textContent = t("status.unavailable");
    elements.count.textContent = "0";
    renderPageMetrics({
      pageProfile: t("content.unavailable"),
      heuristicMarkedCount: 0,
      customSelectorMarkedCount: 0,
      subscriptionMarkedCount: 0,
      restoredCount: 0
    });
    return;
  }

  elements.status.textContent = response.enabled ? t("status.enabled") : t("status.disabled");
  elements.count.textContent = String(response.markedCount ?? 0);
  elements.toggle.checked = Boolean(response.enabled);
  if (typeof response.builtinFilteringEnabled === "boolean") {
    builtinFilteringEnabled = response.builtinFilteringEnabled;
  }
  renderFilterMode();
  renderPageMetrics(response);
  renderSyncStatus();
}

function renderSiteStatus() {
  if (!currentHostname) {
    elements.siteHost.textContent = t("status.unidentified");
    elements.siteMode.textContent = t("status.addressOnly");
    return;
  }

  const mode = siteRules[currentHostname] || "default";
  elements.siteHost.textContent = currentHostname;
  elements.siteMode.textContent = mode === "allow"
    ? t("status.allowSite")
    : mode === "block"
      ? t("status.blockSite")
      : t("status.followGlobal");
}

function renderFilterMode() {
  if (!elements.filterMode) {
    return;
  }

  elements.filterMode.textContent = builtinFilteringEnabled
    ? t("popup.enabled")
    : t("status.builtinOnly");
}

function renderSyncStatus() {
  if (!elements.syncStatus) {
    return;
  }

  const skipped = Number(dynamicRuleStats?.skipped || 0);
  const added = Number(dynamicRuleStats?.added || 0);
  const failed = Number(dynamicRuleStats?.errorSubscriptionCount || 0);
  elements.syncStatus.textContent = t("status.popupSyncSummary", { added, skipped, failed });
}

function renderPageMetrics(response) {
  if (elements.profileStatus) {
    elements.profileStatus.textContent = response?.pageProfile || t("popup.standardMode");
  }

  if (elements.heuristicCount) {
    elements.heuristicCount.textContent = String(response?.heuristicMarkedCount ?? 0);
  }

  if (elements.customHits) {
    elements.customHits.textContent = String(response?.customSelectorMarkedCount ?? 0);
  }

  if (elements.subscriptionHits) {
    elements.subscriptionHits.textContent = String(response?.subscriptionMarkedCount ?? 0);
  }

  if (elements.restoredCount) {
    elements.restoredCount.textContent = String(response?.restoredCount ?? 0);
  }
}

async function sendToActiveTab(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    elements.status.textContent = t("status.noTabs");
    return null;
  }

  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch (error) {
    elements.status.textContent = t("status.unsupported");
    return null;
  }
}

async function setCurrentSiteRule(mode) {
  if (!currentHostname) {
    return;
  }

  const nextRules = { ...siteRules };
  if (mode === "allow" || mode === "block") {
    nextRules[currentHostname] = mode;
  } else {
    delete nextRules[currentHostname];
  }

  await saveSiteRules(nextRules);
  siteRules = normalizeSiteRules(nextRules);
  renderSiteStatus();
  await sendToActiveTab({ type: "SET_SITE_MODE", mode });
}

async function getActiveHostname() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) {
    return "";
  }

  return normalizeHostname(tab.url);
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

function normalizeDynamicRuleStats(value) {
  if (!value || typeof value !== "object") {
    return {};
  }

  return {
    desired: Number(value.desired || 0),
    added: Number(value.added || 0),
    skipped: Number(value.skipped || 0),
    truncatedRuleCount: Number(value.truncatedRuleCount || 0),
    errorSubscriptionCount: Number(value.errorSubscriptionCount || 0)
  };
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
