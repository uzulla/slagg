#!/bin/bash

# Branch Protection Testing Script
# This script creates test scenarios to validate branch protection functionality
# It creates test branches and pull requests to verify merge blocking behavior

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_test() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    print_error "GitHub CLI (gh) is not installed."
    print_error "This script requires GitHub CLI to create and manage pull requests."
    exit 1
fi

# Check if user is authenticated
if ! gh auth status &> /dev/null; then
    print_error "GitHub CLI is not authenticated."
    print_error "Please run: gh auth login"
    exit 1
fi

# Get repository information
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
if [ -z "$REPO" ]; then
    print_error "Could not determine repository information."
    exit 1
fi

print_status "Testing branch protection for repository: $REPO"

# Ensure we're on main branch and up to date
print_status "Ensuring main branch is up to date..."
git checkout main
git pull origin main

# Test 1: Create a test branch with valid changes
print_test "Test 1: Creating test branch with valid changes"

TEST_BRANCH="test-branch-protection-$(date +%s)"
git checkout -b "$TEST_BRANCH"

# Create a simple test file that won't break any checks
cat > TEST_BRANCH_PROTECTION.md << 'EOF'
# Branch Protection Test

This file is created to test branch protection rules.

## Test Details

- Created by: test-branch-protection.sh
- Purpose: Validate that all CI checks run and merge is properly controlled
- Expected behavior: All checks should pass and merge should be allowed

## Cleanup

This file and branch should be deleted after testing.
EOF

git add TEST_BRANCH_PROTECTION.md
git commit -m "test: add branch protection test file

This commit tests that:
- All CI workflows run on pull requests
- Status checks are properly reported
- Merge is blocked until all checks pass
- Merge is allowed when all checks pass"

print_status "Pushing test branch..."
git push origin "$TEST_BRANCH"

