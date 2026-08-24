(function initializeAdCleanerI18n(global) {
  const STORAGE_KEY = "adCleanerLanguage";
  const DEFAULT_LANGUAGE = "zh-CN";
  const SUPPORTED_LANGUAGES = new Set([DEFAULT_LANGUAGE, "en"]);
  const listeners = new Set();
  let currentLanguage = DEFAULT_LANGUAGE;
  let readyPromise = null;

  const messages = {
    "zh-CN": {
      language: {
        label: "语言",
        chinese: "中文",
        english: "English",
        switchToChinese: "切换到中文",
        switchToEnglish: "Switch to English"
      },
      theme: {
        system: "跟随系统",
        dark: "暗夜",
        light: "白天",
        cycle: "切换显示模式（当前：{mode}）"
      },
      options: {
        title: "广告清理工具-Ad-Cleaner 设置",
        heading: "站点规则",
        intro: "把常去的网站加入白名单或黑名单。白名单会放行并停止标记，黑名单会强制启用清理。",
        globalLabel: "全局开关",
        globalHeading: "广告拦截总控",
        globalHelp: "关闭后，默认不扫描也不清理；加入黑名单的网站仍会继续启用清理。",
        builtinHeading: "内置过滤",
        builtinHelp: "关闭后只保留订阅源、手动选择器和站点规则，适合只想用自己的订阅列表时开启。",
        currentSite: "当前站点",
        allowSite: "设为白名单",
        blockSite: "设为黑名单",
        clearRule: "清除规则",
        currentSiteHelp: "如果当前页面没有生效，请刷新一次页面让网络级规则同步。",
        newRule: "新增规则",
        addDomainHeading: "手动添加域名",
        refreshList: "刷新列表",
        hostnamePlaceholder: "例如 example.com 或 https://example.com/page",
        allow: "白名单",
        block: "黑名单",
        add: "添加",
        domainHelp: "支持直接粘贴网址，系统会自动提取域名。",
        elementHiding: "元素隐藏",
        selectorHeading: "当前站点选择器",
        selectorPlaceholder: "例如 .ad-slot, [data-ad], aside.promoted",
        addSelector: "添加选择器",
        selectorHelp: "这些选择器会在当前站点实时隐藏，误杀后可从恢复面板单独放回。",
        subscriptions: "订阅源",
        subscriptionHeading: "过滤规则订阅",
        subscriptionNamePlaceholder: "订阅名称，例如 AdGuard Lite",
        subscriptionSourcePlaceholder: "粘贴订阅 URL 或过滤规则文本。支持 ||domain^ 和 domain##selector",
        addSubscription: "添加订阅",
        resync: "重新同步",
        clearSubscriptions: "清空订阅",
        subscriptionHelp: "远程订阅会在后台自动拉取并编译成网络拦截规则和站点隐藏选择器。",
        syncStatus: "同步状态",
        compileHeading: "动态规则编译结果",
        dynamicRules: "动态规则",
        subscriptionStatus: "订阅状态",
        skippedRules: "跳过规则",
        failedSubscriptions: "失败订阅",
        syncDetail: "同步后会显示规则编译数量、跳过的规则 ID，以及加载失败的订阅名称和原因。",
        ruleList: "规则列表",
        savedSites: "已保存站点",
        maintenance: "规则维护",
        importExport: "导入 / 导出 / 清空",
        ready: "就绪",
        exportRules: "导出规则",
        importRules: "导入规则",
        clearAll: "清空所有",
        importHelp: "导入会替换站点规则、选择器和订阅列表，并同时恢复导出的全局开关状态。"
      },
      popup: {
        title: "广告清理工具-Ad-Cleaner",
        heading: "拦截、标记、清理",
        intro: "自动挡住常见广告请求，并把网页里疑似广告的块高亮出来，方便一键清理。",
        currentPage: "当前页面",
        connecting: "正在连接…",
        marked: "个广告候选已标记",
        pageMode: "页面模式",
        standardMode: "标准模式",
        heuristic: "启发式",
        customHits: "自定义命中",
        subscriptionHits: "订阅命中",
        restored: "恢复次数",
        syncStatus: "同步状态",
        skipped: "跳过",
        networkMatches: "拦截链接",
        checking: "检查中",
        rescan: "重新扫描",
        hideNow: "立即隐藏",
        restore: "恢复清理",
        recovery: "误杀面板",
        picker: "点选屏蔽",
        site: "当前站点",
        identifying: "正在识别…",
        builtinFilter: "内置过滤",
        enabled: "开启",
        allow: "白名单",
        block: "黑名单",
        clear: "清除",
        options: "设置页",
        footnote: "订阅和手动规则会持续生效，内置过滤可以在设置页单独关闭。"
      },
      status: {
        enabled: "已启用",
        disabled: "已关闭",
        unavailable: "当前页面不可用",
        unidentified: "当前页面不可识别",
        addressOnly: "仅支持有地址的页面",
        followGlobal: "默认：跟随全局开关",
        allowSite: "白名单：放行并停止清理",
        blockSite: "黑名单：强制启用清理",
        builtinOnly: "关闭，仅保留订阅和手动规则",
        builtinDisabled: "已关闭内置过滤",
        noTabs: "没有可用标签页",
        unsupported: "当前页面暂不支持",
        unavailableShort: "不可用",
        invalidHostname: "请输入有效域名",
        loadFailedShort: "加载失败",
        countUnit: "条",
        loadFailed: "加载失败：{error}",
        currentSiteMissing: "未找到当前网站",
        none: "无",
        default: "默认",
        noRule: "暂时没有规则",
        addSiteRuleHelp: "可以先把常去的网站加入白名单或黑名单。",
        add: "已添加",
        unnamedSubscription: "未命名订阅",
        emptySelector: "请输入选择器",
        invalidSelector: "选择器不合法（{selector}…），未添加",
        selectorsAdded: "已添加 {valid} 个选择器，跳过 {invalid} 个不合法项",
        selectorAdded: "已添加 {count} 个选择器",
        subscriptionInput: "请输入订阅 URL 或规则文本",
        subscriptionAdded: "已添加订阅 {name}",
        subscriptionEnabled: "已启用订阅",
        subscriptionDisabled: "已禁用订阅",
        subscriptionRemoved: "已移除订阅",
        syncSuccess: "订阅已重新同步并检查生效情况",
        syncGeneric: "订阅已重新同步",
        syncFailed: "后台同步失败，请稍后重试",
        confirmClearSubscriptions: "确定要清空所有订阅吗？这不会删除站点规则或选择器。",
        subscriptionsCleared: "已清空订阅",
        siteUpdated: "已更新 {host}",
        selectorRemoved: "已移除 {selector}",
        rulesExported: "已导出规则",
        invalidImport: "JSON 格式不受支持",
        rulesImported: "已导入 {count} 条站点规则",
        importFailed: "导入失败：{error}",
        confirmClearAll: "确定要清空所有站点规则、选择器和订阅吗？这不会修改全局开关。",
        allRulesCleared: "已清空所有规则",
        siteRule: "站点规则：{label}",
        remove: "移除",
        noSelectorSite: "当前站点不可识别",
        selectorSiteHelp: "打开具体网页后才能添加元素选择器。",
        noSelectors: "还没有选择器",
        selectorHelp: "添加站点专用 CSS 选择器后，这里会列出记录。",
        customCss: "自定义过滤 · CSS 选择器",
        hidden: "隐藏",
        source: "来源",
        manual: "手动添加",
        ruleType: "规则类型",
        pageHide: "页面隐藏",
        scope: "影响范围",
        hostScope: "{host} 及子域名",
        selectorNote: "会在当前站点实时隐藏匹配元素。关闭内置过滤后，这些规则仍然保留。",
        noSubscriptions: "暂时没有订阅",
        subscriptionHelp: "可以添加远程 URL 或直接粘贴过滤规则文本。",
        remote: "远程",
        text: "文本",
        ruleCompile: "规则编译",
        version: "版本",
        updated: "更新时间",
        interval: "更新周期",
        checkActive: "检查生效",
        noExtraDescription: "没有额外说明。",
        notProvided: "未提供",
        networkHidden: "{network} 网络 / {hidden} 隐藏",
        networkHiddenDetailed: "{network} 网络 / {hidden} 隐藏（原始 {raw}，跳过 {unsupported}）",
        count: "{count} 条",
        syncSummary: "{active} 生效 / {error} 失败 / {empty} 空规则",
        dynamicSummary: "{added} 条可用 / {skipped} 条跳过",
        dynamicCounts: "{desired} 条命中，{added} 条添加",
        popupSyncSummary: "{added} 可用 / {skipped} 跳过 / {failed} 失败",
        pageElements: "{count}（页面广告元素）",
        networkMatches: "{count}（订阅 {subscription} / 内置 {builtin}）",
        subscriptionClosed: "已关闭",
        subscriptionActive: "已生效",
        subscriptionEmpty: "无可用规则",
        subscriptionPending: "待检查",
        nothing: "无",
        failedExample: "失败订阅示例：{items}",
        skippedDetail: "已跳过 {count} 条动态规则，常见原因是规则本身不合法或不支持该写法。",
        noSkippedDetail: "没有发现被跳过的动态规则。",
        subscriptionDetail: "订阅 {count} 个，其中 {active} 个生效、{error} 个失败、{empty} 个空规则。",
        truncatedDetail: "订阅规则超过动态规则容量，已截断 {count} 条。"
      },
      content: {
        badge: "广告",
        recoveryKicker: "Recovery",
        recoveryTitle: "误杀恢复面板",
        close: "关闭",
        restoreAll: "全部恢复",
        restore: "恢复",
        rescan: "重新扫描",
        noRecoverable: "当前页面没有可恢复的广告块。",
        reason: "原因：{reason}",
        pickerTitle: "点选屏蔽模式",
        pickerCopy: "点击页面里的广告块，自动生成当前站点的隐藏规则。按 Esc 退出。",
        cancel: "取消",
        pickerAlready: "点选屏蔽已开启，点击一个广告块即可。",
        pickerStarted: "点选屏蔽已开启，点击广告块保存选择器，Esc 取消。",
        pickerVisibleOnly: "请点击一个可见的广告块。",
        pickerExited: "已退出点选屏蔽。",
        selectorFailed: "没能为这个元素生成稳定选择器。",
        selectorSaved: "已添加屏蔽规则：{selector}",
        savedToSite: "已保存到当前站点的屏蔽规则。",
        saveFailed: "保存失败：{error}",
        invalidSelector: "选择器不合法或不安全",
        pickerCanceled: "已取消点选屏蔽。",
        tryBasic: "TryBlock 基础测试页",
        tryIntermediate: "TryBlock 中级测试页",
        tryAdvanced: "TryBlock 高级测试页",
        lowFalsePositive: "低误杀模式",
        standard: "标准模式",
        unavailable: "不可用"
      },
      background: {
        tabUnavailable: "当前标签页不可诊断",
        diagnosticsUnsupported: "当前浏览器不支持规则命中诊断",
        pageTitleHidden: "广告清理工具-Ad-Cleaner · 页面已隐藏 {count} 个广告元素",
        pageTitleEmpty: "广告清理工具-Ad-Cleaner · 当前页面暂无广告元素",
        networkTitleBlocked: "广告清理工具-Ad-Cleaner · 已拦截 {count} 个链接",
        networkTitleEmpty: "广告清理工具-Ad-Cleaner · 当前页面暂无网络命中",
        closed: "已关闭",
        loadFailed: "加载失败",
        usingPrevious: "{error}，继续使用上次成功版本",
        active: "已生效",
        emptyRules: "未识别到可用规则",
        activeWithCount: "已生效，实际加入 {count} 条",
        invalidUrl: "订阅地址无效，请填写完整的规则 URL",
        unsafeHost: "订阅地址指向内网或保留网段，已拒绝加载",
        httpError: "请求失败：HTTP {status}",
        tooLarge: "订阅体积过大（{size}MB），已拒绝加载",
        tooLargeStream: "订阅体积超过 5MB 上限，已中断加载",
        tooLargeText: "订阅体积超过 5MB 上限，已拒绝加载",
        htmlResponse: "返回的是网页 HTML，不像过滤规则文本",
        timeout: "加载超时，请检查订阅地址是否可达",
        failed: "加载失败",
        blocked: "请求被浏览器拦截或无法访问"
      }
    },
    en: {
      language: {
        label: "Language",
        chinese: "中文",
        english: "English",
        switchToChinese: "切换到中文",
        switchToEnglish: "Switch to English"
      },
      theme: {
        system: "System",
        dark: "Dark",
        light: "Light",
        cycle: "Change display mode (current: {mode})"
      },
      options: {
        title: "Ad Cleaner Tool-Ad-Cleaner Settings",
        heading: "Site Rules",
        intro: "Add frequently visited sites to the allowlist or blocklist. Allowlisted sites bypass filtering; blocklisted sites always stay enabled.",
        globalLabel: "Global switch",
        globalHeading: "Ad blocking control",
        globalHelp: "When disabled, pages are not scanned or cleaned by default. Blocklisted sites remain enabled.",
        builtinHeading: "Built-in filtering",
        builtinHelp: "When disabled, only subscriptions, manual selectors, and site rules remain active.",
        currentSite: "Current site",
        allowSite: "Allowlist",
        blockSite: "Blocklist",
        clearRule: "Clear rule",
        currentSiteHelp: "If the current page is not affected, refresh it once to synchronize network rules.",
        newRule: "New rule",
        addDomainHeading: "Add domain manually",
        refreshList: "Refresh list",
        hostnamePlaceholder: "e.g. example.com or https://example.com/page",
        allow: "Allowlist",
        block: "Blocklist",
        add: "Add",
        domainHelp: "Paste a URL directly and the domain will be extracted automatically.",
        elementHiding: "Element hiding",
        selectorHeading: "Current site selectors",
        selectorPlaceholder: "e.g. .ad-slot, [data-ad], aside.promoted",
        addSelector: "Add selector",
        selectorHelp: "These selectors hide matching elements on the current site and can be restored from the recovery panel.",
        subscriptions: "Subscriptions",
        subscriptionHeading: "Filter subscriptions",
        subscriptionNamePlaceholder: "Subscription name, e.g. AdGuard Lite",
        subscriptionSourcePlaceholder: "Paste a subscription URL or filter text. Supports ||domain^ and domain##selector",
        addSubscription: "Add subscription",
        resync: "Sync again",
        clearSubscriptions: "Clear subscriptions",
        subscriptionHelp: "Remote subscriptions are fetched and compiled into network blocking rules and site selectors.",
        syncStatus: "Sync status",
        compileHeading: "Dynamic rule compilation",
        dynamicRules: "Dynamic rules",
        subscriptionStatus: "Subscription status",
        skippedRules: "Skipped rules",
        failedSubscriptions: "Failed subscriptions",
        syncDetail: "After synchronization, this area shows compiled rule counts, skipped rule IDs, and failed subscription details.",
        ruleList: "Rule list",
        savedSites: "Saved sites",
        maintenance: "Rule maintenance",
        importExport: "Import / Export / Clear",
        ready: "Ready",
        exportRules: "Export rules",
        importRules: "Import rules",
        clearAll: "Clear all",
        importHelp: "Import replaces site rules, selectors, and subscriptions, and restores the exported global switch state."
      },
      popup: {
        title: "Ad Cleaner Tool-Ad-Cleaner",
        heading: "Block, mark, clean",
        intro: "Automatically block common ad requests and highlight suspected ad blocks for one-click cleanup.",
        currentPage: "Current page",
        connecting: "Connecting…",
        marked: "ad candidates marked",
        pageMode: "Page mode",
        standardMode: "Standard mode",
        heuristic: "Heuristic",
        customHits: "Custom hits",
        subscriptionHits: "Subscription hits",
        restored: "Restored",
        syncStatus: "Sync status",
        skipped: "skipped",
        networkMatches: "Blocked links",
        checking: "Checking",
        rescan: "Rescan",
        hideNow: "Hide now",
        restore: "Restore cleanup",
        recovery: "Recovery panel",
        picker: "Pick to block",
        site: "Current site",
        identifying: "Identifying…",
        builtinFilter: "Built-in filtering",
        enabled: "On",
        allow: "Allowlist",
        block: "Blocklist",
        clear: "Clear",
        options: "Settings",
        footnote: "Subscriptions and manual rules remain active. Built-in filtering can be disabled in Settings."
      },
      status: {
        enabled: "Enabled",
        disabled: "Disabled",
        unavailable: "Current page unavailable",
        unidentified: "Current page not recognized",
        addressOnly: "Only pages with an address are supported",
        followGlobal: "Default: follow global switch",
        allowSite: "Allowlist: bypass filtering",
        blockSite: "Blocklist: force filtering",
        builtinOnly: "Off, subscriptions and manual rules only",
        builtinDisabled: "Built-in filtering disabled",
        noTabs: "No usable tab",
        unsupported: "This page is not supported",
        unavailableShort: "Unavailable",
        invalidHostname: "Enter a valid domain",
        loadFailedShort: "Load failed",
        countUnit: "rules",
        loadFailed: "Load failed: {error}",
        currentSiteMissing: "Current site not found",
        none: "None",
        default: "Default",
        noRule: "No rules yet",
        addSiteRuleHelp: "Add frequently visited sites to the allowlist or blocklist.",
        add: "Added",
        unnamedSubscription: "Unnamed subscription",
        emptySelector: "Enter a selector",
        invalidSelector: "Invalid selector ({selector}…), not added",
        selectorsAdded: "Added {valid} selectors; skipped {invalid} invalid entries",
        selectorAdded: "Added {count} selectors",
        subscriptionInput: "Enter a subscription URL or filter text",
        subscriptionAdded: "Added subscription {name}",
        subscriptionEnabled: "Subscription enabled",
        subscriptionDisabled: "Subscription disabled",
        subscriptionRemoved: "Subscription removed",
        syncSuccess: "Subscriptions synchronized and checked",
        syncGeneric: "Subscriptions synchronized",
        syncFailed: "Background synchronization failed; try again later",
        confirmClearSubscriptions: "Clear all subscriptions? Site rules and selectors will not be deleted.",
        subscriptionsCleared: "Subscriptions cleared",
        siteUpdated: "Updated {host}",
        selectorRemoved: "Removed {selector}",
        rulesExported: "Rules exported",
        invalidImport: "Unsupported JSON format",
        rulesImported: "Imported {count} site rules",
        importFailed: "Import failed: {error}",
        confirmClearAll: "Clear all site rules, selectors, and subscriptions? The global switch will not change.",
        allRulesCleared: "All rules cleared",
        siteRule: "Site rule: {label}",
        remove: "Remove",
        noSelectorSite: "Current site not recognized",
        selectorSiteHelp: "Open a specific webpage before adding element selectors.",
        noSelectors: "No selectors yet",
        selectorHelp: "Site-specific CSS selectors will appear here after you add them.",
        customCss: "Custom filter · CSS selector",
        hidden: "Hidden",
        source: "Source",
        manual: "Added manually",
        ruleType: "Rule type",
        pageHide: "Page hiding",
        scope: "Scope",
        hostScope: "{host} and subdomains",
        selectorNote: "Matching elements are hidden on this site. These rules remain active when built-in filtering is off.",
        noSubscriptions: "No subscriptions yet",
        subscriptionHelp: "Add a remote URL or paste filter rule text directly.",
        remote: "Remote",
        text: "Text",
        ruleCompile: "Rule compilation",
        version: "Version",
        updated: "Updated",
        interval: "Update interval",
        checkActive: "Check status",
        noExtraDescription: "No additional description.",
        notProvided: "Not provided",
        networkHidden: "{network} network / {hidden} hidden",
        networkHiddenDetailed: "{network} network / {hidden} hidden (raw {raw}, skipped {unsupported})",
        count: "{count}",
        syncSummary: "{active} active / {error} failed / {empty} empty",
        dynamicSummary: "{added} available / {skipped} skipped",
        dynamicCounts: "{desired} matched, {added} added",
        popupSyncSummary: "{added} available / {skipped} skipped / {failed} failed",
        pageElements: "{count} (page ad elements)",
        networkMatches: "{count} (subscriptions {subscription} / built-in {builtin})",
        subscriptionClosed: "Disabled",
        subscriptionActive: "Active",
        subscriptionEmpty: "No usable rules",
        subscriptionPending: "Pending",
        nothing: "None",
        failedExample: "Failed subscription example: {items}",
        skippedDetail: "Skipped {count} dynamic rules, usually because the syntax is invalid or unsupported.",
        noSkippedDetail: "No dynamic rules were skipped.",
        subscriptionDetail: "{count} subscriptions: {active} active, {error} failed, {empty} empty.",
        truncatedDetail: "Subscription rules exceeded dynamic capacity; {count} were truncated."
      },
      content: {
        badge: "AD",
        recoveryKicker: "Recovery",
        recoveryTitle: "Recovery panel",
        close: "Close",
        restoreAll: "Restore all",
        restore: "Restore",
        rescan: "Rescan",
        noRecoverable: "There are no recoverable ad blocks on this page.",
        reason: "Reason: {reason}",
        pickerTitle: "Pick-to-block mode",
        pickerCopy: "Click an ad block to generate a site rule. Press Esc to exit.",
        cancel: "Cancel",
        pickerAlready: "Pick-to-block is already active. Click an ad block.",
        pickerStarted: "Pick-to-block is active. Click an ad block to save a selector, or press Esc to cancel.",
        pickerVisibleOnly: "Click a visible ad block.",
        pickerExited: "Pick-to-block exited.",
        selectorFailed: "Could not generate a stable selector for this element.",
        selectorSaved: "Added blocking rule: {selector}",
        savedToSite: "Saved to this site's blocking rules.",
        saveFailed: "Save failed: {error}",
        invalidSelector: "The selector is invalid or unsafe",
        pickerCanceled: "Pick-to-block canceled.",
        tryBasic: "TryBlock basic test page",
        tryIntermediate: "TryBlock intermediate test page",
        tryAdvanced: "TryBlock advanced test page",
        lowFalsePositive: "Low false-positive mode",
        standard: "Standard mode",
        unavailable: "Unavailable"
      },
      background: {
        tabUnavailable: "This tab cannot be diagnosed",
        diagnosticsUnsupported: "Rule match diagnostics are not supported by this browser",
        pageTitleHidden: "Ad Cleaner Tool-Ad-Cleaner · {count} page ad elements hidden",
        pageTitleEmpty: "Ad Cleaner Tool-Ad-Cleaner · No page ad elements currently hidden",
        networkTitleBlocked: "Ad Cleaner Tool-Ad-Cleaner · {count} links blocked",
        networkTitleEmpty: "Ad Cleaner Tool-Ad-Cleaner · No network matches on this page",
        closed: "Disabled",
        loadFailed: "Load failed",
        usingPrevious: "{error}; continuing with the last successful version",
        active: "Active",
        emptyRules: "No usable rules found",
        activeWithCount: "Active, {count} rules added",
        invalidUrl: "Invalid subscription URL; enter a complete rule URL",
        unsafeHost: "Subscription points to a private or reserved network and was blocked",
        httpError: "Request failed: HTTP {status}",
        tooLarge: "Subscription is too large ({size}MB) and was rejected",
        tooLargeStream: "Subscription exceeded the 5MB limit and was stopped",
        tooLargeText: "Subscription exceeded the 5MB limit and was rejected",
        htmlResponse: "The response is HTML, not filter rule text",
        timeout: "Loading timed out; check whether the subscription URL is reachable",
        failed: "Load failed",
        blocked: "The request was blocked or could not be reached"
      }
    }
  };

  function normalizeLanguage(value) {
    return SUPPORTED_LANGUAGES.has(value) ? value : DEFAULT_LANGUAGE;
  }

  function interpolate(value, variables) {
    return String(value).replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => (
      Object.prototype.hasOwnProperty.call(variables || {}, key) ? String(variables[key]) : match
    ));
  }

  function lookup(language, key) {
    return String(key || "").split(".").reduce((current, part) => current?.[part], messages[language]);
  }

  function t(key, variables = {}) {
    const value = lookup(currentLanguage, key) ?? lookup(DEFAULT_LANGUAGE, key) ?? key;
    return interpolate(value, variables);
  }

  function readLanguage() {
    return new Promise((resolve) => {
      try {
        if (!global.chrome?.storage?.local?.get) {
          resolve(DEFAULT_LANGUAGE);
          return;
        }
        global.chrome.storage.local.get({ [STORAGE_KEY]: DEFAULT_LANGUAGE }, (items) => {
          resolve(normalizeLanguage(items?.[STORAGE_KEY]));
        });
      } catch {
        resolve(DEFAULT_LANGUAGE);
      }
    });
  }

  function notify() {
    for (const listener of listeners) {
      try {
        listener(currentLanguage);
      } catch (error) {
        console.warn("Ad Cleaner language listener failed:", error);
      }
    }
  }

  async function ready() {
    if (!readyPromise) {
      readyPromise = readLanguage().then((value) => {
        currentLanguage = value;
        return currentLanguage;
      });
    }
    return readyPromise;
  }

  async function setLanguage(value) {
    currentLanguage = normalizeLanguage(value);
    try {
      await new Promise((resolve, reject) => {
        if (!global.chrome?.storage?.local?.set) {
          resolve();
          return;
        }
        global.chrome.storage.local.set({ [STORAGE_KEY]: currentLanguage }, () => {
          const error = global.chrome.runtime?.lastError;
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    } finally {
      notify();
    }
    return currentLanguage;
  }

  function apply(root = global.document) {
    if (!root?.querySelectorAll) {
      return;
    }

    for (const element of root.querySelectorAll("[data-i18n]")) {
      element.textContent = t(element.getAttribute("data-i18n"));
    }
    for (const element of root.querySelectorAll("[data-i18n-placeholder]")) {
      element.setAttribute("placeholder", t(element.getAttribute("data-i18n-placeholder")));
    }
    for (const element of root.querySelectorAll("[data-i18n-title]")) {
      element.setAttribute("title", t(element.getAttribute("data-i18n-title")));
    }
    for (const element of root.querySelectorAll("[data-i18n-aria-label]")) {
      element.setAttribute("aria-label", t(element.getAttribute("data-i18n-aria-label")));
    }
    for (const element of root.querySelectorAll("[data-language]")) {
      const active = element.getAttribute("data-language") === currentLanguage;
      element.setAttribute("aria-pressed", String(active));
      element.classList.toggle("active", active);
    }
    for (const element of root.querySelectorAll("[data-language-toggle]")) {
      const switchToEnglish = currentLanguage === DEFAULT_LANGUAGE;
      element.textContent = switchToEnglish ? t("language.english") : t("language.chinese");
      element.setAttribute("aria-label", switchToEnglish ? t("language.switchToEnglish") : t("language.switchToChinese"));
      element.setAttribute("title", element.getAttribute("aria-label"));
    }
    if (root.documentElement) {
      root.documentElement.lang = currentLanguage;
    }
  }

  function bindLanguageSwitchers(root = global.document) {
    if (!root?.querySelectorAll) {
      return;
    }

    for (const element of root.querySelectorAll("[data-language]")) {
      if (element.dataset.i18nBound === "true") {
        continue;
      }
      element.dataset.i18nBound = "true";
      element.addEventListener("click", () => setLanguage(element.getAttribute("data-language")));
    }
    for (const element of root.querySelectorAll("[data-language-toggle]")) {
      if (element.dataset.i18nBound === "true") {
        continue;
      }
      element.dataset.i18nBound = "true";
      element.addEventListener("click", () => setLanguage(currentLanguage === DEFAULT_LANGUAGE ? "en" : DEFAULT_LANGUAGE));
    }
    apply(root);
  }

  function onChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  global.AdCleanerI18n = {
    STORAGE_KEY,
    DEFAULT_LANGUAGE,
    ready,
    t,
    apply,
    bindLanguageSwitchers,
    getLanguage: () => currentLanguage,
    setLanguage,
    onChange
  };

  global.chrome?.storage?.onChanged?.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[STORAGE_KEY]) {
      return;
    }
    const nextLanguage = normalizeLanguage(changes[STORAGE_KEY].newValue);
    if (nextLanguage !== currentLanguage) {
      currentLanguage = nextLanguage;
      notify();
    }
  });
})(globalThis);
