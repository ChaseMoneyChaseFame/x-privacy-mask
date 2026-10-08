const DEFAULT_SETTINGS = {
  enabled: true,
  accountCard: true,
  pageIdentity: false
};

function normalizeSettings(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    enabled: source.enabled !== false,
    accountCard: source.accountCard !== false,
    pageIdentity: source.pageIdentity === true
  };
}

async function getSettings() {
  const stored = await chrome.storage.local.get(DEFAULT_SETTINGS);
  return normalizeSettings(stored);
}

async function broadcastSettings(settings) {
  const tabs = await chrome.tabs.query({
    url: ['https://x.com/*', 'https://twitter.com/*']
  });
  await Promise.all(tabs.map(async (tab) => {
    if (!tab.id) return;
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'APPLY_SETTINGS', settings });
    } catch (_error) {
      // The tab may still be loading or have no content-script document.
    }
  }));
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-enabled') return;
  const current = await getSettings();
  const settings = { ...current, enabled: !current.enabled };
  await chrome.storage.local.set(settings);
  await broadcastSettings(settings);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== 'SET_SETTINGS') return false;
  const settings = normalizeSettings(message.settings);
  chrome.storage.local.set(settings)
    .then(() => broadcastSettings(settings))
    .then(() => sendResponse({ ok: true, settings }))
    .catch((error) => sendResponse({ ok: false, error: String(error) }));
  return true;
});

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(DEFAULT_SETTINGS);
  await chrome.storage.local.set(normalizeSettings(current));
});
