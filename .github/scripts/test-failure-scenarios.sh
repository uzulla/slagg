#!/bin/bash

# Branch Protection Failure Testing Script
# This script creates test scenarios with intentional failures to validate merge blocking

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
    exit 1
fi

# Check if user is authenticated
if ! gh auth status &> /dev/null; then
    print_error "GitHub CLI is not authenticated."
    exit 1
fi

# Get repository information
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
if [ -z "$REPO" ]; then
    print_error "Could not determine repository information."
    exit 1
fi

print_status "Testing branch protection failure scenarios for repository: $REPO"

# Ensure we're on main branch and up to date
print_status "Ensuring main branch is up to date..."
git checkout main
git pull origin main

# Test 1: Create a branch with linting errors
print_test "Test 1: Creating branch with intentional linting errors"

TEST_BRANCH="test-lint-failure-$(date +%s)"
git checkout -b "$TEST_BRANCH"

# Create a file with intentional linting issues
cat > src/test-lint-failure.js << 'EOF'
// This file contains intentional linting errors to test branch protection

var unused_variable = "this will cause a lint error";

function badFunction( ) {
    console.log("This has spacing issues")
    var another_unused = 123
    // Missing semicolon above
    return "test"
}

// Unused function
function unusedFunction() {
    return null
}

// Export with issues
module.exports = { badFunction }
EOF

git add src/test-lint-failure.js
git commit -m "test: add file with intentional linting errors

This commit should cause the lint workflow to fail,
demonstrating that branch protection blocks merges
when CI checks fail."

print_status "Pushing test branch with linting errors..."
git push origin "$TEST_BRANCH"

