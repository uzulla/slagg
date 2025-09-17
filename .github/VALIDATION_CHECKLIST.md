# Branch Protection Validation Checklist

This checklist helps validate that branch protection rules are working correctly according to the requirements.

## Prerequisites

Before running validation tests:

- [ ] All 4 CI workflow files are present in `.github/workflows/`
- [ ] Branch protection rules have been configured (manually or via script)
- [ ] GitHub CLI is installed and authenticated
- [ ] You have appropriate repository permissions

## Validation Tests

### Test 1: Status Check Visibility (Requirement 5.1)

**Objective**: Verify all CI workflow statuses are visible in GitHub pull requests

**Steps**:
1. Run: `./.github/scripts/test-branch-protection.sh`
2. Check the created PR in GitHub web interface
3. Verify all 5 status checks are visible:
   - [ ] Test (20.x)
   - [ ] Test (22.x)
   - [ ] Lint
   - [ ] Format Check
   - [ ] Biome Check

**Expected Result**: All status checks appear in the PR status section

### Test 2: Pending Status Display (Requirement 5.2)

**Objective**: Verify status shows "pending" during execution with progress information

**Steps**:
1. Immediately after creating a test PR, check status
2. Observe status checks while they're running

**Expected Result**: 
- [ ] Status checks show "pending" state with yellow circle
- [ ] Progress information is displayed (e.g., "Expected — Waiting for status to be reported")

### Test 3: Success Status Display (Requirement 5.3)

**Objective**: Verify status shows "success" with green checkmarks when checks pass

**Steps**:
1. Wait for all checks to complete on a valid PR
2. Verify successful status display

**Expected Result**:
- [ ] Successful checks show green checkmarks
- [ ] Status text shows "Success" or similar positive indicator
- [ ] All 5 checks show successful status

### Test 4: Failure Status Display (Requirement 5.4)

**Objective**: Verify status shows "failure" with detailed error information when checks fail

**Steps**:
1. Run: `./.github/scripts/test-failure-scenarios.sh`
2. Check the created PRs with intentional failures
3. Verify failure status display

**Expected Result**:
- [ ] Failed checks show red X marks
- [ ] Status text shows "Failure" or similar negative indicator
- [ ] Detailed error information is accessible via "Details" links
- [ ] Error logs provide actionable information

### Test 5: Required Status Checks (Requirement 5.5)

**Objective**: Verify all CI workflows are configured as required for PR merge

**Steps**:
1. Run: `./.github/scripts/validate-branch-protection.sh`
2. Check that all required status checks are configured

**Expected Result**:
- [ ] All 5 workflows are listed as required status checks
- [ ] Branch protection rule is active on main branch
- [ ] "Require branches to be up to date" is enabled

### Test 6: Merge Blocking (Requirement 5.6)

**Objective**: Verify pull requests cannot be merged while any workflow is failing

**Steps**:
1. Create PRs with failing checks (use failure scenarios script)
2. Attempt to merge PRs with failing checks
3. Verify merge is blocked

**Expected Result**:
- [ ] "Merge pull request" button is disabled when checks are failing
- [ ] GitHub shows message like "Merging is blocked"
- [ ] Specific failing checks are identified
- [ ] Merge becomes available only when all checks pass

## Manual Verification Steps

### GitHub Web Interface Checks

1. **Repository Settings**:
   - [ ] Navigate to Settings → Branches
   - [ ] Verify main branch protection rule exists
   - [ ] Confirm all 5 status checks are required

2. **Pull Request Interface**:
   - [ ] Status checks section is visible
   - [ ] Each check shows appropriate status (pending/success/failure)
   - [ ] "Details" links work and show workflow logs
   - [ ] Merge button state reflects check status

3. **Workflow Logs**:
   - [ ] All workflows execute on PR creation/updates
   - [ ] Logs are accessible and informative
   - [ ] Failed workflows show clear error messages
   - [ ] Successful workflows show completion confirmation

## Automated Validation

Run all validation scripts in sequence:

```bash
# 1. Validate branch protection configuration
./.github/scripts/validate-branch-protection.sh

# 2. Test successful scenario
./.github/scripts/test-branch-protection.sh

# 3. Test failure scenarios
./.github/scripts/test-failure-scenarios.sh
```

## Common Issues and Solutions

### Status Checks Not Appearing

**Symptoms**: No status checks visible in PR
**Solutions**:
- [ ] Verify workflow files are in correct location
- [ ] Check workflow syntax with `gh workflow list`
- [ ] Ensure workflows have run at least once
- [ ] Confirm branch protection is configured

### Merge Not Blocked Despite Failures

**Symptoms**: Can merge PR even with failing checks
**Solutions**:
- [ ] Verify "Require status checks to pass" is enabled
- [ ] Check that failing checks are in the required list
- [ ] Confirm you don't have admin bypass enabled
- [ ] Validate status check names match exactly

### Workflows Not Running

**Symptoms**: Status checks never start
**Solutions**:
- [ ] Check workflow triggers (`pull_request` and `push`)
- [ ] Verify GitHub Actions is enabled for repository
- [ ] Review workflow permissions
- [ ] Check for syntax errors in workflow files

## Requirements Validation Matrix

| Requirement | Test Method | Status |
|-------------|-------------|---------|
| 5.1 - Status visibility | Manual PR inspection | [ ] |
| 5.2 - Pending status | Observe during execution | [ ] |
| 5.3 - Success status | Successful PR completion | [ ] |
| 5.4 - Failure status | Intentional failure scenarios | [ ] |
| 5.5 - Required checks | Branch protection validation | [ ] |
| 5.6 - Merge blocking | Failed check merge attempts | [ ] |

## Sign-off

**Validation completed by**: ________________  
**Date**: ________________  
**All requirements satisfied**: [ ] Yes [ ] No  
**Notes**: ________________________________

---

## Cleanup After Validation

After completing all validation tests:

1. **Close test PRs** (do not merge):
   ```bash
   gh pr list --state open --label "test" --json number -q '.[].number' | xargs -I {} gh pr close {}
   ```

2. **Delete test branches**:
   ```bash
   git branch -D $(git branch | grep test-)
   git push origin --delete $(git branch -r | grep test- | sed 's/origin\///')
   ```

3. **Remove test files** (if any were added to main):
   ```bash
   git rm -f src/test-*.js test/intentional-*.test.js TEST_*.md 2>/dev/null || true
   ```

This ensures your repository stays clean after validation testing.
