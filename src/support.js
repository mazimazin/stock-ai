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
    maxLevels = 3,
    recentWindow = 10
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
    !Array.isArray(highs) ||
    !Array.isArray(lows) ||
    !Array.isArray(closes) ||
    highs.length === 0 ||
    lows.length === 0 ||
    closes.length === 0
  ) {
    return emptyResult;
  }

  const startIndex =
    Math.max(
      0,
      closes.length - lookback
    );

  const pivotLevels = [];


  // -----------------------------
  // 1. 通常のピボット高値・安値
  // -----------------------------

  for (
    let i =
      Math.max(
        startIndex,
        pivotWindow
      );
    i <
      closes.length -
        pivotWindow;
    i++
  ) {
    const currentLow =
      lows[i];

    const currentHigh =
      highs[i];

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
      const previousLow =
        lows[i - offset];

      const nextLow =
        lows[i + offset];

      const previousHigh =
        highs[i - offset];

      const nextHigh =
        highs[i + offset];


      if (
        Number.isFinite(previousLow) &&
        currentLow > previousLow
      ) {
        isPivotLow = false;
      }

      if (
        Number.isFinite(nextLow) &&
        currentLow > nextLow
      ) {
        isPivotLow = false;
      }


      if (
        Number.isFinite(previousHigh) &&
        currentHigh < previousHigh
      ) {
        isPivotHigh = false;
      }

      if (
        Number.isFinite(nextHigh) &&
        currentHigh < nextHigh
      ) {
        isPivotHigh = false;
      }
    }


    if (isPivotLow) {
      pivotLevels.push({
        price: currentLow,
        type: "support",
        index: i,
        source: "pivot"
      });
    }


    if (isPivotHigh) {
      pivotLevels.push({
        price: currentHigh,
        type: "resistance",
        index: i,
        source: "pivot"
      });
    }
  }


  // -----------------------------
  // 2. 直近価格を追加
  // -----------------------------
  //
  // 最新数日には未来側のローソク足がないため、
  // 通常のピボット判定だけだと重要な高値・安値を
  // 拾えない。
  //
  // そのため直近の高値・安値も候補に加える。
  // -----------------------------

  const recentStart =
    Math.max(
      startIndex,
      closes.length -
        recentWindow
    );

  for (
    let i = recentStart;
    i < closes.length;
    i++
  ) {
    const high =
      highs[i];

    const low =
      lows[i];

    if (Number.isFinite(high)) {
      pivotLevels.push({
        price: high,
        type:
          high > latestClose
            ? "resistance"
            : "support",
        index: i,
        source: "recent"
      });
    }

    if (Number.isFinite(low)) {
      pivotLevels.push({
        price: low,
        type:
          low < latestClose
            ? "support"
            : "resistance",
        index: i,
        source: "recent"
      });
    }
  }


  // -----------------------------
  // 3. 価格帯をクラスタ化
  // -----------------------------

  const clusteredLevels = [];

  const tolerance =
    latestClose *
    (
      tolerancePercent /
      100
    );


  const sortedPivots =
    [...pivotLevels].sort(
      (a, b) =>
        a.price - b.price
    );


  for (const pivot of sortedPivots) {
    const existing =
      clusteredLevels.find(
        (level) =>
          level.type ===
            pivot.type &&
          Math.abs(
            level.price -
            pivot.price
          ) <= tolerance
      );


    if (existing) {
      const totalWeight =
        existing.weight +
        1;

      existing.price =
        (
          existing.price *
            existing.weight +
          pivot.price
        ) /
        totalWeight;

      existing.weight =
        totalWeight;

      existing.touches += 1;

      existing.lastIndex =
        Math.max(
          existing.lastIndex,
          pivot.index
        );

      if (
        pivot.source ===
        "recent"
      ) {
        existing.recentTouches +=
          1;
      }

    } else {
      clusteredLevels.push({
        price:
          pivot.price,

        type:
          pivot.type,

        touches:
          1,

        recentTouches:
          pivot.source ===
          "recent"
            ? 1
            : 0,

        weight:
          1,

        lastIndex:
          pivot.index
      });
    }
  }


  // -----------------------------
  // 4. 現在値から遠すぎる価格を除外
  // -----------------------------

  const minimumPrice =
    latestClose *
    (
      1 -
      maxDistancePercent /
        100
    );


  const maximumPrice =
    latestClose *
    (
      1 +
      maxDistancePercent /
        100
    );


  const nearbyLevels =
    clusteredLevels
      .filter(
        (level) =>
          level.price >=
            minimumPrice &&
          level.price <=
            maximumPrice
      )
      .map(
        (level) => {
          const distancePercent =
            Math.abs(
              (
                level.price -
                latestClose
              ) /
                latestClose
            ) * 100;


          const age =
            closes.length -
            1 -
            level.lastIndex;


          const recencyScore =
            Math.max(
              0,
              10 - age
            );


          const strengthScore =
            level.touches * 3 +
            level.recentTouches * 2 +
            recencyScore -
            distancePercent;


          return {
            ...level,
            distancePercent,
            strengthScore
          };
        }
      );


  // -----------------------------
  // 5. サポート
  // -----------------------------

  const supports =
    nearbyLevels
      .filter(
        (level) =>
          level.price <
          latestClose
      )
      .sort(
        (a, b) => {
          const scoreDifference =
            b.strengthScore -
            a.strengthScore;

          if (
            Math.abs(
              scoreDifference
            ) > 1
          ) {
            return scoreDifference;
          }

          return (
            b.price -
            a.price
          );
        }
      )
      .slice(
        0,
        maxLevels
      );


  // -----------------------------
  // 6. レジスタンス
  // -----------------------------

  const resistances =
    nearbyLevels
      .filter(
        (level) =>
          level.price >
          latestClose
      )
      .sort(
        (a, b) => {
          const scoreDifference =
            b.strengthScore -
            a.strengthScore;

          if (
            Math.abs(
              scoreDifference
            ) > 1
          ) {
            return scoreDifference;
          }

          return (
            a.price -
            b.price
          );
        }
      )
      .slice(
        0,
        maxLevels
      );


  // -----------------------------
  // 7. 一番近い支持線・抵抗線
  // -----------------------------

  const nearestSupport =
    supports.length > 0
      ? [...supports]
          .sort(
            (a, b) =>
              b.price -
              a.price
          )[0]
      : null;


  const nearestResistance =
    resistances.length > 0
      ? [...resistances]
          .sort(
            (a, b) =>
              a.price -
              b.price
          )[0]
      : null;


  // -----------------------------
  // 8. 距離
  // -----------------------------

  const supportDistancePercent =
    nearestSupport
      ? (
          (
            nearestSupport.price -
            latestClose
          ) /
          latestClose
        ) * 100
      : null;


  const resistanceDistancePercent =
    nearestResistance
      ? (
          (
            nearestResistance.price -
            latestClose
          ) /
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
