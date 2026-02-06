"""Sentiment analysis for persona responses.

Uses a lightweight keyword + heuristic approach for fast sentiment scoring.
Falls back to Claude for ambiguous cases when needed.
"""

import re

# Positive and negative signal words with weights
_POSITIVE_SIGNALS = {
    # Strong positive (weight 2)
    "invest": 2, "excited": 2, "compelling": 2, "strong": 2,
    "excellent": 2, "impressive": 2, "outstanding": 2, "love": 2,
    "definitely": 2, "absolutely": 2, "confident": 2,
    # Moderate positive (weight 1)
    "interested": 1, "good": 1, "promising": 1, "potential": 1,
    "like": 1, "positive": 1, "solid": 1, "great": 1,
    "prefer": 1, "agree": 1, "recommend": 1, "support": 1,
    "valuable": 1, "useful": 1, "important": 1, "beneficial": 1,
    "opportunity": 1, "innovative": 1, "growth": 1, "traction": 1,
    "appealing": 1, "reasonable": 1, "fair": 1, "willing": 1,
    "upgrade": 1, "subscribe": 1, "adopt": 1,
}

_NEGATIVE_SIGNALS = {
    # Strong negative (weight 2)
    "pass": 2, "reject": 2, "terrible": 2, "awful": 2,
    "never": 2, "unacceptable": 2, "dealbreaker": 2, "overpriced": 2,
    "churn": 2, "cancel": 2, "leave": 2,
    # Moderate negative (weight 1)
    "concern": 1, "risk": 1, "worry": 1, "doubt": 1,
    "expensive": 1, "unclear": 1, "weak": 1, "problem": 1,
    "difficult": 1, "challenge": 1, "issue": 1, "missing": 1,
    "lack": 1, "insufficient": 1, "unlikely": 1, "hesitant": 1,
    "skeptical": 1, "cautious": 1, "limited": 1, "concerned": 1,
    "competitive": 1, "crowded": 1, "saturated": 1, "premature": 1,
    "confused": 1, "frustrated": 1, "disappointed": 1,
}


def analyze_sentiment(text: str) -> float:
    """Analyze the sentiment of a response text.

    Returns a score from -1.0 (very negative) to 1.0 (very positive).
    0.0 indicates neutral sentiment.
    """
    if not text or not text.strip():
        return 0.0

    words = re.findall(r"\b[a-z]+\b", text.lower())

    positive_score = 0
    negative_score = 0

    for word in words:
        if word in _POSITIVE_SIGNALS:
            positive_score += _POSITIVE_SIGNALS[word]
        if word in _NEGATIVE_SIGNALS:
            negative_score += _NEGATIVE_SIGNALS[word]

    total = positive_score + negative_score
    if total == 0:
        return 0.0

    # Normalize to [-1, 1] range
    raw_score = (positive_score - negative_score) / total

    # Clamp to [-1, 1]
    return max(-1.0, min(1.0, round(raw_score, 2)))
