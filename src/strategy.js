export function createStrategy({
  latestClose,
  ma5,
  ma25,
  ma75,
  ma200,
  rsi14,
  bollinger,
  volumeRatio,
  crossSignal,
  atr14,
  latestMacd,
  latestSignal,
  latestHistogram,
  recent20High,
  supportResistance,
  capital,
  riskPercent
}) {

  // =====================================
  // 1. 基本値
  // =====================================

  const effectiveAtr =
    Number.isFinite(atr14) &&
    atr14 > 0
      ? atr14
      : latestClose * 0.03;


  const nearestSupport =
    supportResistance
      ?.nearestSupport ?? null;


  const nearestResistance =
    supportResistance
      ?.nearestResistance ?? null;


  const supportPrice =
    Number.isFinite(
      nearestSupport?.price
    )
      ? nearestSupport.price
      : null;


  const resistancePrice =
    Number.isFinite(
      nearestResistance?.price
    )
      ? nearestResistance.price
      : null;


  const supportDistancePercent =
    Number.isFinite(
      supportResistance
        ?.supportDistancePercent
    )
      ? Math.abs(
          supportResistance
            .supportDistancePercent
        )
      : null;


  const resistanceDistancePercent =
    Number.isFinite(
      supportResistance
        ?.resistanceDistancePercent
    )
      ? Math.abs(
          supportResistance
            .resistanceDistancePercent
        )
      : null;


  // =====================================
  // 2. 基本トレンド判定
  // =====================================

  const bullishTrend =
    Number.isFinite(ma5) &&
    Number.isFinite(ma25) &&
    latestClose > ma5 &&
    ma5 > ma25;


  const mediumBullish =
    Number.isFinite(ma25) &&
    Number.isFinite(ma75) &&
    ma25 > ma75;


  const overheated =
    Number.isFinite(rsi14) &&
    rsi14 >= 70;


  const oversold =
    Number.isFinite(rsi14) &&
    rsi14 <= 30;


  const macdBullish =
    Number.isFinite(latestMacd) &&
    Number.isFinite(latestSignal) &&
    latestMacd >
      latestSignal;


  // =====================================
  // 3. AIスコア
  // =====================================

  let score = 50;

  const reasons = [];
  const cautions = [];


  // 株価 vs 5日線

  if (
    Number.isFinite(ma5) &&
    latestClose > ma5
  ) {
    score += 10;

    reasons.push(
      "株価は5日移動平均線を上回っています"
    );

  } else {
    score -= 10;

    cautions.push(
      "株価は5日移動平均線を下回っています"
    );
  }


  // 5日線 vs 25日線

  if (
    Number.isFinite(ma5) &&
    Number.isFinite(ma25) &&
    ma5 > ma25
  ) {
    score += 15;

    reasons.push(
      "5日線が25日線を上回る上昇トレンドです"
    );

  } else {
    score -= 15;

    cautions.push(
      "5日線が25日線を下回っています"
    );
  }


  // 25日線 vs 75日線

  if (
    Number.isFinite(ma25) &&
    Number.isFinite(ma75)
  ) {
    if (mediumBullish) {
      score += 10;

      reasons.push(
        "25日線が75日線を上回る中期上昇トレンドです"
      );

    } else {
      score -= 10;

      cautions.push(
        "25日線が75日線を下回る中期弱気形です"
      );
    }
  }


  // 200日線

  if (
    Number.isFinite(ma200)
  ) {
    if (
      latestClose > ma200
    ) {
      score += 5;

      reasons.push(
        "株価は200日線を上回り長期基調は良好です"
      );

    } else {
      score -= 5;

      cautions.push(
        "株価は200日線を下回っています"
      );
    }
  }


  // MAクロス

  if (
    crossSignal === "golden"
  ) {
    score += 10;

    reasons.push(
      "5日線と25日線のゴールデンクロスが発生しました"
    );

  } else if (
    crossSignal === "dead"
  ) {
    score -= 10;

    cautions.push(
      "5日線と25日線のデッドクロスが発生しました"
    );
  }


  // =====================================
  // 4. 出来高
  // =====================================

  if (
    Number.isFinite(volumeRatio)
  ) {
    if (
      volumeRatio >= 2
    ) {
      score += 10;

      reasons.push(
        `出来高が20日平均の${volumeRatio.toFixed(1)}倍に急増しています`
      );

    } else if (
      volumeRatio >= 1.3
    ) {
      score += 5;

      reasons.push(
        `出来高が20日平均の${volumeRatio.toFixed(1)}倍です`
      );

    } else if (
      volumeRatio < 0.7
    ) {
      score -= 5;

      cautions.push(
        "出来高が20日平均を大きく下回っています"
      );
    }
  }


  // =====================================
  // 5. ボリンジャーバンド
  // =====================================

  if (
    bollinger &&
    Number.isFinite(
      bollinger.upper
    ) &&
    Number.isFinite(
      bollinger.lower
    )
  ) {
    if (
      latestClose >
      bollinger.upper
    ) {
      score -= 8;

      cautions.push(
        "株価がボリンジャーバンド+2σを上回り、短期的な行き過ぎに注意が必要です"
      );

    } else if (
      latestClose <
      bollinger.lower
    ) {
      score += 3;

      cautions.push(
        "株価がボリンジャーバンド-2σを下回っています。反発余地はありますが下落継続にも注意が必要です"
      );
    }
  }


  // =====================================
  // 6. RSI
  // =====================================

  if (overheated) {
    score -= 20;

    cautions.push(
      `RSIが${rsi14.toFixed(1)}で短期的に過熱しています`
    );
  }


  if (oversold) {
    score += 3;

    cautions.push(
      `RSIが${rsi14.toFixed(1)}で売られ過ぎ水準ですが、下落継続には注意が必要です`
    );
  }


  // =====================================
  // 7. MACD
  // =====================================

  if (macdBullish) {
    score += 10;

    reasons.push(
      "MACDがシグナルを上回っています"
    );

  } else {
    score -= 10;

    cautions.push(
      "MACDがシグナルを下回っています"
    );
  }


  if (
    Number.isFinite(
      latestHistogram
    )
  ) {
    if (
      latestHistogram > 0
    ) {
      score += 5;

      reasons.push(
        "MACDヒストグラムはプラスです"
      );

    } else {
      cautions.push(
        "MACDヒストグラムはマイナスです"
      );
    }
  }


  // =====================================
  // 8. サポート評価
  // =====================================

  if (
    supportPrice !== null &&
    supportDistancePercent !== null
  ) {

    if (
      supportDistancePercent <= 2
    ) {
      score += 8;

      reasons.push(
        `現在値の約${supportDistancePercent.toFixed(1)}%下に直近サポートがあります`
      );

    } else if (
      supportDistancePercent <= 5
    ) {
      score += 5;

      reasons.push(
        `現在値の約${supportDistancePercent.toFixed(1)}%下にサポートがあります`
      );

    } else if (
      supportDistancePercent <= 8
    ) {
      score += 2;

      reasons.push(
        "下値にサポート候補があります"
      );
    }


    if (
      Number.isFinite(
        nearestSupport?.touches
      ) &&
      nearestSupport.touches >= 3
    ) {
      score += 3;

      reasons.push(
        "直近サポート付近で複数回の価格反応が確認されています"
      );
    }
  }


  // =====================================
  // 9. レジスタンス評価
  // =====================================

  if (
    resistancePrice !== null &&
    resistanceDistancePercent !== null
  ) {

    if (
      resistanceDistancePercent <= 1.5
    ) {
      score -= 7;

      cautions.push(
        "現在値のすぐ上にレジスタンスがあり、上値余地が限定される可能性があります"
      );

    } else if (
      resistanceDistancePercent <= 3
    ) {
      score -= 3;

      cautions.push(
        "現在値の近くに上値抵抗があります"
      );

    } else if (
      resistanceDistancePercent >= 5
    ) {
      score += 2;

      reasons.push(
        "直近レジスタンスまで一定の上値余地があります"
      );
    }
  }


  // =====================================
  // 10. 0～100点に収める
  // =====================================

  score =
    Math.max(
      0,
      Math.min(
        100,
        Math.round(score)
      )
    );


  // =====================================
  // 11. 買い候補の中心価格
  // =====================================
  //
  // サポートが現在値から8%以内なら、
  // 5日線よりサポートを優先。
  //
  // サポートが遠ければ従来どおりMA中心。
  // =====================================

  let entryAnchor;

  const usableSupport =
    supportPrice !== null &&
    supportDistancePercent !== null &&
    supportDistancePercent <= 8;


  if (usableSupport) {
    entryAnchor =
      supportPrice;

  } else if (
    Number.isFinite(ma5)
  ) {
    entryAnchor =
      ma5;

  } else {
    entryAnchor =
      latestClose -
      effectiveAtr;
  }


  // =====================================
  // 12. 買い候補レンジ
  // =====================================

  let entryLow =
    Math.max(
      0,
      entryAnchor -
        effectiveAtr * 0.15
    );


  let entryHigh =
    Math.min(
      latestClose,
      entryAnchor +
        effectiveAtr * 0.10
    );


  if (
    entryHigh < entryLow
  ) {
    entryHigh =
      entryLow;
  }


  const entryCenter =
    (
      entryLow +
      entryHigh
    ) / 2;


  // =====================================
  // 13. 短期損切り
  // =====================================
  //
  // サポートがある場合：
  // サポートを明確に割ったところ。
  //
  // なければ従来どおり
  // MA5 + ATR。
  // =====================================

  let shortStop;


  if (usableSupport) {
    shortStop =
      Math.max(
        0,
        supportPrice -
          effectiveAtr * 0.35
      );

  } else {
    shortStop =
      Math.max(
        0,
        entryLow -
          effectiveAtr * 0.55
      );
  }


  // =====================================
  // 14. スイング損切り
  // =====================================

  let swingStop;


  const secondSupport =
    supportResistance
      ?.supports?.[1];


  if (
    Number.isFinite(
      secondSupport?.price
    )
  ) {
    swingStop =
      Math.max(
        0,
        secondSupport.price -
          effectiveAtr * 0.30
      );

  } else if (
    Number.isFinite(ma25)
  ) {
    swingStop =
      Math.max(
        0,
        ma25 -
          effectiveAtr * 0.30
      );

  } else {
    swingStop =
      Math.max(
        0,
        entryLow -
          effectiveAtr * 1.5
      );
  }


  // 損切りがエントリーより上にならないよう保証

  shortStop =
    Math.min(
      shortStop,
      entryCenter - 1
    );


  swingStop =
    Math.min(
      swingStop,
      entryCenter - 1
    );


  // =====================================
  // 15. リスク
  // =====================================

  const shortRiskPerShare =
    Math.max(
      1,
      entryCenter -
        shortStop
    );


  const swingRiskPerShare =
    Math.max(
      1,
      entryCenter -
        swingStop
    );


  // =====================================
  // 16. 利確①
  // =====================================
  //
  // 直近レジスタンスが
  // エントリーより上なら最優先。
  //
  // なければ20日高値または
  // RR 1.5倍。
  // =====================================

  const minimumTarget1 =
    entryCenter +
    shortRiskPerShare *
      1.2;


  let target1;


  if (
    resistancePrice !== null &&
    resistancePrice >
      entryCenter &&
    resistancePrice >=
      minimumTarget1
  ) {
    target1 =
      resistancePrice;

  } else {
    target1 =
      Math.max(
        Number.isFinite(
          recent20High
        )
          ? recent20High
          : 0,

        entryCenter +
          shortRiskPerShare *
            1.5
      );
  }


  // =====================================
  // 17. 利確②
  // =====================================

  const target2 =
    Math.max(
      target1 +
        effectiveAtr * 0.8,

      entryCenter +
        shortRiskPerShare *
          2.5
    );


  // =====================================
  // 18. リスクリワード
  // =====================================

  const riskReward1 =
    (
      target1 -
      entryCenter
    ) /
    shortRiskPerShare;


  const riskReward2 =
    (
      target2 -
      entryCenter
    ) /
    shortRiskPerShare;


  // =====================================
  // 19. 資金管理
  // =====================================

  const loss100Short =
    shortRiskPerShare *
    100;


  const loss100Swing =
    swingRiskPerShare *
    100;


  const allowedLoss =
    capital *
    (
      riskPercent /
      100
    );


  const recommendedShares =
    shortRiskPerShare > 0
      ? Math.max(
          0,
          Math.floor(
            (
              allowedLoss /
              shortRiskPerShare
            ) /
            100
          ) * 100
        )
      : 0;


  const requiredCapital =
    recommendedShares *
    entryCenter;


  // =====================================
  // 20. 最終ラベル
  // =====================================

  let label;
  let className;


  if (
    bullishTrend &&
    overheated
  ) {
    label =
      "上昇トレンド・押し目待ち";

    className =
      "wait";

  } else if (
    bullishTrend &&
    macdBullish &&
    score >= 65
  ) {
    label =
      "買い候補";

    className =
      "buy";

  } else if (
    Number.isFinite(ma25) &&
    latestClose < ma25
  ) {
    label =
      "下落警戒";

    className =
      "danger";

  } else {
    label =
      "様子見";

    className =
      "wait";
  }


  // =====================================
  // 21. AIコメント
  // =====================================

  const roundedEntryLow =
    Math.round(entryLow);

  const roundedEntryHigh =
    Math.round(entryHigh);

  const roundedSupport =
    supportPrice !== null
      ? Math.round(
          supportPrice
        )
      : null;

  const roundedResistance =
    resistancePrice !== null
      ? Math.round(
          resistancePrice
        )
      : null;


  let action;


  if (
    bullishTrend &&
    overheated &&
    usableSupport
  ) {
    action =
      `上昇トレンドは維持していますが短期的に過熱しています。` +
      `現在値を追いかけず、${roundedEntryLow.toLocaleString("ja-JP")}～${roundedEntryHigh.toLocaleString("ja-JP")}円付近への押しを待つ判断です。` +
      `直近サポートは約${roundedSupport.toLocaleString("ja-JP")}円です。`;

  } else if (
    bullishTrend &&
    macdBullish &&
    usableSupport
  ) {
    action =
      `上昇基調を維持しています。` +
      `直近サポート約${roundedSupport.toLocaleString("ja-JP")}円を意識し、${roundedEntryLow.toLocaleString("ja-JP")}～${roundedEntryHigh.toLocaleString("ja-JP")}円を分割エントリー候補とします。`;

  } else if (
    Number.isFinite(ma25) &&
    latestClose < ma25
  ) {
    action =
      "25日線を下回っているため、現時点では底打ち確認を優先します。サポートでの反発や移動平均線の回復を確認してからの方が安全です。";

  } else {
    action =
      `方向感が十分に揃っていません。` +
      `買い候補は${roundedEntryLow.toLocaleString("ja-JP")}～${roundedEntryHigh.toLocaleString("ja-JP")}円付近ですが、反発確認を優先します。`;
  }


  if (
    roundedResistance !== null &&
    resistanceDistancePercent !== null &&
    resistanceDistancePercent <= 5
  ) {
    action +=
      ` 上値は約${roundedResistance.toLocaleString("ja-JP")}円付近のレジスタンスに注意します。`;
  }


  // =====================================
  // 22. 星評価
  // =====================================

  const stars =
    Math.max(
      1,
      Math.min(
        5,
        Math.ceil(
          score / 20
        )
      )
    );


  // =====================================
  // 23. 結果
  // =====================================

  return {
    score,
    stars,

    label,
    className,

    action,
    aiComment: action,

    reasons,
    strengths: reasons,
    cautions,

    entryLow,
    entryHigh,
    entryCenter,

    shortStop,
    swingStop,

    target1,
    target2,

    riskReward1,
    riskReward2,

    shortRiskPerShare,
    swingRiskPerShare,

    loss100Short,
    loss100Swing,

    allowedLoss,
    recommendedShares,
    requiredCapital
  };
}
