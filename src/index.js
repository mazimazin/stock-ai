import {
  normalizeNumber,
  htmlError,
  formatNumber,
  formatDecimal,
  formatSignedDecimal,
  formatRatio,
  formatCrossSignal,
  escapeHtml
} from "./utils.js"; 
import {
  createStrategy as createStrategyV2
} from "./strategy.js";
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.searchParams.get("mode") === "ranking") {
      return createRankingResponse(env);
    }
    const inputCode = (url.searchParams.get("code") || "285A")
      .trim()
      .toUpperCase();

    const capital = normalizeNumber(
      url.searchParams.get("capital"),
      1000000
    );

    const riskPercent = normalizeNumber(
      url.searchParams.get("risk"),
      1
    );

    const code =
      inputCode.length === 4
        ? `${inputCode}0`
        : inputCode;

    const stockNames = {
      "285A": "キオクシアホールディングス",
      "6857": "アドバンテスト",
      "6146": "ディスコ",
      "6920": "レーザーテック",
      "8035": "東京エレクトロン",
      "7013": "IHI",
      "7011": "三菱重工業",
      "5801": "古河電気工業",
      "5802": "住友電気工業",
      "5803": "フジクラ"
    };

    const stockName =
      stockNames[inputCode] ||
      `銘柄コード ${inputCode}`;

    if (!env.JQUANTS_API_KEY) {
      return htmlError(
        "JQUANTS_API_KEYが設定されていません"
      );
    }

    const apiUrl = new URL(
      "https://api.jquants.com/v2/equities/bars/daily"
    );

    apiUrl.searchParams.set("code", code);

    try {
      const response = await fetch(apiUrl.toString(), {
        headers: {
          "x-api-key": env.JQUANTS_API_KEY,
          Accept: "application/json"
        }
      });

      const result = await response.json();

      if (!response.ok) {
        return htmlError(
          `J-Quants APIエラー：${response.status}`
        );
      }

      const prices = Array.isArray(result.data)
        ? result.data
        : [];

      if (prices.length === 0) {
        return htmlError(
          `${inputCode}の株価データが見つかりませんでした`
        );
      }

      prices.sort(
        (a, b) =>
          new Date(a.Date) - new Date(b.Date)
      );

      const closes = prices.map((price) =>
        Number(price.AdjC ?? price.C)
      );

      const highs = prices.map((price) =>
        Number(price.AdjH ?? price.H)
      );

      const lows = prices.map((price) =>
        Number(price.AdjL ?? price.L)
      );

      const volumes = prices.map((price) =>
        Number(price.AdjVo ?? price.Vo)
      );

      const latest =
        prices[prices.length - 1];

      const previous =
        prices.length >= 2
          ? prices[prices.length - 2]
          : null;

      const latestClose =
        closes[closes.length - 1];

      const previousClose = previous
        ? Number(previous.AdjC ?? previous.C)
        : null;

      const change =
        previousClose !== null
          ? latestClose - previousClose
          : null;

      const changePercent =
        previousClose
          ? (change / previousClose) * 100
          : null;

      const ma5 = calculateSMA(closes, 5);
      const ma25 = calculateSMA(closes, 25);
      const ma75 = calculateSMA(closes, 75);
      const ma200 = calculateSMA(closes, 200);
      const rsi14 = calculateRSI(closes, 14);

      const bollinger = calculateBollingerBands(
        closes,
        20,
        2
      );

      const averageVolume20 = calculateSMA(
        volumes,
        20
      );

      const latestVolume =
        volumes[volumes.length - 1];

      const volumeRatio =
        Number.isFinite(averageVolume20) &&
        averageVolume20 > 0
          ? latestVolume / averageVolume20
          : null;

      const crossSignal = detectMovingAverageCross(
        closes,
        5,
        25
      );

      const atr14 = calculateATR(
        highs,
        lows,
        closes,
        14
      );

      const macdData = calculateMACD(
        closes,
        12,
        26,
        9
      );

      const latestMacd =
        getLastFinite(macdData.macd);

      const latestSignal =
        getLastFinite(macdData.signal);

      const latestHistogram =
        getLastFinite(macdData.histogram);

      const recent20High = Math.max(
        ...highs.slice(-20)
      );

      const strategy = createStrategy({
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
        capital,
        riskPercent
      });

      const recentPrices = prices
        .slice(-10)
        .reverse();

      const chartStart = Math.max(
        0,
        prices.length - 60
      );

      const chartData = prices
        .slice(chartStart)
        .map((price, index) => {
          const absoluteIndex =
            chartStart + index;

          return {
            date: price.Date,
            open: Number(
              price.AdjO ?? price.O
            ),
            close: closes[absoluteIndex],
            volume: volumes[absoluteIndex],
            ma5: calculateSMAAt(
              closes,
              absoluteIndex,
              5
            ),
            ma25: calculateSMAAt(
              closes,
              absoluteIndex,
              25
            ),
            ma75: calculateSMAAt(
              closes,
              absoluteIndex,
              75
            ),
            ma200: calculateSMAAt(
              closes,
              absoluteIndex,
              200
            ),
            bollinger: calculateBollingerAt(
              closes,
              absoluteIndex,
              20,
              2
            ),
            macd:
              macdData.macd[absoluteIndex],
            signal:
              macdData.signal[absoluteIndex],
            histogram:
              macdData.histogram[absoluteIndex]
          };
        });

      return new Response(
        createHtml({
          stockName,
          inputCode,
          latest,
          latestClose,
          previousClose,
          change,
          changePercent,
          recentPrices,
          ma5,
          ma25,
          ma75,
          ma200,
          rsi14,
          bollinger,
          averageVolume20,
          volumeRatio,
          crossSignal,
          atr14,
          latestMacd,
          latestSignal,
          latestHistogram,
          strategy,
          chartData,
          capital,
          riskPercent
        }),
        {
          headers: {
            "Content-Type":
              "text/html; charset=UTF-8",
            "Cache-Control": "no-store"
          }
        }
      );
    } catch (error) {
      return htmlError(
        error instanceof Error
          ? error.message
          : "株価データの取得に失敗しました"
      );
    }
  }
};

function calculateSMA(values, period) {
  if (values.length < period) {
    return null;
  }

  const selected = values.slice(-period);

  return (
    selected.reduce(
      (sum, value) => sum + value,
      0
    ) / period
  );
}

function calculateSMAAt(values, index, period) {
  if (index + 1 < period) {
    return null;
  }

  const selected = values.slice(
    index - period + 1,
    index + 1
  );

  return (
    selected.reduce(
      (sum, value) => sum + value,
      0
    ) / period
  );
}

function calculateStandardDeviation(values) {
  if (!values.length) {
    return null;
  }

  const average =
    values.reduce(
      (sum, value) => sum + value,
      0
    ) / values.length;

  const variance =
    values.reduce(
      (sum, value) =>
        sum + Math.pow(value - average, 2),
      0
    ) / values.length;

  return Math.sqrt(variance);
}

function calculateBollingerBands(
  values,
  period = 20,
  multiplier = 2
) {
  if (values.length < period) {
    return {
      middle: null,
      upper: null,
      lower: null,
      bandwidth: null,
      percentB: null
    };
  }

  const selected = values.slice(-period);
  const middle = calculateSMA(values, period);
  const deviation = calculateStandardDeviation(
    selected
  );

  const upper =
    middle + deviation * multiplier;
  const lower =
    middle - deviation * multiplier;

  const latest = values[values.length - 1];
  const width = upper - lower;

  return {
    middle,
    upper,
    lower,
    bandwidth:
      middle !== 0
        ? (width / middle) * 100
        : null,
    percentB:
      width !== 0
        ? ((latest - lower) / width) * 100
        : null
  };
}

