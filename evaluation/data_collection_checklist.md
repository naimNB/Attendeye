# Data-collection checklist

## Before recording

- [ ] Assign an organiser, approved data custodians and a deletion date.
- [ ] Read the consent notice aloud if needed; answer questions and offer a manual alternative.
- [ ] Collect separate choices for application, offline dataset, group photos and spoof media.
- [ ] Use adult volunteers, pseudonymous IDs and an encrypted drive.
- [ ] Keep signed forms and the identity map apart from images.
- [ ] Ensure every person visible in group/background shots consents.
- [ ] Decide validation/test splits before capture; reserve unknown identities outside the gallery.
- [ ] Record camera/lens, resolution, CPU, operating system and room configuration.

## People and enrolment

- [ ] At least two enrolled volunteers and one unknown volunteer for a functional evaluation.
- [ ] Recruit more independent volunteers and sessions for meaningful uncertainty estimates; document actual counts.
- [ ] Include naturally varied appearance and glasses with voluntary participation; do not infer demographics.
- [ ] Collect 5–10 enrol images per enrolled identity, covering front, left, right, up and down.
- [ ] Check exactly one face, sufficient size, sharpness, lighting and plausible pose.
- [ ] Keep probes temporally separate; avoid duplicates and consecutive near-identical frames.

## Required probe conditions for every person

- [ ] Bright: even indoor illumination, no direct glare.
- [ ] Dim: realistically reduced illumination; record the setting, avoid unsafe darkness.
- [ ] Backlit: bright background/window; keep exposure settings documented.
- [ ] Angle30: approximately 30° yaw; alternate left/right where possible.
- [ ] Angle45: approximately 45° yaw; record direction.
- [ ] Far: increased distance; record distance and approximate face-pixel size.
- [ ] Glasses: normal clear-lens glasses if the person ordinarily uses them, or a documented voluntary condition.
- [ ] Optional mask: record as a separate condition, never mix into an unlabelled folder.
- [ ] Record ordinary distance, farther classroom distance and seating row; do not fabricate metre measurements.

## Spoof and active challenge captures

- [ ] Print: photograph a consented printed portrait using the evaluation camera.
- [ ] Vary paper finish, size, tilt and lighting; label attack medium privately.
- [ ] Screen: photograph a consented portrait displayed on different available screens.
- [ ] Vary display brightness, distance and screen angle; include glare and moire where they occur naturally.
- [ ] Collect bona-fide live-face photos on the same cameras for BPCER.
- [ ] Do not use source digital portraits alone as presentation attacks; physically re-photograph the medium.
- [ ] Destroy printouts and delete display copies at the agreed date.
- [ ] If studying active challenges, capture ordered bursts with prompt timing, including genuine failures and consented replay attempts.

## Group photographs

- [ ] Obtain consent from everyone in every image.
- [ ] Capture different rows, distances, face sizes, occlusions and realistic lighting.
- [ ] Double-check person_ids with a second annotator.
- [ ] Annotate face boxes in EXIF-corrected coordinates for true detection recall.
- [ ] Label unknown volunteers too; do not silently omit difficult faces.
- [ ] Keep each identity once per image; do not use collages with repeated people.

## Before publishing results

- [ ] Check duplicate and near-duplicate leakage across enrol/validation/test sets.
- [ ] Freeze thresholds on validation and record model version/checksums.
- [ ] Keep detection/quality failures in the reported denominators where appropriate.
- [ ] Report missing/nonresponse counts, denominators and per-condition metrics.
- [ ] Label DEMO attendance separately from evaluated recognition performance.
- [ ] Share aggregate plots and summaries only; remove person IDs from public per-person tables.
- [ ] Record limitations, actual CPU timing and the exact date of evaluation.
- [ ] Delete photos, embeddings, derivatives and controlled backups at the agreed deadline.
