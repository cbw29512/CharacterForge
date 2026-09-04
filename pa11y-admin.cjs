const username = process.env.CI_ADMIN_USERNAME;
const password = process.env.CI_ADMIN_PASSWORD;

if (!username || !password) {
  throw new Error('CI admin credentials are required for the authenticated accessibility audit');
}

module.exports = {
  standard: 'WCAG2AA',
  timeout: 30000,
  chromeLaunchConfig: {
    args: ['--no-sandbox']
  },
  actions: [
    `set field #login-username to ${username}`,
    `set field #login-password to ${password}`,
    'click element button[type=submit]',
    'wait for path to be /admin/'
  ]
};
