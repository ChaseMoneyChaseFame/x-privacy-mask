(function startContentScript() {
  const core = globalThis.XPrivacyMaskCore;
  if (!core) return;

  const state = {
    settings: { ...core.DEFAULT_SETTINGS },
    accountCard: null,
    account: { handle: '', displayName: '' },
    maskedNodes: new Set(),
    scheduled: false,
    observer: null,
    originalLabels: new WeakMap()
  };

  function getSurfaceColor(element) {
    let current = element;
    for (let depth = 0; current && depth < 5; depth += 1, current = current.parentElement) {
      const color = getComputedStyle(current).backgroundColor;
      if (color && !color.startsWith('rgba(0, 0, 0, 0)') && !color.startsWith('transparent')) {
        return color;
      }
    }
    return getComputedStyle(document.documentElement).backgroundColor || 'Canvas';
  }

  function updateAccessibleLabel(card, masked) {
    if (!card) return;
    if (masked) {
      if (!state.originalLabels.has(card)) {
        state.originalLabels.set(card, {
          ariaLabel: card.getAttribute('aria-label'),
          title: card.getAttribute('title')
        });
      }
      if (card.hasAttribute('aria-label')) card.setAttribute('aria-label', 'Account menu');
      if (card.hasAttribute('title')) card.removeAttribute('title');
    } else {
      const original = state.originalLabels.get(card);
      if (!original) return;
      if (original.ariaLabel === null) card.removeAttribute('aria-label');
      else card.setAttribute('aria-label', original.ariaLabel);
      if (original.title === null) card.removeAttribute('title');
      else card.setAttribute('title', original.title);
    }
  }

  function applyAccountCard() {
    const nextCard = core.findAccountCard(document);
    if (nextCard !== state.accountCard) {
      state.accountCard?.classList.remove('xpm-account-card', 'xpm-is-masked');
      if (state.accountCard) {
        state.accountCard.style.removeProperty('--xpm-mask-color');
        updateAccessibleLabel(state.accountCard, false);
      }
    }
    state.accountCard = nextCard;
    if (!nextCard) {
      state.account = { handle: '', displayName: '' };
      return;
    }

    state.account = core.extractAccount(nextCard);
    nextCard.classList.add('xpm-account-card');
    const masked = state.settings.enabled && state.settings.accountCard;
    nextCard.classList.toggle('xpm-is-masked', masked);
    if (masked) nextCard.style.setProperty('--xpm-mask-color', getSurfaceColor(nextCard));
    else nextCard.style.removeProperty('--xpm-mask-color');
    updateAccessibleLabel(nextCard, masked);
  }

  function clearIdentityNodes() {
    for (const node of state.maskedNodes) {
      if (node.isConnected) node.classList.remove('xpm-identity-node', 'xpm-is-masked');
    }
    state.maskedNodes.clear();
  }

  function markIdentity(node) {
    if (!node || node === state.accountCard || state.accountCard?.contains(node)) return;
    node.classList.add('xpm-identity-node');
    if (state.settings.enabled && state.settings.pageIdentity) {
      node.classList.add('xpm-is-masked');
      state.maskedNodes.add(node);
    }
  }

  function applyPageIdentity() {
    clearIdentityNodes();
    if (!state.settings.enabled || !state.settings.pageIdentity || !state.account.handle) return;

    for (const link of document.querySelectorAll('a[href]')) {
      if (core.isCurrentIdentityLink(link, state.account)) markIdentity(link);
    }

    const avatarKeys = new Set([...state.accountCard.querySelectorAll('img[src]')]
      .map((image) => core.avatarImageKey(image.getAttribute('src'))).filter(Boolean));
    // Composer avatars often have no profile link and only a generic image alt.
    // Mask the wrapper as X may also paint the avatar as a background image.
    for (const avatar of document.querySelectorAll('[data-testid^="UserAvatar-Container"]')) {
      if (core.isCurrentAvatar(avatar, state.account, avatarKeys)) markIdentity(avatar);
    }
  }

  function applyAll() {
    state.scheduled = false;
    applyAccountCard();
    applyPageIdentity();
    document.documentElement.classList.toggle('xpm-enabled', state.settings.enabled);
  }

  function scheduleApply() {
    if (state.scheduled) return;
    state.scheduled = true;
    window.setTimeout(applyAll, 80);
  }

  function setSettings(settings) {
    state.settings = core.normalizeSettings(settings);
    scheduleApply();
  }

  chrome.storage.local.get(core.DEFAULT_SETTINGS).then(setSettings).catch(() => scheduleApply());
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    const next = { ...state.settings };
    for (const key of Object.keys(core.DEFAULT_SETTINGS)) {
      if (changes[key]) next[key] = changes[key].newValue;
    }
    setSettings(next);
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== 'APPLY_SETTINGS') return false;
    setSettings(message.settings);
    sendResponse({ ok: true });
    return false;
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== 'GET_STATUS') return false;
    sendResponse({
      ok: true,
      settings: state.settings,
      detected: Boolean(state.accountCard),
      handle: state.account.handle
    });
    return false;
  });

  state.observer = new MutationObserver(scheduleApply);
  state.observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-testid', 'src', 'href'],
    characterData: true
  });
  window.addEventListener('popstate', scheduleApply);
  window.addEventListener('hashchange', scheduleApply);
  scheduleApply();
})();