function calculateBollingerAt(
  values,
  index,
  period = 20,
  multiplier = 2
) {
  if (index + 1 < period) {
    return {
      middle: null,
      upper: null,
      lower: null
    };
  }

  const selected = values.slice(
    index - period + 1,
    index + 1
  );

  const middle =
    selected.reduce(
      (sum, value) => sum + value,
      0
    ) / period;

  const deviation =
    calculateStandardDeviation(selected);

  return {
    middle,
    upper: middle + deviation * multiplier,
    lower: middle - deviation * multiplier
  };
}

function detectMovingAverageCross(
  values,
  shortPeriod = 5,
  longPeriod = 25
) {
  if (values.length < longPeriod + 2) {
    return "none";
  }

  const currentShort =
    calculateSMAAt(
      values,
      values.length - 1,
      shortPeriod
    );
  const currentLong =
    calculateSMAAt(
      values,
      values.length - 1,
      longPeriod
    );
  const previousShort =
    calculateSMAAt(
      values,
      values.length - 2,
      shortPeriod
    );
  const previousLong =
    calculateSMAAt(
      values,
      values.length - 2,
      longPeriod
    );

  if (
    previousShort <= previousLong &&
    currentShort > currentLong
  ) {
    return "golden";
  }

  if (
    previousShort >= previousLong &&
    currentShort < currentLong
  ) {
    return "dead";
  }

  return "none";
}

function calculateRSI(values, period = 14) {
  if (values.length <= period) {
    return null;
  }

  const recent = values.slice(
    -(period + 1)
  );

  let gains = 0;
  let losses = 0;

  for (let i = 1; i < recent.length; i++) {
    const difference =
      recent[i] - recent[i - 1];

    if (difference > 0) {
      gains += difference;
    } else {
      losses += Math.abs(difference);
    }
  }

  const averageGain =
    gains / period;

  const averageLoss =
    losses / period;

  if (averageLoss === 0) {
    return 100;
  }

  const relativeStrength =
    averageGain / averageLoss;

  return (
    100 -
    100 / (1 + relativeStrength)
  );
}

function calculateATR(
  highs,
  lows,
  closes,
  period = 14
) {
  if (closes.length <= period) {
    return null;
  }

  const trueRanges = [];

  for (let i = 1; i < closes.length; i++) {
    const highLow =
      highs[i] - lows[i];

    const highPrevious = Math.abs(
      highs[i] - closes[i - 1]
    );

    const lowPrevious = Math.abs(
      lows[i] - closes[i - 1]
    );

    trueRanges.push(
      Math.max(
        highLow,
        highPrevious,
        lowPrevious
      )
    );
  }

  const recentRanges =
    trueRanges.slice(-period);

  return (
    recentRanges.reduce(
      (sum, value) => sum + value,
      0
    ) / period
  );
}

function calculateEMA(values, period) {
  const result =
    new Array(values.length).fill(null);

  if (values.length < period) {
    return result;
  }

  const multiplier =
    2 / (period + 1);

  const initialValues =
    values.slice(0, period);

  let previousEma =
    initialValues.reduce(
      (sum, value) => sum + value,
      0
    ) / period;

  result[period - 1] =
    previousEma;

  for (
    let i = period;
    i < values.length;
    i++
  ) {
    const currentEma =
      (values[i] - previousEma) *
        multiplier +
      previousEma;

    result[i] = currentEma;
    previousEma = currentEma;
  }

  return result;
}

function calculateMACD(
  values,
  shortPeriod = 12,
  longPeriod = 26,
  signalPeriod = 9
) {
  const shortEma = calculateEMA(
    values,
    shortPeriod
  );

  const longEma = calculateEMA(
    values,
    longPeriod
  );

  const macd = values.map((_, index) => {
    if (
      !Number.isFinite(shortEma[index]) ||
      !Number.isFinite(longEma[index])
    ) {
      return null;
    }

    return (
      shortEma[index] -
      longEma[index]
    );
  });

  const validMacd =
    macd.filter(Number.isFinite);

  const validSignal = calculateEMA(
    validMacd,
    signalPeriod
  );

  const signal =
    new Array(values.length).fill(null);

  let validIndex = 0;

  for (
    let i = 0;
    i < macd.length;
    i++
  ) {
    if (!Number.isFinite(macd[i])) {
      continue;
    }

    signal[i] =
      validSignal[validIndex];

    validIndex++;
  }

  const histogram = macd.map(
    (value, index) => {
      if (
        !Number.isFinite(value) ||
        !Number.isFinite(signal[index])
      ) {
        return null;
      }

      return value - signal[index];
    }
  );

  return {
    macd,
    signal,
    histogram
  };
}

function getLastFinite(values) {
  for (
    let i = values.length - 1;
    i >= 0;
    i--
  ) {
    if (Number.isFinite(values[i])) {
      return values[i];
    }
  }

  return null;
}

