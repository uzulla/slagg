#!/bin/bash

# Branch Protection Setup Script
# This script configures branch protection rules for the main branch
# Requires GitHub CLI (gh) to be installed and authenticated

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    print_error "GitHub CLI (gh) is not installed."
    print_error "Please install it from: https://cli.github.com/"
    print_error "Or configure branch protection manually using the GitHub web interface."
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
    print_error "Make sure you're in a Git repository with a GitHub remote."
    exit 1
fi

print_status "Setting up branch protection for repository: $REPO"

# Required status checks
REQUIRED_CHECKS=(
    "test (20.x)"
    "test (22.x)"
    "lint"
    "format"
    "biome-check"
)

print_status "Configuring required status checks:"
for check in "${REQUIRED_CHECKS[@]}"; do
    echo "  - $check"
done

# Create the branch protection rule
print_status "Creating branch protection rule for 'main' branch..."

# Build the required status checks parameter
CHECKS_JSON=""
for check in "${REQUIRED_CHECKS[@]}"; do
    if [ -z "$CHECKS_JSON" ]; then
        CHECKS_JSON="\"$check\""
    else
        CHECKS_JSON="$CHECKS_JSON,\"$check\""
    fi
done

# Use GitHub API to set branch protection
API_URL="https://api.github.com/repos/$REPO/branches/main/protection"

# Create the protection rule JSON
PROTECTION_JSON=$(cat <<EOF
{
  "required_status_checks": {
    "strict": true,
    "checks": [
      {"context": "test (20.x)"},
      {"context": "test (22.x)"},
      {"context": "lint"},
      {"context": "format"},
      {"context": "biome-check"}
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
)

# Apply the branch protection rule
if gh api --method PUT "$API_URL" --input - <<< "$PROTECTION_JSON" > /dev/null 2>&1; then
    print_status "✅ Branch protection rule created successfully!"
    print_status "The following status checks are now required for merging to main:"
    for check in "${REQUIRED_CHECKS[@]}"; do
        echo "  ✓ $check"
    done
    print_status ""
    print_status "Additional settings applied:"
    echo "  ✓ Require branches to be up to date before merging"
    echo "  ✓ Require pull request reviews (1 reviewer)"
    echo "  ✓ Dismiss stale reviews when new commits are pushed"
    echo "  ✓ Prevent force pushes to main branch"
    echo "  ✓ Prevent deletion of main branch"
else
    print_error "Failed to create branch protection rule."
    print_error "This might be due to insufficient permissions or the rule already exists."
    print_warning "You can manually configure branch protection using the GitHub web interface."
    print_warning "See .github/BRANCH_PROTECTION_SETUP.md for detailed instructions."
    exit 1
fi

print_status ""
print_status "🎉 Branch protection setup complete!"
print_status "Create a test pull request to verify the configuration is working correctly."
