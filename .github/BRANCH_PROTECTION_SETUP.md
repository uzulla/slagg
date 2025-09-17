# Branch Protection Rules Setup Guide

This document provides step-by-step instructions for configuring branch protection rules to make all CI workflows required for pull request merges.

## Required Status Checks Configuration

### Step 1: Access Repository Settings

1. Navigate to your GitHub repository
2. Click on the **Settings** tab
3. In the left sidebar, click on **Branches**

### Step 2: Add Branch Protection Rule

1. Click **Add rule** button
2. In the **Branch name pattern** field, enter: `main`
3. Check the following options:

#### Required Status Checks

✅ **Require status checks to pass before merging**

Under "Status checks that are required", add the following checks:

- `test (20.x)` - Test workflow with Node.js 20.x
- `test (22.x)` - Test workflow with Node.js 22.x  
- `lint` - Lint workflow
- `format` - Format Check workflow
- `biome-check` - Biome Check workflow

✅ **Require branches to be up to date before merging**

#### Additional Recommended Settings

✅ **Require pull request reviews before merging**
- Required number of reviewers: 1 (adjust as needed)

✅ **Dismiss stale pull request approvals when new commits are pushed**

✅ **Restrict pushes that create files**

### Step 3: Save Protection Rule

1. Scroll down and click **Create** to save the branch protection rule

## Verification Steps

After setting up the branch protection rules, verify the configuration:

### 1. Create a Test Pull Request

Create a new branch and make a small change to test the protection rules:

```bash
git checkout -b test-branch-protection
echo "# Test" >> TEST.md
git add TEST.md
git commit -m "Test branch protection"
git push origin test-branch-protection
```

### 2. Open Pull Request

1. Go to GitHub and create a pull request from `test-branch-protection` to `main`
2. Verify that all 5 status checks appear:
   - Test (20.x)
   - Test (22.x)
   - Lint
   - Format Check
   - Biome Check

### 3. Check Merge Blocking

1. While checks are running or if any fail, verify that the **Merge pull request** button is disabled
2. Confirm that GitHub shows a message like "Merging is blocked" with details about required status checks

### 4. Verify Successful Merge

1. Once all checks pass (green checkmarks), verify that the **Merge pull request** button becomes enabled
2. The PR should show "All checks have passed"

## Status Check Names Reference

The following status check names should be configured as required:

| Workflow File | Job Name | Status Check Name |
|---------------|----------|-------------------|
| `test.yml` | `test` | `test (20.x)` |
| `test.yml` | `test` | `test (22.x)` |
| `lint.yml` | `lint` | `lint` |
| `format.yml` | `format` | `format` |
| `biome-check.yml` | `biome-check` | `biome-check` |

## Troubleshooting

### Status Checks Not Appearing

If status checks don't appear in the dropdown:

1. Ensure the workflows have run at least once on a pull request
2. Check that workflow files are in the correct location (`.github/workflows/`)
3. Verify workflow syntax is correct
4. Make sure the workflows are triggered on `pull_request` events

### Merge Still Allowed Despite Failing Checks

1. Verify that "Require status checks to pass before merging" is enabled
2. Check that all required status check names are correctly spelled
3. Ensure you have the correct permissions to enforce branch protection

### Checks Not Running

1. Verify workflows are triggered on the correct events (`pull_request` and `push` to `main`)
2. Check that the repository has GitHub Actions enabled
3. Review workflow logs for any syntax or configuration errors

## Requirements Satisfied

This configuration satisfies the following requirements:

- **5.1**: All CI workflow statuses are visible in GitHub pull requests
- **5.2**: Status shows "pending" during execution with progress information
- **5.3**: Status shows "success" with green checkmarks when checks pass
- **5.4**: Status shows "failure" with detailed error information when checks fail
- **5.5**: All 4 CI workflows are configured as required for PR merge
- **5.6**: Pull requests cannot be merged while any workflow is failing