function createStrategy({
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
  capital,
  riskPercent
}) {
  const effectiveAtr =
    Number.isFinite(atr14) && atr14 > 0
      ? atr14
      : latestClose * 0.03;

  let score = 50;

  const reasons = [];
  const cautions = [];

  const bullishTrend =
    Number.isFinite(ma5) &&
    Number.isFinite(ma25) &&
    latestClose > ma5 &&
    ma5 > ma25;

  const overheated =
    Number.isFinite(rsi14) &&
    rsi14 >= 70;

  const macdBullish =
    Number.isFinite(latestMacd) &&
    Number.isFinite(latestSignal) &&
    latestMacd > latestSignal;

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

  if (
    Number.isFinite(ma25) &&
    Number.isFinite(ma75)
  ) {
    if (ma25 > ma75) {
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

  if (
    Number.isFinite(ma200)
  ) {
    if (latestClose > ma200) {
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

  if (crossSignal === "golden") {
    score += 10;
    reasons.push(
      "5日線と25日線のゴールデンクロスが発生しました"
    );
  } else if (crossSignal === "dead") {
    score -= 10;
    cautions.push(
      "5日線と25日線のデッドクロスが発生しました"
    );
  }

  if (Number.isFinite(volumeRatio)) {
    if (volumeRatio >= 2) {
      score += 10;
      reasons.push(
        `出来高が20日平均の${volumeRatio.toFixed(1)}倍に急増しています`
      );
    } else if (volumeRatio >= 1.3) {
      score += 5;
      reasons.push(
        `出来高が20日平均の${volumeRatio.toFixed(1)}倍です`
      );
    } else if (volumeRatio < 0.7) {
      score -= 5;
      cautions.push(
        "出来高が20日平均を大きく下回っています"
      );
    }
  }

  if (
    bollinger &&
    Number.isFinite(bollinger.upper) &&
    Number.isFinite(bollinger.lower)
  ) {
    if (latestClose > bollinger.upper) {
      score -= 8;
      cautions.push(
        "株価がボリンジャーバンド+2σを上回り、短期的な行き過ぎに注意が必要です"
      );
    } else if (latestClose < bollinger.lower) {
      score += 3;
      cautions.push(
        "株価がボリンジャーバンド-2σを下回っています。反発余地はありますが下落継続にも注意が必要です"
      );
    }
  }

  if (overheated) {
    score -= 20;

    cautions.push(
      `RSIが${rsi14.toFixed(
        1
      )}で短期的に過熱しています`
    );
  }

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
    Number.isFinite(latestHistogram) &&
    latestHistogram > 0
  ) {
    score += 5;

    reasons.push(
      "MACDヒストグラムはプラスです"
    );
  }

  score = Math.max(
    0,
    Math.min(100, score)
  );

  let label;
  let className;
  let action;

  if (bullishTrend && overheated) {
    label =
      "上昇トレンド・押し目待ち";

    className = "wait";

    action =
      "高値を追わず、5日線付近まで下げた後の反発確認を優先します。";
  } else if (
    bullishTrend &&
    macdBullish
  ) {
    label = "買い候補";
    className = "buy";

    action =
      "上昇基調ですが、一括ではなく分割で入る方が安全です。";
  } else if (
    Number.isFinite(ma25) &&
    latestClose < ma25
  ) {
    label = "下落警戒";
    className = "danger";

    action =
      "25日線を下回っているため、底打ちを確認するまで待ちます。";
  } else {
    label = "様子見";
    className = "wait";

    action =
      "方向感が十分に揃っていないため、無理に入らない判断です。";
  }

  const pullbackCenter =
    Number.isFinite(ma5)
      ? ma5
      : latestClose - effectiveAtr;

  const entryLow = Math.max(
    0,
    pullbackCenter -
      effectiveAtr * 0.35
  );

  const entryHigh = Math.min(
    latestClose,
    pullbackCenter +
      effectiveAtr * 0.2
  );

  const entryCenter =
    (entryLow + entryHigh) / 2;

  const shortStop = Math.max(
    0,
    Math.max(
      entryLow -
        effectiveAtr * 0.55,
      Number.isFinite(ma5)
        ? ma5 -
          effectiveAtr * 0.85
        : 0
    )
  );

  const swingStop = Math.max(
    0,
    Math.max(
      entryLow -
        effectiveAtr * 1.5,
      Number.isFinite(ma25)
        ? ma25 -
          effectiveAtr * 0.3
        : 0
    )
  );

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

  const reward1 =
    target1 - entryCenter;

  const reward2 =
    target2 - entryCenter;

  const riskReward1 =
    reward1 / shortRiskPerShare;

  const riskReward2 =
    reward2 / shortRiskPerShare;

  const loss100Short =
    shortRiskPerShare * 100;

  const loss100Swing =
    swingRiskPerShare * 100;

  const allowedLoss =
    capital *
    (riskPercent / 100);

  const rawShares =
    allowedLoss /
    shortRiskPerShare;

  const recommendedShares =
    Math.max(
      0,
      Math.floor(rawShares / 100) * 100
    );

  const requiredCapital =
    recommendedShares *
    entryCenter;

  return {
    score,
    label,
    className,
    action,
    reasons,
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

function createHtml({
  stockName,
  inputCode,
  latest,
  latestClose,
  previousClose,
  change,
  changePercent,
  recentPrices,
  ma5,
  ma25,
  ma75,
  ma200,
  rsi14,
  bollinger,
  averageVolume20,
  volumeRatio,
  crossSignal,
  atr14,
  latestMacd,
  latestSignal,
  latestHistogram,
  strategy,
  chartData,
  capital,
  riskPercent
}) {
  const isPositive =
    change !== null &&
    change >= 0;

  const changeClass =
    isPositive
      ? "positive"
      : "negative";

  const changeSign =
    isPositive ? "+" : "";

  const rows = recentPrices
    .map((price) => {
      const open = Number(
        price.AdjO ?? price.O
      );

      const high = Number(
        price.AdjH ?? price.H
      );

      const low = Number(
        price.AdjL ?? price.L
      );

      const close = Number(
        price.AdjC ?? price.C
      );

      const volume = Number(
        price.AdjVo ?? price.Vo
      );

      return `
        <tr>
          <td>${escapeHtml(price.Date)}</td>
          <td>${formatNumber(open)}</td>
          <td>${formatNumber(high)}</td>
          <td>${formatNumber(low)}</td>
          <td class="close">
            ${formatNumber(close)}
          </td>
          <td>${formatNumber(volume)}</td>
        </tr>
      `;
    })
    .join("");

  const reasonItems =
    strategy.reasons
      .map(
        (reason) =>
          `<li>${escapeHtml(reason)}</li>`
      )
      .join("");

  const cautionItems =
    strategy.cautions
      .map(
        (reason) =>
          `<li>${escapeHtml(reason)}</li>`
      )
      .join("");

  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >

  <title>
    ${escapeHtml(stockName)}｜Stock AI
  </title>

  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 24px;
      background: #0f172a;
      color: #e2e8f0;
      font-family:
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
    }

    .container {
      max-width: 1000px;
      margin: 0 auto;
    }

    .title {
      margin-bottom: 6px;
      font-size: 30px;
    }

    .code,
    .date,
    .notice {
      color: #94a3b8;
    }

    .search {
      display: grid;
      grid-template-columns:
        1fr 1fr 1fr auto;
      gap: 10px;
      margin: 24px 0;
    }

    .search input {
      width: 100%;
      padding: 14px;
      border:
        1px solid #334155;
      border-radius: 10px;
      background: #1e293b;
      color: white;
      font-size: 16px;
    }

    .search button {
      padding: 14px 22px;
      border: none;
      border-radius: 10px;
      background: #2563eb;
      color: white;
      font-weight: bold;
      cursor: pointer;
    }

    .card {
      margin-bottom: 20px;
      padding: 24px;
      border:
        1px solid #334155;
      border-radius: 16px;
      background: #1e293b;
    }

    .price {
      margin: 12px 0 4px;
      font-size: 46px;
      font-weight: 800;
    }

    .change {
      font-size: 22px;
      font-weight: bold;
    }

    .positive {
      color: #22c55e;
    }

    .negative {
      color: #ef4444;
    }

    .details,
    .indicator-grid,
    .strategy-grid,
    .risk-grid {
      display: grid;
      grid-template-columns:
        repeat(
          auto-fit,
          minmax(155px, 1fr)
        );
      gap: 12px;
      margin-top: 22px;
    }

    .detail-item,
    .indicator-item,
    .strategy-item,
    .risk-item {
      padding: 15px;
      border-radius: 10px;
      background: #0f172a;
    }

    .detail-label {
      color: #94a3b8;
      font-size: 13px;
    }

    .detail-value {
      margin-top: 5px;
      font-size: 18px;
      font-weight: bold;
    }

    .chart-wrap {
      width: 100%;
      margin-top: 18px;
      overflow-x: auto;
      border-radius: 12px;
      background: #0f172a;
    }

    .chart-wrap svg {
      display: block;
      width: 100%;
      min-width: 700px;
      height: auto;
    }

    .chart-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 18px;
      font-size: 14px;
    }

    .legend-close {
      color: #e2e8f0;
    }

    .legend-ma5 {
      color: #38bdf8;
    }

    .legend-ma25 {
      color: #facc15;
    }

    .legend-ma75 {
      color: #a855f7;
    }

    .legend-ma200 {
      color: #fb7185;
    }

    .legend-bollinger {
      color: #94a3b8;
    }

    .legend-macd {
      color: #60a5fa;
    }

    .legend-signal {
      color: #f97316;
    }

    .judgment {
      display: grid;
      grid-template-columns:
        240px 1fr;
      gap: 20px;
      align-items: start;
    }

    .judgment-badge {
      padding: 28px 12px;
      border-radius: 16px;
      text-align: center;
    }

    .judgment-label {
      font-size: 23px;
      font-weight: 800;
    }

    .judgment-score {
      margin-top: 8px;
    }

    .buy {
      background:
        rgba(34, 197, 94, 0.18);
      color: #4ade80;
      border:
        1px solid #22c55e;
    }

    .wait {
      background:
        rgba(234, 179, 8, 0.18);
      color: #facc15;
      border:
        1px solid #eab308;
    }

    .danger {
      background:
        rgba(239, 68, 68, 0.18);
      color: #f87171;
      border:
        1px solid #ef4444;
    }

    .action {
      margin-bottom: 15px;
      padding: 14px;
      border-left:
        4px solid #60a5fa;
      background: #0f172a;
      line-height: 1.7;
    }

    .reasons,
    .cautions {
      padding-left: 22px;
      line-height: 1.8;
    }

    .cautions {
      color: #fbbf24;
    }

    .entry {
      color: #38bdf8;
    }

    .short-stop {
      color: #fb923c;
    }

    .swing-stop {
      color: #f87171;
    }

    .target {
      color: #4ade80;
    }

    .risk {
      color: #facc15;
    }

    .position {
      color: #c084fc;
    }

    .table-wrap {
      overflow-x: auto;
    }

    table {
      width: 100%;
      min-width: 680px;
      border-collapse: collapse;
    }

    th,
    td {
      padding: 13px 10px;
      border-bottom:
        1px solid #334155;
      text-align: right;
    }

    th:first-child,
    td:first-child {
      text-align: left;
    }

    th {
      color: #94a3b8;
      font-size: 13px;
    }

    .close {
      font-weight: bold;
    }

    .notice {
      margin-top: 18px;
      font-size: 13px;
      line-height: 1.7;
    }

    .simple-card {
      padding: 30px;
      border: 2px solid #334155;
      background:
        linear-gradient(
          145deg,
          #1e293b,
          #172033
        );
    }

    .simple-top {
      display: grid;
      grid-template-columns:
        minmax(220px, 0.8fr)
        minmax(320px, 1.2fr);
      gap: 24px;
      align-items: stretch;
    }

    .simple-judgment {
      display: flex;
      min-height: 230px;
      flex-direction: column;
      justify-content: center;
      padding: 28px;
      border-radius: 18px;
      text-align: center;
    }

    .simple-small {
      font-size: 14px;
      font-weight: 700;
      opacity: 0.9;
    }

    .simple-label {
      margin: 12px 0;
      font-size: 31px;
      font-weight: 900;
      line-height: 1.25;
    }

    .simple-score {
      font-size: 23px;
      font-weight: 800;
    }

    .simple-main {
      display: grid;
      grid-template-columns:
        repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .simple-box {
      display: flex;
      min-height: 105px;
      flex-direction: column;
      justify-content: center;
      padding: 18px;
      border-radius: 14px;
      background: #0f172a;
    }

    .simple-box-wide {
      grid-column: 1 / -1;
    }

    .simple-box-label {
      color: #94a3b8;
      font-size: 13px;
      font-weight: 700;
    }

    .simple-box-value {
      margin-top: 7px;
      font-size: 24px;
      font-weight: 900;
      line-height: 1.3;
    }

    .simple-action {
      margin-top: 18px;
      padding: 18px;
      border-radius: 14px;
      background: #0f172a;
      font-size: 17px;
      font-weight: 700;
      line-height: 1.7;
    }

    .simple-price-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px 18px;
      align-items: baseline;
      margin-bottom: 22px;
    }

    .simple-current-price {
      font-size: 34px;
      font-weight: 900;
    }

    details.analysis-details {
      margin-top: 18px;
      border-top: 1px solid #334155;
      padding-top: 16px;
    }

    details.analysis-details summary {
      color: #cbd5e1;
      cursor: pointer;
      font-weight: 800;
    }

    @media (
      max-width: 750px
    ) {
      body {
        padding: 14px;
      }

      .title {
        font-size: 23px;
      }

      .price {
        font-size: 37px;
      }

      .search {
        grid-template-columns: 1fr;
      }

      .judgment {
        grid-template-columns: 1fr;
      }

      .simple-card {
        padding: 18px;
      }

      .simple-top {
        grid-template-columns: 1fr;
      }

      .simple-main {
        grid-template-columns: 1fr;
      }

      .simple-box-wide {
        grid-column: auto;
      }

      .simple-label {
        font-size: 27px;
      }

      .simple-box-value {
        font-size: 21px;
      }
    }
  </style>
</head>

<body>
  <main class="container">
    <h1 class="title">
      ${escapeHtml(stockName)}
    </h1>

    <div class="code">
      証券コード：
      ${escapeHtml(inputCode)}
    </div>

    <form
      class="search"
      method="GET"
    >
      <input
        type="text"
        name="code"
        value="${escapeHtml(inputCode)}"
        placeholder="証券コード"
        maxlength="5"
      >

      <input
        type="number"
        name="capital"
        value="${Math.round(capital)}"
        placeholder="投資資金"
        min="0"
        step="10000"
      >

      <input
        type="number"
        name="risk"
        value="${riskPercent}"
        placeholder="許容損失率"
        min="0.1"
        max="20"
        step="0.1"
      >

      <button type="submit">
        分析する
      </button>
    </form>

    <section class="card simple-card">
      <div class="simple-price-row">
        <span class="date">
          最新取得日：
          ${escapeHtml(latest.Date)}
        </span>

        <span class="simple-current-price">
          ${formatNumber(latestClose)}円
        </span>

        <span class="change ${changeClass}">
          ${
            change !== null
              ? `${changeSign}${formatNumber(change)}円`
              : "-"
          }

          ${
            changePercent !== null
              ? `（${changeSign}${changePercent.toFixed(2)}%）`
              : ""
          }
        </span>
      </div>

      <div class="simple-top">
        <div
          class="
            simple-judgment
            ${strategy.className}
          "
        >
          <div class="simple-small">
            AI評価
          </div>

          <div class="simple-label">
            ${escapeHtml(strategy.label)}
          </div>

          <div class="simple-score">
            ${strategy.score}点
          </div>
        </div>

        <div class="simple-main">
          <div class="simple-box simple-box-wide">
            <div class="simple-box-label">
              買い候補
            </div>

            <div class="simple-box-value entry">
              ${formatNumber(strategy.entryLow)}円
              ～
              ${formatNumber(strategy.entryHigh)}円
            </div>
          </div>

          <div class="simple-box">
            <div class="simple-box-label">
              損切り目安
            </div>

            <div class="simple-box-value short-stop">
              ${formatNumber(strategy.shortStop)}円
            </div>
          </div>

          <div class="simple-box">
            <div class="simple-box-label">
              利確目安
            </div>

            <div class="simple-box-value target">
              ${formatNumber(strategy.target1)}円
            </div>
          </div>
        </div>
      </div>

      <div class="simple-action">
        ひとこと：
        ${escapeHtml(strategy.action)}
      </div>

      <details class="analysis-details">
        <summary>
          判断理由と注意点を見る
        </summary>

        <ul class="reasons">
          ${reasonItems}
        </ul>

        ${
          cautionItems
            ? `
              <h3>注意点</h3>

              <ul class="cautions">
                ${cautionItems}
              </ul>
            `
            : ""
        }
      </details>
    </section>

    <section class="card">
      <h2>現在値の詳細</h2>

      <div class="details">
        ${detailBox(
          "始値",
          `${formatNumber(
            latest.AdjO ?? latest.O
          )}円`
        )}

        ${detailBox(
          "高値",
          `${formatNumber(
            latest.AdjH ?? latest.H
          )}円`
        )}

        ${detailBox(
          "安値",
          `${formatNumber(
            latest.AdjL ?? latest.L
          )}円`
        )}

        ${detailBox(
          "前日終値",
          `${formatNumber(
            previousClose
          )}円`
        )}

        ${detailBox(
          "出来高",
          `${formatNumber(
            latest.AdjVo ?? latest.Vo
          )}株`
        )}
      </div>
    </section>

    <section class="card">
      <h2>リスク管理</h2>

      <div class="risk-grid">
        ${strategyBox(
          "短期の100株損失",
          `${formatNumber(
            strategy.loss100Short
          )}円`,
          "risk"
        )}

        ${strategyBox(
          "スイングの100株損失",
          `${formatNumber(
            strategy.loss100Swing
          )}円`,
          "risk"
        )}

        ${strategyBox(
          "利確① リスクリワード",
          `1：${formatRatio(
            strategy.riskReward1
          )}`,
          "target"
        )}

        ${strategyBox(
          "利確② リスクリワード",
          `1：${formatRatio(
            strategy.riskReward2
          )}`,
          "target"
        )}

        ${strategyBox(
          "許容損失額",
          `${formatNumber(
            strategy.allowedLoss
          )}円`,
          "risk"
        )}

        ${strategyBox(
          "適正株数",
          `${formatNumber(
            strategy.recommendedShares
          )}株`,
          "position"
        )}

        ${strategyBox(
          "必要資金の目安",
          `${formatNumber(
            strategy.requiredCapital
          )}円`,
          "position"
        )}
      </div>

      <div class="notice">
        投資資金
        ${formatNumber(capital)}円、
        1回の許容損失率
        ${riskPercent}%で計算しています。
        日本株の100株単位に切り下げています。
      </div>
    </section>

    <section class="card">
      <h2>株価チャート</h2>

      <div class="chart-legend">
        <span class="legend-close">
          ● 終値
        </span>

        <span class="legend-ma5">
          ● 5日線
        </span>

        <span class="legend-ma25">
          ● 25日線
        </span>

        <span class="legend-ma75">
          ● 75日線
        </span>

        <span class="legend-ma200">
          ● 200日線
        </span>

        <span class="legend-bollinger">
          ┄ ボリンジャーバンド ±2σ
        </span>
      </div>

      <div class="chart-wrap">
        ${createPriceChart(chartData)}
      </div>
    </section>

    <section class="card">
      <h2>出来高</h2>

      <div class="chart-wrap">
        ${createVolumeChart(chartData)}
      </div>
    </section>

    <section class="card">
      <h2>MACD</h2>

      <div class="chart-legend">
        <span class="legend-macd">
          ● MACD
        </span>

        <span class="legend-signal">
          ● シグナル
        </span>
      </div>

      <div class="chart-wrap">
        ${createMacdChart(chartData)}
      </div>
    </section>

    <section class="card">
      <h2>テクニカル指標</h2>

      <div class="indicator-grid">
        ${detailBox(
          "5日移動平均",
          `${formatNumber(ma5)}円`
        )}

        ${detailBox(
          "25日移動平均",
          `${formatNumber(ma25)}円`
        )}

        ${detailBox(
          "75日移動平均",
          `${formatNumber(ma75)}円`
        )}

        ${detailBox(
          "200日移動平均",
          `${formatNumber(ma200)}円`
        )}

        ${detailBox(
          "ボリンジャー上限（+2σ）",
          `${formatNumber(bollinger.upper)}円`
        )}

        ${detailBox(
          "ボリンジャー中心線",
          `${formatNumber(bollinger.middle)}円`
        )}

        ${detailBox(
          "ボリンジャー下限（-2σ）",
          `${formatNumber(bollinger.lower)}円`
        )}

        ${detailBox(
          "出来高20日平均",
          `${formatNumber(averageVolume20)}株`
        )}

        ${detailBox(
          "出来高倍率",
          Number.isFinite(volumeRatio)
            ? `${volumeRatio.toFixed(2)}倍`
            : "-"
        )}

        ${detailBox(
          "移動平均クロス",
          formatCrossSignal(crossSignal)
        )}

        ${detailBox(
          "RSI（14日）",
          formatDecimal(rsi14)
        )}

        ${detailBox(
          "ATR（14日）",
          `${formatNumber(atr14)}円`
        )}

        ${detailBox(
          "MACD",
          formatDecimal(latestMacd)
        )}

        ${detailBox(
          "シグナル",
          formatDecimal(latestSignal)
        )}

        ${detailBox(
          "ヒストグラム",
          formatSignedDecimal(
            latestHistogram
          )
        )}
      </div>
    </section>

    <section class="card">
      <h2>直近10営業日</h2>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>日付</th>
              <th>始値</th>
              <th>高値</th>
              <th>安値</th>
              <th>終値</th>
              <th>出来高</th>
            </tr>
          </thead>

          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>

      <div class="notice">
        J-Quantsで取得可能な日付の
        データを使用しています。
        無料プランでは現在価格ではありません。
      </div>
    </section>
  </main>
</body>
</html>
  `;
}

function detailBox(label, value) {
  return `
    <div class="detail-item">
      <div class="detail-label">
        ${escapeHtml(label)}
      </div>

      <div class="detail-value">
        ${escapeHtml(value)}
      </div>
    </div>
  `;
}

function strategyBox(
  label,
  value,
  className
) {
  return `
    <div class="strategy-item">
      <div class="detail-label">
        ${escapeHtml(label)}
      </div>

      <div
        class="
          detail-value
          ${className}
        "
      >
        ${escapeHtml(value)}
      </div>
    </div>
  `;
}

function createPriceChart(data) {
  const values = data
    .flatMap((item) => [
      item.close,
      item.ma5,
      item.ma25,
      item.ma75,
      item.ma200,
      item.bollinger?.upper,
      item.bollinger?.lower
    ])
    .filter(Number.isFinite);

  if (values.length < 2) {
    return "<p>チャートデータが不足しています。</p>";
  }

  const width = 900;
  const height = 360;

  const padding = {
    top: 25,
    right: 75,
    bottom: 50,
    left: 20
  };

  const rawMin =
    Math.min(...values);

  const rawMax =
    Math.max(...values);

  const range =
    rawMax - rawMin || 1;

  const minValue =
    rawMin - range * 0.08;

  const maxValue =
    rawMax + range * 0.08;

  const plotWidth =
    width -
    padding.left -
    padding.right;

  const plotHeight =
    height -
    padding.top -
    padding.bottom;

  const x = (index) =>
    padding.left +
    (
      index /
      (data.length - 1)
    ) *
      plotWidth;

  const y = (value) =>
    padding.top +
    (
      (maxValue - value) /
      (maxValue - minValue)
    ) *
      plotHeight;

  const makePoints = (key) =>
    data
      .map((item, index) => {
        if (
          !Number.isFinite(
            item[key]
          )
        ) {
          return null;
        }

        return `${x(
          index
        ).toFixed(1)},${y(
          item[key]
        ).toFixed(1)}`;
      })
      .filter(Boolean)
      .join(" ");

  return `
    <svg
      viewBox="0 0 ${width} ${height}"
    >
      ${createGridLines({
        width,
        padding,
        minValue,
        maxValue,
        y,
        formatter: (value) =>
          Math.round(value)
            .toLocaleString("ja-JP")
      })}

      ${createDateLabels(
        data,
        x,
        height
      )}

      <polyline
        points="${makePoints("close")}"
        fill="none"
        stroke="#e2e8f0"
        stroke-width="3"
      />

      <polyline
        points="${makePoints("ma5")}"
        fill="none"
        stroke="#38bdf8"
        stroke-width="2.5"
      />

      <polyline
        points="${makePoints("ma25")}"
        fill="none"
        stroke="#facc15"
        stroke-width="2.5"
      />

      <polyline
        points="${makePoints("ma75")}"
        fill="none"
        stroke="#a855f7"
        stroke-width="2.2"
      />

      <polyline
        points="${makePoints("ma200")}"
        fill="none"
        stroke="#fb7185"
        stroke-width="2.2"
      />

      <polyline
        points="${makeNestedPoints(data, x, y, "bollinger", "upper")}"
        fill="none"
        stroke="#94a3b8"
        stroke-width="1.4"
        stroke-dasharray="6 5"
      />

      <polyline
        points="${makeNestedPoints(data, x, y, "bollinger", "lower")}"
        fill="none"
        stroke="#94a3b8"
        stroke-width="1.4"
        stroke-dasharray="6 5"
      />
    </svg>
  `;
}

function makeNestedPoints(
  data,
  x,
  y,
  parentKey,
  childKey
) {
  return data
    .map((item, index) => {
      const value =
        item[parentKey]?.[childKey];

      if (!Number.isFinite(value)) {
        return null;
      }

      return `${x(index).toFixed(1)},${y(
        value
      ).toFixed(1)}`;
    })
    .filter(Boolean)
    .join(" " );
}

function createVolumeChart(data) {
  const width = 900;
  const height = 250;

  const padding = {
    top: 20,
    right: 75,
    bottom: 50,
    left: 20
  };

  const maxVolume = Math.max(
    ...data.map(
      (item) => item.volume
    )
  ) || 1;

  const plotWidth =
    width -
    padding.left -
    padding.right;

  const plotHeight =
    height -
    padding.top -
    padding.bottom;

  const step =
    plotWidth / data.length;

  const barWidth =
    Math.max(3, step * 0.65);

  const bars = data
    .map((item, index) => {
      const barHeight =
        (item.volume /
          maxVolume) *
        plotHeight;

      const x =
        padding.left +
        index * step +
        (step - barWidth) / 2;

      const y =
        padding.top +
        plotHeight -
        barHeight;

      const fill =
        item.close >= item.open
          ? "#22c55e"
          : "#ef4444";

      return `
        <rect
          x="${x}"
          y="${y}"
          width="${barWidth}"
          height="${Math.max(
            1,
            barHeight
          )}"
          fill="${fill}"
          opacity="0.8"
        />
      `;
    })
    .join("");

  const x = (index) =>
    padding.left +
    index * step +
    step / 2;

  return `
    <svg
      viewBox="0 0 ${width} ${height}"
    >
      ${bars}

      ${createDateLabels(
        data,
        x,
        height
      )}
    </svg>
  `;
}

function createMacdChart(data) {
  const values = data
    .flatMap((item) => [
      item.macd,
      item.signal,
      item.histogram
    ])
    .filter(Number.isFinite);

  if (values.length < 2) {
    return "<p>MACDデータが不足しています。</p>";
  }

  const width = 900;
  const height = 320;

  const padding = {
    top: 25,
    right: 75,
    bottom: 50,
    left: 20
  };

  const rawMin =
    Math.min(0, ...values);

  const rawMax =
    Math.max(0, ...values);

  const range =
    rawMax - rawMin || 1;

  const minValue =
    rawMin - range * 0.1;

  const maxValue =
    rawMax + range * 0.1;

  const plotWidth =
    width -
    padding.left -
    padding.right;

  const plotHeight =
    height -
    padding.top -
    padding.bottom;

  const x = (index) =>
    padding.left +
    (
      index /
      (data.length - 1)
    ) *
      plotWidth;

  const y = (value) =>
    padding.top +
    (
      (maxValue - value) /
      (maxValue - minValue)
    ) *
      plotHeight;

  const makePoints = (key) =>
    data
      .map((item, index) => {
        if (
          !Number.isFinite(
            item[key]
          )
        ) {
          return null;
        }

        return `${x(
          index
        ).toFixed(1)},${y(
          item[key]
        ).toFixed(1)}`;
      })
      .filter(Boolean)
      .join(" ");

  return `
    <svg
      viewBox="0 0 ${width} ${height}"
    >
      ${createGridLines({
        width,
        padding,
        minValue,
        maxValue,
        y,
        formatter: (value) =>
          value.toFixed(0)
      })}

      <line
        x1="${padding.left}"
        y1="${y(0)}"
        x2="${width - padding.right}"
        y2="${y(0)}"
        stroke="#64748b"
      />

      <polyline
        points="${makePoints("macd")}"
        fill="none"
        stroke="#60a5fa"
        stroke-width="2.5"
      />

      <polyline
        points="${makePoints("signal")}"
        fill="none"
        stroke="#f97316"
        stroke-width="2.5"
      />

      ${createDateLabels(
        data,
        x,
        height
      )}
    </svg>
  `;
}

function createGridLines({
  width,
  padding,
  minValue,
  maxValue,
  y,
  formatter
}) {
  const lines = [];

  for (let i = 0; i <= 4; i++) {
    const value =
      maxValue -
      (
        (maxValue - minValue) /
        4
      ) *
        i;

    const gridY =
      y(value);

    lines.push(`
      <line
        x1="${padding.left}"
        y1="${gridY}"
        x2="${width - padding.right}"
        y2="${gridY}"
        stroke="#334155"
      />

      <text
        x="${width - padding.right + 8}"
        y="${gridY + 5}"
        fill="#94a3b8"
        font-size="12"
      >
        ${formatter(value)}
      </text>
    `);
  }

  return lines.join("");
}

function createDateLabels(
  data,
  x,
  height
) {
  const interval = Math.max(
    1,
    Math.floor(data.length / 6)
  );

  return data
    .map((item, index) => {
      if (
        index % interval !== 0 &&
        index !== data.length - 1
      ) {
        return "";
      }

      return `
        <text
          x="${x(index)}"
          y="${height - 18}"
          fill="#94a3b8"
          font-size="11"
          text-anchor="middle"
        >
          ${escapeHtml(
            item.date.slice(5)
          )}
        </text>
      `;
    })
    .join("");
}


const RANKING_STOCKS = [
  {
    code: "285A",
    apiCode: "285A0",
    name: "キオクシアホールディングス"
  },
  {
    code: "6857",
    apiCode: "68570",
    name: "アドバンテスト"
  },
  {
    code: "6146",
    apiCode: "61460",
    name: "ディスコ"
  },
  {
    code: "6920",
    apiCode: "69200",
    name: "レーザーテック"
  },
  {
    code: "8035",
    apiCode: "80350",
    name: "東京エレクトロン"
  }
];

async function createRankingResponse(env) {
  if (!env.JQUANTS_API_KEY) {
    return htmlError(
      "JQUANTS_API_KEYが設定されていません"
    );
  }

  try {
    const results = [];

    for (const stock of RANKING_STOCKS) {
      try {
        const analysis =
          await analyzeRankingStock(
            stock,
            env.JQUANTS_API_KEY
          );

        results.push(analysis);
      } catch (error) {
        results.push({
          code: stock.code,
          name: stock.name,
          error:
            error instanceof Error
              ? error.message
              : "分析に失敗しました"
        });
      }
    }

    const successfulResults = results
      .filter(
        (item) =>
          !item.error &&
          Number.isFinite(item.score)
      )
      .sort((a, b) => b.score - a.score)
      .map((item, index) => ({
        ...item,
        rank: index + 1
      }));

    const failedResults = results.filter(
      (item) => item.error
    );

    return new Response(
      createRankingHtml({
        rankings: successfulResults,
        failedResults
      }),
      {
        headers: {
          "Content-Type":
            "text/html; charset=UTF-8",
          "Cache-Control":
            "public, max-age=300"
        }
      }
    );
  } catch (error) {
    return htmlError(
      error instanceof Error
        ? error.message
        : "ランキングの作成に失敗しました"
    );
  }
}

async function analyzeRankingStock(
 async function analyzeRankingStock(
  stock,
  apiKey
) {
  const cache = caches.default;

  const cacheKey = new Request(
    `,`https://stock-ai-cache.local/ranking-v2/${stock.apiCode}`
    {
      method: "GET"
    }
  );

  const cachedResponse =
    await cache.match(cacheKey);

  if (cachedResponse) {
    return await cachedResponse.json();
  }

  const apiUrl = new URL(
    "https://api.jquants.com/v2/equities/bars/daily"
  );

  apiUrl.searchParams.set(
    "code",
    stock.apiCode
  );

  const response = await fetch(
    apiUrl.toString(),
    {
      headers: {
        "x-api-key": apiKey,
        Accept: "application/json"
      }
    }
  );

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error(
      `API応答を読み込めませんでした（${response.status}）`
    );
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error(
        "API回数制限です。1分ほど空けて再分析してください"
      );
    }

    throw new Error(
      `J-Quants APIエラー：${response.status}`
    );
  }

  const prices = Array.isArray(result.data)
    ? result.data
    : [];

  if (prices.length === 0) {
    throw new Error(
      "株価データがありません"
    );
  }

  prices.sort(
    (a, b) =>
      new Date(a.Date) -
      new Date(b.Date)
  );

  const closes = prices.map((price) =>
    Number(price.AdjC ?? price.C)
  );

  const highs = prices.map((price) =>
    Number(price.AdjH ?? price.H)
  );

  const lows = prices.map((price) =>
    Number(price.AdjL ?? price.L)
  );

  const volumes = prices.map((price) =>
    Number(price.AdjVo ?? price.Vo)
  );

  const latest =
    prices[prices.length - 1];

  const previous =
    prices.length >= 2
      ? prices[prices.length - 2]
      : null;

  const latestClose =
    closes[closes.length - 1];

  const previousClose = previous
    ? Number(previous.AdjC ?? previous.C)
    : null;

  const change =
    previousClose !== null
      ? latestClose - previousClose
      : null;

  const changePercent =
    previousClose
      ? (change / previousClose) * 100
      : null;

  const ma5 =
    calculateSMA(closes, 5);

  const ma25 =
    calculateSMA(closes, 25);

  const ma75 =
    calculateSMA(closes, 75);

  const ma200 =
    calculateSMA(closes, 200);

  const rsi14 =
    calculateRSI(closes, 14);

  const bollinger =
    calculateBollingerBands(
      closes,
      20,
      2
    );

  const averageVolume20 =
    calculateSMA(volumes, 20);

  const latestVolume =
    volumes[volumes.length - 1];

  const volumeRatio =
    Number.isFinite(averageVolume20) &&
    averageVolume20 > 0
      ? latestVolume / averageVolume20
      : null;

  const crossSignal =
    detectMovingAverageCross(
      closes,
      5,
      25
    );

  const atr14 =
    calculateATR(
      highs,
      lows,
      closes,
      14
    );

  const macdData =
    calculateMACD(
      closes,
      12,
      26,
      9
    );

  const latestMacd =
    getLastFinite(macdData.macd);

  const latestSignal =
    getLastFinite(macdData.signal);

  const latestHistogram =
    getLastFinite(
      macdData.histogram
    );

  const recent20High = Math.max(
    ...highs.slice(-20)
  );

  const strategy = createStrategyV2({
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
    capital: 1000000,
    riskPercent: 1
  });

  const analysis = {
    code: stock.code,
    name: stock.name,
    date: latest.Date,
    latestClose,
    previousClose,
    change,
    changePercent,

    score: strategy.score,
stars: strategy.stars,
label: strategy.label,
className: strategy.className,
action: strategy.action,
aiComment: strategy.aiComment,
strengths: strategy.strengths,
cautions: strategy.cautions,

    entryLow: strategy.entryLow,
    entryHigh: strategy.entryHigh,
    shortStop: strategy.shortStop,
    target1: strategy.target1,

    rsi14,
    volumeRatio,
    ma5,
    ma25,
    latestHistogram
  };

  const responseToCache = new Response(
    JSON.stringify(analysis),
    {
      headers: {
        "Content-Type":
          "application/json; charset=UTF-8",

        "Cache-Control":
          "public, max-age=21600"
      }
    }
  );

  await cache.put(
    cacheKey,
    responseToCache
  );

  return analysis;
}
    }
  );

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error(
      `API応答を読み込めませんでした（${response.status}）`
    );
  }

  if (!response.ok) {
    throw new Error(
      `J-Quants APIエラー：${response.status}`
    );
  }

  const prices = Array.isArray(result.data)
    ? result.data
    : [];

  if (prices.length === 0) {
    throw new Error(
      "株価データがありません"
    );
  }

  prices.sort(
    (a, b) =>
      new Date(a.Date) -
      new Date(b.Date)
  );

  const closes = prices.map((price) =>
    Number(price.AdjC ?? price.C)
  );

  const highs = prices.map((price) =>
    Number(price.AdjH ?? price.H)
  );

  const lows = prices.map((price) =>
    Number(price.AdjL ?? price.L)
  );

  const volumes = prices.map((price) =>
    Number(price.AdjVo ?? price.Vo)
  );

  const latest =
    prices[prices.length - 1];

  const previous =
    prices.length >= 2
      ? prices[prices.length - 2]
      : null;

  const latestClose =
    closes[closes.length - 1];

  const previousClose = previous
    ? Number(previous.AdjC ?? previous.C)
    : null;

  const change =
    previousClose !== null
      ? latestClose - previousClose
      : null;

  const changePercent =
    previousClose
      ? (change / previousClose) * 100
      : null;

  const ma5 =
    calculateSMA(closes, 5);

  const ma25 =
    calculateSMA(closes, 25);

  const ma75 =
    calculateSMA(closes, 75);

  const ma200 =
    calculateSMA(closes, 200);

  const rsi14 =
    calculateRSI(closes, 14);

  const bollinger =
    calculateBollingerBands(
      closes,
      20,
      2
    );

  const averageVolume20 =
    calculateSMA(volumes, 20);

  const latestVolume =
    volumes[volumes.length - 1];

  const volumeRatio =
    Number.isFinite(averageVolume20) &&
    averageVolume20 > 0
      ? latestVolume / averageVolume20
      : null;

  const crossSignal =
    detectMovingAverageCross(
      closes,
      5,
      25
    );

  const atr14 =
    calculateATR(
      highs,
      lows,
      closes,
      14
    );

  const macdData =
    calculateMACD(
      closes,
      12,
      26,
      9
    );

  const latestMacd =
    getLastFinite(macdData.macd);

  const latestSignal =
    getLastFinite(macdData.signal);

  const latestHistogram =
    getLastFinite(
      macdData.histogram
    );

  const recent20High = Math.max(
    ...highs.slice(-20)
  );

  const strategy = createStrategyV2({
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
    capital: 1000000,
    riskPercent: 1
  });

  return {
    code: stock.code,
    name: stock.name,
    date: latest.Date,
    latestClose,
    previousClose,
    change,
    changePercent,

    score: strategy.score,
    label: strategy.label,
    className: strategy.className,
    action: strategy.action,

    entryLow: strategy.entryLow,
    entryHigh: strategy.entryHigh,
    shortStop: strategy.shortStop,
    target1: strategy.target1,

    rsi14,
    volumeRatio,
    ma5,
    ma25,
    latestHistogram
  };
}

