export function detectSupportResistance(
  highs,
  lows,
  closes,
  options = {}
) {
  const {
    lookback = 60,
    pivotWindow = 2,
    tolerancePercent = 1.5,
    maxDistancePercent = 15,
    maxLevels = 3
  } = options;

  const latestClose =
    closes[closes.length - 1];

  const emptyResult = {
    supports: [],
    resistances: [],
    nearestSupport: null,
    nearestResistance: null,
    supportDistancePercent: null,
    resistanceDistancePercent: null
  };

  if (
    !Number.isFinite(latestClose) ||
    closes.length < pivotWindow * 2 + 1
  ) {
    return emptyResult;
  }

  const startIndex = Math.max(
    pivotWindow,
    closes.length - lookback
  );

  const endIndex =
    closes.length - pivotWindow;

  const pivotLevels = [];

  for (let i = startIndex; i < endIndex; i++) {
    const currentLow = lows[i];
    const currentHigh = highs[i];

    if (
      !Number.isFinite(currentLow) ||
      !Number.isFinite(currentHigh)
    ) {
      continue;
    }

    let isPivotLow = true;
    let isPivotHigh = true;

    for (
      let offset = 1;
      offset <= pivotWindow;
      offset++
    ) {
      if (
        currentLow > lows[i - offset] ||
        currentLow > lows[i + offset]
      ) {
        isPivotLow = false;
      }

      if (
        currentHigh < highs[i - offset] ||
        currentHigh < highs[i + offset]
      ) {
        isPivotHigh = false;
      }
    }

    if (isPivotLow) {
      pivotLevels.push({
        price: currentLow,
        type: "support",
        index: i
      });
    }

    if (isPivotHigh) {
      pivotLevels.push({
        price: currentHigh,
        type: "resistance",
        index: i
      });
    }
  }

  const clusteredLevels = [];
  const tolerance =
    latestClose *
    (tolerancePercent / 100);

  for (const pivot of pivotLevels) {
    const existing = clusteredLevels.find(
      (level) =>
        level.type === pivot.type &&
        Math.abs(level.price - pivot.price) <= tolerance
    );

    if (existing) {
      existing.price =
        (
          existing.price * existing.touches +
          pivot.price
        ) /
        (existing.touches + 1);

      existing.touches += 1;
      existing.lastIndex = Math.max(
        existing.lastIndex,
        pivot.index
      );
    } else {
      clusteredLevels.push({
        price: pivot.price,
        type: pivot.type,
        touches: 1,
        lastIndex: pivot.index
      });
    }
  }

  const minimumPrice =
    latestClose *
    (1 - maxDistancePercent / 100);

  const maximumPrice =
    latestClose *
    (1 + maxDistancePercent / 100);

  const nearbyLevels = clusteredLevels.filter(
    (level) =>
      level.price >= minimumPrice &&
      level.price <= maximumPrice
  );

  const supports = nearbyLevels
    .filter(
      (level) =>
        level.type === "support" &&
        level.price < latestClose
    )
    .sort((a, b) => {
      const distanceA =
        latestClose - a.price;
      const distanceB =
        latestClose - b.price;

      if (
        Math.abs(distanceA - distanceB) >
        latestClose * 0.005
      ) {
        return distanceA - distanceB;
      }

      return b.touches - a.touches;
    })
    .slice(0, maxLevels);

  const resistances = nearbyLevels
    .filter(
      (level) =>
        level.type === "resistance" &&
        level.price > latestClose
    )
    .sort((a, b) => {
      const distanceA =
        a.price - latestClose;
      const distanceB =
        b.price - latestClose;

      if (
        Math.abs(distanceA - distanceB) >
        latestClose * 0.005
      ) {
        return distanceA - distanceB;
      }

      return b.touches - a.touches;
    })
    .slice(0, maxLevels);

  const nearestSupport =
    supports[0] ?? null;

  const nearestResistance =
    resistances[0] ?? null;

  const supportDistancePercent =
    nearestSupport
      ? (
          (nearestSupport.price - latestClose) /
          latestClose
        ) * 100
      : null;

  const resistanceDistancePercent =
    nearestResistance
      ? (
          (nearestResistance.price - latestClose) /
          latestClose
        ) * 100
      : null;

  return {
    supports,
    resistances,
    nearestSupport,
    nearestResistance,
    supportDistancePercent,
    resistanceDistancePercent
  };
}

