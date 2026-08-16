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

  const candidates = [];


  // =============================
  // 1. 通常のピボット高値・安値
  // =============================

  for (
    let i = Math.max(
      startIndex,
      pivotWindow
    );
    i < closes.length - pivotWindow;
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
      if (
        Number.isFinite(
          lows[i - offset]
        ) &&
        currentLow >
          lows[i - offset]
      ) {
        isPivotLow = false;
      }

      if (
        Number.isFinite(
          lows[i + offset]
        ) &&
        currentLow >
          lows[i + offset]
      ) {
        isPivotLow = false;
      }

      if (
        Number.isFinite(
          highs[i - offset]
        ) &&
        currentHigh <
          highs[i - offset]
      ) {
        isPivotHigh = false;
      }

      if (
        Number.isFinite(
          highs[i + offset]
        ) &&
        currentHigh <
          highs[i + offset]
      ) {
        isPivotHigh = false;
      }
    }

    if (isPivotLow) {
      candidates.push({
        price: currentLow,
        index: i,
        source: "pivot"
      });
    }

    if (isPivotHigh) {
      candidates.push({
        price: currentHigh,
        index: i,
        source: "pivot"
      });
    }
  }


  // =============================
  // 2. 直近高値・安値を追加
  // =============================

  const recentStart =
    Math.max(
      startIndex,
      closes.length - recentWindow
    );

  for (
    let i = recentStart;
    i < closes.length;
    i++
  ) {
    if (
      Number.isFinite(highs[i])
    ) {
      candidates.push({
        price: highs[i],
        index: i,
        source: "recent"
      });
    }

    if (
      Number.isFinite(lows[i])
    ) {
      candidates.push({
        price: lows[i],
        index: i,
        source: "recent"
      });
    }
  }


  // =============================
  // 3. 近い価格帯をクラスタ化
  // =============================

  const tolerance =
    latestClose *
    (tolerancePercent / 100);

  const sortedCandidates =
    [...candidates].sort(
      (a, b) =>
        a.price - b.price
    );

  const clusters = [];

  for (
    const candidate of
    sortedCandidates
  ) {
    const existing =
      clusters.find(
        (level) =>
          Math.abs(
            level.price -
            candidate.price
          ) <= tolerance
      );

    if (existing) {
      const newTouches =
        existing.touches + 1;

      existing.price =
        (
          existing.price *
            existing.touches +
          candidate.price
        ) /
        newTouches;

      existing.touches =
        newTouches;

      existing.lastIndex =
        Math.max(
          existing.lastIndex,
          candidate.index
        );

      if (
        candidate.source ===
        "recent"
      ) {
        existing.recentTouches += 1;
      }

    } else {
      clusters.push({
        price: candidate.price,
        touches: 1,
        recentTouches:
          candidate.source === "recent"
            ? 1
            : 0,
        lastIndex:
          candidate.index
      });
    }
  }


  // =============================
  // 4. 現在値から遠すぎる価格帯を除外
  // =============================

  const minimumPrice =
    latestClose *
    (
      1 -
      maxDistancePercent / 100
    );

  const maximumPrice =
    latestClose *
    (
      1 +
      maxDistancePercent / 100
    );

  const nearbyLevels =
    clusters
      .filter(
        (level) =>
          level.price >= minimumPrice &&
          level.price <= maximumPrice
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


  // =============================
  // 5. サポート候補
  // =============================

  const supportCandidates =
    nearbyLevels
      .filter(
        (level) =>
          level.price <
          latestClose
      )
      .sort(
        (a, b) =>
          b.strengthScore -
          a.strengthScore
      );


  // =============================
  // 6. レジスタンス候補
  // =============================

  const resistanceCandidates =
    nearbyLevels
      .filter(
        (level) =>
          level.price >
          latestClose
      )
      .sort(
        (a, b) =>
          b.strengthScore -
          a.strengthScore
      );


  // =============================
  // 7. 念のため重複除去
  // =============================

  const removeDuplicates =
    (levels) => {
      const result = [];

      for (const level of levels) {
        const duplicate =
          result.some(
            (existing) =>
              Math.abs(
                existing.price -
                level.price
              ) <=
              latestClose * 0.005
          );

        if (!duplicate) {
          result.push(level);
        }
      }

      return result;
    };


  // =============================
  // 8. 最終結果は「現在値に近い順」
  // =============================
  //
  // html.js が
  // supports[0], supports[1], supports[2]
  // の順番をそのまま表示できるようにする。
  // =============================

  const supports =
    removeDuplicates(
      supportCandidates
    )
      .sort(
        (a, b) =>
          b.price - a.price
      )
      .slice(
        0,
        maxLevels
      );


  const resistances =
    removeDuplicates(
      resistanceCandidates
    )
      .sort(
        (a, b) =>
          a.price - b.price
      )
      .slice(
        0,
        maxLevels
      );


  // =============================
  // 9. 直近サポート / レジスタンス
  // =============================

  const nearestSupport =
    supports[0] ?? null;

  const nearestResistance =
    resistances[0] ?? null;


  // =============================
  // 10. 現在値との距離
  // =============================

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
