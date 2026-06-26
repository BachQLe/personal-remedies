---
name: no-remove-features
description: Don't remove existing features unless explicitly asked — "get rid of X transition" means remove the transition/animation, not the underlying feature
metadata:
  type: feedback
---

When the user says to remove a transition or animation, only remove the visual transition — not the underlying feature (e.g., swipe gesture, pagination, drag). "Get rid of the swipe" meant remove the slide transition wrapping title+cards, not the swipe-to-paginate drag gesture.

**Why:** User was frustrated when swipe pagination was removed instead of just the panel slide transition.
**How to apply:** Parse removal requests narrowly. If ambiguous, ask which part to remove rather than removing the whole feature.
