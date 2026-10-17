# Family workspace

Family settings separate learner profiles, learning access, and privacy. The learner selector displays one profile or retained billing reference at a time. Selection stays with the parent account while moving between family settings and purchase workspaces; changing accounts clears it.

Access presents the selected learner’s current license, nearest scheduled term, or absence of current access. Revoked and expired terms do not grant access. License history lists all retained terms and their dates. A license is distinct from consent: an active license does not enable learning when verified consent is paused or absent.

Billing and purchase actions occupy a fixed action area. Long names and larger text can scroll inside the profile content without hiding these actions. The selector includes deleted profiles only as billing references, without their erased learner names. Billing controls are available after withdrawal or learning-data deletion. Withdrawal and deletion do not cancel a subscription; the parent must manage renewal with the purchase provider.

Phone and landscape browser checks exercise current and future terms, revoked history, long names, deleted references, ownership of rename requests, selection after deletion, dialog focus, and visible touch targets. Financial eligibility for deletion is enforced by the backend; a profile with active or scheduled paid access cannot be silently erased while its renewal mapping is lost.

## Consent entry

Family → Privacy → Learning consent opens a separate focused workspace for reviewing the notice, requesting enrollment, responding to email links, and reviewing current consent. Enrollment availability and existing effective consent are separate states. Delivery is disabled by default. The opt-in Resend worker requires explicit provider configuration and a separately installed reviewed policy. A private policy or cryptographic secret alone does not enable enrollment or establish legal compliance; see [parent consent enrollment](parent-consent.md).

Consent email fragments are removed before browser authentication initializes. The challenge is held in memory, never browser storage or a purchase-return record. After an external sign-in redirect, reopen the email link. Signing out or changing parent accounts clears the held challenge; renewing the same parent’s access token preserves the current workspace. Returning to family settings restores focus to its consent action.

A completed consent mutation immediately invalidates local learning state before refreshing family metadata. An obsolete response from a closed workspace or another account cannot restore that state. Consent, a paid license, subscription cancellation, and deletion are independent decisions; granting consent does not purchase access, and withdrawing it does not cancel renewal.
