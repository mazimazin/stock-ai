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

  const latestIndex =
    closes.length - 1;

  const latestClose =
    closes[latestIndex];

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


  // =====================================
  // 1. ピボット高値・安値を取得
  // =====================================

  for (
    let i = Math.max(
      startIndex,
      pivotWindow
    );
    i <
      closes.length - pivotWindow;
    i++
  ) {
    const currentHigh =
      highs[i];

    const currentLow =
      lows[i];

    if (
      !Number.isFinite(currentHigh) ||
      !Number.isFinite(currentLow)
    ) {
      continue;
    }

    let pivotHigh = true;
    let pivotLow = true;

    for (
      let offset = 1;
      offset <= pivotWindow;
      offset++
    ) {
      if (
        currentHigh <
          highs[i - offset] ||
        currentHigh <
          highs[i + offset]
      ) {
        pivotHigh = false;
      }

      if (
        currentLow >
          lows[i - offset] ||
        currentLow >
          lows[i + offset]
      ) {
        pivotLow = false;
      }
    }

    if (pivotHigh) {
      candidates.push({
        price: currentHigh,
        index: i,
        source: "pivot"
      });
    }

    if (pivotLow) {
      candidates.push({
        price: currentLow,
        index: i,
        source: "pivot"
      });
    }
  }


  // =====================================
  // 2. 直近の高値・安値も追加
  // =====================================

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


  // =====================================
  // 3. 現在値±15%だけ残す
  // =====================================

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

  const nearbyCandidates =
    candidates
      .filter(
        (item) =>
          Number.isFinite(item.price) &&
          item.price >= minimumPrice &&
          item.price <= maximumPrice
      )
      .sort(
        (a, b) =>
          a.price - b.price
      );


  // =====================================
  // 4. 近い価格を1つの価格帯にまとめる
  // =====================================

  const tolerance =
    latestClose *
    (
      tolerancePercent / 100
    );

  const clusters = [];

  for (
    const candidate of
    nearbyCandidates
  ) {
    let bestCluster = null;
    let bestDistance = Infinity;

    for (
      const cluster of clusters
    ) {
      const distance =
        Math.abs(
          cluster.price -
          candidate.price
        );

      if (
        distance <= tolerance &&
        distance < bestDistance
      ) {
        bestCluster = cluster;
        bestDistance = distance;
      }
    }

    if (bestCluster) {
      const oldTouches =
        bestCluster.touches;

      const newTouches =
        oldTouches + 1;

      bestCluster.price =
        (
          bestCluster.price *
            oldTouches +
          candidate.price
        ) /
        newTouches;

      bestCluster.touches =
        newTouches;

      bestCluster.lastIndex =
        Math.max(
          bestCluster.lastIndex,
          candidate.index
        );

      if (
        candidate.source ===
        "recent"
      ) {
        bestCluster.recentTouches += 1;
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


  // =====================================
  // 5. クラスタ同士が再び近くなった場合も統合
  // =====================================

  let merged = true;

  while (merged) {
    merged = false;

    clusters.sort(
      (a, b) =>
        a.price - b.price
    );

    for (
      let i = 0;
      i < clusters.length - 1;
      i++
    ) {
      const current =
        clusters[i];

      const next =
        clusters[i + 1];

      if (
        Math.abs(
          current.price -
          next.price
        ) <= tolerance
      ) {
        const totalTouches =
          current.touches +
          next.touches;

        current.price =
          (
            current.price *
              current.touches +
            next.price *
              next.touches
          ) /
          totalTouches;

        current.touches =
          totalTouches;

        current.recentTouches +=
          next.recentTouches;

        current.lastIndex =
          Math.max(
            current.lastIndex,
            next.lastIndex
          );

        clusters.splice(
          i + 1,
          1
        );

        merged = true;
        break;
      }
    }
  }


  // =====================================
  // 6. 補助情報を追加
  // =====================================

  const levels =
    clusters.map(
      (level) => {
        const distancePercent =
          (
            (
              level.price -
              latestClose
            ) /
            latestClose
          ) * 100;

        const age =
          latestIndex -
          level.lastIndex;

        const recencyScore =
          Math.max(
            0,
            10 - age
          );

        const strengthScore =
          level.touches * 3 +
          level.recentTouches * 2 +
          recencyScore;

        return {
          ...level,
          distancePercent,
          strengthScore
        };
      }
    );


  // =====================================
  // 7. サポート
  //    現在値に近い順
  // =====================================

  const supports =
    levels
      .filter(
        (level) =>
          level.price <
          latestClose
      )
      .sort(
        (a, b) =>
          b.price - a.price
      )
      .slice(
        0,
        maxLevels
      );


  // =====================================
  // 8. レジスタンス
  //    現在値に近い順
  // =====================================

  const resistances =
    levels
      .filter(
        (level) =>
          level.price >
          latestClose
      )
      .sort(
        (a, b) =>
          a.price - b.price
      )
      .slice(
        0,
        maxLevels
      );


  // =====================================
  // 9. nearest は必ず配列の0番
  // =====================================

  const nearestSupport =
    supports[0] ?? null;

  const nearestResistance =
    resistances[0] ?? null;


  // =====================================
  // 10. 現在値からの距離
  // =====================================

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
