import numpy as np
import pytest
from metrics import rates, eer, recommend


def test_separable_scores():
    g = np.array([.8, .9]); i = np.array([.1, .2])
    result = rates(g, i, .5)
    assert result['FAR'] == 0 and result['FRR'] == 0 and result['F1'] == 1
    assert eer(g, i)[0] == 0


def test_threshold_target_and_no_solution():
    rows = [{'threshold': .4, 'FAR': .1}, {'threshold': .5, 'FAR': .01}, {'threshold': .6, 'FAR': 0}]
    assert recommend(rows, .01)['threshold'] == .5
    assert recommend(rows[:1], .01) is None


def test_no_genuine_denominator():
    result = rates(np.array([]), np.array([.2]), .5)
    assert np.isnan(result['FRR'])
    with pytest.raises(ValueError): eer(np.array([]), np.array([.2]))
