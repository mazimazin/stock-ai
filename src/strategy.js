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
  riskPercent,
  tradeMode = "margin",
  marginRate = 30
}) {

  // =====================================
  // 1. 基本値
  // =====================================

  const effectiveAtr =
    Number.isFinite(atr14) &&
    atr14 > 0
      ? atr14
      : latestClose * 0.03;


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


  const safeTradeMode =
    tradeMode === "cash"
      ? "cash"
      : "margin";


  const safeMarginRate =
    Number.isFinite(marginRate) &&
    marginRate > 0
      ? marginRate
      : 30;


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


  if (Number.isFinite(ma5)) {

    if (latestClose > ma5) {

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

    if (ma5 > ma25) {

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

    if (mediumBullish) {

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


  if (Number.isFinite(ma200)) {

    if (longBullish) {

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


  if (crossSignal === "golden") {

    trendScore += 8;

    trendReasons.push(
      "5日線と25日線のゴールデンクロスが発生しています"
    );

  } else if (crossSignal === "dead") {

    trendScore -= 8;

    trendCautions.push(
      "5日線と25日線のデッドクロスが発生しています"
    );
  }


  if (
    Number.isFinite(latestMacd) &&
    Number.isFinite(latestSignal)
  ) {

    if (macdBullish) {

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

    if (histogramPositive) {

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


  if (Number.isFinite(volumeRatio)) {

    if (volumeRatio >= 2) {

      trendScore += 8;

      trendReasons.push(
        `出来高が20日平均の${volumeRatio.toFixed(1)}倍に急増しています`
      );

    } else if (volumeRatio >= 1.3) {

      trendScore += 4;

      trendReasons.push(
        `出来高が20日平均の${volumeRatio.toFixed(1)}倍です`
      );

    } else if (volumeRatio < 0.7) {

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
        Math.round(trendScore)
      )
    );


  // =====================================
  // 4. 買い候補
  // =====================================

  const usableSupport =
    supportPrice !== null &&
    supportDistancePercent !== null &&
    supportDistancePercent <= 8;


  let entryAnchor;


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
  // 5. 損切り
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
  // 6. 1株あたりリスク
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
  // 7. 利確
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


  const target2 =
    Math.max(
      target1 +
      effectiveAtr * 0.8,

      entryCenter +
      shortRiskPerShare *
      2.5
    );


  // =====================================
  // 8. 買い候補中心からのRR
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
  // 9. 現在値から見た実戦RR
  // =====================================

  const currentRiskPerShare =
    latestClose >
    shortStop
      ? latestClose -
        shortStop
      : 1;


  const currentReward1PerShare =
    Math.max(
      0,
      target1 -
      latestClose
    );


  const currentReward2PerShare =
    Math.max(
      0,
      target2 -
      latestClose
    );


  const currentRiskReward1 =
    currentRiskPerShare > 0
      ? currentReward1PerShare /
        currentRiskPerShare
      : 0;


  const currentRiskReward2 =
    currentRiskPerShare > 0
      ? currentReward2PerShare /
        currentRiskPerShare
      : 0;


  // =====================================
  // 10. エントリー評価
  // =====================================

  let entryScore = 50;

  const entryReasons = [];
  const entryCautions = [];


  // -------------------------------------
  // RSI
  // -------------------------------------

  if (Number.isFinite(rsi14)) {

    if (rsi14 >= 80) {

      entryScore -= 30;

      entryCautions.push(
        `RSIが${rsi14.toFixed(1)}で非常に過熱しています`
      );

    } else if (rsi14 >= 70) {

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

    } else if (rsi14 <= 30) {

      entryScore -= 5;

      entryCautions.push(
        `RSIが${rsi14.toFixed(1)}で売られ過ぎですが、下落継続リスクがあります`
      );
    }
  }


  // -------------------------------------
  // ボリンジャーバンド
  // -------------------------------------

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


  // -------------------------------------
  // サポート
  // -------------------------------------

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


  // -------------------------------------
  // レジスタンス
  // -------------------------------------

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


  // -------------------------------------
  // トレンド・MACD
  // -------------------------------------

  if (bullishTrend) {

    entryScore += 8;

    entryReasons.push(
      "短期上昇トレンドが維持されています"
    );
  }


  if (macdBullish) {

    entryScore += 5;

    entryReasons.push(
      "MACDはエントリー方向を支えています"
    );
  }


  // =====================================
  // 11. 現在値と買い候補ゾーンの位置関係
  // =====================================

  const aboveEntryHighPercent =
    entryHigh > 0
      ? (
          (
            latestClose -
            entryHigh
          ) /
          entryHigh
        ) *
        100
      : null;


  const belowEntryLowPercent =
    entryLow > 0
      ? (
          (
            entryLow -
            latestClose
          ) /
          entryLow
        ) *
        100
      : null;


  if (
    latestClose >= entryLow &&
    latestClose <= entryHigh
  ) {

    entryScore += 18;

    entryReasons.push(
      "現在値が買い候補ゾーン内にあります"
    );

  } else if (
    Number.isFinite(
      aboveEntryHighPercent
    ) &&
    aboveEntryHighPercent > 0
  ) {

    if (
      aboveEntryHighPercent <= 1
    ) {

      entryScore += 8;

      entryReasons.push(
        "現在値は買い候補上限の1%以内です"
      );

    } else if (
      aboveEntryHighPercent <= 3
    ) {

      entryCautions.push(
        `現在値は買い候補上限より約${aboveEntryHighPercent.toFixed(1)}%上にあります`
      );

    } else if (
      aboveEntryHighPercent <= 5
    ) {

      entryScore -= 10;

      entryCautions.push(
        `現在値は買い候補上限より約${aboveEntryHighPercent.toFixed(1)}%高く、追い買いリスクがあります`
      );

    } else {

      entryScore -= 20;

      entryCautions.push(
        `現在値は買い候補上限より約${aboveEntryHighPercent.toFixed(1)}%高く、追いかける位置ではありません`
      );
    }

  } else if (
    Number.isFinite(
      belowEntryLowPercent
    ) &&
    belowEntryLowPercent > 0
  ) {

    if (
      belowEntryLowPercent <= 1
    ) {

      entryScore += 5;

      entryReasons.push(
        "現在値は買い候補下限のすぐ下にあります"
      );

    } else {

      entryScore -= 8;

      entryCautions.push(
        "現在値が買い候補を下抜けており、反発確認が必要です"
      );
    }
  }


  // =====================================
  // 12. 現在値からの実戦RR評価
  // =====================================

  if (
    Number.isFinite(
      currentRiskReward1
    )
  ) {

    if (
      currentRiskReward1 >= 2.5
    ) {

      entryScore += 15;

      entryReasons.push(
        `現在値から利確①までのリスクリワードは1：${currentRiskReward1.toFixed(2)}で良好です`
      );

    } else if (
      currentRiskReward1 >= 2
    ) {

      entryScore += 10;

      entryReasons.push(
        `現在値から利確①までのリスクリワードは1：${currentRiskReward1.toFixed(2)}です`
      );

    } else if (
      currentRiskReward1 >= 1.5
    ) {

      entryScore += 5;

      entryReasons.push(
        `現在値から利確①までのリスクリワードは1：${currentRiskReward1.toFixed(2)}です`
      );

    } else if (
      currentRiskReward1 >= 1.2
    ) {

      entryCautions.push(
        `現在値から利確①までのリスクリワードは1：${currentRiskReward1.toFixed(2)}で、余裕は大きくありません`
      );

    } else if (
      currentRiskReward1 >= 1
    ) {

      entryScore -= 5;

      entryCautions.push(
        `現在値から利確①までのリスクリワードは1：${currentRiskReward1.toFixed(2)}です`
      );

    } else if (
      currentRiskReward1 >= 0.7
    ) {

      entryScore -= 10;

      entryCautions.push(
        `現在値から利確①までのリスクリワードは1：${currentRiskReward1.toFixed(2)}で不利です`
      );

    } else {

      entryScore -= 18;

      entryCautions.push(
        `現在値から利確①までのリスクリワードは1：${currentRiskReward1.toFixed(2)}で、追い買いには不利です`
      );
    }
  }


  // =====================================
  // 13. エントリー点数確定
  // =====================================

  entryScore =
    Math.max(
      0,
      Math.min(
        100,
        Math.round(entryScore)
      )
    );


  // =====================================
  // 14. 総合スコア
  // =====================================

  const score =
    Math.round(
      trendScore * 0.6 +
      entryScore * 0.4
    );


  // =====================================
  // 15. リスク管理
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


  const requiredCapital =
    recommendedShares > 0
      ? recommendedShares *
        entryCenter
      : null;


  // =====================================
  // 16. 100株でリスク基準を守る条件
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
  // 17. 現物 / 信用の必要資金
  // =====================================

  const requiredCashFor100 =
    minimumLotTradeValue;


  const requiredMarginFor100 =
    minimumLotTradeValue *
    (
      safeMarginRate /
      100
    );


  const minimumRequiredFunds =
    safeTradeMode === "cash"
      ? requiredCashFor100
      : requiredMarginFor100;


  const canAffordMinimumLot =
    safeCapital >=
    minimumRequiredFunds;


  const fundingShortfall =
    Math.max(
      0,
      minimumRequiredFunds -
      safeCapital
    );


  const minimumLotCapitalMultiple =
    safeCapital > 0
      ? minimumLotTradeValue /
        safeCapital
      : null;


  const requiredFundsCapitalMultiple =
    safeCapital > 0
      ? minimumRequiredFunds /
        safeCapital
      : null;


  // =====================================
  // 18. 判定ラベル
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
    entryScore >= 75
  ) {

    label =
      "買い候補";

    className =
      "buy";

  } else if (
    trendScore >= 70 &&
    entryScore >= 60
  ) {

    label =
      "強い・エントリー待ち";

    className =
      "wait";

  } else if (
    trendScore >= 70 &&
    entryScore < 60
  ) {

    label =
      "強いが今は待ち";

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
  // 19. AIコメント
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
    entryScore < 50
  ) {

    action =
      `トレンド自体は強いですが、現在値からのエントリー条件は良くありません。` +
      `${roundedEntryLow.toLocaleString("ja-JP")}～${roundedEntryHigh.toLocaleString("ja-JP")}円付近までの押し、または反発確認を待つ判断です。`;

  } else if (
    trendScore >= 70 &&
    entryScore >= 75
  ) {

    action =
      `トレンドと現在のエントリー条件の両方が良好です。` +
      `${roundedEntryLow.toLocaleString("ja-JP")}～${roundedEntryHigh.toLocaleString("ja-JP")}円付近を分割エントリー候補とします。`;

  } else if (
    trendScore >= 70 &&
    entryScore >= 60
  ) {

    action =
      `トレンドは良好ですが、現在値から飛びつくより買い候補への接近を待ちたい局面です。` +
      `${roundedEntryLow.toLocaleString("ja-JP")}～${roundedEntryHigh.toLocaleString("ja-JP")}円付近での値動きを確認します。`;

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
      `方向感とエントリー条件が十分に揃っていません。` +
      `${roundedEntryLow.toLocaleString("ja-JP")}～${roundedEntryHigh.toLocaleString("ja-JP")}円付近を候補とし、反発確認を優先します。`;
  }


  if (
    Number.isFinite(
      currentRiskReward1
    )
  ) {

    action +=
      ` 現在値から利確目安①までのリスクリワードは約1：${currentRiskReward1.toFixed(2)}です。`;
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
  // 20. 理由・注意点
  // =====================================

  const reasons = [
    ...trendReasons,
    ...entryReasons
  ];


  const cautions = [
    ...trendCautions,
    ...entryCautions
  ];


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
  // 21. 戻り値
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

    currentRiskReward1,
    currentRiskReward2,

    currentRiskPerShare,
    currentReward1PerShare,
    currentReward2PerShare,

    aboveEntryHighPercent,
    belowEntryLowPercent,

    shortRiskPerShare,
    swingRiskPerShare,

    loss100Short,
    loss100Swing,

    allowedLoss,

    recommendedShares,
    requiredCapital,

    minimumLotTradeValue,

    requiredCapitalFor100,
    maxRiskPerShareFor100,
    maxAllowedStopFor100,
    minimumLotRiskMultiple,
    minimumLotCapitalRiskPercent,
    canTradeMinimumLot,

    tradeMode:
      safeTradeMode,

    marginRate:
      safeMarginRate,

    requiredCashFor100,
    requiredMarginFor100,

    minimumRequiredFunds,

    canAffordMinimumLot,

    fundingShortfall,

    minimumLotCapitalMultiple,

    requiredFundsCapitalMultiple
  };
}
