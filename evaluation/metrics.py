"""Metric definitions with explicit denominators; no fabricated scores."""
import numpy as np


def safe_ratio(num: int | float, denominator: int | float) -> float:
    return float(num / denominator) if denominator else float("nan")


def rates(genuine: np.ndarray, impostor: np.ndarray, threshold: float) -> dict:
    tp = int(np.sum(genuine >= threshold)); fn = len(genuine) - tp
    fp = int(np.sum(impostor >= threshold)); tn = len(impostor) - fp
    precision = safe_ratio(tp, tp + fp)
    recall = safe_ratio(tp, tp + fn)
    return {"threshold": float(threshold), "FAR": safe_ratio(fp, fp + tn), "FRR": safe_ratio(fn, tp + fn),
            "precision": precision, "recall": recall, "F1": safe_ratio(2 * tp, 2 * tp + fp + fn),
            "genuine_n": len(genuine), "impostor_n": len(impostor), "TP": tp, "FP": fp, "TN": tn, "FN": fn}


def eer(genuine: np.ndarray, impostor: np.ndarray) -> tuple[float, float]:
    """Piecewise-linear crossing over the empirical score thresholds, including endpoints."""
    if not len(genuine) or not len(impostor):
        raise ValueError("EER needs genuine and impostor comparisons")
    thresholds = np.r_[-1.000001, np.unique(np.r_[genuine, impostor]), 1.000001]
    values = [rates(genuine, impostor, float(t)) for t in thresholds]
    differences = np.array([r["FAR"] - r["FRR"] for r in values])
    index = int(np.flatnonzero(differences <= 0)[0])
    if index == 0: return float(values[0]["FAR"]), float(thresholds[0])
    previous, current = values[index - 1], values[index]
    weight = differences[index - 1] / (differences[index - 1] - differences[index])
    error = previous["FAR"] + weight * (current["FAR"] - previous["FAR"])
    threshold = thresholds[index - 1] + weight * (thresholds[index] - thresholds[index - 1])
    return float(error), float(threshold)


def recommend(rows: list[dict], target_far: float) -> dict | None:
    return next((r for r in sorted(rows, key=lambda r: r["threshold"]) if r["FAR"] <= target_far), None)


def wilson_upper(successes: int, trials: int, z: float = 1.96) -> float:
    if not trials: return float("nan")
    p = successes / trials
    return float((p + z*z/(2*trials) + z*np.sqrt(p*(1-p)/trials + z*z/(4*trials*trials))) / (1 + z*z/trials))
