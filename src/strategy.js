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
  // 2. 状態判定
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


  const longBullish =
    Number.isFinite(ma200) &&
    latestClose > ma200;


  const overheated =
    Number.isFinite(rsi14) &&
    rsi14 >= 70;


  const veryOverheated =
    Number.isFinite(rsi14) &&
    rsi14 >= 80;


  const oversold =
    Number.isFinite(rsi14) &&
    rsi14 <= 30;


  const macdBullish =
    Number.isFinite(latestMacd) &&
    Number.isFinite(latestSignal) &&
    latestMacd > latestSignal;


  const histogramPositive =
    Number.isFinite(
      latestHistogram
    ) &&
    latestHistogram > 0;


  // =====================================
  // 3. トレンド評価
  // =====================================

  let trendScore = 50;

  const trendReasons = [];
  const trendCautions = [];


  if (
    Number.isFinite(ma5)
  ) {

    if (
      latestClose > ma5
    ) {

      trendScore += 10;

      trendReasons.push(
        "株価は5日移動平均線を上回っています"
      );

    } else {

      trendScore -= 10;

      trendCautions.push(
        "株価は5日移動平均線を下回っています"
      );
    }
  }


  if (
    Number.isFinite(ma5) &&
    Number.isFinite(ma25)
  ) {

    if (
      ma5 > ma25
    ) {

      trendScore += 15;

      trendReasons.push(
        "5日線が25日線を上回る短期上昇トレンドです"
      );

    } else {

      trendScore -= 15;

      trendCautions.push(
        "5日線が25日線を下回っています"
      );
    }
  }


  if (
    Number.isFinite(ma25) &&
    Number.isFinite(ma75)
  ) {

    if (
      mediumBullish
    ) {

      trendScore += 10;

      trendReasons.push(
        "25日線が75日線を上回る中期上昇トレンドです"
      );

    } else {

      trendScore -= 10;

      trendCautions.push(
        "25日線が75日線を下回っています"
      );
    }
  }


  if (
    Number.isFinite(ma200)
  ) {

    if (
      longBullish
    ) {

      trendScore += 5;

      trendReasons.push(
        "株価は200日線を上回り長期基調も良好です"
      );

    } else {

      trendScore -= 5;

      trendCautions.push(
        "株価は200日線を下回っています"
      );
    }
  }


  if (
    crossSignal === "golden"
  ) {

    trendScore += 8;

    trendReasons.push(
      "5日線と25日線のゴールデンクロスが発生しています"
    );

  } else if (
    crossSignal === "dead"
  ) {

    trendScore -= 8;

    trendCautions.push(
      "5日線と25日線のデッドクロスが発生しています"
    );
  }


  if (
    Number.isFinite(latestMacd) &&
    Number.isFinite(latestSignal)
  ) {

    if (
      macdBullish
    ) {

      trendScore += 10;

      trendReasons.push(
        "MACDがシグナルを上回っています"
      );

    } else {

      trendScore -= 10;

      trendCautions.push(
        "MACDがシグナルを下回っています"
      );
    }
  }


  if (
    Number.isFinite(
      latestHistogram
    )
  ) {

    if (
      histogramPositive
    ) {

      trendScore += 5;

      trendReasons.push(
        "MACDヒストグラムはプラスです"
      );

    } else {

      trendScore -= 3;

      trendCautions.push(
        "MACDヒストグラムはマイナスです"
      );
    }
  }


  if (
    Number.isFinite(volumeRatio)
  ) {

    if (
      volumeRatio >= 2
    ) {

      trendScore += 8;

      trendReasons.push(
        `出来高が20日平均の${volumeRatio.toFixed(1)}倍に急増しています`
      );

    } else if (
      volumeRatio >= 1.3
    ) {

      trendScore += 4;

      trendReasons.push(
        `出来高が20日平均の${volumeRatio.toFixed(1)}倍です`
      );

    } else if (
      volumeRatio < 0.7
    ) {

      trendScore -= 5;

      trendCautions.push(
        "出来高が20日平均を大きく下回っています"
      );
    }
  }


  trendScore =
    Math.max(
      0,
      Math.min(
        100,
        Math.round(
          trendScore
        )
      )
    );


  // =====================================
  // 4. エントリー評価
  // =====================================

  let entryScore = 50;

  const entryReasons = [];
  const entryCautions = [];


  if (
    Number.isFinite(rsi14)
  ) {

    if (
      rsi14 >= 80
    ) {

      entryScore -= 30;

      entryCautions.push(
        `RSIが${rsi14.toFixed(1)}で非常に過熱しています`
      );

    } else if (
      rsi14 >= 70
    ) {

      entryScore -= 20;

      entryCautions.push(
        `RSIが${rsi14.toFixed(1)}で短期的に過熱しています`
      );

    } else if (
      rsi14 >= 45 &&
      rsi14 <= 65
    ) {

      entryScore += 10;

      entryReasons.push(
        "RSIは極端な過熱感のない水準です"
      );

    } else if (
      rsi14 <= 30
    ) {

      entryScore -= 5;

      entryCautions.push(
        `RSIが${rsi14.toFixed(1)}で売られ過ぎですが、下落継続リスクがあります`
      );
    }
  }


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

      entryScore -= 15;

      entryCautions.push(
        "株価がボリンジャーバンド+2σを上回っており、追い買いには注意が必要です"
      );

    } else if (
      latestClose <
      bollinger.lower
    ) {

      entryScore -= 5;

      entryCautions.push(
        "株価がボリンジャーバンド-2σを下回っており、反発確認が必要です"
      );
    }
  }


  if (
    supportPrice !== null &&
    supportDistancePercent !== null
  ) {

    if (
      supportDistancePercent <= 2
    ) {

      entryScore += 18;

      entryReasons.push(
        `現在値の約${supportDistancePercent.toFixed(1)}%下に直近サポートがあります`
      );

    } else if (
      supportDistancePercent <= 4
    ) {

      entryScore += 12;

      entryReasons.push(
        `現在値の約${supportDistancePercent.toFixed(1)}%下にサポートがあります`
      );

    } else if (
      supportDistancePercent <= 7
    ) {

      entryScore += 6;

      entryReasons.push(
        "比較的近い位置にサポートがあります"
      );

    } else {

      entryScore -= 5;

      entryCautions.push(
        "直近サポートまで距離があり、下値余地に注意が必要です"
      );
    }


    if (
      Number.isFinite(
        nearestSupport?.touches
      ) &&
      nearestSupport.touches >= 3
    ) {

      entryScore += 5;

      entryReasons.push(
        "直近サポート付近で複数回の価格反応があります"
      );
    }
  }


  if (
    resistancePrice !== null &&
    resistanceDistancePercent !== null
  ) {

    if (
      resistanceDistancePercent <= 1.5
    ) {

      entryScore -= 20;

      entryCautions.push(
        "現在値のすぐ上にレジスタンスがあります"
      );

    } else if (
      resistanceDistancePercent <= 3
    ) {

      entryScore -= 10;

      entryCautions.push(
        "現在値の近くに上値抵抗があります"
      );

    } else if (
      resistanceDistancePercent <= 5
    ) {

      entryScore -= 3;

      entryCautions.push(
        "比較的近い位置にレジスタンスがあります"
      );

    } else {

      entryScore += 8;

      entryReasons.push(
        "直近レジスタンスまで一定の上値余地があります"
      );
    }
  }


  if (
    bullishTrend
  ) {

    entryScore += 8;

    entryReasons.push(
      "短期上昇トレンドが維持されています"
    );
  }


  if (
    macdBullish
  ) {

    entryScore += 5;
  }


  entryScore =
    Math.max(
      0,
      Math.min(
        100,
        Math.round(
          entryScore
        )
      )
    );


  // =====================================
  // 5. 総合スコア
  // =====================================

  const score =
    Math.round(
      trendScore * 0.6 +
      entryScore * 0.4
    );


  // =====================================
  // 6. 買い候補価格
  // =====================================

  const usableSupport =
    supportPrice !== null &&
    supportDistancePercent !== null &&
    supportDistancePercent <= 8;


  let entryAnchor;


  if (
    usableSupport
  ) {

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
    entryHigh <
    entryLow
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
  // 7. 損切り
  // =====================================

  let shortStop;


  if (
    usableSupport
  ) {

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


  const secondSupport =
    supportResistance
      ?.supports?.[1];


  let swingStop;


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
  // 8. 1株あたりリスク
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
  // 9. 利確①
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
  // 10. 利確②
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
  // 11. リスクリワード
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
  // 12. 資金管理
  // =====================================

  const loss100Short =
    shortRiskPerShare *
    100;


  const loss100Swing =
    swingRiskPerShare *
    100;


  const minimumLotTradeValue =
    entryCenter *
    100;


  const safeCapital =
    Number.isFinite(capital) &&
    capital > 0
      ? capital
      : 0;


  const safeRiskPercent =
    Number.isFinite(riskPercent) &&
    riskPercent > 0
      ? riskPercent
      : 1;


  const allowedLoss =
    safeCapital *
    (
      safeRiskPercent /
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
          ) *
          100
        )
      : 0;


  // 適正株数が0株なら
  // 「必要資金0円」という
  // 誤解を招く表示を作らない

  const requiredCapital =
    recommendedShares > 0
      ? recommendedShares *
        entryCenter
      : null;


  // =====================================
  // 13. 100株で取引するための必要条件
  // =====================================

  const requiredCapitalFor100 =
    safeRiskPercent > 0
      ? loss100Short /
        (
          safeRiskPercent /
          100
        )
      : null;


  const maxRiskPerShareFor100 =
    allowedLoss > 0
      ? allowedLoss /
        100
      : 0;


  const maxAllowedStopFor100 =
    Math.max(
      0,
      entryCenter -
      maxRiskPerShareFor100
    );


  const minimumLotRiskMultiple =
    allowedLoss > 0
      ? loss100Short /
        allowedLoss
      : null;


  const minimumLotCapitalRiskPercent =
    safeCapital > 0
      ? (
          loss100Short /
          safeCapital
        ) *
        100
      : null;


  const canTradeMinimumLot =
    allowedLoss > 0 &&
    loss100Short <=
    allowedLoss;


  // =====================================
  // 14. 資金面の追加指標
  // =====================================

  // 現金100%で100株を買う場合、
  // 現在の入力資金で足りるか

  const canAffordMinimumLot =
    safeCapital > 0 &&
    minimumLotTradeValue <=
    safeCapital;


  // 100株の売買代金が
  // 入力資金の何倍か

  const minimumLotCapitalMultiple =
    safeCapital > 0
      ? minimumLotTradeValue /
        safeCapital
      : null;


  // =====================================
  // 15. 判定ラベル
  // =====================================

  let label;
  let className;


  if (
    bullishTrend &&
    veryOverheated
  ) {

    label =
      "強い上昇・過熱警戒";

    className =
      "wait";

  } else if (
    bullishTrend &&
    overheated
  ) {

    label =
      "上昇トレンド・押し目待ち";

    className =
      "wait";

  } else if (
    trendScore >= 70 &&
    entryScore >= 70
  ) {

    label =
      "買い候補";

    className =
      "buy";

  } else if (
    trendScore >= 70 &&
    entryScore < 70
  ) {

    label =
      "強いが待ち";

    className =
      "wait";

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
  // 16. コメント
  // =====================================

  const roundedEntryLow =
    Math.round(
      entryLow
    );


  const roundedEntryHigh =
    Math.round(
      entryHigh
    );


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
    trendScore >= 75 &&
    entryScore < 60
  ) {

    action =
      `トレンド自体は強い一方、現在位置からのエントリー条件はまだ良くありません。` +
      `${roundedEntryLow.toLocaleString("ja-JP")}～${roundedEntryHigh.toLocaleString("ja-JP")}円付近までの押し、または反発確認を待つ判断です。`;

  } else if (
    trendScore >= 70 &&
    entryScore >= 70
  ) {

    action =
      `トレンドとエントリー条件の両方が比較的良好です。` +
      `${roundedEntryLow.toLocaleString("ja-JP")}～${roundedEntryHigh.toLocaleString("ja-JP")}円付近を分割エントリー候補とします。`;

  } else if (
    bullishTrend &&
    overheated
  ) {

    action =
      `上昇トレンドは維持していますが短期的に過熱しています。` +
      `現在値を追いかけず、${roundedEntryLow.toLocaleString("ja-JP")}～${roundedEntryHigh.toLocaleString("ja-JP")}円付近への押しを待つ判断です。`;

  } else if (
    Number.isFinite(ma25) &&
    latestClose < ma25
  ) {

    action =
      "25日線を下回っているため、現時点では底打ち確認を優先します。サポートでの反発や移動平均線の回復を確認してからの方が安全です。";

  } else {

    action =
      `方向感が十分に揃っていません。` +
      `${roundedEntryLow.toLocaleString("ja-JP")}～${roundedEntryHigh.toLocaleString("ja-JP")}円付近を候補とし、反発確認を優先します。`;
  }


  if (
    roundedSupport !== null
  ) {

    action +=
      ` 直近サポートは約${roundedSupport.toLocaleString("ja-JP")}円です。`;
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
  // 17. 理由・注意点
  // =====================================

  const reasons = [
    ...trendReasons,
    ...entryReasons
  ];


  const cautions = [
    ...trendCautions,
    ...entryCautions
  ];


  // =====================================
  // 18. 星評価
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
  // 19. 戻り値
  // =====================================

  return {

    score,
    trendScore,
    entryScore,

    stars,

    label,
    className,

    action,
    aiComment:
      action,

    reasons,
    strengths:
      reasons,

    cautions,

    trendReasons,
    trendCautions,

    entryReasons,
    entryCautions,

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

    requiredCapital,

    // 100株の売買金額

    minimumLotTradeValue,

    // 100株リスク関連

    requiredCapitalFor100,

    maxRiskPerShareFor100,

    maxAllowedStopFor100,

    minimumLotRiskMultiple,

    minimumLotCapitalRiskPercent,

    canTradeMinimumLot,

    // 資金面

    canAffordMinimumLot,

    minimumLotCapitalMultiple
  };
}
