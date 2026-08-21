const STORAGE_KEYS = {
  enabled: "adCleanerEnabled",
  builtinFiltering: "adCleanerBuiltinFilteringEnabled",
  siteRules: "adCleanerSiteRules",
  customHideRules: "adCleanerCustomElementHideRules",
  subscriptions: "adCleanerSubscriptions",
  subscriptionStats: "adCleanerSubscriptionStats",
  dynamicRuleStats: "adCleanerDynamicRuleStats"
};

const i18n = globalThis.AdCleanerI18n;
const theme = globalThis.AdCleanerTheme;
const t = (key, values) => i18n.t(key, values);

const elements = {
  globalToggle: document.getElementById("globalToggle"),
  builtinToggle: document.getElementById("builtinToggle"),
  currentSiteTitle: document.getElementById("currentSiteTitle"),
  currentMode: document.getElementById("currentMode"),
  allowCurrentBtn: document.getElementById("allowCurrentBtn"),
  blockCurrentBtn: document.getElementById("blockCurrentBtn"),
  clearCurrentBtn: document.getElementById("clearCurrentBtn"),
  refreshBtn: document.getElementById("refreshBtn"),
  hostnameInput: document.getElementById("hostnameInput"),
  modeSelect: document.getElementById("modeSelect"),
  addRuleBtn: document.getElementById("addRuleBtn"),
  rulesList: document.getElementById("rulesList"),
  ruleCount: document.getElementById("ruleCount"),
  selectorCount: document.getElementById("selectorCount"),
  selectorInput: document.getElementById("selectorInput"),
  addSelectorBtn: document.getElementById("addSelectorBtn"),
  siteSelectorsList: document.getElementById("siteSelectorsList"),
  subscriptionCount: document.getElementById("subscriptionCount"),
  subscriptionNameInput: document.getElementById("subscriptionNameInput"),
  subscriptionSourceInput: document.getElementById("subscriptionSourceInput"),
  addSubscriptionBtn: document.getElementById("addSubscriptionBtn"),
  syncSubscriptionsBtn: document.getElementById("syncSubscriptionsBtn"),
  clearSubscriptionsBtn: document.getElementById("clearSubscriptionsBtn"),
  subscriptionsList: document.getElementById("subscriptionsList"),
  subscriptionSummary: document.getElementById("subscriptionSummary"),
  dynamicRuleSummary: document.getElementById("dynamicRuleSummary"),
  dynamicRuleCounts: document.getElementById("dynamicRuleCounts"),
  subscriptionSyncCounts: document.getElementById("subscriptionSyncCounts"),
  dynamicSkippedRules: document.getElementById("dynamicSkippedRules"),
  dynamicFailedSubscriptions: document.getElementById("dynamicFailedSubscriptions"),
  dynamicRuleDetail: document.getElementById("dynamicRuleDetail"),
  settingsStatus: document.getElementById("settingsStatus"),
  exportBtn: document.getElementById("exportBtn"),
  importBtn: document.getElementById("importBtn"),
  clearAllBtn: document.getElementById("clearAllBtn"),
  importInput: document.getElementById("importInput")
};

let enabled = true;
let builtinFilteringEnabled = true;
let siteRules = {};
let customHideRules = {};
let subscriptions = [];
let subscriptionStats = {};
let dynamicRuleStats = {};
let currentHostname = "";

