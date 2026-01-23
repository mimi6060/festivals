/**
 * Commitlint Configuration
 * https://commitlint.js.org/
 *
 * Enforces conventional commit format:
 * <type>(<scope>): <subject>
 *
 * Examples:
 * - feat(auth): add OAuth2 login support
 * - fix(api): resolve null pointer in user handler
 * - docs(readme): update installation instructions
 * - chore(deps): bump dependencies
 */

module.exports = {
  extends: ['@commitlint/config-conventional'],
  parserPreset: 'conventional-changelog-conventionalcommits',
  rules: {
    // Type rules
    'type-enum': [
      2,
      'always',
      [
        'feat', // New feature
        'fix', // Bug fix
        'docs', // Documentation only
        'style', // Code style (formatting, semicolons, etc.)
        'refactor', // Code change that neither fixes a bug nor adds a feature
        'perf', // Performance improvement
        'test', // Adding or updating tests
        'build', // Build system or external dependencies
        'ci', // CI/CD configuration
        'chore', // Other changes (maintenance, tooling)
        'revert', // Reverts a previous commit
        'wip', // Work in progress (should not be in main)
      ],
    ],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],

    // Scope rules
    'scope-case': [2, 'always', 'lower-case'],
    'scope-enum': [
      1, // Warning only - scopes are optional
      'always',
      [
        // Backend scopes
        'api',
        'auth',
        'db',
        'cache',
        'worker',
        'middleware',
        'config',
        'domain',
        'infra',

        // Frontend scopes
        'admin',
        'mobile',
        'ui',
        'components',

        // Feature scopes
        'festival',
        'ticket',
        'wallet',
        'lineup',
        'security',
        'staff',
        'nfc',
        'analytics',

        // General scopes
        'deps',
        'docker',
        'k8s',
        'ci',
        'test',
        'docs',
        'release',
      ],
    ],

    // Subject rules
    'subject-case': [
      2,
      'never',
      ['sentence-case', 'start-case', 'pascal-case', 'upper-case'],
    ],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'subject-min-length': [2, 'always', 10],
    'subject-max-length': [2, 'always', 72],

    // Header rules
    'header-max-length': [2, 'always', 100],

    // Body rules
    'body-leading-blank': [2, 'always'],
    'body-max-line-length': [2, 'always', 100],
    'body-case': [0], // No restriction on body case

    // Footer rules
    'footer-leading-blank': [2, 'always'],
    'footer-max-line-length': [2, 'always', 100],

    // References rules (for issue/PR references)
    'references-empty': [0], // Allow commits without references
  },
  prompt: {
    questions: {
      type: {
        description: "Select the type of change you're committing",
        enum: {
          feat: {
            description: 'A new feature',
            title: 'Features',
            emoji: 'sparkles',
          },
          fix: {
            description: 'A bug fix',
            title: 'Bug Fixes',
            emoji: 'bug',
          },
          docs: {
            description: 'Documentation only changes',
            title: 'Documentation',
            emoji: 'memo',
          },
          style: {
            description: 'Changes that do not affect the meaning of the code',
            title: 'Styles',
            emoji: 'art',
          },
          refactor: {
            description: 'A code change that neither fixes a bug nor adds a feature',
            title: 'Code Refactoring',
            emoji: 'recycle',
          },
          perf: {
            description: 'A code change that improves performance',
            title: 'Performance Improvements',
            emoji: 'zap',
          },
          test: {
            description: 'Adding missing tests or correcting existing tests',
            title: 'Tests',
            emoji: 'test_tube',
          },
          build: {
            description: 'Changes that affect the build system or external dependencies',
            title: 'Builds',
            emoji: 'hammer',
          },
          ci: {
            description: 'Changes to CI configuration files and scripts',
            title: 'Continuous Integration',
            emoji: 'construction_worker',
          },
          chore: {
            description: "Other changes that don't modify src or test files",
            title: 'Chores',
            emoji: 'wrench',
          },
          revert: {
            description: 'Reverts a previous commit',
            title: 'Reverts',
            emoji: 'rewind',
          },
        },
      },
      scope: {
        description: 'What is the scope of this change (e.g. api, admin, mobile)?',
      },
      subject: {
        description: 'Write a short, imperative tense description of the change',
      },
      body: {
        description: 'Provide a longer description of the change (optional)',
      },
      isBreaking: {
        description: 'Are there any breaking changes?',
      },
      breakingBody: {
        description:
          'A BREAKING CHANGE commit requires a body. Please enter a longer description of the commit itself',
      },
      breaking: {
        description: 'Describe the breaking changes',
      },
      isIssueAffected: {
        description: 'Does this change affect any open issues?',
      },
      issuesBody: {
        description:
          'If issues are closed, the commit requires a body. Please enter a longer description of the commit itself',
      },
      issues: {
        description: 'Add issue references (e.g. "fix #123", "closes #456")',
      },
    },
  },
};
