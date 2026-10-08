const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../extension/shared.js');

test('头像容器识别完整账号，拒绝部分匹配', () => {
  const node = (id) => ({ getAttribute: () => id });
  assert.equal(core.handleFromAvatar(node('UserAvatar-Container-MY_user')), '@my_user');
  assert.equal(core.handleFromAvatar(node('UserAvatar-Container')), '');
  assert.equal(core.handleFromAvatar(node('Other-MY_user')), '');
});

test('头像图片跨尺寸匹配，但默认头像、非头像及不同文件不混淆', () => {
  const base = 'https://pbs.twimg.com/profile_images/123/';
  assert.equal(core.avatarImageKey(`${base}photo_normal.jpg`), core.avatarImageKey(`${base}photo_400x400.jpg?x=1`));
  assert.notEqual(core.avatarImageKey(`${base}photo.jpg`), core.avatarImageKey(`${base}other.jpg`));
  assert.equal(core.avatarImageKey('https://pbs.twimg.com/sticky/default_profile_images/default.png'), '');
  assert.equal(core.avatarImageKey('https://example.com/profile_images/123/photo.jpg'), '');
  assert.equal(core.avatarImageKey(''), '');
});

test('默认设置保护性开启账号卡，关闭页面身份', () => {
  assert.deepEqual(core.normalizeSettings({}), {
    enabled: true,
    accountCard: true,
    pageIdentity: false
  });
});

test('设置只接受明确的布尔开关', () => {
  assert.deepEqual(core.normalizeSettings({ enabled: 0, accountCard: null, pageIdentity: 'yes' }), {
    enabled: true,
    accountCard: true,
    pageIdentity: false
  });
  assert.deepEqual(core.normalizeSettings({ enabled: false, accountCard: false, pageIdentity: true }), {
    enabled: false,
    accountCard: false,
    pageIdentity: true
  });
});

test('只接受 X 用户名格式，并统一为小写句柄', () => {
  assert.equal(core.normalizeHandle('@Example_User'), '@example_user');
  assert.equal(core.normalizeHandle('a_b'), '@a_b');
  assert.equal(core.normalizeHandle('this-has-dash'), '');
  assert.equal(core.normalizeHandle(''), '');
});

test('从用户链接提取句柄，并拒绝保留路径', () => {
  assert.equal(core.handleFromHref('/Example_User'), '@example_user');
  assert.equal(core.handleFromHref('https://x.com/Example_User/status/1'), '');
  assert.equal(core.handleFromHref('/home'), '');
  assert.equal(core.handleFromHref('/settings/profile'), '');
});

test('当前用户判断只匹配同一个用户链接', () => {
  const account = { handle: '@example_user' };
  assert.equal(core.isCurrentIdentityLink({ getAttribute: () => '/Example_User' }, account), true);
  assert.equal(core.isCurrentIdentityLink({ getAttribute: () => '/someone_else' }, account), false);
  assert.equal(core.isCurrentIdentityLink({ getAttribute: () => '/Example_User/status/1' }, account), false);
});
