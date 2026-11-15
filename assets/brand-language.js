/* 2026-11-11：复用 UI 1111 品牌资源，首页和营销页按各自的现有语言设置切换字标。 */
(() => {
  const logo = document.querySelector("[data-vina-brand-logo]");
  if (!logo) return;
  const entryBrand = logo.closest(".marketing-entry-brand");

  function syncBrand(language) {
    const domestic = language.toLowerCase() === "zh-cn";
    const asset = domestic ? "laihua-white.svg" : "vina-white.svg";
    const source = new URL("./assets/images/brand/" + asset, document.baseURI).href;
    const name = domestic ? "来画" : "Vina";
    if (logo.src !== source) logo.src = source;
    if (logo.alt !== name) logo.alt = name;
    if (entryBrand && entryBrand.getAttribute("aria-label") !== name) entryBrand.setAttribute("aria-label", name);
  }

  document.addEventListener("vina:language-change", event => syncBrand(event.detail.language));
  // 营销页通过根节点 lang 同步语言，嵌入与独立访问共用同一逻辑。
  const root = document.documentElement;
  new MutationObserver(() => syncBrand(root.lang)).observe(root, { attributes: true, attributeFilter: ["lang"] });
  const requestedLanguage = new URLSearchParams(window.location.search).get("lang");
  syncBrand(requestedLanguage === "en" || requestedLanguage === "ar" ? requestedLanguage : root.lang);
})();