init().catch((error) => {
  setSettingsStatus(t("status.loadFailed", { error: error.message }));
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
    renderAll();
  });
  const settings = await loadSettings();
  enabled = settings.enabled;
  builtinFilteringEnabled = settings.builtinFilteringEnabled;
  siteRules = settings.siteRules;
  customHideRules = settings.customHideRules;
  subscriptions = settings.subscriptions;
  subscriptionStats = settings.subscriptionStats;
  dynamicRuleStats = settings.dynamicRuleStats;
  elements.globalToggle.checked = enabled;
  elements.builtinToggle.checked = builtinFilteringEnabled;

  currentHostname = await getActiveHostname();
  renderAll();

  elements.globalToggle.addEventListener("change", onGlobalToggle);
  elements.builtinToggle.addEventListener("change", onBuiltinToggle);
  elements.allowCurrentBtn.addEventListener("click", () => setCurrentSiteRule("allow"));
  elements.blockCurrentBtn.addEventListener("click", () => setCurrentSiteRule("block"));
  elements.clearCurrentBtn.addEventListener("click", () => setCurrentSiteRule(null));
  elements.refreshBtn.addEventListener("click", async () => {
    currentHostname = await getActiveHostname();
    renderCurrentSite();
    renderSelectors();
  });
  elements.addRuleBtn.addEventListener("click", addRuleFromForm);
  elements.addSelectorBtn.addEventListener("click", addSelectorFromForm);
  elements.addSubscriptionBtn.addEventListener("click", addSubscriptionFromForm);
  elements.syncSubscriptionsBtn.addEventListener("click", syncSubscriptionsNow);
  elements.clearSubscriptionsBtn.addEventListener("click", clearSubscriptions);
  elements.exportBtn.addEventListener("click", exportRules);
  elements.importBtn.addEventListener("click", () => elements.importInput.click());
  elements.clearAllBtn.addEventListener("click", clearAllRules);
  elements.importInput.addEventListener("change", importRulesFromFile);

  elements.hostnameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addRuleFromForm();
    }
  });

  elements.selectorInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addSelectorFromForm();
    }
  });

  elements.subscriptionSourceInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.metaKey) {
      event.preventDefault();
      addSubscriptionFromForm();
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }

    if (changes[STORAGE_KEYS.enabled]) {
      enabled = Boolean(changes[STORAGE_KEYS.enabled].newValue);
      elements.globalToggle.checked = enabled;
      renderCurrentSite();
    }

    if (changes[STORAGE_KEYS.builtinFiltering]) {
      builtinFilteringEnabled = changes[STORAGE_KEYS.builtinFiltering].newValue !== false;
      elements.builtinToggle.checked = builtinFilteringEnabled;
      setSettingsStatus(
        builtinFilteringEnabled ? t("status.enabled") : t("status.builtinDisabled")
      );
    }

    if (changes[STORAGE_KEYS.siteRules]) {
      siteRules = normalizeSiteRules(changes[STORAGE_KEYS.siteRules].newValue);
      renderCurrentSite();
      renderRules();
    }

    if (changes[STORAGE_KEYS.customHideRules]) {
      customHideRules = normalizeHideRules(changes[STORAGE_KEYS.customHideRules].newValue);
      renderSelectors();
    }

    if (changes[STORAGE_KEYS.subscriptions]) {
      subscriptions = normalizeSubscriptions(changes[STORAGE_KEYS.subscriptions].newValue);
      renderSubscriptions();
    }

    if (changes[STORAGE_KEYS.subscriptionStats]) {
      subscriptionStats = normalizeSubscriptionStats(changes[STORAGE_KEYS.subscriptionStats].newValue);
      renderSubscriptions();
    }

    if (changes[STORAGE_KEYS.dynamicRuleStats]) {
      dynamicRuleStats = normalizeDynamicRuleStats(changes[STORAGE_KEYS.dynamicRuleStats].newValue);
      renderSyncStats();
    }
  });
}

function renderAll() {
  renderCurrentSite();
  renderRules();
  renderSelectors();
  renderSubscriptions();
  renderSyncStats();
}

function loadSettings() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get({
      [STORAGE_KEYS.enabled]: true,
      [STORAGE_KEYS.builtinFiltering]: true,
      [STORAGE_KEYS.siteRules]: {},
      [STORAGE_KEYS.customHideRules]: {},
      [STORAGE_KEYS.subscriptions]: [],
      [STORAGE_KEYS.subscriptionStats]: {},
      [STORAGE_KEYS.dynamicRuleStats]: {}
    }, (items) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(error);
        return;
      }

      resolve({
        enabled: Boolean(items[STORAGE_KEYS.enabled]),
        builtinFilteringEnabled: items[STORAGE_KEYS.builtinFiltering] !== false,
        siteRules: normalizeSiteRules(items[STORAGE_KEYS.siteRules]),
        customHideRules: normalizeHideRules(items[STORAGE_KEYS.customHideRules]),
        subscriptions: normalizeSubscriptions(items[STORAGE_KEYS.subscriptions]),
        subscriptionStats: normalizeSubscriptionStats(items[STORAGE_KEYS.subscriptionStats]),
        dynamicRuleStats: normalizeDynamicRuleStats(items[STORAGE_KEYS.dynamicRuleStats])
      });
    });
  });
}

