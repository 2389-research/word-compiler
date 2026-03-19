# CIPHER Prompt Simmer — Trajectory

| Iter | Specificity | Actionability | Pattern-focus | Downstream Utility | Composite | Key Change |
|------|-------------|---------------|---------------|--------------------|-----------|------------|
| 0    | 6           | 4             | 7             | 5                  | 5.3       | seed — minimal prompt, descriptive output, clustered on concreteness |
| 1    | 8           | 8             | 8             | 7                  | 7.8       | directive format, dimension constraint, 3+ edit threshold — #1/#3 still overlap on concreteness |
| 2    | 9           | 9             | 9             | 8                  | 8.8       | dimension labels, 30-word cap, exactly 5 — highly consistent across runs, dialogue dimension dropped |
| 3    | 9           | 9             | 9             | 8                  | 8.8       | added PACING dimension, "fewer than 3" guard — same output, model correctly adapts to edit distribution |
