const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

// Synthetic X DOM: runs the actual content script and stylesheet without login/network.
const avatar = (id, owner, file = 'self_normal.jpg') => `
  <div id="${id}" data-testid="UserAvatar-Container${owner ? `-${owner}` : ''}"
       style="width:40px;height:40px;background-image:url(https://pbs.twimg.com/profile_images/123/${file})">
    <img alt="头像" src="https://pbs.twimg.com/profile_images/123/${file}">
  </div>`;

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.route('**/*', (route) => route.abort());
    await page.setContent(`<button data-testid="SideNav_AccountSwitcher_Button">
      <span>My Name</span><span id="handle">@my_user</span>${avatar('account-avatar', 'my_user')}
      </button><main>${avatar('inline', 'my_user')}</main>`);
    await page.evaluate(() => {
      window.chrome = {
        storage: {
          local: { get: async () => ({ enabled: true, accountCard: true, pageIdentity: true }) },
          onChanged: { addListener: (listener) => { window.changeSettings = listener; } }
        },
        runtime: { onMessage: { addListener() {} } }
      };
    });
    const extension = path.join(__dirname, '../extension');
    await page.addStyleTag({ path: path.join(extension, 'content.css') });
    await page.addScriptTag({ path: path.join(extension, 'shared.js') });
    await page.addScriptTag({ path: path.join(extension, 'content.js') });
    async function masked(id, expected) {
      await page.waitForFunction(({ id, expected }) => {
        const node = document.getElementById(id);
        return node.classList.contains('xpm-is-masked') === expected;
      }, { id, expected });
      if (expected) {
        assert.equal(await page.locator(`#${id}`).evaluate((node) => getComputedStyle(node).filter), 'opacity(0)');
        assert.equal(await page.locator(`#${id} img`).evaluate((node) => getComputedStyle(node).visibility), 'hidden');
      }
    }
    const settings = async (changes) => {
      await page.evaluate((changes) => window.changeSettings(
        Object.fromEntries(Object.entries(changes).map(([key, value]) => [key, { newValue: value }])), 'local'), changes);
    };
    await masked('inline', true);
    // Opening a reply after the content script has started must trigger masking.
    await page.evaluate((html) => document.body.insertAdjacentHTML('beforeend', html), `
      <div role="dialog">${avatar('other', 'someone_else', 'other_normal.jpg')}
        ${avatar('reply', 'MY_USER')}
        <div contenteditable="true" data-testid="tweetTextarea_0"></div>
        ${avatar('fallback', '', 'self_400x400.jpg')}
        ${avatar('same-photo-other', 'someone_else')}
        <a href="/someone_else">${avatar('linked-other', '')}</a>
      </div>`);
    await masked('reply', true);
    await masked('fallback', true);
    for (const id of ['other', 'same-photo-other', 'linked-other']) await masked(id, false);
    assert.equal(await page.locator('[contenteditable]').evaluate((node) => getComputedStyle(node).filter), 'none');
    console.log('PASS: dynamically opened reply, generic alt, unlinked avatar, size fallback, other author and editor preserved');

    await settings({ pageIdentity: false });
    await masked('reply', false);
    assert.equal(await page.locator('#reply').evaluate((node) => getComputedStyle(node).filter), 'none');
    await settings({ pageIdentity: true });
    await masked('reply', true);
    await settings({ enabled: false });
    await masked('reply', false);
    await settings({ enabled: true });
    await masked('reply', true);
    console.log('PASS: page identity and master switches restore avatar visibility');

    // React may recycle nodes with only attribute/text updates.
    await page.locator('#reply').evaluate((node) => node.setAttribute('data-testid', 'UserAvatar-Container-someone_else'));
    await masked('reply', false);
    await page.locator('#fallback img').evaluate((node) => node.setAttribute('src', 'https://pbs.twimg.com/profile_images/456/different.jpg'));
    await masked('fallback', false);
    await page.evaluate(() => {
      document.querySelector('#handle').firstChild.data = '@someone_else';
      document.querySelector('#account-avatar').setAttribute('data-testid', 'UserAvatar-Container-someone_else');
    });
    await masked('reply', true);
    await masked('inline', false);
    // Narrow sidebars may omit the handle text entirely.
    await page.locator('#handle').evaluate((node) => node.remove());
    await masked('other', true);
    await page.waitForTimeout(200);
    await masked('other', true);
    console.log('PASS: recycled DOM attributes, image changes, account switch and collapsed account card');
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