function saveSettings(patch) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(patch, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function onGlobalToggle(event) {
  enabled = event.target.checked;
  await saveSettings({ [STORAGE_KEYS.enabled]: enabled });
  setSettingsStatus(enabled ? t("status.enabled") : t("status.disabled"));
}

async function onBuiltinToggle(event) {
  builtinFilteringEnabled = event.target.checked;
  await saveSettings({ [STORAGE_KEYS.builtinFiltering]: builtinFilteringEnabled });
  setSettingsStatus(
    builtinFilteringEnabled
      ? t("status.enabled")
      : t("status.builtinOnly")
  );
  await syncSubscriptionsNow();
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

  siteRules = normalizeSiteRules(nextRules);
  await saveSettings({ [STORAGE_KEYS.siteRules]: siteRules });
  renderCurrentSite();
  renderRules();
  setSettingsStatus(mode ? `${t("options.allowSite")} ${currentHostname}` : `${t("options.clearRule")} ${currentHostname}`);
}

async function addRuleFromForm() {
  const hostname = normalizeHostname(elements.hostnameInput.value);
  const mode = elements.modeSelect.value === "block" ? "block" : "allow";

  if (!hostname) {
    setSettingsStatus(t("status.invalidHostname"));
    return;
  }

  const nextRules = { ...siteRules, [hostname]: mode };
  siteRules = normalizeSiteRules(nextRules);
  await saveSettings({ [STORAGE_KEYS.siteRules]: siteRules });
  elements.hostnameInput.value = "";
  elements.hostnameInput.focus();
  renderCurrentSite();
  renderRules();
  setSettingsStatus(`${t("status.add")} ${hostname}`);
}

async function addSelectorFromForm() {
  if (!currentHostname) {
    setSettingsStatus(t("status.unidentified"));
    return;
  }

  const rawInputs = String(elements.selectorInput.value || "")
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (!rawInputs.length) {
    setSettingsStatus(t("status.emptySelector"));
    return;
  }

  const validSelectors = [];
  const invalidSelectors = [];
  for (const selector of rawInputs) {
    if (isSafeCosmeticSelector(selector)) {
      try {
        document.createElement("div").querySelector?.(selector);
        validSelectors.push(selector);
      } catch {
        invalidSelectors.push(selector);
      }
    } else {
      invalidSelectors.push(selector);
    }
  }

  if (!validSelectors.length) {
    setSettingsStatus(invalidSelectors.length
      ? t("status.invalidSelector", { selector: invalidSelectors[0].slice(0, 32) })
      : t("status.emptySelector"));
    return;
  }

  const nextRules = { ...customHideRules };
  const current = new Set(nextRules[currentHostname] || []);
  for (const selector of validSelectors) {
    current.add(selector);
  }

  nextRules[currentHostname] = Array.from(current);
  customHideRules = normalizeHideRules(nextRules);
  await saveSettings({ [STORAGE_KEYS.customHideRules]: customHideRules });
  elements.selectorInput.value = "";
  renderSelectors();
  setSettingsStatus(invalidSelectors.length
    ? t("status.selectorsAdded", { valid: validSelectors.length, invalid: invalidSelectors.length })
    : t("status.selectorAdded", { count: validSelectors.length }));
}

async function addSubscriptionFromForm() {
  const source = String(elements.subscriptionSourceInput.value || "").trim();
  if (!source) {
    setSettingsStatus(t("status.subscriptionInput"));
    return;
  }

  const metadata = sourceTypeIsText(source) ? parseSubscriptionMetadataText(source) : null;
  const name = String(elements.subscriptionNameInput.value || "").trim() || metadata?.title || deriveSubscriptionName(source);
  const sourceType = sourceLooksLikeUrl(source) ? "url" : "text";
  const nextItem = {
    id: createId(),
    name,
    sourceType,
    source,
    enabled: true,
    title: metadata?.title || "",
    description: metadata?.description || "",
    version: metadata?.version || "",
    updatedAtText: metadata?.updatedAtText || "",
    updateIntervalText: metadata?.updateIntervalText || "",
    sourceSummary: metadata?.sourceSummary || ""
  };

  subscriptions = normalizeSubscriptions([...subscriptions, nextItem]);
  await saveSettings({ [STORAGE_KEYS.subscriptions]: subscriptions });
  elements.subscriptionNameInput.value = "";
  elements.subscriptionSourceInput.value = "";
  renderSubscriptions();
  setSettingsStatus(t("status.subscriptionAdded", { name }));
  await syncSubscriptionsNow();
}

async function toggleSubscription(id, nextEnabled) {
  const next = subscriptions.map((item) => (item.id === id ? { ...item, enabled: nextEnabled } : item));
  subscriptions = normalizeSubscriptions(next);
  await saveSettings({ [STORAGE_KEYS.subscriptions]: subscriptions });
  renderSubscriptions();
  setSettingsStatus(nextEnabled ? t("status.subscriptionEnabled") : t("status.subscriptionDisabled"));
  await syncSubscriptionsNow();
}

async function removeSubscription(id) {
  subscriptions = subscriptions.filter((item) => item.id !== id);
  await saveSettings({ [STORAGE_KEYS.subscriptions]: subscriptions });
  renderSubscriptions();
  setSettingsStatus(t("status.subscriptionRemoved"));
  await syncSubscriptionsNow();
}

async function syncSubscriptionsNow() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "SYNC_RULES" });
    if (response?.ok && response.stats) {
      subscriptionStats = normalizeSubscriptionStats(response.stats);
      dynamicRuleStats = normalizeDynamicRuleStats(response.dynamicRuleStats);
      await saveSettings({ [STORAGE_KEYS.subscriptionStats]: subscriptionStats });
      await saveSettings({ [STORAGE_KEYS.dynamicRuleStats]: dynamicRuleStats });
      renderSubscriptions();
      renderSyncStats();
      setSettingsStatus(t("status.syncSuccess"));
      return;
    }

    setSettingsStatus(t("status.syncGeneric"));
  } catch {
    setSettingsStatus(t("status.syncFailed"));
  }
}

