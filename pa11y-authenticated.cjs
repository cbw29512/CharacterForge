const username = process.env.CI_AUDIT_USERNAME;
const password = process.env.CI_AUDIT_PASSWORD;
const role = process.env.CI_AUDIT_ROLE;
const path = process.env.CI_AUDIT_PATH;
const baseUrl = process.env.CI_BASE_URL || 'http://127.0.0.1:5050';

if (!username || !password || !role || !path) {
  throw new Error('CI_AUDIT_USERNAME, CI_AUDIT_PASSWORD, CI_AUDIT_ROLE, and CI_AUDIT_PATH are required');
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
    `click element .role-btn[data-role="${role}"]`,
    'click element button[type=submit]',
    'wait for path to not be /auth/login',
    `navigate to ${baseUrl}${path}`,
    `wait for path to be ${path}`
  ]
};
