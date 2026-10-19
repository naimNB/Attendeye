# 25 likely viva questions

1. **What is the main contribution?** A complete consent-to-attendance workflow: quality/liveness gating, section-specific matching, conservative review, corrections, reporting and privacy controls on a CPU laptop.

2. **Why use embeddings instead of storing photos?** Embeddings make similarity matching compact and avoid a permanent raw-photo enrolment archive. They are still biometric data, so we encrypt them and support deletion.

3. **What is an embedding here?** A pretrained network maps an aligned face into 512 floating-point features. Similar identities should have nearby vectors, but this must be evaluated in our classroom conditions.

4. **Why L2 normalise?** With unit-length vectors, their dot product equals cosine similarity. This makes the comparison independent of vector magnitude.

5. **Why maximum similarity across samples?** Multiple poses provide coverage; the best matching sample represents the closest view. Taking a maximum can also increase impostor scores, so calibration must use the same number-of-samples policy.

6. **Why restrict the gallery to a section?** Only roster members can receive attendance there. It improves access control and reduces irrelevant candidates, but does not remove the need for unknown handling.

7. **What does the Hungarian algorithm do?** It optimises a one-to-one assignment between observed faces and enrolled identities. Dummy columns allow unmatched faces; poor quality or spoof observations cannot consume an identity.

8. **Why two thresholds?** T_high supports conservative automation, T_low separates candidate review from unknown review. Every uncertain decision remains visible to a human.

9. **How do you choose T_high?** On validation data, choose the lowest tested threshold satisfying the empirical FAR target, report the number of impostor trials and uncertainty, then freeze the setting for final testing.

10. **What are FAR and FRR?** FAR is impostor comparisons accepted divided by impostor comparisons. FRR is genuine comparisons rejected divided by genuine comparisons. Comparison-level rates differ from full classroom operational error rates.

11. **What is the margin check?** The assigned identity's score must exceed the strongest competing identity by a configured margin. A high absolute score alone is insufficient when two candidates look similarly plausible.

12. **What is EER?** The point where empirical false-accept and false-reject rates are equal, using interpolation if needed. It is a summary measure, not necessarily our chosen operating threshold.

13. **How does open-set evaluation work?** Collect probes from consenting people absent from the gallery. Measure how often they avoid automatic identity acceptance and report false acceptance and review rates.

14. **Why might precision change between experiments?** It depends on the genuine/impostor comparison balance and operating threshold. A synthetic pair balance is not the real classroom prevalence.

15. **How does passive liveness work?** MiniFASNet classifies an expanded face crop as live or attack. Its BGR scaling, crop size, class mapping and model version must match training. A weak texture/moire baseline is only a fallback and defaults to review-only.

16. **What are APCER and BPCER?** APCER is checked attacks misclassified as bona fide / checked attacks. BPCER is checked bona-fide presentations misclassified as attacks / checked bona fide. We separately disclose nonresponses and fail-closed operational rates.

17. **Does a blink prove someone is live?** No. It is a simple challenge signal based on eye-aspect-ratio changes. Sparse frames, estimated landmarks, replay, generated media or injected requests can defeat or confuse it.

18. **What stops challenge replay?** A signed token is bound to user and session, expires in 15 seconds and is consumed atomically once. Duplicate image bytes are rejected, but transformed/re-recorded media are not fully prevented.

19. **Does the rotating QR prove classroom location?** No. It proves knowledge of a current token, which can be relayed. We combine it with the signed-in student's face and liveness challenge and permit one redemption per session.

20. **Why do small group faces go to review?** They may have too little detail for reliable recognition or passive liveness. Upscaling helps detection but cannot recreate missing texture.

21. **How is attendance percentage calculated?** Present records divided by closed sessions for that section. Open sessions do not count, and zero closed sessions produces no percentage. A frozen roster keeps the denominator consistent.

22. **How do you prevent a teacher from accessing another class?** The API checks current user role and teacher-section assignment on session, report, review and thumbnail routes. Hiding a frontend button alone is not security.

23. **What happens when consent is revoked?** Delete the student's encrypted embeddings, mark consent revoked, and conservatively clear temporary review crops/candidates. Academic and audit records remain. Offline research photos require the separately documented withdrawal process.

24. **How do you address bias and fairness?** Evaluate failures by capture condition and with sufficient, voluntarily collected subgroup evidence where appropriate. Do not infer demographics from faces or claim fairness from a small convenience sample. Always retain a manual alternative.

25. **What would you improve before real deployment?** Larger independent evaluation, robust anti-spoofing, secure camera/transport controls, temporal enrolments, migrations, shared rate limits/locks, retention operations, key rotation and independent security/institutional review. We do not claim these are already solved.
