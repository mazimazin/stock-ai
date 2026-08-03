// ========================================
// Stock AI Strategy Engine
// Version 2
// ========================================

export function createStrategy(data) {

  const comments = [];
  let score = 50;

  //------------------------
  // 移動平均
  //------------------------

  if (data.latestClose > data.ma5) {
    score += 5;
    comments.push("5日移動平均線を上回っています");
  } else {
    score -= 5;
    comments.push("5日移動平均線を下回っています");
  }

  if (data.ma5 > data.ma25) {
    score += 10;
    comments.push("5日線が25日線を上回る上昇トレンドです");
  } else {
    score -= 10;
    comments.push("5日線が25日線を下回っています");
  }

  if (data.ma25 > data.ma75) {
    score += 10;
    comments.push("25日線が75日線を上回っています");
  }

  if (data.ma75 > data.ma200) {
    score += 10;
    comments.push("長期トレンドは良好です");
  }

  //------------------------
  // RSI
  //------------------------

  if (data.rsi14 >= 80) {

    score -= 15;

    comments.push(
      "RSIが80以上でかなり買われ過ぎです"
    );

  } else if (data.rsi14 >= 70) {

    score -= 8;

    comments.push(
      "RSIが高く飛び付きには注意です"
    );

  } else if (data.rsi14 >= 40 && data.rsi14 <= 60) {

    score += 5;

    comments.push(
      "RSIは適正な水準です"
    );

  }

  //------------------------
  // MACD
  //------------------------

  if (data.latestMacd > data.latestSignal) {

    score += 8;

    comments.push(
      "MACDは買いシグナルです"
    );

  } else {

    score -= 8;

    comments.push(
      "MACDは弱含みです"
    );

  }  //------------------------
  // MACDヒストグラム
  //------------------------

  if (
    Number.isFinite(data.latestHistogram) &&
    data.latestHistogram > 0
  ) {
    score += 5;

    comments.push(
      "MACDヒストグラムはプラスです"
    );
  } else if (
    Number.isFinite(data.latestHistogram) &&
    data.latestHistogram < 0
  ) {
    score -= 5;

    comments.push(
      "MACDヒストグラムはマイナスです"
    );
  }

  //------------------------
  // 出来高
  //------------------------

  if (Number.isFinite(data.volumeRatio)) {
    if (data.volumeRatio >= 2) {
      score += 10;

      comments.push(
        `出来高が20日平均の${data.volumeRatio.toFixed(
          1
        )}倍に急増しています`
      );
    } else if (data.volumeRatio >= 1.3) {
      score += 5;

      comments.push(
        `出来高が20日平均の${data.volumeRatio.toFixed(
          1
        )}倍です`
      );
    } else if (data.volumeRatio < 0.7) {
      score -= 5;

      comments.push(
        "出来高が20日平均を大きく下回っています"
      );
    } else {
      comments.push(
        "出来高はおおむね通常水準です"
      );
    }
  }

  //------------------------
  // ボリンジャーバンド
  //------------------------

  if (
    data.bollinger &&
    Number.isFinite(data.bollinger.upper) &&
    Number.isFinite(data.bollinger.lower)
  ) {
    if (
      data.latestClose >
      data.bollinger.upper
    ) {
      score -= 8;

      comments.push(
        "株価がボリンジャーバンド+2σを上回り、短期的な過熱に注意が必要です"
      );
    } else if (
      data.latestClose <
      data.bollinger.lower
    ) {
      score += 3;

      comments.push(
        "株価がボリンジャーバンド-2σを下回っています"
      );
    }
  }

  //------------------------
  // 移動平均クロス
  //------------------------

  if (data.crossSignal === "golden") {
    score += 10;

    comments.push(
      "5日線と25日線のゴールデンクロスが発生しています"
    );
  } else if (
    data.crossSignal === "dead"
  ) {
    score -= 10;

    comments.push(
      "5日線と25日線のデッドクロスが発生しています"
    );
  }

  //------------------------
  // スコア調整
  //------------------------

  score = Math.max(
    0,
    Math.min(100, score)
  );

  const bullishTrend =
    Number.isFinite(data.ma5) &&
    Number.isFinite(data.ma25) &&
    data.latestClose > data.ma5 &&
    data.ma5 > data.ma25;

  const overheated =
    Number.isFinite(data.rsi14) &&
    data.rsi14 >= 70;

  const macdBullish =
    Number.isFinite(data.latestMacd) &&
    Number.isFinite(data.latestSignal) &&
    data.latestMacd >
      data.latestSignal;

  let label;
  let className;
  let action;

  if (bullishTrend && overheated) {
    label =
      "上昇トレンド・押し目待ち";

    className = "wait";

    action =
      "上昇基調ですが過熱感があります。高値を追わず、5日線付近まで下げた後の反発確認を優先します。";
  } else if (
    bullishTrend &&
    macdBullish
  ) {
    label = "買い候補";
    className = "buy";

    action =
      "上昇基調ですが、一括ではなく分割で入る方が安全です。";
  } else if (
    Number.isFinite(data.ma25) &&
    data.latestClose < data.ma25
  ) {
    label = "下落警戒";
    className = "danger";

    action =
      "株価が25日線を下回っているため、底打ちを確認するまで待ちます。";
  } else {
    label = "様子見";
    className = "wait";

    action =
      "方向感が十分に揃っていないため、無理に入らない判断です。";
  }

  //------------------------
  // ATRと価格計算の準備
  //------------------------

  const effectiveAtr =
    Number.isFinite(data.atr14) &&
    data.atr14 > 0
      ? data.atr14
      : data.latestClose * 0.03;

  const pullbackCenter =
    Number.isFinite(data.ma5)
      ? data.ma5
      : data.latestClose -
        effectiveAtr;  //------------------------
  // 買い候補価格
  //------------------------

  const entryLow = Math.max(
    0,
    pullbackCenter -
      effectiveAtr * 0.35
  );

  const entryHigh = Math.min(
    data.latestClose,
    pullbackCenter +
      effectiveAtr * 0.2
  );

  const entryCenter =
    (entryLow + entryHigh) / 2;

  //------------------------
  // 損切り価格
  //------------------------

  const shortStop = Math.max(
    0,
    Math.max(
      entryLow -
        effectiveAtr * 0.55,

      Number.isFinite(data.ma5)
        ? data.ma5 -
          effectiveAtr * 0.85
        : 0
    )
  );

  const swingStop = Math.max(
    0,
    Math.max(
      entryLow -
        effectiveAtr * 1.5,

      Number.isFinite(data.ma25)
        ? data.ma25 -
          effectiveAtr * 0.3
        : 0
    )
  );

  //------------------------
  // 1株あたりのリスク
  //------------------------

  const shortRiskPerShare =
    Math.max(
      1,
      entryCenter - shortStop
    );

  const swingRiskPerShare =
    Math.max(
      1,
      entryCenter - swingStop
    );

  //------------------------
  // 利確価格
  //------------------------

  const recent20High =
    Number.isFinite(data.recent20High)
      ? data.recent20High
      : data.latestClose;

  const target1 = Math.max(
    recent20High,
    entryCenter +
      shortRiskPerShare * 1.5
  );

  const target2 = Math.max(
    target1 + effectiveAtr,
    entryCenter +
      shortRiskPerShare * 2.5
  );

  //------------------------
  // リスクリワード
  //------------------------

  const reward1 =
    target1 - entryCenter;

  const reward2 =
    target2 - entryCenter;

  const riskReward1 =
    reward1 /
    shortRiskPerShare;

  const riskReward2 =
    reward2 /
    shortRiskPerShare;

  //------------------------
  // 100株あたり損失
  //------------------------

  const loss100Short =
    shortRiskPerShare * 100;

  const loss100Swing =
    swingRiskPerShare * 100;

  //------------------------
  // 資金管理
  //------------------------

  const capital =
    Number.isFinite(data.capital)
      ? data.capital
      : 1000000;

  const riskPercent =
    Number.isFinite(data.riskPercent)
      ? data.riskPercent
      : 1;

  const allowedLoss =
    capital *
    (riskPercent / 100);

  const rawShares =
    allowedLoss /
    shortRiskPerShare;

  const recommendedShares =
    Math.max(
      0,
      Math.floor(
        rawShares / 100
      ) * 100
    );

  const requiredCapital =
    recommendedShares *
    entryCenter;

  //------------------------
  // AIコメント
  //------------------------

  const strengths = [];
  const cautions = [];

  if (
    Number.isFinite(data.ma5) &&
    Number.isFinite(data.ma25) &&
    data.ma5 > data.ma25
  ) {
    strengths.push(
      "短期の移動平均線は上向きです"
    );
  }

  if (
    Number.isFinite(data.ma25) &&
    Number.isFinite(data.ma75) &&
    data.ma25 > data.ma75
  ) {
    strengths.push(
      "中期の上昇トレンドが続いています"
    );
  }

  if (macdBullish) {
    strengths.push(
      "MACDは買い優勢です"
    );
  } else {
    cautions.push(
      "MACDはまだ弱含みです"
    );
  }

  if (
    Number.isFinite(
      data.latestHistogram
    ) &&
    data.latestHistogram > 0
  ) {
    strengths.push(
      "MACDの勢いはプラスです"
    );
  } else if (
    Number.isFinite(
      data.latestHistogram
    ) &&
    data.latestHistogram < 0
  ) {
    cautions.push(
      "MACDの勢いはマイナスです"
    );
  }

  if (
    Number.isFinite(data.rsi14) &&
    data.rsi14 >= 70
  ) {
    cautions.push(
      `RSIが${data.rsi14.toFixed(
        1
      )}で、飛び付き買いには注意が必要です`
    );
  } else if (
    Number.isFinite(data.rsi14) &&
    data.rsi14 >= 40 &&
    data.rsi14 <= 60
  ) {
    strengths.push(
      `RSIは${data.rsi14.toFixed(
        1
      )}で過熱感の少ない水準です`
    );
  }

  if (
    Number.isFinite(data.volumeRatio)
  ) {
    if (data.volumeRatio >= 1.3) {
      strengths.push(
        `出来高は20日平均の${data.volumeRatio.toFixed(
          2
        )}倍で活発です`
      );
    } else if (
      data.volumeRatio < 0.7
    ) {
      cautions.push(
        `出来高は20日平均の${data.volumeRatio.toFixed(
          2
        )}倍で少なめです`
      );
    }
  }

  const starCount =
    score >= 90
      ? 5
      : score >= 75
        ? 4
        : score >= 60
          ? 3
          : score >= 40
            ? 2
            : 1;

  const stars =
    "★".repeat(starCount) +
    "☆".repeat(5 - starCount);

  let aiComment;

  if (
    label ===
    "上昇トレンド・押し目待ち"
  ) {
    aiComment =
      "上昇トレンドは維持していますが、短期的な過熱感があります。現在値を追いかけず、買い候補価格までの押しを待つ判断です。";
  } else if (
    label === "買い候補"
  ) {
    aiComment =
      "複数の上昇条件が揃っています。ただし一括で入らず、買い候補価格の範囲で分割する方が安全です。";
  } else if (
    label === "下落警戒"
  ) {
    aiComment =
      "株価が主要な移動平均線を下回っています。反発を予想して先回りせず、底打ち確認を優先します。";
  } else {
    aiComment =
      "強気と弱気の条件が混在しています。方向が明確になるまで無理に売買しない判断です。";
  }

  //------------------------
  // 結果を返す
  //------------------------

  return {
    score,
    stars,
    label,
    className,
    action,
    aiComment,

    comments,
    strengths,
    cautions,

    reasons:
      strengths.length > 0
        ? strengths
        : comments,

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