async function clearSubscriptions() {
  if (!confirm(t("status.confirmClearSubscriptions"))) {
    return;
  }

  subscriptions = [];
  subscriptionStats = {};
  dynamicRuleStats = {};
  await saveSettings({ [STORAGE_KEYS.subscriptions]: subscriptions });
  await saveSettings({ [STORAGE_KEYS.subscriptionStats]: subscriptionStats });
  await saveSettings({ [STORAGE_KEYS.dynamicRuleStats]: dynamicRuleStats });
  renderSubscriptions();
  renderSyncStats();
  setSettingsStatus(t("status.subscriptionsCleared"));
  await syncSubscriptionsNow();
}

function renderCurrentSite() {
  if (!currentHostname) {
    elements.currentSiteTitle.textContent = t("status.currentSiteMissing");
    elements.currentMode.textContent = t("status.none");
    return;
  }

  const mode = siteRules[currentHostname] || "default";
  elements.currentSiteTitle.textContent = currentHostname;
  elements.currentMode.textContent = mode === "default" ? t("status.default") : mode === "allow" ? t("options.allow") : t("options.block");
  elements.currentMode.className = `badge ${mode}`;
}

function renderRules() {
  const entries = Object.entries(siteRules).sort(([a], [b]) => a.localeCompare(b));
  elements.ruleCount.textContent = t("status.count", { count: entries.length });

  if (!entries.length) {
    elements.rulesList.innerHTML = `
      <div class="rule-row">
        <div class="rule-meta">
          <div class="rule-host">${escapeHtml(t("status.noRule"))}</div>
          <div class="rule-sub">${escapeHtml(t("status.addSiteRuleHelp"))}</div>
        </div>
      </div>
    `;
    return;
  }

  elements.rulesList.innerHTML = entries
    .map(([hostname, mode]) => {
      const label = mode === "allow" ? t("options.allow") : t("options.block");
      return `
        <div class="rule-row">
          <div class="rule-meta">
            <div class="rule-host">${escapeHtml(hostname)}</div>
            <div class="rule-sub">${escapeHtml(t("status.siteRule", { label }))}</div>
          </div>
          <div class="pill ${mode}">${label}</div>
          <div class="rule-actions">
            <button class="ghost" data-action="allow" data-host="${escapeAttr(hostname)}">${escapeHtml(t("options.allow"))}</button>
            <button class="danger" data-action="block" data-host="${escapeAttr(hostname)}">${escapeHtml(t("options.block"))}</button>
            <button class="ghost" data-action="clear" data-host="${escapeAttr(hostname)}">${escapeHtml(t("status.remove"))}</button>
          </div>
        </div>
      `;
    })
    .join("");

  for (const button of elements.rulesList.querySelectorAll("button[data-action]")) {
    button.addEventListener("click", async () => {
      const host = button.getAttribute("data-host");
      const action = button.getAttribute("data-action");
      if (!host) {
        return;
      }

      const nextRules = { ...siteRules };
      if (action === "clear") {
        delete nextRules[host];
      } else {
        nextRules[host] = action === "allow" ? "allow" : "block";
      }

      siteRules = normalizeSiteRules(nextRules);
      await saveSettings({ [STORAGE_KEYS.siteRules]: siteRules });
      renderCurrentSite();
      renderRules();
      setSettingsStatus(t("status.siteUpdated", { host }));
    });
  }
}

function renderSelectors() {
  if (!currentHostname) {
    elements.selectorCount.textContent = t("status.count", { count: 0 });
    elements.siteSelectorsList.innerHTML = `
      <div class="rule-row">
        <div class="rule-meta">
          <div class="rule-host">${escapeHtml(t("status.noSelectorSite"))}</div>
          <div class="rule-sub">${escapeHtml(t("status.selectorSiteHelp"))}</div>
        </div>
      </div>
    `;
    return;
  }

  const selectors = getSelectorsForCurrentSite();
  elements.selectorCount.textContent = t("status.count", { count: selectors.length });

  if (!selectors.length) {
    elements.siteSelectorsList.innerHTML = `
      <div class="rule-row">
        <div class="rule-meta">
          <div class="rule-host">${escapeHtml(t("status.noSelectors"))}</div>
          <div class="rule-sub">${escapeHtml(t("status.selectorHelp"))}</div>
        </div>
      </div>
    `;
    return;
  }

  elements.siteSelectorsList.innerHTML = selectors
    .map((selector) => `
      <div class="selector-card">
        <div class="selector-card-head">
          <div class="rule-meta">
            <div class="rule-host">${escapeHtml(selector)}</div>
            <div class="rule-sub">${escapeHtml(t("status.customCss"))}</div>
          </div>
          <div class="pill block">${escapeHtml(t("status.hidden"))}</div>
        </div>

        <div class="selector-card-grid">
          <div class="selector-stat">
            <div class="selector-stat-label">${escapeHtml(t("status.source"))}</div>
            <div class="selector-stat-value">${escapeHtml(t("status.manual"))}</div>
          </div>
          <div class="selector-stat">
            <div class="selector-stat-label">${escapeHtml(t("status.ruleType"))}</div>
            <div class="selector-stat-value">${escapeHtml(t("status.pageHide"))}</div>
          </div>
          <div class="selector-stat">
            <div class="selector-stat-label">${escapeHtml(t("status.scope"))}</div>
            <div class="selector-stat-value">${escapeHtml(t("status.hostScope", { host: currentHostname }))}</div>
          </div>
        </div>

        <div class="selector-card-note">${escapeHtml(t("status.selectorNote"))}</div>

        <div class="rule-actions selector-actions">
          <button class="ghost" data-selector-action="remove" data-selector="${escapeAttr(selector)}">${escapeHtml(t("status.remove"))}</button>
        </div>
      </div>
    `)
    .join("");

  for (const button of elements.siteSelectorsList.querySelectorAll("button[data-selector-action]")) {
    button.addEventListener("click", async () => {
      const selector = button.getAttribute("data-selector");
      if (!selector) {
        return;
      }

      const nextRules = { ...customHideRules };
      const current = (nextRules[currentHostname] || []).filter((item) => item !== selector);
      if (current.length) {
        nextRules[currentHostname] = current;
      } else {
        delete nextRules[currentHostname];
      }

      customHideRules = normalizeHideRules(nextRules);
      await saveSettings({ [STORAGE_KEYS.customHideRules]: customHideRules });
      renderSelectors();
      setSettingsStatus(t("status.selectorRemoved", { selector }));
    });
  }
}

