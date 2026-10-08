(function attachCore(root) {
  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    accountCard: true,
    pageIdentity: false
  });

  const ACCOUNT_CARD_SELECTORS = [
    '[data-testid="SideNav_AccountSwitcher_Button"]',
    'button[aria-label*="Account menu"]',
    'button[aria-label*="账户菜单"]'
  ];

  const RESERVED_PATHS = new Set([
    'home', 'explore', 'notifications', 'messages', 'i', 'compose',
    'settings', 'search', 'bookmarks', 'lists', 'communities', 'premium',
    'jobs', 'spaces', 'articles', 'grok', 'login', 'logout'
  ]);

  function normalizeSettings(value) {
    const source = value && typeof value === 'object' ? value : {};
    return {
      enabled: source.enabled !== false,
      accountCard: source.accountCard !== false,
      pageIdentity: source.pageIdentity === true
    };
  }

  function normalizeHandle(value) {
    if (!value) return '';
    const match = String(value).trim().match(/^@?([A-Za-z0-9_]{1,15})$/);
    return match ? `@${match[1].toLowerCase()}` : '';
  }

  function handleFromHref(href) {
    if (!href) return '';
    try {
      const url = new URL(href, 'https://x.com');
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length !== 1 || RESERVED_PATHS.has(parts[0].toLowerCase())) return '';
      return normalizeHandle(parts[0]);
    } catch (_error) {
      return '';
    }
  }

  function handleFromText(text) {
    const match = String(text || '').match(/@([A-Za-z0-9_]{1,15})(?![A-Za-z0-9_])/);
    return match ? normalizeHandle(match[1]) : '';
  }

  function handleFromAvatar(node) {
    const testId = node?.getAttribute('data-testid') || '';
    return testId.startsWith('UserAvatar-Container-')
      ? normalizeHandle(testId.slice('UserAvatar-Container-'.length)) : '';
  }

  function avatarImageKey(source) {
    try {
      const url = new URL(source);
      if (url.hostname !== 'pbs.twimg.com' || !/^\/profile_images\/\d+\//.test(url.pathname)) return '';
      return url.pathname.replace(/_(normal|bigger|mini|\d+x\d+)(?=\.[^.]+$)/, '');
    } catch (_error) {
      return '';
    }
  }

  function isCurrentAvatar(node, account, avatarKeys) {
    const owner = handleFromAvatar(node);
    if (owner) return owner === account.handle;
    const link = node.closest('a[href]') || node.querySelector('a[href]');
    const linkedOwner = link && handleFromHref(link.getAttribute('href'));
    if (linkedOwner) return linkedOwner === account.handle;
    return [...node.querySelectorAll('img')].some((image) => {
      const key = avatarImageKey(image.getAttribute('src'));
      return key && avatarKeys.has(key);
    });
  }

  function findAccountCard(rootDocument) {
    for (const selector of ACCOUNT_CARD_SELECTORS) {
      const element = rootDocument.querySelector(selector);
      if (element) return element;
    }
    return null;
  }

  function extractAccount(card) {
    if (!card) return { handle: '', displayName: '' };

    const links = [...card.querySelectorAll('a[href]')];
    const handle = links.map((link) => handleFromHref(link.getAttribute('href'))).find(Boolean)
      || handleFromText(card.textContent)
      || [...card.querySelectorAll('[data-testid^="UserAvatar-Container-"]')]
        .map(handleFromAvatar).find(Boolean) || '';
    const displayName = [...card.querySelectorAll('span, div')]
      .map((node) => (node.textContent || '').trim())
      .find((text) => text && !text.startsWith('@') && text.length <= 80) || '';
    return { handle, displayName };
  }

  function isCurrentIdentityLink(node, account) {
    if (!node || !account.handle) return false;
    return handleFromHref(node.getAttribute('href')) === account.handle;
  }

  const core = {
    DEFAULT_SETTINGS,
    ACCOUNT_CARD_SELECTORS,
    normalizeSettings,
    normalizeHandle,
    handleFromHref,
    handleFromText,
    handleFromAvatar,
    avatarImageKey,
    isCurrentAvatar,
    findAccountCard,
    extractAccount,
    isCurrentIdentityLink
  };

  root.XPrivacyMaskCore = core;
  if (typeof module !== 'undefined' && module.exports) module.exports = core;
})(typeof globalThis !== 'undefined' ? globalThis : window);
