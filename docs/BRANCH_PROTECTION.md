# Branch Protection Rules

This document outlines the recommended branch protection rules for the Festivals repository to ensure code quality, security, and proper deployment workflows.

## Overview

Branch protection rules help maintain code quality by requiring certain checks and approvals before changes can be merged. These rules apply to critical branches like `main` and `development`.

## Protected Branches

### `main` Branch

The `main` branch represents the production-ready code. All changes must go through strict review and pass all quality gates.

#### Required Settings

```yaml
Branch name pattern: main

Rules:
  # Pull Request Requirements
  - require_pull_request:
      required_approving_review_count: 2
      dismiss_stale_reviews: true
      require_code_owner_reviews: true
      require_last_push_approval: true

  # Status Checks
  - require_status_checks:
      strict: true
      contexts:
        # CI Checks
        - "Backend Tests (Go 1.22)"
        - "Backend Tests (Go 1.23)"
        - "Backend Lint"
        - "Admin Build (Node 18)"
        - "Admin Build (Node 20)"
        - "Admin Build (Node 22)"
        - "Mobile Lint (Node 18)"
        - "Mobile Lint (Node 20)"
        - "Docker Build (festivals-api)"
        - "Docker Build (festivals-worker)"
        - "Docker Build (festivals-admin)"
        - "CI Summary"

        # Security Checks
        - "Go Security Scan"
        - "Go Vulnerability Check"
        - "NPM Audit (Admin)"
        - "NPM Audit (Mobile)"
        - "Trivy Scan (Backend)"
        - "Trivy Scan (Admin)"
        - "Secret Detection"
        - "Security Summary"

        # Quality Checks
        - "Go Linting"
        - "Go Formatting"
        - "ESLint (Admin)"
        - "ESLint (Mobile)"
        - "Prettier (Admin)"
        - "Prettier (Mobile)"
        - "TypeScript Check (Admin)"
        - "TypeScript Check (Mobile)"
        - "Quality Summary"

  # Additional Protections
  - require_conversation_resolution: true
  - require_signed_commits: false  # Optional but recommended
  - require_linear_history: false
  - allow_force_pushes: false
  - allow_deletions: false

  # Restrictions
  - restrictions:
      users: []
      teams:
        - maintainers
      apps:
        - github-actions
```

### `development` Branch

The `development` branch is used for integration and testing before merging to `main`.

#### Required Settings

```yaml
Branch name pattern: development

Rules:
  # Pull Request Requirements
  - require_pull_request:
      required_approving_review_count: 1
      dismiss_stale_reviews: true
      require_code_owner_reviews: false
      require_last_push_approval: false

  # Status Checks
  - require_status_checks:
      strict: true
      contexts:
        # CI Checks (minimum)
        - "Backend Tests (Go 1.23)"
        - "Backend Lint"
        - "Admin Build (Node 20)"
        - "Mobile Lint (Node 20)"
        - "CI Summary"

        # Security Checks
        - "Secret Detection"

        # Quality Checks
        - "Go Linting"
        - "ESLint (Admin)"
        - "Quality Summary"

  # Additional Protections
  - require_conversation_resolution: true
  - allow_force_pushes: false
  - allow_deletions: false
```

### Feature Branch Naming Convention

Feature branches should follow the naming convention:

```
<type>/<ticket-number>-<short-description>
```

Examples:
- `feat/FEST-123-add-oauth-login`
- `fix/FEST-456-resolve-payment-bug`
- `chore/FEST-789-update-dependencies`

Types:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `chore` - Maintenance
- `refactor` - Code refactoring
- `test` - Testing improvements

## Setting Up Branch Protection via GitHub UI

### Step 1: Navigate to Branch Protection Settings

1. Go to your repository on GitHub
2. Click **Settings** > **Branches**
3. Click **Add branch protection rule**

### Step 2: Configure Main Branch Protection

1. Enter `main` as the branch name pattern
2. Enable the following options:

   **Protect matching branches:**
   - [x] Require a pull request before merging
     - [x] Require approvals: 2
     - [x] Dismiss stale pull request approvals when new commits are pushed
     - [x] Require review from Code Owners
     - [x] Require approval of the most recent reviewable push

   - [x] Require status checks to pass before merging
     - [x] Require branches to be up to date before merging
     - Add required status checks (see list above)

   - [x] Require conversation resolution before merging
   - [x] Do not allow bypassing the above settings

   **Rules applied to everyone including administrators:**
   - [ ] Allow force pushes (keep disabled)
   - [ ] Allow deletions (keep disabled)

3. Click **Create** or **Save changes**

### Step 3: Configure Development Branch Protection

Repeat the process for `development` with relaxed settings as specified above.

## Setting Up Branch Protection via GitHub API

You can also configure branch protection using the GitHub API or Terraform.

### Using GitHub CLI

```bash
# Protect main branch
gh api -X PUT /repos/{owner}/{repo}/branches/main/protection \
  --input - << EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Backend Tests (Go 1.23)",
      "Backend Lint",
      "Admin Build (Node 20)",
      "CI Summary",
      "Security Summary",
      "Quality Summary"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismissal_restrictions": {},
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "required_approving_review_count": 2,
    "require_last_push_approval": true
  },
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
EOF
```

