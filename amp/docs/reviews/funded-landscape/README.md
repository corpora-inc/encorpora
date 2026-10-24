# Funded purchase layout

Purchase details and optional support share the scrollable content area. The primary payment/status actions occupy the fixed footer. On short landscape screens, parents can scroll to invoice instructions, the support email and the feedback dialog without losing the payment actions.

Synthetic browser captures cover 320, 390, 768 and 1280 pixel widths in light and dark themes. Landscape captures use 844×390 and include the request and open feedback dialog. No real parent, learner, payment or advertising data appears.

The existing `npm run test:funding-ui` checks quote download, submission, token renewal, consent gating, invoice entry, retry identity, account reset and integrated checkout redirection. A temporary extension of `verify-funding-ui.ts` captured both themes and all listed widths, opened and dismissed feedback, and checked support reachability; the existing phone-landscape hit tests passed for both request and dialog. These checks verify layout and mocked browser interactions, not settlement or production activation.