function createRankingHtml({
  rankings,
  failedResults
}) {
  const rankingCards = rankings
    .map((item) =>
      createRankingCard(item)
    )
    .join("");

  const failedCards = failedResults
    .map(
      (item) => `
        <div class="ranking-error">
          <strong>
            ${escapeHtml(item.name)}
          </strong>

          <span>
            ${escapeHtml(item.error)}
          </span>
        </div>
      `
    )
    .join("");

  const latestDate =
    rankings.length > 0
      ? rankings[0].date
      : "-";

  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >

  <title>
    半導体株ランキング｜Stock AI
  </title>

  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 24px;
      background: #0f172a;
      color: #e2e8f0;
      font-family:
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
    }

    .container {
      max-width: 1050px;
      margin: 0 auto;
    }

    h1 {
      margin-bottom: 8px;
      font-size: 32px;
    }

    .sub {
      margin-bottom: 24px;
      color: #94a3b8;
      line-height: 1.7;
    }

    .navigation {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 24px;
    }

    .navigation a {
      padding: 12px 18px;
      border-radius: 10px;
      background: #2563eb;
      color: white;
      font-weight: 800;
      text-decoration: none;
    }

    .ranking-list {
      display: grid;
      gap: 18px;
    }

    .ranking-card {
      display: grid;
      grid-template-columns:
        95px
        minmax(180px, 1fr)
        minmax(330px, 1.5fr);
      gap: 18px;
      align-items: stretch;
      padding: 22px;
      border:
        1px solid #334155;
      border-radius: 18px;
      background: #1e293b;
    }

    .rank-area {
      display: flex;
      flex-direction: column;
      justify-content: center;
      border-radius: 14px;
      background: #0f172a;
      text-align: center;
    }

    .rank-number {
      font-size: 34px;
      font-weight: 900;
    }

    .rank-text {
      color: #94a3b8;
      font-size: 13px;
    }

    .stock-area {
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .stock-name {
      font-size: 22px;
      font-weight: 900;
    }

    .stock-code {
      margin-top: 5px;
      color: #94a3b8;
    }

    .price {
      margin-top: 14px;
      font-size: 29px;
      font-weight: 900;
    }

    .positive {
      color: #22c55e;
    }

    .negative {
      color: #ef4444;
    }

    .score-area {
      padding: 18px;
      border-radius: 14px;
      background: #0f172a;
    }

    .score-top {
      display: flex;
      flex-wrap: wrap;
      gap: 10px 18px;
      align-items: center;
      justify-content:
        space-between;
    }

    .score {
      font-size: 32px;
      font-weight: 900;
    }

    .label {
      padding: 8px 12px;
      border-radius: 999px;
      font-weight: 900;
    }

    .buy {
      color: #4ade80;
      background:
        rgba(34, 197, 94, 0.18);
    }

    .wait {
      color: #facc15;
      background:
        rgba(234, 179, 8, 0.18);
    }

    .danger {
      color: #f87171;
      background:
        rgba(239, 68, 68, 0.18);
    }

    .price-grid {
      display: grid;
      grid-template-columns:
        repeat(3, minmax(0, 1fr));
      gap: 9px;
      margin-top: 15px;
    }

    .price-box {
      padding: 11px;
      border-radius: 9px;
      background: #172033;
    }

    .price-label {
      color: #94a3b8;
      font-size: 12px;
    }

    .price-value {
      margin-top: 4px;
      font-weight: 900;
    }

    .entry {
      color: #38bdf8;
    }

    .stop {
      color: #fb923c;
    }

    .target {
      color: #4ade80;
    }

    .action {
      margin-top: 14px;
      color: #cbd5e1;
      line-height: 1.6;
    }

    .indicators {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 13px;
    }

    .indicator {
      padding: 6px 9px;
      border-radius: 8px;
      background: #172033;
      color: #cbd5e1;
      font-size: 12px;
    }

    .detail-link {
      display: inline-block;
      margin-top: 13px;
      color: #60a5fa;
      font-weight: 800;
      text-decoration: none;
    }

    .ranking-error {
      display: flex;
      justify-content:
        space-between;
      gap: 15px;
      margin-top: 12px;
      padding: 15px;
      border:
        1px solid #ef4444;
      border-radius: 10px;
      background:
        rgba(239, 68, 68, 0.12);
      color: #fca5a5;
    }

    .notice {
      margin-top: 24px;
      padding: 16px;
      border-radius: 12px;
      background: #1e293b;
      color: #94a3b8;
      font-size: 13px;
      line-height: 1.7;
    }

    @media (
      max-width: 800px
    ) {
      body {
        padding: 14px;
      }

      h1 {
        font-size: 25px;
      }

      .ranking-card {
        grid-template-columns: 1fr;
      }

      .rank-area {
        min-height: 85px;
      }

      .price-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>

<body>
  <main class="container">
    <h1>
      半導体株 AIランキング
    </h1>

    <div class="sub">
      最新取得日：
      ${escapeHtml(latestDate)}
      <br>
      日足のトレンド、移動平均線、
      RSI、MACD、出来高、ボリンジャーバンドを
      共通条件で採点しています。
    </div>

    <nav class="navigation">
      <a href="?mode=ranking">
        ランキングを再分析
      </a>

      <a href="?code=285A">
        個別分析へ戻る
      </a>
    </nav>

    <section class="ranking-list">
      ${
        rankingCards ||
        `
          <div class="ranking-error">
            ランキングを作成できませんでした。
          </div>
        `
      }
    </section>

    ${
      failedCards
        ? `
          <section>
            <h2>取得できなかった銘柄</h2>
            ${failedCards}
          </section>
        `
        : ""
    }

    <div class="notice">
      この順位は、現在のコードに実装されている
      テクニカル指標のスコア比較です。
      将来の値上がりを保証する予測ではありません。
      J-Quantsの日足データはプランに応じた
      提供範囲と更新時刻になります。
    </div>
  </main>
</body>
</html>
  `;
}

function createRankingCard(item) {
  const isPositive =
    Number.isFinite(item.change) &&
    item.change >= 0;

  const changeClass =
    isPositive
      ? "positive"
      : "negative";

  const sign =
    isPositive ? "+" : "";

  const changeText =
    Number.isFinite(item.change) &&
    Number.isFinite(
      item.changePercent
    )
      ? `${sign}${formatNumber(
          item.change
        )}円（${sign}${item.changePercent.toFixed(
          2
        )}%）`
      : "-";

  const volumeText =
    Number.isFinite(item.volumeRatio)
      ? `${item.volumeRatio.toFixed(
          2
        )}倍`
      : "-";

  const rsiText =
    Number.isFinite(item.rsi14)
      ? item.rsi14.toFixed(1)
      : "-";

  const histogramText =
    Number.isFinite(
      item.latestHistogram
    )
      ? formatSignedDecimal(
          item.latestHistogram
        )
      : "-";

  return `
    <article class="ranking-card">
      <div class="rank-area">
        <div class="rank-number">
          ${item.rank}
        </div>

        <div class="rank-text">
          RANK
        </div>
      </div>

      <div class="stock-area">
        <div class="stock-name">
          ${escapeHtml(item.name)}
        </div>

        <div class="stock-code">
          ${escapeHtml(item.code)}
        </div>

        <div class="price">
          ${formatNumber(
            item.latestClose
          )}円
        </div>

        <div class="${changeClass}">
          ${changeText}
        </div>

        <a
          class="detail-link"
          href="?code=${encodeURIComponent(
            item.code
          )}"
        >
          個別分析を見る
        </a>
      </div>

      <div class="score-area">
        <div class="score-top">
          <div class="score">
            ${item.score}点
          </div>

          <div
            class="
              label
              ${item.className}
            "
          >
            ${escapeHtml(item.label)}
          </div>
        </div>

        <div class="price-grid">
          <div class="price-box">
            <div class="price-label">
              買い候補
            </div>

            <div class="price-value entry">
              ${formatNumber(
                item.entryLow
              )}～
              ${formatNumber(
                item.entryHigh
              )}円
            </div>
          </div>

          <div class="price-box">
            <div class="price-label">
              損切り目安
            </div>

            <div class="price-value stop">
              ${formatNumber(
                item.shortStop
              )}円
            </div>
          </div>

          <div class="price-box">
            <div class="price-label">
              利確目安
            </div>

            <div class="price-value target">
              ${formatNumber(
                item.target1
              )}円
            </div>
          </div>
        </div>

        <div class="indicators">
          <span class="indicator">
            RSI ${rsiText}
          </span>

          <span class="indicator">
            出来高 ${volumeText}
          </span>

          <span class="indicator">
            MACD差 ${histogramText}
          </span>
        </div>

        <div class="action">
          ${escapeHtml(item.action)}
        </div>
      </div>
    </article>
  `;
}
