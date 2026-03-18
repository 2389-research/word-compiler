# Simmer: Drift Accuracy — Trajectory

## Criteria
1. **Drift accuracy** (PRIMARY): All 5 blogs survive into Stage 3 clustering. Blogs with CMS boilerplate/embedded quotes should NOT be excluded. High = 5/5 docs in Stage 3 with drift ratios <0.5.
2. **Feature quality**: Stage 3 finds stable cross-document features. High = 5+ features identified as consistent and transferable.
3. **Voice guide fidelity**: Guide accurately describes Jacqui Cheng's tech journalism voice. High = specific, distinctive traits, not generic.

## Iterations

| Iter | Drift Accuracy | Feature Quality | Voice Guide Fidelity | Composite | Key Change |
|------|---------------|-----------------|---------------------|-----------|------------|
| 0    | 2/10          | 3/10            | 4/10                | 3.0       | seed — boolean drift kills 4/5 docs |
| 1    | 10/10         | 1/10            | 1/10                | 4.0       | drift fixed! but features empty — max_tokens truncation |
| 2    | 10/10         | 8/10            | 7/10                | 8.3       | max_tokens fix — full guide with 10 features! extraction needs fix |
| 3    | 10/10         | 9/10            | 9/10                | 9.3       | extraction fix + defensive nulls — 15 features, rich guide, instructions populated |