function renderSubscriptions() {
  elements.subscriptionCount.textContent = t("status.count", { count: subscriptions.length });
  if (elements.subscriptionSummary) {
    const statsValues = Object.values(subscriptionStats || {});
    const activeCount = statsValues.filter((item) => item.status === "active").length;
    const errorCount = statsValues.filter((item) => item.status === "error").length;
    const emptyCount = statsValues.filter((item) => item.status === "empty").length;
    elements.subscriptionSummary.textContent = t("status.syncSummary", { active: activeCount, error: errorCount, empty: emptyCount });
  }

  if (!subscriptions.length) {
    elements.subscriptionsList.innerHTML = `
      <div class="rule-row">
        <div class="rule-meta">
          <div class="rule-host">${escapeHtml(t("status.noSubscriptions"))}</div>
          <div class="rule-sub">${escapeHtml(t("status.subscriptionHelp"))}</div>
        </div>
      </div>
    `;
    return;
  }

  elements.subscriptionsList.innerHTML = subscriptions
    .map((item) => {
      const stats = subscriptionStats[item.id] || {};
      const displayName = stats.title || item.title || item.name;
      const displayStatus = getSubscriptionStatusLabel(stats.status, item.enabled);
      const displayStatusClass = getSubscriptionStatusClass(stats.status, item.enabled);
      const sourceLabel = item.sourceType === "url" ? item.source : t("status.text");
      const kindLabel = item.sourceType === "url" ? t("status.remote") : t("status.text");
      const summaryText = stats.status === "error"
        ? stats.message || t("status.loadFailedShort")
        : stats.description || item.description || t("status.noExtraDescription");
      const versionText = stats.version || item.version || t("status.notProvided");
      const updatedText = stats.updatedAtText || item.updatedAtText || t("status.notProvided");
      const intervalText = stats.updateIntervalText || item.updateIntervalText || t("status.notProvided");
      const sourceSummary = stats.sourceSummary || item.sourceSummary || sourceLabel;
      const compiledRuleCount = Number.isFinite(stats.ruleCount) ? stats.ruleCount : 0;
      const rawRuleCount = Number.isFinite(stats.rawRuleCount) ? stats.rawRuleCount : compiledRuleCount;
      const unsupportedRuleCount = Number.isFinite(stats.unsupportedRuleCount) ? stats.unsupportedRuleCount : 0;
      const addedRuleCount = Number.isFinite(stats.addedRuleCount) ? stats.addedRuleCount : compiledRuleCount;
      const ruleCountText = addedRuleCount < compiledRuleCount
        ? `${addedRuleCount} / ${compiledRuleCount} ${t("status.countUnit")}`
        : `${compiledRuleCount} ${t("status.countUnit")}`;
      const hideCountText = Number.isFinite(stats.hideCount) ? `${stats.hideCount} ${t("status.countUnit")}` : `0 ${t("status.countUnit")}`;
      const ruleDetailText = rawRuleCount > compiledRuleCount
        ? t("status.networkHiddenDetailed", { network: ruleCountText, hidden: hideCountText, raw: rawRuleCount, unsupported: unsupportedRuleCount })
        : t("status.networkHidden", { network: ruleCountText, hidden: hideCountText });
      return `
        <div class="subscription-card">
          <div class="subscription-card-head">
            <div class="rule-meta">
              <div class="rule-host">${escapeHtml(displayName)}</div>
              <div class="rule-sub">${escapeHtml(displayStatus)} · ${escapeHtml(kindLabel)} · ${escapeHtml(sourceLabel.slice(0, 100))}</div>
            </div>
            <div class="pill ${displayStatusClass}">${escapeHtml(displayStatus)}</div>
          </div>

          <div class="subscription-card-description">${escapeHtml(summaryText)}</div>

          <div class="selector-card-grid subscription-grid">
            <div class="selector-stat">
            <div class="selector-stat-label">${escapeHtml(t("status.ruleCompile"))}</div>
            <div class="selector-stat-value">${escapeHtml(ruleDetailText)}</div>
            </div>
            <div class="selector-stat">
            <div class="selector-stat-label">${escapeHtml(t("status.version"))}</div>
              <div class="selector-stat-value">${escapeHtml(versionText)}</div>
            </div>
            <div class="selector-stat">
            <div class="selector-stat-label">${escapeHtml(t("status.updated"))}</div>
              <div class="selector-stat-value">${escapeHtml(updatedText)}</div>
            </div>
            <div class="selector-stat">
            <div class="selector-stat-label">${escapeHtml(t("status.interval"))}</div>
              <div class="selector-stat-value">${escapeHtml(intervalText)}</div>
            </div>
          </div>

          <div class="subscription-source">${escapeHtml(sourceSummary)}</div>

          <div class="subscription-actions">
            <label class="switch compact">
              <input type="checkbox" data-sub-toggle="${escapeAttr(item.id)}" ${item.enabled ? "checked" : ""} />
              <span></span>
            </label>
            <div class="rule-actions">
              <button class="ghost" data-sub-action="sync" data-sub="${escapeAttr(item.id)}">${escapeHtml(t("status.checkActive"))}</button>
              <button class="ghost" data-sub-action="remove" data-sub="${escapeAttr(item.id)}">${escapeHtml(t("status.remove"))}</button>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  for (const toggle of elements.subscriptionsList.querySelectorAll("input[data-sub-toggle]")) {
    toggle.addEventListener("change", async (event) => {
      const id = event.target.getAttribute("data-sub-toggle");
      await toggleSubscription(id, event.target.checked);
    });
  }

  for (const button of elements.subscriptionsList.querySelectorAll("button[data-sub-action]")) {
    button.addEventListener("click", async () => {
      const id = button.getAttribute("data-sub");
      const action = button.getAttribute("data-sub-action");
      if (!id) {
        return;
      }

      if (action === "remove") {
        await removeSubscription(id);
      } else if (action === "sync") {
        await syncSubscriptionsNow();
      }
    });
  }
}

function getSelectorsForCurrentSite() {
  if (!currentHostname) {
    return [];
  }

  const selectors = [];
  for (const [host, values] of Object.entries(customHideRules || {})) {
    if (hostMatches(host, currentHostname)) {
      selectors.push(...values);
    }
  }

  return Array.from(new Set(selectors)).sort((a, b) => a.localeCompare(b));
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

    normalized[hostname] = Array.from(new Set(safeSelectors)).slice(0, 200);
  }

  return normalized;
}

function isSafeCosmeticSelector(selector) {
  const value = String(selector || "").trim();
  if (!value || value.length > 1024) {
    return false;
  }

  if (value.includes("</") || value.includes("/>")) {
    return false;
  }

  // Block uBlock-extended pseudo-classes that querySelectorAll cannot parse
  if (/:has-text\(|:matches-css\(|:xpath\(|:style\(|:remove\(|:abp\(|:contains\(|:properties\(|:matches-attr\(|:matches-prop\(/i.test(value)) {
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

  const source = String(item.source || "").trim();
  if (!source) {
    return null;
  }

  const sourceType = item.sourceType === "text"
    ? "text"
    : sourceLooksLikeUrl(source)
      ? "url"
      : "text";

  return {
    id: String(item.id || `sub-${index + 1}`),
    name: String(item.name || deriveSubscriptionName(source)).trim().slice(0, 120),
    sourceType,
    source,
    enabled: item.enabled !== false,
    title: String(item.title || "").trim().slice(0, 120),
    description: String(item.description || "").trim().slice(0, 1000),
    version: String(item.version || "").trim().slice(0, 80),
    updatedAtText: String(item.updatedAtText || "").trim().slice(0, 120),
    updateIntervalText: String(item.updateIntervalText || "").trim().slice(0, 120),
    sourceSummary: String(item.sourceSummary || "").trim().slice(0, 400)
  };
}

function normalizeSubscriptionStats(value) {
  if (!value || typeof value !== "object") {
    return {};
  }

  const normalized = {};
  for (const [key, item] of Object.entries(value)) {
    const id = String(key || "").trim();
    if (!id) {
      continue;
    }

    normalized[id] = {
      id,
      name: String(item?.name || "").trim(),
      enabled: item?.enabled !== false,
      status: String(item?.status || "").trim(),
      message: String(item?.message || "").trim(),
      ruleCount: Number(item?.ruleCount || 0),
      rawRuleCount: Number(item?.rawRuleCount || item?.ruleCount || 0),
      unsupportedRuleCount: Number(item?.unsupportedRuleCount || 0),
      addedRuleCount: Number(item?.addedRuleCount ?? item?.ruleCount ?? 0),
      hideCount: Number(item?.hideCount || 0),
      title: String(item?.title || "").trim(),
      description: String(item?.description || "").trim(),
      version: String(item?.version || "").trim(),
      updatedAtText: String(item?.updatedAtText || "").trim(),
      updateIntervalText: String(item?.updateIntervalText || "").trim(),
      sourceSummary: String(item?.sourceSummary || "").trim()
    };
  }

  return normalized;
}

function normalizeDynamicRuleStats(value) {
  if (!value || typeof value !== "object") {
    return {};
  }

  const skippedRuleIds = Array.isArray(value.skippedRuleIds)
    ? value.skippedRuleIds.map((item) => Number(item)).filter(Number.isFinite)
    : [];
  const failedSubscriptionIds = Array.isArray(value.failedSubscriptionIds)
    ? value.failedSubscriptionIds.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  return {
    desired: Number(value.desired || 0),
    added: Number(value.added || 0),
    skipped: Number(value.skipped || 0),
    truncatedRuleCount: Number(value.truncatedRuleCount || 0),
    skippedRuleIds,
    subscriptionCount: Number(value.subscriptionCount || 0),
    activeSubscriptionCount: Number(value.activeSubscriptionCount || 0),
    errorSubscriptionCount: Number(value.errorSubscriptionCount || 0),
    emptySubscriptionCount: Number(value.emptySubscriptionCount || 0),
    failedSubscriptionIds
  };
}

function parseSubscriptionMetadataText(text) {
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
    const versionMatch = raw.match(/(?:version|版本)\s*[:：]\s*([^，,]+)/i);
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
      return raw && !raw.includes("：") && !raw.includes(":") && !/[|^*#]/.test(raw);
    });

    if (firstContentLine) {
      metadata.title = firstContentLine.replace(/^[!#]+\s*/, "").trim().slice(0, 120);
    }
  }

  return metadata;
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

function sourceTypeIsText(source) {
  return !/^https?:\/\//i.test(String(source || "").trim()) || /\n/.test(String(source || ""));
}

function sourceLooksLikeUrl(source) {
  const text = String(source || "").trim();
  if (!text || /\s/.test(text) || /\n/.test(text)) {
    return false;
  }

  if (/^https?:\/\//i.test(text)) {
    return true;
  }

  return /^[a-z0-9.-]+\.[a-z]{2,}(?:[/?#].*)?$/i.test(text);
}

function hostMatches(ruleHost, hostname) {
  return hostname === ruleHost || hostname.endsWith(`.${ruleHost}`);
}

function deriveSubscriptionName(source) {
  const text = String(source || "").trim();
  if (/^https?:\/\//i.test(text)) {
    try {
      return new URL(text).hostname.replace(/^www\./, "");
    } catch {
      return text.slice(0, 80);
    }
  }

  return text.slice(0, 80) || t("status.unnamedSubscription");
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `sub-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
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

async function exportRules() {
  const payload = {
    version: 3,
    exportedAt: new Date().toISOString(),
    enabled,
    builtinFilteringEnabled,
    siteRules,
    customHideRules,
    subscriptions
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const filename = `ad-cleaner-rules-${new Date().toISOString().slice(0, 10)}.json`;
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  setSettingsStatus(t("status.rulesExported"));
}

async function importRulesFromFile(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const imported = parseImportedSettings(parsed);
    if (!imported) {
      throw new Error(t("status.invalidImport"));
    }

    enabled = imported.enabled;
    builtinFilteringEnabled = imported.builtinFilteringEnabled;
    siteRules = imported.siteRules;
    customHideRules = imported.customHideRules;
    subscriptions = imported.subscriptions;
    subscriptionStats = {};
    dynamicRuleStats = {};

    await saveSettings({
      [STORAGE_KEYS.enabled]: enabled,
      [STORAGE_KEYS.builtinFiltering]: builtinFilteringEnabled,
      [STORAGE_KEYS.siteRules]: siteRules,
      [STORAGE_KEYS.customHideRules]: customHideRules,
      [STORAGE_KEYS.subscriptions]: subscriptions,
      [STORAGE_KEYS.subscriptionStats]: subscriptionStats,
      [STORAGE_KEYS.dynamicRuleStats]: dynamicRuleStats
    });

    elements.globalToggle.checked = enabled;
    elements.builtinToggle.checked = builtinFilteringEnabled;
    renderAll();
    setSettingsStatus(t("status.rulesImported", { count: Object.keys(siteRules).length }));
    await syncSubscriptionsNow();
  } catch (error) {
    setSettingsStatus(t("status.importFailed", { error: error.message }));
  }
}

async function clearAllRules() {
  if (!confirm(t("status.confirmClearAll"))) {
    return;
  }

  siteRules = {};
  customHideRules = {};
  subscriptions = [];
  subscriptionStats = {};
  dynamicRuleStats = {};
  await saveSettings({
    [STORAGE_KEYS.siteRules]: siteRules,
    [STORAGE_KEYS.customHideRules]: customHideRules,
    [STORAGE_KEYS.subscriptions]: subscriptions,
    [STORAGE_KEYS.subscriptionStats]: subscriptionStats,
    [STORAGE_KEYS.dynamicRuleStats]: dynamicRuleStats
  });
  renderAll();
  setSettingsStatus(t("status.allRulesCleared"));
  await syncSubscriptionsNow();
}

async function saveCurrentRules() {
  await saveSettings({
    [STORAGE_KEYS.siteRules]: siteRules,
    [STORAGE_KEYS.customHideRules]: customHideRules,
    [STORAGE_KEYS.subscriptions]: subscriptions
  });
}

function parseImportedSettings(data) {
  if (!data || typeof data !== "object") {
    return null;
  }

  if ("siteRules" in data || "customHideRules" in data || "subscriptions" in data || "enabled" in data || "builtinFilteringEnabled" in data || "version" in data) {
    return {
      enabled: typeof data.enabled === "boolean" ? data.enabled : enabled,
      builtinFilteringEnabled: typeof data.builtinFilteringEnabled === "boolean" ? data.builtinFilteringEnabled : builtinFilteringEnabled,
      siteRules: normalizeSiteRules(data.siteRules ?? {}),
      customHideRules: normalizeHideRules(data.customHideRules ?? {}),
      subscriptions: normalizeSubscriptions(data.subscriptions ?? [])
    };
  }

  return {
    enabled,
    builtinFilteringEnabled,
    siteRules: normalizeSiteRules(data),
    customHideRules: {},
    subscriptions: []
  };
}

function getSubscriptionStatusLabel(status, enabled) {
  if (!enabled || status === "disabled") {
    return t("status.subscriptionClosed");
  }

  if (status === "active") {
    return t("status.subscriptionActive");
  }

  if (status === "error") {
    return t("status.loadFailedShort");
  }

  if (status === "empty") {
    return t("status.subscriptionEmpty");
  }

  return t("status.subscriptionPending");
}

function getSubscriptionStatusClass(status, enabled) {
  if (!enabled || status === "disabled") {
    return "disabled";
  }

  if (status === "active") {
    return "allow";
  }

  if (status === "error") {
    return "block";
  }

  return "empty";
}

function setSettingsStatus(message) {
  if (elements.settingsStatus) {
    elements.settingsStatus.textContent = message;
  }
}

function renderSyncStats() {
  const stats = normalizeDynamicRuleStats(dynamicRuleStats);
  const subscriptionValues = Object.values(subscriptionStats || {});
  const activeCount = subscriptionValues.filter((item) => item.status === "active").length;
  const errorCount = subscriptionValues.filter((item) => item.status === "error").length;
  const emptyCount = subscriptionValues.filter((item) => item.status === "empty").length;
  const failedSubItems = subscriptionValues.filter((item) => item.status === "error");
  const skippedRuleText = stats.skippedRuleIds.length
    ? stats.skippedRuleIds.slice(0, 12).join(", ") + (stats.skippedRuleIds.length > 12 ? " ..." : "")
    : t("status.nothing");
  const failedSubText = failedSubItems.length
    ? failedSubItems.slice(0, 3).map((item) => `${item.name || item.id}: ${item.message || t("status.loadFailedShort")}`).join("; ") + (failedSubItems.length > 3 ? " ..." : "")
    : t("status.nothing");

  if (elements.dynamicRuleSummary) {
    elements.dynamicRuleSummary.textContent = t("status.dynamicSummary", { added: stats.added || 0, skipped: stats.skipped || 0 });
  }

  if (elements.dynamicRuleCounts) {
    elements.dynamicRuleCounts.textContent = t("status.dynamicCounts", { desired: stats.desired || 0, added: stats.added || 0 });
  }

  if (elements.subscriptionSyncCounts) {
    elements.subscriptionSyncCounts.textContent = t("status.syncSummary", { active: activeCount, error: errorCount, empty: emptyCount });
  }

  if (elements.dynamicSkippedRules) {
    elements.dynamicSkippedRules.textContent = skippedRuleText;
  }

  if (elements.dynamicFailedSubscriptions) {
    elements.dynamicFailedSubscriptions.textContent = failedSubText;
  }

  if (elements.dynamicRuleDetail) {
    const parts = [];
    if (stats.subscriptionCount || stats.activeSubscriptionCount || stats.errorSubscriptionCount || stats.emptySubscriptionCount) {
      parts.push(t("status.subscriptionDetail", { count: stats.subscriptionCount || 0, active: stats.activeSubscriptionCount || 0, error: stats.errorSubscriptionCount || 0, empty: stats.emptySubscriptionCount || 0 }));
    }
    if (stats.skippedRuleIds.length) {
      parts.push(t("status.skippedDetail", { count: stats.skippedRuleIds.length }));
    } else {
      parts.push(t("status.noSkippedDetail"));
    }
    if (stats.truncatedRuleCount) {
      parts.push(t("status.truncatedDetail", { count: stats.truncatedRuleCount }));
    }
    if (failedSubItems.length) {
      parts.push(t("status.failedExample", { items: failedSubText }));
    }
    elements.dynamicRuleDetail.textContent = parts.join(" ");
  }
}
