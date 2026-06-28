export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      ['app', 'pages', 'widgets', 'features', 'entities', 'shared', 'e2e', 'ci', 'deps'],
    ],
  },
};
