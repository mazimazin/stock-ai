import { RANKING_STOCKS } from "./config.js";
import { fetchDailyBars } from "./api.js";

import {
  htmlError,
  formatNumber,
  formatSignedDecimal,
  escapeHtml
} from "./utils.js";

import {
  calculateSMA,
  calculateRSI,
  calculateBollingerBands,
  detectMovingAverageCross,
  calculateATR,
  calculateMACD,
  getLastFinite
} from "./indicators.js";

import { detectSupportResistance } from "./support.js";
import { createStrategy } from "./strategy.js";


export async function createRankingResponse(env) {
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
      .sort(
        (a, b) =>
          b.score - a.score
      )
      .map(
        (item, index) => ({
          ...item,
          rank: index + 1
        })
      );

    const failedResults =
      results.filter(
        (item) =>
          item.error
      );

    return new Response(
      createRankingHtml({
        rankings:
          successfulResults,

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
  stock,
  apiKey
) {
  const cache =
    caches.default;


  // =====================================
  // 開発中のキャッシュバージョン
  // v5へ変更して旧戦略の結果を破棄
  // =====================================

  const cacheKey =
    new Request(
      `https://stock-ai-cache.local/ranking-v5/${stock.apiCode}`,
      {
        method: "GET"
      }
    );


  const cachedResponse =
    await cache.match(
      cacheKey
    );


  if (cachedResponse) {
    return await cachedResponse.json();
  }


  const prices =
    await fetchDailyBars(
      stock.apiCode,
      apiKey
    );


  if (
    prices.length === 0
  ) {
    throw new Error(
      "株価データがありません"
    );
  }


  prices.sort(
    (a, b) =>
      new Date(a.Date) -
      new Date(b.Date)
  );


  const closes =
    prices.map(
      (price) =>
        Number(
          price.AdjC ??
          price.C
        )
    );


  const highs =
    prices.map(
      (price) =>
        Number(
          price.AdjH ??
          price.H
        )
    );


  const lows =
    prices.map(
      (price) =>
        Number(
          price.AdjL ??
          price.L
        )
    );


  const volumes =
    prices.map(
      (price) =>
        Number(
          price.AdjVo ??
          price.Vo
        )
    );


  const latest =
    prices[
      prices.length - 1
    ];


  const previous =
    prices.length >= 2
      ? prices[
          prices.length - 2
        ]
      : null;


  const latestClose =
    closes[
      closes.length - 1
    ];


  const previousClose =
    previous
      ? Number(
          previous.AdjC ??
          previous.C
        )
      : null;


  const change =
    previousClose !== null
      ? latestClose -
        previousClose
      : null;


  const changePercent =
    previousClose
      ? (
          change /
          previousClose
        ) * 100
      : null;


  // =====================================
  // テクニカル指標
  // =====================================

  const ma5 =
    calculateSMA(
      closes,
      5
    );


  const ma25 =
    calculateSMA(
      closes,
      25
    );


  const ma75 =
    calculateSMA(
      closes,
      75
    );


  const ma200 =
    calculateSMA(
      closes,
      200
    );


  const rsi14 =
    calculateRSI(
      closes,
      14
    );


  const bollinger =
    calculateBollingerBands(
      closes,
      20,
      2
    );


  const averageVolume20 =
    calculateSMA(
      volumes,
      20
    );


  const latestVolume =
    volumes[
      volumes.length - 1
    ];


  const volumeRatio =
    Number.isFinite(
      averageVolume20
    ) &&
    averageVolume20 > 0
      ? latestVolume /
        averageVolume20
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
    getLastFinite(
      macdData.macd
    );


  const latestSignal =
    getLastFinite(
      macdData.signal
    );


  const latestHistogram =
    getLastFinite(
      macdData.histogram
    );


  const recent20High =
    Math.max(
      ...highs.slice(-20)
    );


  // =====================================
  // サポート・レジスタンス
  // =====================================

  const supportResistance =
    detectSupportResistance(
      highs,
      lows,
      closes
    );


  // =====================================
  // 新しいstrategy.jsで戦略生成
  // =====================================

  const strategy =
    createStrategy({
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

      capital: 1000000,
      riskPercent: 1
    });


  const analysis = {
    code:
      stock.code,

    name:
      stock.name,

    date:
      latest.Date,

    latestClose,
    previousClose,

    change,
    changePercent,

    score:
      strategy.score,

    stars:
      strategy.stars,

    label:
      strategy.label,

    className:
      strategy.className,

    action:
      strategy.action,

    aiComment:
      strategy.aiComment,

    strengths:
      strategy.strengths,

    cautions:
      strategy.cautions,

    entryLow:
      strategy.entryLow,

    entryHigh:
      strategy.entryHigh,

    shortStop:
      strategy.shortStop,

    target1:
      strategy.target1,

    rsi14,
    volumeRatio,

    ma5,
    ma25,

    latestHistogram
  };


  // =====================================
  // 銘柄ごとに6時間キャッシュ
  // =====================================

  const responseToCache =
    new Response(
      JSON.stringify(
        analysis
      ),
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


function createRankingHtml({
  rankings,
  failedResults
}) {

  const rankingCards =
    rankings
      .map(
        (item) =>
          createRankingCard(
            item
          )
      )
      .join("");


  const failedCards =
    failedResults
      .map(
        (item) => `
          <div class="ranking-error">

            <strong>
              ${escapeHtml(
                item.name
              )}
            </strong>

            <span>
              ${escapeHtml(
                item.error
              )}
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
        repeat(
          3,
          minmax(0, 1fr)
        );

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
      ${escapeHtml(
        latestDate
      )}

      <br>

      日足のトレンド、移動平均線、
      RSI、MACD、出来高、
      ボリンジャーバンド、
      サポート・レジスタンスを
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

            <h2>
              取得できなかった銘柄
            </h2>

            ${failedCards}

          </section>
        `
        : ""
    }


    <div class="notice">

      この順位は、
      現在のコードに実装されている
      テクニカル指標と価格帯分析の
      スコア比較です。

      将来の値上がりを保証する予測ではありません。

      J-Quantsの日足データは
      プランに応じた提供範囲と
      更新時刻になります。

    </div>

  </main>

</body>

</html>
  `;
}


function createRankingCard(
  item
) {

  const isPositive =
    Number.isFinite(
      item.change
    ) &&
    item.change >= 0;


  const changeClass =
    isPositive
      ? "positive"
      : "negative";


  const sign =
    isPositive
      ? "+"
      : "";


  const changeText =
    Number.isFinite(
      item.change
    ) &&
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
    Number.isFinite(
      item.volumeRatio
    )
      ? `${item.volumeRatio.toFixed(
          2
        )}倍`
      : "-";


  const rsiText =
    Number.isFinite(
      item.rsi14
    )
      ? item.rsi14.toFixed(
          1
        )
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
          ${escapeHtml(
            item.name
          )}
        </div>


        <div class="stock-code">
          ${escapeHtml(
            item.code
          )}
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
            ${escapeHtml(
              item.label
            )}
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
              )}
              ～

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
          ${escapeHtml(
            item.action
          )}
        </div>


      </div>


    </article>
  `;
}
