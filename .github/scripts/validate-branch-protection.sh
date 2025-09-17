#!/bin/bash

# Branch Protection Validation Script
# This script validates that branch protection rules are properly configured
# Requires GitHub CLI (gh) to be installed and authenticated

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

print_check() {
    echo -e "${BLUE}[CHECK]${NC} $1"
}

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    print_error "GitHub CLI (gh) is not installed."
    print_error "Cannot validate branch protection settings."
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

print_status "Validating branch protection for repository: $REPO"
print_status "Checking main branch protection rules..."

# Expected required status checks
EXPECTED_CHECKS=(
    "test (20.x)"
    "test (22.x)"
    "lint"
    "format"
    "biome-check"
)

# Get branch protection information
API_URL="https://api.github.com/repos/$REPO/branches/main/protection"

if ! PROTECTION_DATA=$(gh api "$API_URL" 2>/dev/null); then
    print_error "❌ No branch protection rules found for main branch"
    print_error "Please run the setup script or configure manually via GitHub web interface"
    exit 1
fi

print_status "✅ Branch protection rules found for main branch"

# Check required status checks
print_check "Validating required status checks..."

if echo "$PROTECTION_DATA" | jq -e '.required_status_checks' > /dev/null 2>&1; then
    STRICT_MODE=$(echo "$PROTECTION_DATA" | jq -r '.required_status_checks.strict')
    if [ "$STRICT_MODE" = "true" ]; then
        print_status "✅ Strict mode enabled (branches must be up to date)"
    else
        print_warning "⚠️  Strict mode disabled (branches don't need to be up to date)"
    fi
    
    # Get configured checks
    CONFIGURED_CHECKS=$(echo "$PROTECTION_DATA" | jq -r '.required_status_checks.checks[].context' 2>/dev/null || echo "")
    
    if [ -z "$CONFIGURED_CHECKS" ]; then
        print_error "❌ No required status checks configured"
        exit 1
    fi
    
    print_status "Configured status checks:"
    echo "$CONFIGURED_CHECKS" | while read -r check; do
        echo "  - $check"
    done
    
    # Validate each expected check
    ALL_CHECKS_FOUND=true
    for expected_check in "${EXPECTED_CHECKS[@]}"; do
        if echo "$CONFIGURED_CHECKS" | grep -q "^$expected_check$"; then
            print_status "✅ Required check found: $expected_check"
        else
            print_error "❌ Missing required check: $expected_check"
            ALL_CHECKS_FOUND=false
        fi
    done
    
    if [ "$ALL_CHECKS_FOUND" = "true" ]; then
        print_status "✅ All required status checks are properly configured"
    else
        print_error "❌ Some required status checks are missing"
        exit 1
    fi
else
    print_error "❌ Required status checks are not enabled"
    exit 1
fi

# Check pull request reviews
print_check "Validating pull request review requirements..."

if echo "$PROTECTION_DATA" | jq -e '.required_pull_request_reviews' > /dev/null 2>&1; then
    REQUIRED_REVIEWERS=$(echo "$PROTECTION_DATA" | jq -r '.required_pull_request_reviews.required_approving_review_count')
    DISMISS_STALE=$(echo "$PROTECTION_DATA" | jq -r '.required_pull_request_reviews.dismiss_stale_reviews')
    
    print_status "✅ Pull request reviews required: $REQUIRED_REVIEWERS reviewer(s)"
    
    if [ "$DISMISS_STALE" = "true" ]; then
        print_status "✅ Stale reviews are dismissed on new commits"
    else
        print_warning "⚠️  Stale reviews are not dismissed on new commits"
    fi
else
    print_warning "⚠️  Pull request reviews are not required"
fi

# Check other protection settings
print_check "Validating additional protection settings..."

ENFORCE_ADMINS=$(echo "$PROTECTION_DATA" | jq -r '.enforce_admins.enabled // false')
ALLOW_FORCE_PUSHES=$(echo "$PROTECTION_DATA" | jq -r '.allow_force_pushes.enabled // false')
ALLOW_DELETIONS=$(echo "$PROTECTION_DATA" | jq -r '.allow_deletions.enabled // false')

if [ "$ENFORCE_ADMINS" = "true" ]; then
    print_status "✅ Rules are enforced for administrators"
else
    print_warning "⚠️  Rules are not enforced for administrators"
fi

if [ "$ALLOW_FORCE_PUSHES" = "false" ]; then
    print_status "✅ Force pushes are blocked"
else
    print_warning "⚠️  Force pushes are allowed"
fi

if [ "$ALLOW_DELETIONS" = "false" ]; then
    print_status "✅ Branch deletion is blocked"
else
    print_warning "⚠️  Branch deletion is allowed"
fi

print_status ""
print_status "🎉 Branch protection validation complete!"
print_status "All critical protections are in place for the main branch."
