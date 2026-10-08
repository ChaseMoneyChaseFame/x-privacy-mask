const DEFAULT_SETTINGS = {
  enabled: true,
  accountCard: true,
  pageIdentity: false
};

const controls = {
  enabled: document.querySelector('#enabled'),
  accountCard: document.querySelector('#accountCard'),
  pageIdentity: document.querySelector('#pageIdentity'),
  statusText: document.querySelector('#statusText'),
  detectionText: document.querySelector('#detectionText'),
  options: document.querySelector('.options')
};

let activeTabId = null;
let currentSettings = { ...DEFAULT_SETTINGS };

function normalizeSettings(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    enabled: source.enabled !== false,
    accountCard: source.accountCard !== false,
    pageIdentity: source.pageIdentity === true
  };
}

function render(settings, status) {
  currentSettings = normalizeSettings(settings);
  controls.enabled.checked = currentSettings.enabled;
  controls.accountCard.checked = currentSettings.accountCard;
  controls.pageIdentity.checked = currentSettings.pageIdentity;
  controls.options.classList.toggle('is-disabled', !currentSettings.enabled);
  controls.statusText.textContent = currentSettings.enabled ? '隐私模式已开启' : '隐私模式已关闭';
  if (status && status.detected === false) {
    controls.detectionText.textContent = '当前页面暂未检测到账号卡';
  } else if (status && status.handle) {
    controls.detectionText.textContent = `已识别当前账号：${status.handle}`;
  } else {
    controls.detectionText.textContent = '';
  }
}

async function readSettings() {
  const stored = await chrome.storage.local.get(DEFAULT_SETTINGS);
  render(stored);
}

async function readTabStatus() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTabId = tab?.id || null;
  if (!tab?.url || !/^https:\/\/(x\.com|twitter\.com)\//.test(tab.url)) {
    controls.detectionText.textContent = '请在 x.com 或 twitter.com 页面使用';
    return;
  }
  try {
    const status = await chrome.tabs.sendMessage(activeTabId, { type: 'GET_STATUS' });
    render(status.settings, status);
  } catch (_error) {
    controls.detectionText.textContent = '页面仍在加载，请稍后重试';
  }
}

async function updateSettings(patch) {
  const next = normalizeSettings({ ...currentSettings, ...patch });
  render(next);
  const response = await chrome.runtime.sendMessage({ type: 'SET_SETTINGS', settings: next });
  if (!response?.ok) controls.detectionText.textContent = '保存失败，请重试';
  if (activeTabId) {
    try {
      const status = await chrome.tabs.sendMessage(activeTabId, { type: 'GET_STATUS' });
      render(next, status);
    } catch (_error) {
      // The storage update still applies on the next page load.
    }
  }
}

controls.enabled.addEventListener('change', () => updateSettings({ enabled: controls.enabled.checked }));
controls.accountCard.addEventListener('change', () => updateSettings({ accountCard: controls.accountCard.checked }));
controls.pageIdentity.addEventListener('change', () => updateSettings({ pageIdentity: controls.pageIdentity.checked }));

readSettings().then(readTabStatus).catch(() => {
  controls.detectionText.textContent = '读取设置失败，请重新打开扩展';
});