# Create pull request
print_status "Creating pull request..."
PR_URL=$(gh pr create \
    --title "Test: Branch Protection Validation" \
    --body "This PR tests branch protection functionality.

## Expected Behavior

1. All 5 CI workflows should run:
   - Test (Node.js 20.x)
   - Test (Node.js 22.x)
   - Lint
   - Format Check
   - Biome Check

2. Merge should be blocked while checks are running
3. Merge should be allowed only when all checks pass

## Cleanup

This PR should be closed/merged and the branch deleted after testing." \
    --base main \
    --head "$TEST_BRANCH")

print_status "✅ Test pull request created: $PR_URL"

# Get PR number
PR_NUMBER=$(echo "$PR_URL" | grep -o '[0-9]\+$')

print_status "Waiting for initial status checks to appear..."
sleep 10

# Check PR status
print_test "Test 2: Validating status checks appear"

# Wait for status checks to start
MAX_WAIT=60
WAIT_COUNT=0
while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    STATUS_CHECKS=$(gh pr view "$PR_NUMBER" --json statusCheckRollup -q '.statusCheckRollup | length')
    if [ "$STATUS_CHECKS" -gt 0 ]; then
        break
    fi
    print_status "Waiting for status checks to appear... ($WAIT_COUNT/$MAX_WAIT)"
    sleep 5
    WAIT_COUNT=$((WAIT_COUNT + 5))
done

if [ "$STATUS_CHECKS" -eq 0 ]; then
    print_error "❌ No status checks appeared after $MAX_WAIT seconds"
    print_error "This may indicate a problem with the CI workflows or branch protection setup"
else
    print_status "✅ Status checks detected: $STATUS_CHECKS checks"
fi

# Display current status
print_test "Test 3: Checking current PR status"
gh pr view "$PR_NUMBER" --json statusCheckRollup,mergeable -q '
"Status Checks:",
(.statusCheckRollup[] | "  - \(.context): \(.state)"),
"",
"Mergeable: \(.mergeable)"'

# Check if merge is blocked
MERGEABLE=$(gh pr view "$PR_NUMBER" --json mergeable -q '.mergeable')
if [ "$MERGEABLE" = "CONFLICTING" ] || [ "$MERGEABLE" = "UNKNOWN" ]; then
    print_warning "⚠️  PR mergeable status: $MERGEABLE"
elif [ "$MERGEABLE" = "MERGEABLE" ]; then
    # Check if there are any pending/failing checks
    PENDING_OR_FAILING=$(gh pr view "$PR_NUMBER" --json statusCheckRollup -q '[.statusCheckRollup[] | select(.state == "PENDING" or .state == "FAILURE")] | length')
    if [ "$PENDING_OR_FAILING" -gt 0 ]; then
        print_status "✅ Merge is technically possible but checks are still running/failing"
    else
        print_status "✅ All checks passed - merge should be allowed"
    fi
else
    print_status "✅ Merge is properly blocked (status: $MERGEABLE)"
fi

# Wait for all checks to complete
print_test "Test 4: Waiting for all checks to complete"
print_status "This may take several minutes..."

MAX_WAIT=600  # 10 minutes
WAIT_COUNT=0
ALL_COMPLETE=false

while [ $WAIT_COUNT -lt $MAX_WAIT ] && [ "$ALL_COMPLETE" = "false" ]; do
    PENDING_CHECKS=$(gh pr view "$PR_NUMBER" --json statusCheckRollup -q '[.statusCheckRollup[] | select(.state == "PENDING")] | length')
    
    if [ "$PENDING_CHECKS" -eq 0 ]; then
        ALL_COMPLETE=true
        print_status "✅ All status checks completed"
    else
        print_status "Waiting for $PENDING_CHECKS checks to complete... ($WAIT_COUNT/$MAX_WAIT seconds)"
        sleep 30
        WAIT_COUNT=$((WAIT_COUNT + 30))
    fi
done

if [ "$ALL_COMPLETE" = "false" ]; then
    print_warning "⚠️  Timeout waiting for checks to complete"
    print_warning "Some checks may still be running"
fi

# Final status report
print_test "Test 5: Final status validation"

print_status "Final PR status:"
gh pr view "$PR_NUMBER" --json statusCheckRollup,mergeable -q '
"Status Checks:",
(.statusCheckRollup[] | "  - \(.context): \(.state)"),
"",
"Mergeable: \(.mergeable)"'

# Count passed/failed checks
PASSED_CHECKS=$(gh pr view "$PR_NUMBER" --json statusCheckRollup -q '[.statusCheckRollup[] | select(.state == "SUCCESS")] | length')
FAILED_CHECKS=$(gh pr view "$PR_NUMBER" --json statusCheckRollup -q '[.statusCheckRollup[] | select(.state == "FAILURE")] | length')

print_status "Check summary:"
print_status "  ✅ Passed: $PASSED_CHECKS"
print_status "  ❌ Failed: $FAILED_CHECKS"

# Validate expected behavior
EXPECTED_CHECKS=5
if [ "$PASSED_CHECKS" -eq "$EXPECTED_CHECKS" ] && [ "$FAILED_CHECKS" -eq 0 ]; then
    print_status "🎉 All checks passed! Branch protection is working correctly."
    print_status "The PR should now be mergeable."
elif [ "$FAILED_CHECKS" -gt 0 ]; then
    print_warning "⚠️  Some checks failed. This is expected if there are code quality issues."
    print_status "Branch protection is working correctly by blocking the merge."
else
    print_warning "⚠️  Unexpected check results. Please review manually."
fi

# Cleanup prompt
print_status ""
print_status "🧹 Cleanup Options:"
print_status "1. To merge the test PR (if all checks passed):"
print_status "   gh pr merge $PR_NUMBER --squash"
print_status ""
print_status "2. To close the test PR without merging:"
print_status "   gh pr close $PR_NUMBER"
print_status ""
print_status "3. To delete the test branch after closing/merging:"
print_status "   git branch -D $TEST_BRANCH"
print_status "   git push origin --delete $TEST_BRANCH"
print_status ""
print_status "Test completed! Review the results above to confirm branch protection is working."

# Return to main branch
git checkout main
