export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const inputCode = (url.searchParams.get("code") || "285A")
      .trim()
      .toUpperCase();

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

      const latest = prices[prices.length - 1];
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
      const rsi14 = calculateRSI(closes, 14);
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

      const recent10Low = Math.min(
        ...lows.slice(-10)
      );

      const strategy = createStrategy({
        latestClose,
        ma5,
        ma25,
        rsi14,
        atr14,
        latestMacd,
        latestSignal,
        latestHistogram,
        recent20High,
        recent10Low
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
          rsi14,
          atr14,
          latestMacd,
          latestSignal,
          latestHistogram,
          strategy,
          chartData
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

  const averageGain = gains / period;
  const averageLoss = losses / period;

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
    const highLow = highs[i] - lows[i];

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

  result[period - 1] = previousEma;

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
  rsi14,
  atr14,
  latestMacd,
  latestSignal,
  latestHistogram,
  recent20High,
  recent10Low
}) {
  let score = 50;
  const reasons = [];
  const cautions = [];

  const bullishTrend =
    ma5 !== null &&
    ma25 !== null &&
    latestClose > ma5 &&
    ma5 > ma25;

  const overheated =
    rsi14 !== null && rsi14 >= 70;

  const oversold =
    rsi14 !== null && rsi14 <= 30;

  const macdBullish =
    latestMacd !== null &&
    latestSignal !== null &&
    latestMacd > latestSignal;

  if (latestClose > ma5) {
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

  if (ma5 > ma25) {
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

  if (overheated) {
    score -= 20;
    cautions.push(
      `RSIが${rsi14.toFixed(
        1
      )}で、短期的に過熱しています`
    );
  } else if (oversold) {
    score += 10;
    reasons.push(
      `RSIが${rsi14.toFixed(
        1
      )}で、売られすぎ水準です`
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
    latestHistogram !== null &&
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
    label = "上昇トレンド・過熱注意";
    className = "wait";
    action =
      "高値追いより、5日線付近への押し目を待つ場面です。";
  } else if (
    bullishTrend &&
    !overheated &&
    macdBullish
  ) {
    label = "買い候補";
    className = "buy";
    action =
      "上昇トレンドが継続しています。ただし分割で入る方が安全です。";
  } else if (oversold) {
    label = "反発待ち";
    className = "wait";
    action =
      "売られすぎですが、反発確認前の買いは慎重に判断します。";
  } else if (
    latestClose < ma25
  ) {
    label = "下落警戒";
    className = "danger";
    action =
      "25日線を下回っているため、底打ち確認を優先します。";
  } else {
    label = "様子見";
    className = "wait";
    action =
      "方向感が十分に揃っていないため、無理に入らない判断です。";
  }

  const effectiveAtr =
    Number.isFinite(atr14) && atr14 > 0
      ? atr14
      : latestClose * 0.03;

  const pullbackCenter =
    Number.isFinite(ma5)
      ? ma5
      : latestClose - effectiveAtr;

  const entryHigh = Math.min(
    latestClose,
    pullbackCenter + effectiveAtr * 0.25
  );

  const entryLow = Math.max(
    0,
    pullbackCenter - effectiveAtr * 0.35
  );

  const technicalStop = Math.min(
    recent10Low,
    Number.isFinite(ma25)
      ? ma25 - effectiveAtr * 0.3
      : recent10Low
  );

  const stopLoss = Math.max(
    0,
    technicalStop
  );

  const entryCenter =
    (entryLow + entryHigh) / 2;

  const risk = Math.max(
    effectiveAtr,
    entryCenter - stopLoss
  );

  const target1 = Math.max(
    recent20High,
    entryCenter + risk * 1.5
  );

  const target2 = Math.max(
    target1 + effectiveAtr,
    entryCenter + risk * 2.5
  );

  return {
    score,
    label,
    className,
    action,
    reasons,
    cautions,
    entryLow,
    entryHigh,
    stopLoss,
    target1,
    target2
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
  rsi14,
  atr14,
  latestMacd,
  latestSignal,
  latestHistogram,
  strategy,
  chartData
}) {
  const isPositive =
    change !== null && change >= 0;

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
      max-width: 950px;
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
      display: flex;
      gap: 10px;
      margin: 24px 0;
    }

    .search input {
      flex: 1;
      padding: 14px;
      border: 1px solid #334155;
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
      border: 1px solid #334155;
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
    .strategy-grid {
      display: grid;
      grid-template-columns:
        repeat(auto-fit, minmax(145px, 1fr));
      gap: 12px;
      margin-top: 22px;
    }

    .detail-item,
    .indicator-item,
    .strategy-item {
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

    .legend-macd {
      color: #60a5fa;
    }

    .legend-signal {
      color: #f97316;
    }

    .judgment {
      display: grid;
      grid-template-columns: 230px 1fr;
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
      background: rgba(34, 197, 94, 0.18);
      color: #4ade80;
      border: 1px solid #22c55e;
    }

    .wait {
      background: rgba(234, 179, 8, 0.18);
      color: #facc15;
      border: 1px solid #eab308;
    }

    .danger {
      background: rgba(239, 68, 68, 0.18);
      color: #f87171;
      border: 1px solid #ef4444;
    }

    .action {
      margin-bottom: 15px;
      padding: 14px;
      border-left: 4px solid #60a5fa;
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

    .stop {
      color: #f87171;
    }

    .target {
      color: #4ade80;
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
      border-bottom: 1px solid #334155;
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

    @media (max-width: 650px) {
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
        flex-direction: column;
      }

      .judgment {
        grid-template-columns: 1fr;
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
      証券コード：${escapeHtml(inputCode)}
    </div>

    <form class="search" method="GET">
      <input
        type="text"
        name="code"
        value="${escapeHtml(inputCode)}"
        placeholder="例：285A、6857"
        maxlength="5"
      >

      <button type="submit">
        株価を表示
      </button>
    </form>

    <section class="card">
      <div class="date">
        最新取得日：${escapeHtml(latest.Date)}
      </div>

      <div class="price">
        ${formatNumber(latestClose)}円
      </div>

      <div class="change ${changeClass}">
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
      </div>

      <div class="details">
        <div class="detail-item">
          <div class="detail-label">始値</div>
          <div class="detail-value">
            ${formatNumber(latest.AdjO ?? latest.O)}円
          </div>
        </div>

        <div class="detail-item">
          <div class="detail-label">高値</div>
          <div class="detail-value">
            ${formatNumber(latest.AdjH ?? latest.H)}円
          </div>
        </div>

        <div class="detail-item">
          <div class="detail-label">安値</div>
          <div class="detail-value">
            ${formatNumber(latest.AdjL ?? latest.L)}円
          </div>
        </div>

        <div class="detail-item">
          <div class="detail-label">前日終値</div>
          <div class="detail-value">
            ${formatNumber(previousClose)}円
          </div>
        </div>

        <div class="detail-item">
          <div class="detail-label">出来高</div>
          <div class="detail-value">
            ${formatNumber(latest.AdjVo ?? latest.Vo)}株
          </div>
        </div>
      </div>
    </section>

    <section class="card">
      <h2>実戦判定</h2>

      <div class="judgment">
        <div class="judgment-badge ${strategy.className}">
          <div class="judgment-label">
            ${escapeHtml(strategy.label)}
          </div>

          <div class="judgment-score">
            総合スコア ${strategy.score}点
          </div>
        </div>

        <div>
          <div class="action">
            ${escapeHtml(strategy.action)}
          </div>

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
        </div>
      </div>
    </section>

    <section class="card">
      <h2>売買価格の参考目安</h2>

      <div class="strategy-grid">
        <div class="strategy-item">
          <div class="detail-label">
            押し目候補
          </div>

          <div class="detail-value entry">
            ${formatNumber(strategy.entryLow)}円
            ～
            ${formatNumber(strategy.entryHigh)}円
          </div>
        </div>

        <div class="strategy-item">
          <div class="detail-label">
            損切り目安
          </div>

          <div class="detail-value stop">
            ${formatNumber(strategy.stopLoss)}円
          </div>
        </div>

        <div class="strategy-item">
          <div class="detail-label">
            利確目安①
          </div>

          <div class="detail-value target">
            ${formatNumber(strategy.target1)}円
          </div>
        </div>

        <div class="strategy-item">
          <div class="detail-label">
            利確目安②
          </div>

          <div class="detail-value target">
            ${formatNumber(strategy.target2)}円
          </div>
        </div>
      </div>

      <div class="notice">
        ATR、移動平均線、直近安値・高値を使った機械的な参考値です。
        実際の注文価格を保証するものではありません。
      </div>
    </section>

    <section class="card">
      <h2>株価チャート</h2>

      <div class="chart-legend">
        <span class="legend-close">● 終値</span>
        <span class="legend-ma5">● 5日線</span>
        <span class="legend-ma25">● 25日線</span>
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
        <span class="legend-macd">● MACD</span>
        <span class="legend-signal">● シグナル</span>
      </div>

      <div class="chart-wrap">
        ${createMacdChart(chartData)}
      </div>
    </section>

    <section class="card">
      <h2>テクニカル指標</h2>

      <div class="indicator-grid">
        <div class="indicator-item">
          <div class="detail-label">5日移動平均</div>
          <div class="detail-value">
            ${formatNumber(ma5)}円
          </div>
        </div>

        <div class="indicator-item">
          <div class="detail-label">25日移動平均</div>
          <div class="detail-value">
            ${formatNumber(ma25)}円
          </div>
        </div>

        <div class="indicator-item">
          <div class="detail-label">RSI（14日）</div>
          <div class="detail-value">
            ${formatDecimal(rsi14)}
          </div>
        </div>

        <div class="indicator-item">
          <div class="detail-label">ATR（14日）</div>
          <div class="detail-value">
            ${formatNumber(atr14)}円
          </div>
        </div>

        <div class="indicator-item">
          <div class="detail-label">MACD</div>
          <div class="detail-value">
            ${formatDecimal(latestMacd)}
          </div>
        </div>

        <div class="indicator-item">
          <div class="detail-label">シグナル</div>
          <div class="detail-value">
            ${formatDecimal(latestSignal)}
          </div>
        </div>

        <div class="indicator-item">
          <div class="detail-label">
            ヒストグラム
          </div>

          <div class="detail-value">
            ${formatSignedDecimal(latestHistogram)}
          </div>
        </div>
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
        現在のJ-Quants契約で取得可能な日付のデータです。
        無料プランでは最新市場価格ではない点に注意してください。
      </div>
    </section>
  </main>
</body>
</html>
  `;
}

function createPriceChart(data) {
  const values = data
    .flatMap((item) => [
      item.close,
      item.ma5,
      item.ma25
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

  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const range = rawMax - rawMin || 1;

  const minValue =
    rawMin - range * 0.08;

  const maxValue =
    rawMax + range * 0.08;

  const plotWidth =
    width - padding.left - padding.right;

  const plotHeight =
    height - padding.top - padding.bottom;

  const x = (index) =>
    padding.left +
    (index / (data.length - 1)) *
      plotWidth;

  const y = (value) =>
    padding.top +
    ((maxValue - value) /
      (maxValue - minValue)) *
      plotHeight;

  const makePoints = (key) =>
    data
      .map((item, index) => {
        if (!Number.isFinite(item[key])) {
          return null;
        }

        return `${x(index).toFixed(1)},${y(
          item[key]
        ).toFixed(1)}`;
      })
      .filter(Boolean)
      .join(" ");

  return `
    <svg viewBox="0 0 ${width} ${height}">
      ${createGridLines({
        width,
        padding,
        minValue,
        maxValue,
        y,
        formatter: (value) =>
          Math.round(value).toLocaleString("ja-JP")
      })}

      ${createDateLabels(data, x, height)}

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
    </svg>
  `;
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
    ...data.map((item) => item.volume)
  ) || 1;

  const plotWidth =
    width - padding.left - padding.right;

  const plotHeight =
    height - padding.top - padding.bottom;

  const step =
    plotWidth / data.length;

  const barWidth =
    Math.max(3, step * 0.65);

  const bars = data
    .map((item, index) => {
      const barHeight =
        (item.volume / maxVolume) *
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
          height="${Math.max(1, barHeight)}"
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
    <svg viewBox="0 0 ${width} ${height}">
      ${bars}
      ${createDateLabels(data, x, height)}
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

  const rawMin = Math.min(0, ...values);
  const rawMax = Math.max(0, ...values);
  const range = rawMax - rawMin || 1;

  const minValue =
    rawMin - range * 0.1;

  const maxValue =
    rawMax + range * 0.1;

  const plotWidth =
    width - padding.left - padding.right;

  const plotHeight =
    height - padding.top - padding.bottom;

  const x = (index) =>
    padding.left +
    (index / (data.length - 1)) *
      plotWidth;

  const y = (value) =>
    padding.top +
    ((maxValue - value) /
      (maxValue - minValue)) *
      plotHeight;

  const makePoints = (key) =>
    data
      .map((item, index) => {
        if (!Number.isFinite(item[key])) {
          return null;
        }

        return `${x(index).toFixed(1)},${y(
          item[key]
        ).toFixed(1)}`;
      })
      .filter(Boolean)
      .join(" ");

  return `
    <svg viewBox="0 0 ${width} ${height}">
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

      ${createDateLabels(data, x, height)}
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
      ((maxValue - minValue) / 4) * i;

    const gridY = y(value);

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

function createDateLabels(data, x, height) {
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
          ${escapeHtml(item.date.slice(5))}
        </text>
      `;
    })
    .join("");
}

function htmlError(message) {
  return new Response(
    `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>エラー｜Stock AI</title>
</head>

<body
  style="
    background:#0f172a;
    color:white;
    font-family:sans-serif;
    padding:30px;
  "
>
  <h1>データ取得エラー</h1>
  <p>${escapeHtml(message)}</p>
</body>
</html>
    `,
    {
      status: 500,
      headers: {
        "Content-Type":
          "text/html; charset=UTF-8"
      }
    }
  );
}

function formatNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "-";
  }

  return Math.round(number)
    .toLocaleString("ja-JP");
}

function formatDecimal(value) {
  if (!Number.isFinite(value)) {
    return "-";
  }

  return value.toFixed(2);
}

function formatSignedDecimal(value) {
  if (!Number.isFinite(value)) {
    return "-";
  }

  const sign =
    value >= 0 ? "+" : "";

  return `${sign}${value.toFixed(2)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
