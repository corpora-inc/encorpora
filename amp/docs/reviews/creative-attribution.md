# Creative attribution review

Arkansas campaign reporting accepts a fixed creative label alongside the campaign, source, and medium. The privacy notice describes the label retained with a funded purchase request. No learner answers, advertising click identifiers, or visitor identifiers enter the creative aggregate table.

The screenshots below show the changed privacy paragraph at each required viewport and theme. Browser checks confirmed readable wrapping, no horizontal overflow, and stable paragraph geometry after fonts loaded. The complete funded-entry journey also passed at these eight viewport/theme combinations, including a return from a separate email-verification tab.

| Width | Light | Dark |
| --- | --- | --- |
| 320 | [Screenshot](creative-attribution/privacy-320-light.png) | [Screenshot](creative-attribution/privacy-320-dark.png) |
| 390 | [Screenshot](creative-attribution/privacy-390-light.png) | [Screenshot](creative-attribution/privacy-390-dark.png) |
| 768 | [Screenshot](creative-attribution/privacy-768-light.png) | [Screenshot](creative-attribution/privacy-768-dark.png) |
| 1280 | [Screenshot](creative-attribution/privacy-1280-light.png) | [Screenshot](creative-attribution/privacy-1280-dark.png) |

Database integration tests exercise every accepted creative against the actual SQL constraint, legacy requests without a creative, immutable attribution, and replay-safe settlement/refund counters. Browser tests cover invalid creative removal and GPC/DNT opt-out. Apply the additive migration and compatible API before sending creative labels from the public site; see [funded campaign deployment](../funded-campaign.md).