### Using Terraform

```hcl
resource "github_branch_protection" "main" {
  repository_id = github_repository.festivals.node_id
  pattern       = "main"

  required_status_checks {
    strict   = true
    contexts = [
      "Backend Tests (Go 1.23)",
      "Backend Lint",
      "Admin Build (Node 20)",
      "CI Summary",
      "Security Summary",
      "Quality Summary"
    ]
  }

  required_pull_request_reviews {
    dismiss_stale_reviews           = true
    require_code_owner_reviews      = true
    required_approving_review_count = 2
    require_last_push_approval      = true
  }

  enforce_admins = true

  allows_deletions    = false
  allows_force_pushes = false

  required_conversation_resolution = true
}
```

## CODEOWNERS File

Create a `CODEOWNERS` file in the repository root to automatically request reviews from specific teams or individuals.

```
# Default owners for everything
* @festivals/maintainers

# Backend code
/backend/ @festivals/backend-team
*.go @festivals/backend-team

# Frontend code
/admin/ @festivals/frontend-team
/mobile/ @festivals/mobile-team
*.ts @festivals/frontend-team
*.tsx @festivals/frontend-team

# Infrastructure
/k8s/ @festivals/devops-team
/.github/workflows/ @festivals/devops-team
/docker-compose*.yml @festivals/devops-team
Dockerfile* @festivals/devops-team

# Security-sensitive files
/backend/internal/domain/auth/ @festivals/security-team
/backend/internal/domain/security/ @festivals/security-team
*.env* @festivals/security-team

# Documentation
/docs/ @festivals/maintainers
*.md @festivals/maintainers
```

## Environment Protection Rules

GitHub Environments can have their own protection rules for deployments.

### Staging Environment

```yaml
Environment: staging
Protection rules:
  - required_reviewers: []  # No reviewers required
  - wait_timer: 0           # No wait time
  - deployment_branch_policy:
      protected_branches: true
      custom_branches:
        - main
        - development
```

### Production Environment

```yaml
Environment: production
Protection rules:
  - required_reviewers:
      - teams:
          - maintainers
          - devops-team
  - wait_timer: 5  # 5 minute wait before deployment
  - deployment_branch_policy:
      protected_branches: true
      custom_branches:
        - main
```

### Production Approval Environment

For the manual approval gate in production deployments:

```yaml
Environment: production-approval
Protection rules:
  - required_reviewers:
      - teams:
          - maintainers
      - users:
          - lead-developer
  - wait_timer: 0
  - deployment_branch_policy:
      protected_branches: true
```

## Rulesets (GitHub Enterprise)

For GitHub Enterprise users, Rulesets provide more granular control:

```yaml
Ruleset: Protect Main Branches
Target: main, development
Rules:
  - creation: deny
  - update:
      require_pull_request:
        required_approving_review_count: 2
        dismiss_stale_reviews: true
      require_status_checks:
        strict: true
        contexts: [...]
      require_linear_history: false
  - deletion: deny
  - force_push: deny
  - required_signatures: optional
```

## Best Practices

### 1. Start Strict, Relax When Needed

Begin with strict protection rules and relax them only when necessary. It's easier to loosen rules than to tighten them after issues occur.

### 2. Use Status Checks Wisely

Only require status checks that are:
- Reliable (low flakiness)
- Fast (under 10 minutes for most)
- Relevant to code quality

### 3. Review Regularly

Periodically review your branch protection rules to ensure they still meet your team's needs. Update required status checks when CI jobs change.

### 4. Document Bypass Procedures

Sometimes administrators need to bypass protections for emergency fixes. Document this process and ensure it includes:
- Logging of who bypassed and why
- Post-bypass review requirement
- Notification to the team

### 5. Use Protected Tags

For releases, consider protecting tags:

```bash
# Protect version tags
gh api -X POST /repos/{owner}/{repo}/tag-protection \
  -f pattern='v*'
```

## Troubleshooting

### Status Checks Not Appearing

If required status checks aren't appearing:

1. Ensure the workflow has run at least once on the branch
2. Check that the job name exactly matches the required check name
3. Verify the workflow triggers on pull requests

### Stale Reviews

If reviews are being dismissed unexpectedly:

1. Check if `dismiss_stale_reviews` is enabled
2. Review which commits triggered the dismissal
3. Consider using `require_last_push_approval` for clarity

### Force Push Prevention

If force pushes are being blocked when they shouldn't be:

1. Verify you're not on a protected branch
2. Check if a ruleset is applying additional restrictions
3. Contact a repository administrator

## Monitoring

Monitor branch protection effectiveness through:

1. **Audit logs** - Track who bypassed protections
2. **Security alerts** - Watch for unauthorized changes
3. **Deployment frequency** - Ensure protections don't slow down delivery too much

## References

- [GitHub Documentation: About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [GitHub API: Branch protection](https://docs.github.com/en/rest/branches/branch-protection)
- [GitHub Rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)
