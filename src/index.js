export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const inputCode = (url.searchParams.get("code") || "285A")
      .trim()
      .toUpperCase();

    const code = inputCode.length === 4 ? `${inputCode}0` : inputCode;

    const stockNames = {
      "285A": "キオクシアホールディングス",
      "6857": "アドバンテスト",
      "6146": "ディスコ",
      "6920": "レーザーテック",
      "8035": "東京エレクトロン",
      "7013": "IHI",
      "7011": "三菱重工業"
    };

    const stockName = stockNames[inputCode] || `銘柄コード ${inputCode}`;

    if (!env.JQUANTS_API_KEY) {
      return htmlError("JQUANTS_API_KEYが設定されていません");
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

      const prices = Array.isArray(result.data) ? result.data : [];

      if (prices.length === 0) {
        return htmlError(
          `${inputCode}の株価データが見つかりませんでした`
        );
      }

      prices.sort(
        (a, b) => new Date(a.Date) - new Date(b.Date)
      );

      const latest = prices[prices.length - 1];
      const previous =
        prices.length >= 2 ? prices[prices.length - 2] : null;

      const closes = prices.map((price) =>
        Number(price.AdjC ?? price.C)
      );

      const latestClose = closes[closes.length - 1];

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

      const judgment = createJudgment({
        latestClose,
        ma5,
        ma25,
        rsi14
      });

      const recentPrices = prices
        .slice(-10)
        .reverse();

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
          judgment
        }),
        {
          headers: {
            "Content-Type": "text/html; charset=UTF-8",
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
  const total = selected.reduce((sum, value) => sum + value, 0);

  return total / period;
}

function calculateRSI(values, period = 14) {
  if (values.length <= period) {
    return null;
  }

  const recent = values.slice(-(period + 1));

  let gains = 0;
  let losses = 0;

  for (let i = 1; i < recent.length; i++) {
    const difference = recent[i] - recent[i - 1];

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

  const relativeStrength = averageGain / averageLoss;

  return 100 - 100 / (1 + relativeStrength);
}

function createJudgment({
  latestClose,
  ma5,
  ma25,
  rsi14
}) {
  let score = 50;
  const reasons = [];

  if (ma5 !== null) {
    if (latestClose > ma5) {
      score += 10;
      reasons.push("株価が5日移動平均線を上回っています");
    } else {
      score -= 10;
      reasons.push("株価が5日移動平均線を下回っています");
    }
  }

  if (ma5 !== null && ma25 !== null) {
    if (ma5 > ma25) {
      score += 15;
      reasons.push("5日線が25日線を上回っています");
    } else {
      score -= 15;
      reasons.push("5日線が25日線を下回っています");
    }
  }

  if (rsi14 !== null) {
    if (rsi14 < 30) {
      score += 15;
      reasons.push("RSIが売られすぎ水準です");
    } else if (rsi14 > 70) {
      score -= 15;
      reasons.push("RSIが買われすぎ水準です");
    } else if (rsi14 >= 45 && rsi14 <= 65) {
      score += 5;
      reasons.push("RSIは比較的安定した水準です");
    }
  }

  score = Math.max(0, Math.min(100, score));

  if (score >= 70) {
    return {
      label: "買い寄り",
      className: "buy",
      score,
      reasons
    };
  }

  if (score >= 45) {
    return {
      label: "様子見",
      className: "wait",
      score,
      reasons
    };
  }

  return {
    label: "注意",
    className: "danger",
    score,
    reasons
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
  judgment
}) {
  const isPositive = change !== null && change >= 0;
  const changeClass = isPositive ? "positive" : "negative";
  const changeSign = isPositive ? "+" : "";

  const rows = recentPrices
    .map((price) => {
      const open = Number(price.AdjO ?? price.O);
      const high = Number(price.AdjH ?? price.H);
      const low = Number(price.AdjL ?? price.L);
      const close = Number(price.AdjC ?? price.C);
      const volume = Number(price.AdjVo ?? price.Vo);

      return `
        <tr>
          <td>${escapeHtml(price.Date)}</td>
          <td>${formatNumber(open)}</td>
          <td>${formatNumber(high)}</td>
          <td>${formatNumber(low)}</td>
          <td class="close">${formatNumber(close)}</td>
          <td>${formatNumber(volume)}</td>
        </tr>
      `;
    })
    .join("");

  const reasonItems = judgment.reasons
    .map((reason) => `<li>${escapeHtml(reason)}</li>`)
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

  <title>${escapeHtml(stockName)}｜Stock AI</title>

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

    .code {
      color: #94a3b8;
      font-size: 15px;
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
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
    }

    .card {
      margin-bottom: 20px;
      padding: 24px;
      border: 1px solid #334155;
      border-radius: 16px;
      background: #1e293b;
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.2);
    }

    .date {
      color: #94a3b8;
      font-size: 14px;
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
    .indicator-grid {
      display: grid;
      grid-template-columns:
        repeat(auto-fit, minmax(145px, 1fr));
      gap: 12px;
      margin-top: 24px;
    }

    .detail-item,
    .indicator-item {
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

    .judgment {
      display: grid;
      grid-template-columns: 180px 1fr;
      gap: 20px;
      align-items: center;
    }

    .judgment-badge {
      padding: 28px 12px;
      border-radius: 16px;
      text-align: center;
    }

    .judgment-label {
      font-size: 26px;
      font-weight: 800;
    }

    .judgment-score {
      margin-top: 8px;
      font-size: 17px;
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

    .reasons {
      margin: 0;
      padding-left: 22px;
      line-height: 1.9;
      color: #cbd5e1;
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
      color: #94a3b8;
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
    <h1 class="title">${escapeHtml(stockName)}</h1>
    <div class="code">証券コード：${escapeHtml(inputCode)}</div>

    <form class="search" method="GET">
      <input
        type="text"
        name="code"
        value="${escapeHtml(inputCode)}"
        placeholder="例：285A、6857"
        maxlength="5"
      >
      <button type="submit">株価を表示</button>
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
            ${
              previousClose !== null
                ? `${formatNumber(previousClose)}円`
                : "-"
            }
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
      <h2>テクニカル指標</h2>

      <div class="indicator-grid">
        <div class="indicator-item">
          <div class="detail-label">5日移動平均</div>
          <div class="detail-value">
            ${ma5 !== null ? `${formatNumber(ma5)}円` : "-"}
          </div>
        </div>

        <div class="indicator-item">
          <div class="detail-label">25日移動平均</div>
          <div class="detail-value">
            ${ma25 !== null ? `${formatNumber(ma25)}円` : "-"}
          </div>
        </div>

        <div class="indicator-item">
          <div class="detail-label">RSI（14日）</div>
          <div class="detail-value">
            ${rsi14 !== null ? rsi14.toFixed(1) : "-"}
          </div>
        </div>
      </div>
    </section>

    <section class="card">
      <h2>簡易判定</h2>

      <div class="judgment">
        <div class="judgment-badge ${judgment.className}">
          <div class="judgment-label">
            ${escapeHtml(judgment.label)}
          </div>

          <div class="judgment-score">
            判定スコア ${judgment.score}点
          </div>
        </div>

        <ul class="reasons">
          ${reasonItems}
        </ul>
      </div>

      <div class="notice">
        この判定は移動平均線とRSIだけを使った簡易評価です。
        売買を保証するものではありません。
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
        現在のJ-Quants契約で取得可能な日付のデータを表示しています。
      </div>
    </section>
  </main>
</body>
</html>
  `;
}

function htmlError(message) {
  return new Response(
    `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >
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
  <p>
    <a href="/" style="color:#60a5fa;">
      トップへ戻る
    </a>
  </p>
</body>
</html>
    `,
    {
      status: 500,
      headers: {
        "Content-Type": "text/html; charset=UTF-8",
        "Cache-Control": "no-store"
      }
    }
  );
}

function formatNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "-";
  }

  return Math.round(number).toLocaleString("ja-JP");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
