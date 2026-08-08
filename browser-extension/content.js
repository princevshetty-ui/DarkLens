const CHECKOUT_PATH_PATTERN = /(?:^|\/)(checkout|cart|viewcart|payment|billing|order-review|place-order)(?:\/|$)/i;
const PASSIVE_SCAN_DELAY_MS = 1500;

let passiveScanTimer = null;
let lastTriggeredSignature = "";
let isPassiveScanInFlight = false;
let routeObserver = null;

function getCurrentSignature() {
  return `${location.pathname}${location.search}${location.hash}`;
}

function isCheckoutLikeUrl(url) {
  try {
    const parsed = new URL(url);
    return CHECKOUT_PATH_PATTERN.test(parsed.pathname);
  } catch {
    return false;
  }
}

function schedulePassiveScan() {
  if (!isCheckoutLikeUrl(location.href)) {
    return;
  }

  if (isPassiveScanInFlight) {
    return;
  }

  const signature = getCurrentSignature();
  if (signature === lastTriggeredSignature) {
    return;
  }

  if (passiveScanTimer) {
    clearTimeout(passiveScanTimer);
  }

  passiveScanTimer = window.setTimeout(() => {
    if (!isCheckoutLikeUrl(location.href)) {
      return;
    }

    const latestSignature = getCurrentSignature();
    if (latestSignature === lastTriggeredSignature) {
      return;
    }

    lastTriggeredSignature = latestSignature;
    isPassiveScanInFlight = true;

    chrome.runtime.sendMessage({
      type: "START_PASSIVE_SCAN",
      url: location.href,
      title: document.title,
    }).catch(() => {
      // Ignore failures; the background script will handle state and badge updates.
    }).finally(() => {
      isPassiveScanInFlight = false;
    });
  }, PASSIVE_SCAN_DELAY_MS);
}

function observePageChanges() {
  if (routeObserver || !document.body) {
    return;
  }

  routeObserver = new MutationObserver(() => {
    schedulePassiveScan();
  });

  routeObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true,
  });
}

function patchHistoryNavigation() {
  if (window.__darklensPatched) {
    return;
  }

  const notifyRouteChange = () => {
    window.dispatchEvent(new Event("darklens-route-change"));
  };

  const originalPushState = window.history.pushState;
  window.history.pushState = function patchedPushState(...args) {
    const result = originalPushState.apply(this, args);
    notifyRouteChange();
    return result;
  };

  const originalReplaceState = window.history.replaceState;
  window.history.replaceState = function patchedReplaceState(...args) {
    const result = originalReplaceState.apply(this, args);
    notifyRouteChange();
    return result;
  };

  window.addEventListener("popstate", schedulePassiveScan);
  window.addEventListener("darklens-route-change", schedulePassiveScan);
  window.__darklensPatched = true;
}

function initPassiveScanning() {
  if (!document.body) {
    window.addEventListener("load", initPassiveScanning, { once: true });
    return;
  }

  patchHistoryNavigation();
  observePageChanges();
  schedulePassiveScan();
}

initPassiveScanning();
