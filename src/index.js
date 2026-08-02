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

      const latestClose = Number(latest.AdjC ?? latest.C);

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
          recentPrices
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

function createHtml({
  stockName,
  inputCode,
  latest,
  latestClose,
  previousClose,
  change,
  changePercent,
  recentPrices
}) {
  const isPositive = change !== null && change >= 0;

  const changeClass = isPositive
    ? "positive"
    : "negative";

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
      max-width: 900px;
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

    .details {
      display: grid;
      grid-template-columns:
        repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
      margin-top: 24px;
    }

    .detail-item {
      padding: 14px;
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

    @media (max-width: 600px) {
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
        ${change !== null
          ? `${changeSign}${formatNumber(change)}円`
          : "-"
        }

        ${changePercent !== null
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
            ${previousClose !== null
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
        この画面は投資判断を保証するものではありません。
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

  return number.toLocaleString("ja-JP");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
