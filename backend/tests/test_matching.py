import numpy as np
import pytest
from app.services.matching import normalize, match_faces, decision, fuse_frames, Match, score_matrix


def vec(i: int) -> np.ndarray:
    value = np.zeros(512, dtype=np.float32); value[i] = 1; return value


def test_max_sample_score():
    matrix, ids = score_matrix([vec(1)], {5: [vec(0), vec(1)]})
    assert ids == [5] and matrix[0, 0] == pytest.approx(1)


def test_hungarian_uniqueness():
    results = match_faces([vec(0), vec(0)], {1: [vec(0)], 2: [vec(1)]})
    accepted = [r.student_id for r in results if r.reason == "auto"]
    assert accepted == [1]
    assert sum(r.reason == "assignment_conflict" for r in results) == 1


def test_quality_face_cannot_steal_assignment():
    results = match_faces([vec(0), vec(0)], {1: [vec(0)]}, quality=[False, True])
    assert results[0].reason == "quality_fail"
    assert results[1].student_id == 1 and results[1].reason == "auto"


@pytest.mark.parametrize("score,margin,live,expected", [(.50, .05, True, "auto"), (.50, .049, True, "ambiguous"),
    (.35, .1, True, "ambiguous"), (.349, .9, True, "unknown"), (.95, .9, False, "liveness_fail")])
def test_threshold_boundaries(score, margin, live, expected):
    assert decision(score, margin, live=live) == expected


def test_single_student_margin_and_empty_gallery():
    assert match_faces([vec(0)], {1: [vec(0)]})[0].reason == "auto"
    assert match_faces([vec(0)], {})[0].reason == "unknown"


def test_ambiguity_blocks_auto():
    results = match_faces([vec(0)], {1: [vec(0)], 2: [normalize(vec(0) + .1 * vec(1))]})
    assert results[0].reason == "ambiguous"


def test_votes_unique_per_frame_and_no_spoof_vote():
    good = Match(0, 1, .8, .2, "auto", [])
    bad = Match(0, 1, .9, .2, "liveness_fail", [])
    assert fuse_frames([[good, good], [bad]]) == {}
    assert fuse_frames([[good], [good]])[1]["votes"] == 2


def test_normalization_rejects_invalid():
    with pytest.raises(ValueError): normalize(np.zeros(512))
