from __future__ import annotations

"""Van Westendorp Price Sensitivity Meter calculation.

Parses structured price points from persona responses and calculates
intersection points that define the acceptable price range.

Reference: https://en.wikipedia.org/wiki/Van_Westendorp%27s_Price_Sensitivity_Meter

This is a pure Python helper module -- no Modal decorators.
"""

import re


def calculate_van_westendorp(results: list[dict]) -> dict:
    """Calculate Van Westendorp Price Sensitivity Meter from persona responses.

    Expects persona responses to contain structured price lines like:
        TOO_EXPENSIVE: $150
        EXPENSIVE: $120
        BARGAIN: $80
        TOO_CHEAP: $50

    Args:
        results: List of persona result dicts from experiment execution.

    Returns:
        Dict with intersection points, acceptable price range,
        cumulative distribution data, and per-archetype breakdowns.
        Returns None-filled result if fewer than 2 valid data points.
    """
    # Parse price points from all successful responses
    all_prices = []
    by_archetype: dict[str, list[dict]] = {}

    for r in results:
        if r.get("error") is not None:
            continue

        response_text = r.get("response", "")
        prices = _parse_price_points(response_text)

        if prices is None:
            continue

        archetype = r.get("archetype_name", "unknown")
        all_prices.append(prices)

        if archetype not in by_archetype:
            by_archetype[archetype] = []
        by_archetype[archetype].append(prices)

    if len(all_prices) < 2:
        return _empty_result()

    # Calculate overall intersections
    overall = _calculate_intersections(all_prices)

    # Calculate per-archetype intersections
    archetype_results = {}
    for arch, arch_prices in by_archetype.items():
        if len(arch_prices) >= 2:
            arch_intersections = _calculate_intersections(arch_prices)
            archetype_results[arch] = {
                "opp": arch_intersections["optimal_price_point"],
                "ipp": arch_intersections["indifference_price_point"],
                "pmc": arch_intersections["point_of_marginal_cheapness"],
                "pme": arch_intersections["point_of_marginal_expensiveness"],
            }

    overall["by_archetype"] = archetype_results
    return overall


def _parse_price_points(text: str) -> dict | None:
    """Extract 4 price points from a persona response.

    Looks for patterns like:
        TOO_EXPENSIVE: $150
        TOO EXPENSIVE: $150
        Too Expensive: 150
        EXPENSIVE: $120.50

    Returns dict with keys: too_expensive, expensive, bargain, too_cheap
    or None if not all 4 are found.
    """
    if not text:
        return None

    patterns = {
        "too_expensive": r"TOO[_\s]EXPENSIVE\s*:\s*\$?\s*([\d,]+(?:\.\d{1,2})?)",
        "expensive": r"(?<!TOO[_\s])EXPENSIVE\s*:\s*\$?\s*([\d,]+(?:\.\d{1,2})?)",
        "bargain": r"BARGAIN\s*:\s*\$?\s*([\d,]+(?:\.\d{1,2})?)",
        "too_cheap": r"TOO[_\s]CHEAP\s*:\s*\$?\s*([\d,]+(?:\.\d{1,2})?)",
    }

    prices = {}
    for key, pattern in patterns.items():
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            value_str = match.group(1).replace(",", "")
            try:
                prices[key] = float(value_str)
            except ValueError:
                return None
        else:
            return None

    # Sanity check: too_cheap <= bargain <= expensive <= too_expensive
    if not (prices["too_cheap"] <= prices["bargain"] <= prices["expensive"] <= prices["too_expensive"]):
        # Try to use the values anyway -- personas may not be perfectly ordered
        pass

    return prices


def _calculate_intersections(price_data: list[dict]) -> dict:
    """Calculate Van Westendorp intersection points from parsed price data.

    Uses cumulative distributions of the four price questions and finds
    where the curves intersect.

    Returns dict with optimal_price_point, indifference_price_point,
    point_of_marginal_cheapness, point_of_marginal_expensiveness,
    acceptable_price_range, and cumulative_data.
    """
    # Collect all unique price values to build the x-axis
    all_values: set[float] = set()
    for p in price_data:
        all_values.update(p.values())

    price_points = sorted(all_values)
    n = len(price_data)

    # Build cumulative distributions
    # For each price on the x-axis, calculate the proportion of respondents
    # who gave a value <= that price for each question.
    cumulative = []
    for price in price_points:
        too_cheap_cum = sum(1 for p in price_data if p["too_cheap"] >= price) / n
        bargain_cum = sum(1 for p in price_data if p["bargain"] >= price) / n
        expensive_cum = sum(1 for p in price_data if p["expensive"] <= price) / n
        too_expensive_cum = sum(1 for p in price_data if p["too_expensive"] <= price) / n

        cumulative.append({
            "price": price,
            "too_cheap": round(too_cheap_cum, 4),
            "bargain": round(bargain_cum, 4),
            "expensive": round(expensive_cum, 4),
            "too_expensive": round(too_expensive_cum, 4),
        })

    # Find intersections by linear interpolation between adjacent points
    opp = _find_intersection(cumulative, "too_expensive", "too_cheap")
    ipp = _find_intersection(cumulative, "expensive", "bargain")
    pmc = _find_intersection(cumulative, "too_cheap", "expensive")
    pme = _find_intersection(cumulative, "too_expensive", "bargain")

    # Acceptable price range: between PMC and PME
    low = pmc if pmc is not None else price_points[0]
    high = pme if pme is not None else price_points[-1]

    return {
        "optimal_price_point": opp,
        "indifference_price_point": ipp,
        "point_of_marginal_cheapness": pmc,
        "point_of_marginal_expensiveness": pme,
        "acceptable_price_range": {
            "low": round(low, 2),
            "high": round(high, 2),
        },
        "cumulative_data": cumulative,
    }


def _find_intersection(
    cumulative: list[dict],
    curve_a: str,
    curve_b: str,
) -> float | None:
    """Find the price where two cumulative curves intersect.

    Uses linear interpolation between adjacent data points where
    the sign of (curve_a - curve_b) changes.

    Returns the interpolated price or None if no intersection found.
    """
    for i in range(len(cumulative) - 1):
        a1 = cumulative[i][curve_a]
        b1 = cumulative[i][curve_b]
        a2 = cumulative[i + 1][curve_a]
        b2 = cumulative[i + 1][curve_b]

        diff1 = a1 - b1
        diff2 = a2 - b2

        # Check for sign change (intersection between these two points)
        if diff1 * diff2 < 0:
            # Linear interpolation
            p1 = cumulative[i]["price"]
            p2 = cumulative[i + 1]["price"]
            # Solve: a1 + t*(a2-a1) = b1 + t*(b2-b1) for t
            denom = (a2 - a1) - (b2 - b1)
            if abs(denom) < 1e-10:
                return round((p1 + p2) / 2, 2)
            t = (b1 - a1) / denom
            return round(p1 + t * (p2 - p1), 2)

        # Exact intersection at a data point
        if abs(diff1) < 1e-10:
            return round(cumulative[i]["price"], 2)

    # Check last point
    if cumulative and abs(cumulative[-1][curve_a] - cumulative[-1][curve_b]) < 1e-10:
        return round(cumulative[-1]["price"], 2)

    return None


def _empty_result() -> dict:
    """Return empty Van Westendorp result when insufficient data."""
    return {
        "optimal_price_point": None,
        "indifference_price_point": None,
        "point_of_marginal_cheapness": None,
        "point_of_marginal_expensiveness": None,
        "acceptable_price_range": {"low": None, "high": None},
        "cumulative_data": [],
        "by_archetype": {},
    }
