export function createStrategy({
  latestClose, ma5, ma25, ma75, ma200, rsi14, bollinger,
  volumeRatio, crossSignal, atr14, latestMacd, latestSignal,
  latestHistogram, recent20High, capital, riskPercent
}) {
  const effectiveAtr = Number.isFinite(atr14) && atr14 > 0 ? atr14 : latestClose * 0.03;
  let score = 50;
  const reasons = [];
  const cautions = [];
  const bullishTrend = Number.isFinite(ma5) && Number.isFinite(ma25) && latestClose > ma5 && ma5 > ma25;
  const overheated = Number.isFinite(rsi14) && rsi14 >= 70;
  const macdBullish = Number.isFinite(latestMacd) && Number.isFinite(latestSignal) && latestMacd > latestSignal;

  if (Number.isFinite(ma5) && latestClose > ma5) { score += 10; reasons.push("株価は5日移動平均線を上回っています"); }
  else { score -= 10; cautions.push("株価は5日移動平均線を下回っています"); }

  if (Number.isFinite(ma5) && Number.isFinite(ma25) && ma5 > ma25) { score += 15; reasons.push("5日線が25日線を上回る上昇トレンドです"); }
  else { score -= 15; cautions.push("5日線が25日線を下回っています"); }

  if (Number.isFinite(ma25) && Number.isFinite(ma75)) {
    if (ma25 > ma75) { score += 10; reasons.push("25日線が75日線を上回る中期上昇トレンドです"); }
    else { score -= 10; cautions.push("25日線が75日線を下回る中期弱気形です"); }
  }
  if (Number.isFinite(ma200)) {
    if (latestClose > ma200) { score += 5; reasons.push("株価は200日線を上回り長期基調は良好です"); }
    else { score -= 5; cautions.push("株価は200日線を下回っています"); }
  }
  if (crossSignal === "golden") { score += 10; reasons.push("5日線と25日線のゴールデンクロスが発生しました"); }
  else if (crossSignal === "dead") { score -= 10; cautions.push("5日線と25日線のデッドクロスが発生しました"); }

  if (Number.isFinite(volumeRatio)) {
    if (volumeRatio >= 2) { score += 10; reasons.push(`出来高が20日平均の${volumeRatio.toFixed(1)}倍に急増しています`); }
    else if (volumeRatio >= 1.3) { score += 5; reasons.push(`出来高が20日平均の${volumeRatio.toFixed(1)}倍です`); }
    else if (volumeRatio < 0.7) { score -= 5; cautions.push("出来高が20日平均を大きく下回っています"); }
  }
  if (bollinger && Number.isFinite(bollinger.upper) && Number.isFinite(bollinger.lower)) {
    if (latestClose > bollinger.upper) { score -= 8; cautions.push("株価がボリンジャーバンド+2σを上回り、短期的な行き過ぎに注意が必要です"); }
    else if (latestClose < bollinger.lower) { score += 3; cautions.push("株価がボリンジャーバンド-2σを下回っています。反発余地はありますが下落継続にも注意が必要です"); }
  }
  if (overheated) { score -= 20; cautions.push(`RSIが${rsi14.toFixed(1)}で短期的に過熱しています`); }
  if (macdBullish) { score += 10; reasons.push("MACDがシグナルを上回っています"); }
  else { score -= 10; cautions.push("MACDがシグナルを下回っています"); }
  if (Number.isFinite(latestHistogram) && latestHistogram > 0) { score += 5; reasons.push("MACDヒストグラムはプラスです"); }
  score = Math.max(0, Math.min(100, score));

  let label, className, action;
  if (bullishTrend && overheated) {
    label = "上昇トレンド・押し目待ち"; className = "wait";
    action = "上昇トレンドは維持していますが、短期的な過熱感があります。現在値を追いかけず、買い候補価格までの押しを待つ判断です。";
  } else if (bullishTrend && macdBullish) {
    label = "買い候補"; className = "buy";
    action = "上昇基調ですが、一括ではなく分割で入る方が安全です。";
  } else if (Number.isFinite(ma25) && latestClose < ma25) {
    label = "下落警戒"; className = "danger";
    action = "25日線を下回っているため、底打ちを確認するまで待ちます。";
  } else {
    label = "様子見"; className = "wait";
    action = "方向感が十分に揃っていないため、無理に入らない判断です。";
  }

  const pullbackCenter = Number.isFinite(ma5) ? ma5 : latestClose - effectiveAtr;
  const entryLow = Math.max(0, pullbackCenter - effectiveAtr * 0.35);
  const entryHigh = Math.min(latestClose, pullbackCenter + effectiveAtr * 0.2);
  const entryCenter = (entryLow + entryHigh) / 2;
  const shortStop = Math.max(0, Math.max(entryLow - effectiveAtr * 0.55, Number.isFinite(ma5) ? ma5 - effectiveAtr * 0.85 : 0));
  const swingStop = Math.max(0, Math.max(entryLow - effectiveAtr * 1.5, Number.isFinite(ma25) ? ma25 - effectiveAtr * 0.3 : 0));
  const shortRiskPerShare = Math.max(1, entryCenter - shortStop);
  const swingRiskPerShare = Math.max(1, entryCenter - swingStop);
  const target1 = Math.max(recent20High, entryCenter + shortRiskPerShare * 1.5);
  const target2 = Math.max(target1 + effectiveAtr, entryCenter + shortRiskPerShare * 2.5);
  const riskReward1 = (target1 - entryCenter) / shortRiskPerShare;
  const riskReward2 = (target2 - entryCenter) / shortRiskPerShare;
  const loss100Short = shortRiskPerShare * 100;
  const loss100Swing = swingRiskPerShare * 100;
  const allowedLoss = capital * (riskPercent / 100);
  const recommendedShares = Math.max(0, Math.floor((allowedLoss / shortRiskPerShare) / 100) * 100);
  const requiredCapital = recommendedShares * entryCenter;
  const stars = Math.max(1, Math.min(5, Math.ceil(score / 20)));

  return {
    score, stars, label, className, action, aiComment: action,
    reasons, strengths: reasons, cautions,
    entryLow, entryHigh, entryCenter, shortStop, swingStop, target1, target2,
    riskReward1, riskReward2, shortRiskPerShare, swingRiskPerShare,
    loss100Short, loss100Swing, allowedLoss, recommendedShares, requiredCapital
  };
}
