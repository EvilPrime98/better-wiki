---
'better-wiki': patch
---

Clarify `getCategoryMembers` JSDoc: when passing multiple category titles, they are read left to right, so the first category should be the one that narrows the result set the most for efficient queries. No behavior change.
