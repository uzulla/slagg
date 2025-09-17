# Branch Protection Scripts

This directory contains scripts to help set up and validate GitHub branch protection rules for the CI workflows.

## Scripts Overview

### 1. `setup-branch-protection.sh`
Automatically configures branch protection rules using the GitHub CLI.

**Prerequisites:**
- GitHub CLI (`gh`) installed and authenticated
- Repository admin permissions

**Usage:**
```bash
./.github/scripts/setup-branch-protection.sh
```

**What it does:**
- Configures required status checks for all 5 CI workflows
- Enables "require branches to be up to date" setting
- Sets up pull request review requirements
- Prevents force pushes and branch deletion

### 2. `validate-branch-protection.sh`
Validates that branch protection rules are properly configured.

**Prerequisites:**
- GitHub CLI (`gh`) installed and authenticated
- Repository read permissions

**Usage:**
```bash
./.github/scripts/validate-branch-protection.sh
```

**What it checks:**
- Verifies all required status checks are configured
- Confirms strict mode is enabled
- Validates pull request review settings
- Checks additional protection settings

### 3. `test-branch-protection.sh`
Creates a test pull request to validate branch protection functionality with passing checks.

**Prerequisites:**
- GitHub CLI (`gh`) installed and authenticated
- Repository write permissions
- Clean working directory

**Usage:**
```bash
./.github/scripts/test-branch-protection.sh
```

**What it does:**
- Creates a test branch with valid changes
- Opens a pull request to trigger all CI workflows
- Monitors status check execution
- Validates merge behavior when all checks pass
- Provides cleanup instructions

### 4. `test-failure-scenarios.sh`
Creates test pull requests with intentional failures to validate merge blocking.

**Prerequisites:**
- GitHub CLI (`gh`) installed and authenticated
- Repository write permissions
- Clean working directory

**Usage:**
```bash
./.github/scripts/test-failure-scenarios.sh
```

**What it does:**
- Creates multiple test branches with different types of failures
- Tests lint failures, test failures, and format failures
- Validates that merge is blocked when checks fail
- Monitors status check failure reporting
- Provides cleanup instructions

## Required Status Checks

The following status checks must be configured as required:

| Workflow | Job | Status Check Name |
|----------|-----|-------------------|
| Test | test (Node.js 20.x) | `test (20.x)` |
| Test | test (Node.js 22.x) | `test (22.x)` |
| Lint | lint | `lint` |
| Format Check | format | `format` |
| Biome Check | biome-check | `biome-check` |

## Manual Setup Alternative

If you prefer to configure branch protection manually or don't have the GitHub CLI, see the detailed instructions in:
- [`.github/BRANCH_PROTECTION_SETUP.md`](../BRANCH_PROTECTION_SETUP.md)

## Troubleshooting

### Permission Issues
If you get permission errors:
1. Ensure you have admin access to the repository
2. Check that your GitHub CLI authentication has the necessary scopes
3. Try re-authenticating: `gh auth login --scopes repo`

### Status Checks Not Available
If status checks don't appear in the configuration:
1. Ensure all workflow files are present in `.github/workflows/`
2. Run the workflows at least once by creating a test pull request
3. Verify workflow syntax is correct

### Script Dependencies
Both scripts require:
- `bash` shell
- `jq` for JSON processing (usually pre-installed on most systems)
- `gh` (GitHub CLI) for API access

Install GitHub CLI:
- macOS: `brew install gh`
- Ubuntu/Debian: `sudo apt install gh`
- Windows: `winget install GitHub.cli`
- Or download from: https://cli.github.com/

## Complete Validation Workflow

For comprehensive validation of branch protection:

1. **Setup**: Run the setup script
   ```bash
   ./.github/scripts/setup-branch-protection.sh
   ```

2. **Validate Configuration**: Confirm settings are correct
   ```bash
   ./.github/scripts/validate-branch-protection.sh
   ```

3. **Test Success Scenario**: Verify behavior with passing checks
   ```bash
   ./.github/scripts/test-branch-protection.sh
   ```

4. **Test Failure Scenarios**: Verify behavior with failing checks
   ```bash
   ./.github/scripts/test-failure-scenarios.sh
   ```

5. **Manual Verification**: Use the validation checklist
   - See [`.github/VALIDATION_CHECKLIST.md`](../VALIDATION_CHECKLIST.md)

## Requirements Satisfied

These scripts satisfy requirements:
- **5.5**: All CI workflows configured as required for PR merge
- **5.6**: Pull requests cannot be merged while any workflow is failing