# Create pull request
print_status "Creating pull request for lint failure test..."
PR_URL=$(gh pr create \
    --title "Test: Lint Failure Scenario" \
    --body "This PR tests branch protection with failing lint checks.

## Expected Behavior

1. Lint workflow should fail due to intentional errors
2. Other workflows may pass or fail depending on the errors
3. Merge should be blocked due to failing status checks

## Intentional Issues

- Unused variables
- Spacing issues
- Missing semicolons
- Unused functions

## Cleanup

This PR should be closed (not merged) and the branch deleted after testing." \
    --base main \
    --head "$TEST_BRANCH")

print_status "✅ Lint failure test PR created: $PR_URL"
PR_NUMBER=$(echo "$PR_URL" | grep -o '[0-9]\+$')

# Wait for checks to start and show initial status
print_status "Waiting for status checks to start..."
sleep 15

print_status "Initial status:"
gh pr view "$PR_NUMBER" --json statusCheckRollup,mergeable -q '
"Status Checks:",
(.statusCheckRollup[] | "  - \(.context): \(.state)"),
"",
"Mergeable: \(.mergeable)"'

# Test 2: Create a branch with test failures
print_test "Test 2: Creating branch with intentional test failures"

git checkout main
TEST_BRANCH_2="test-test-failure-$(date +%s)"
git checkout -b "$TEST_BRANCH_2"

# Create a test file that will fail
cat > test/intentional-failure.test.js << 'EOF'
// This test file contains intentional failures to test branch protection

const { describe, it, expect } = require('vitest');

describe('Intentional Test Failures', () => {
    it('should fail intentionally', () => {
        expect(true).toBe(false); // This will always fail
    });

    it('should throw an error', () => {
        throw new Error('Intentional test error');
    });

    it('should timeout', async () => {
        // This test will timeout
        await new Promise(resolve => setTimeout(resolve, 30000));
        expect(true).toBe(true);
    }, 1000); // 1 second timeout, but we wait 30 seconds
});
EOF

git add test/intentional-failure.test.js
git commit -m "test: add intentionally failing tests

This commit should cause the test workflow to fail,
demonstrating that branch protection blocks merges
when test checks fail."

print_status "Pushing test branch with failing tests..."
git push origin "$TEST_BRANCH_2"

# Create pull request
print_status "Creating pull request for test failure scenario..."
PR_URL_2=$(gh pr create \
    --title "Test: Test Failure Scenario" \
    --body "This PR tests branch protection with failing test checks.

## Expected Behavior

1. Test workflow should fail due to intentional test failures
2. Other workflows may pass depending on code quality
3. Merge should be blocked due to failing status checks

## Intentional Issues

- Tests that always fail
- Tests that throw errors
- Tests that timeout

## Cleanup

This PR should be closed (not merged) and the branch deleted after testing." \
    --base main \
    --head "$TEST_BRANCH_2")

print_status "✅ Test failure test PR created: $PR_URL_2"
PR_NUMBER_2=$(echo "$PR_URL_2" | grep -o '[0-9]\+$')

# Test 3: Create a branch with format issues
print_test "Test 3: Creating branch with intentional format issues"

git checkout main
TEST_BRANCH_3="test-format-failure-$(date +%s)"
git checkout -b "$TEST_BRANCH_3"

# Create a file with intentional formatting issues
cat > src/test-format-failure.js << 'EOF'
// This file contains intentional formatting errors

const   badSpacing    =    "too many spaces";

function poorlyFormatted(param1,param2,param3) {
return{
prop1:param1,
prop2:param2,
prop3:param3
};
}

const arrayWithBadFormatting=[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15];

if(true){
console.log("bad formatting");
}else{
console.log("also bad");
}

module.exports={poorlyFormatted,badSpacing,arrayWithBadFormatting};
EOF

git add src/test-format-failure.js
git commit -m "test: add file with intentional formatting errors

This commit should cause the format check workflow to fail,
demonstrating that branch protection blocks merges
when format checks fail."

print_status "Pushing test branch with formatting errors..."
git push origin "$TEST_BRANCH_3"

# Create pull request
print_status "Creating pull request for format failure scenario..."
PR_URL_3=$(gh pr create \
    --title "Test: Format Failure Scenario" \
    --body "This PR tests branch protection with failing format checks.

## Expected Behavior

1. Format Check workflow should fail due to formatting issues
2. Other workflows may pass or fail depending on the code
3. Merge should be blocked due to failing status checks

## Intentional Issues

- Poor spacing
- Missing spaces in function parameters
- Inconsistent object formatting
- Long lines without proper breaks

## Cleanup

This PR should be closed (not merged) and the branch deleted after testing." \
    --base main \
    --head "$TEST_BRANCH_3")

print_status "✅ Format failure test PR created: $PR_URL_3"
PR_NUMBER_3=$(echo "$PR_URL_3" | grep -o '[0-9]\+$')

# Monitor all test PRs
print_test "Test 4: Monitoring all failure scenarios"

print_status "Waiting for all checks to run on failure test PRs..."
sleep 30

print_status "=== LINT FAILURE TEST (PR #$PR_NUMBER) ==="
gh pr view "$PR_NUMBER" --json statusCheckRollup,mergeable -q '
"Status Checks:",
(.statusCheckRollup[] | "  - \(.context): \(.state)"),
"",
"Mergeable: \(.mergeable)"'

print_status ""
print_status "=== TEST FAILURE TEST (PR #$PR_NUMBER_2) ==="
gh pr view "$PR_NUMBER_2" --json statusCheckRollup,mergeable -q '
"Status Checks:",
(.statusCheckRollup[] | "  - \(.context): \(.state)"),
"",
"Mergeable: \(.mergeable)"'

print_status ""
print_status "=== FORMAT FAILURE TEST (PR #$PR_NUMBER_3) ==="
gh pr view "$PR_NUMBER_3" --json statusCheckRollup,mergeable -q '
"Status Checks:",
(.statusCheckRollup[] | "  - \(.context): \(.state)"),
"",
"Mergeable: \(.mergeable)"'

# Validation summary
print_test "Test 5: Validation Summary"

print_status "Checking that all test PRs are properly blocked from merging..."

for pr_num in "$PR_NUMBER" "$PR_NUMBER_2" "$PR_NUMBER_3"; do
    MERGEABLE=$(gh pr view "$pr_num" --json mergeable -q '.mergeable')
    FAILED_CHECKS=$(gh pr view "$pr_num" --json statusCheckRollup -q '[.statusCheckRollup[] | select(.state == "FAILURE")] | length')
    
    if [ "$FAILED_CHECKS" -gt 0 ]; then
        print_status "✅ PR #$pr_num has $FAILED_CHECKS failed checks - merge should be blocked"
    else
        print_warning "⚠️  PR #$pr_num has no failed checks yet - may still be running"
    fi
    
    if [ "$MERGEABLE" = "MERGEABLE" ] && [ "$FAILED_CHECKS" -gt 0 ]; then
        print_error "❌ PR #$pr_num is marked as mergeable despite failed checks!"
    fi
done

# Cleanup instructions
print_status ""
print_status "🧹 Cleanup Instructions:"
print_status ""
print_status "Close all test PRs (DO NOT MERGE):"
print_status "  gh pr close $PR_NUMBER"
print_status "  gh pr close $PR_NUMBER_2"
print_status "  gh pr close $PR_NUMBER_3"
print_status ""
print_status "Delete test branches:"
print_status "  git branch -D $TEST_BRANCH $TEST_BRANCH_2 $TEST_BRANCH_3"
print_status "  git push origin --delete $TEST_BRANCH $TEST_BRANCH_2 $TEST_BRANCH_3"
print_status ""
print_status "Remove test files from main branch (if any were accidentally added):"
print_status "  git rm -f src/test-lint-failure.js src/test-format-failure.js test/intentional-failure.test.js 2>/dev/null || true"
print_status ""
print_status "🎉 Failure scenario testing completed!"
print_status "Review the results above to confirm branch protection blocks merges when checks fail."

# Return to main branch
git checkout main
