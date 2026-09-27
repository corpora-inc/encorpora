# Store automation

The application tools in [`asc/`](asc/) and [`play/`](play/) manage App Store
Connect and Google Play through their supported APIs. Their `--help` output
explains available commands and dry-run behavior.

Account-specific setup, AWS access, credential-store locations, login reminders,
and operational troubleshooting belong in the private
[Corpora infrastructure runbooks](https://github.com/corpora-inc/infra-private).
Authorized operators should use that repository and their approved credential
stores. Personal login reminders may also be kept outside Git with owner-only
file permissions.

This repository is public. Do not put personal login details, account-specific
access instructions, credentials, private signing material, tokens, or recovery
codes in files, issues, PRs, logs, screenshots, or artifacts. Public examples use
placeholders. A private repository is a place for runbooks, not a credential store.

App Store Connect management credentials and App Store Server purchase-verification
credentials serve different APIs and are not interchangeable. Tools must retrieve
the appropriate credential from an authorized secret store without printing it.
