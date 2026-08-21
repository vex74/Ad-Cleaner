(function initializeAdCleanerTheme(global) {
  const STORAGE_KEY = "adCleanerThemePreference";
  const SYSTEM = "system";
  const PREFERENCES = [SYSTEM, "dark", "light"];
  const mediaQuery = global.matchMedia?.("(prefers-color-scheme: dark)");
  let preference = SYSTEM;
  let readyPromise = null;

  function normalizePreference(value) {
    return PREFERENCES.includes(value) ? value : SYSTEM;
  }

  function resolvedTheme() {
    return preference === SYSTEM ? (mediaQuery?.matches ? "dark" : "light") : preference;
  }

  function renderThemeToggles(root = global.document, translate) {
    if (!root?.querySelectorAll) {
      return;
    }

    for (const element of root.querySelectorAll("[data-theme-toggle]")) {
      const t = translate || element._adCleanerThemeTranslate;
      if (t) {
        const label = t(`theme.${preference}`);
        element.textContent = label;
        element.setAttribute("aria-label", t("theme.cycle", { mode: label }));
        element.setAttribute("title", t("theme.cycle", { mode: label }));
      }
      element.dataset.themePreference = preference;
    }
  }

  function applyTheme(value) {
    preference = normalizePreference(value);
    const root = global.document?.documentElement;
    if (root) {
      root.dataset.theme = resolvedTheme();
      root.dataset.themePreference = preference;
    }
    renderThemeToggles();
    return preference;
  }

  function readPreference() {
    return new Promise((resolve) => {
      try {
        if (!global.chrome?.storage?.local?.get) {
          resolve(SYSTEM);
          return;
        }
        global.chrome.storage.local.get({ [STORAGE_KEY]: SYSTEM }, (items) => {
          resolve(normalizePreference(items?.[STORAGE_KEY]));
        });
      } catch {
        resolve(SYSTEM);
      }
    });
  }

  async function ready() {
    if (!readyPromise) {
      readyPromise = readPreference().then((value) => applyTheme(value));
    }
    return readyPromise;
  }

  async function setPreference(value) {
    const next = applyTheme(value);
    if (!global.chrome?.storage?.local?.set) {
      return next;
    }
    await new Promise((resolve, reject) => {
      global.chrome.storage.local.set({ [STORAGE_KEY]: next }, () => {
        const error = global.chrome.runtime?.lastError;
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    return next;
  }

  function nextPreference() {
    return PREFERENCES[(PREFERENCES.indexOf(preference) + 1) % PREFERENCES.length];
  }

  function bindThemeToggles(root = global.document, translate) {
    if (!root?.querySelectorAll) {
      return;
    }
    for (const element of root.querySelectorAll("[data-theme-toggle]")) {
      element._adCleanerThemeTranslate = translate;
      if (element.dataset.themeBound === "true") {
        continue;
      }
      element.dataset.themeBound = "true";
      element.addEventListener("click", () => setPreference(nextPreference()));
    }
    renderThemeToggles(root, translate);
  }

  applyTheme(SYSTEM);
  mediaQuery?.addEventListener?.("change", () => {
    if (preference === SYSTEM) {
      applyTheme(SYSTEM);
    }
  });
  global.chrome?.storage?.onChanged?.addListener((changes, areaName) => {
    if (areaName === "local" && changes[STORAGE_KEY]) {
      applyTheme(changes[STORAGE_KEY].newValue);
    }
  });

  global.AdCleanerTheme = {
    STORAGE_KEY,
    ready,
    getPreference: () => preference,
    getResolvedTheme: resolvedTheme,
    setPreference,
    bindThemeToggles,
    renderThemeToggles
  };
})(globalThis);
