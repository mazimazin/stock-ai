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

import {
  detectSupportResistance
} from "./support.js";

import {
  createStrategy
} from "./strategy.js";


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


    const successfulResults =
      results
        .filter(
          (item) =>
            !item.error &&
            Number.isFinite(
              item.score
            )
        )
        .sort(
          (a, b) => {

            // 総合スコアを最優先
            if (
              b.score !==
              a.score
            ) {
              return (
                b.score -
                a.score
              );
            }

            // 同点なら
            // エントリー評価を優先
            if (
              b.entryScore !==
              a.entryScore
            ) {
              return (
                b.entryScore -
                a.entryScore
              );
            }

            // それでも同じなら
            // トレンド評価
            return (
              b.trendScore -
              a.trendScore
            );
          }
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
  // キャッシュ
  // =====================================
  //
  // strategy.jsを3スコア方式へ変更したため
  // v6へ更新
  // =====================================

  const cacheKey =
    new Request(
      `https://stock-ai-cache.local/ranking-v6/${stock.apiCode}`,
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


  // =====================================
  // 株価データ取得
  // =====================================

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


  // =====================================
  // OHLCV
  // =====================================

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
  // 移動平均
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


  // =====================================
  // RSI
  // =====================================

  const rsi14 =
    calculateRSI(
      closes,
      14
    );


  // =====================================
  // ボリンジャーバンド
  // =====================================

  const bollinger =
    calculateBollingerBands(
      closes,
      20,
      2
    );


  // =====================================
  // 出来高
  // =====================================

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


  // =====================================
  // 移動平均クロス
  // =====================================

  const crossSignal =
    detectMovingAverageCross(
      closes,
      5,
      25
    );


  // =====================================
  // ATR
  // =====================================

  const atr14 =
    calculateATR(
      highs,
      lows,
      closes,
      14
    );


  // =====================================
  // MACD
  // =====================================

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


  // =====================================
  // 直近20日高値
  // =====================================

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
  // 戦略
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

      capital:
        1000000,

      riskPercent:
        1
    });


  // =====================================
  // ランキング用データ
  // =====================================

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


    // 総合
    score:
      strategy.score,


    // 3スコア
    trendScore:
      Number.isFinite(
        strategy.trendScore
      )
        ? strategy.trendScore
        : strategy.score,

    entryScore:
      Number.isFinite(
        strategy.entryScore
      )
        ? strategy.entryScore
        : strategy.score,


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

    latestHistogram,


    supportPrice:
      supportResistance
        ?.nearestSupport
        ?.price ?? null,

    resistancePrice:
      supportResistance
        ?.nearestResistance
        ?.price ?? null
  };


  // =====================================
  // 6時間キャッシュ
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


// =====================================
// ランキングHTML
// =====================================

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
      max-width: 1100px;

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
        90px
        minmax(180px, 0.8fr)
        minmax(410px, 1.7fr);

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
      font-size: 36px;
      font-weight: 900;
    }


    .rank-text {
      color: #94a3b8;

      font-size: 12px;
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

      gap: 12px;

      align-items: center;
      justify-content:
        space-between;
    }


    .score {
      font-size: 34px;
      font-weight: 900;
    }


    .score-caption {
      color: #94a3b8;

      font-size: 11px;
      font-weight: 700;
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


    /* ============================= */
    /* トレンド / エントリー評価     */
    /* ============================= */

    .sub-scores {
      display: grid;

      grid-template-columns:
        repeat(
          2,
          minmax(0, 1fr)
        );

      gap: 9px;

      margin-top: 14px;
    }


    .sub-score {
      padding: 12px;

      border-radius: 10px;

      background: #172033;
    }


    .sub-score-label {
      color: #94a3b8;

      font-size: 12px;
    }


    .sub-score-value {
      margin-top: 4px;

      font-size: 22px;
      font-weight: 900;
    }


    .trend-value {
      color: #c084fc;
    }


    .entry-value {
      color: #38bdf8;
    }


    /* ============================= */
    /* 売買価格                      */
    /* ============================= */

    .price-grid {
      display: grid;

      grid-template-columns:
        repeat(
          3,
          minmax(0, 1fr)
        );

      gap: 9px;

      margin-top: 14px;
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


    /* ============================= */
    /* 指標                          */
    /* ============================= */

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


    .action {
      margin-top: 14px;

      color: #cbd5e1;

      line-height: 1.65;
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
      max-width: 850px
    ) {

      body {
        padding: 14px;
      }


      h1 {
        font-size: 25px;
      }


      .ranking-card {
        grid-template-columns:
          1fr;
      }


      .rank-area {
        min-height: 80px;
      }


      .price-grid {
        grid-template-columns:
          1fr;
      }
    }


    @media (
      max-width: 500px
    ) {

      .sub-scores {
        grid-template-columns:
          1fr;
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

      総合スコアは
      トレンド評価60％、
      エントリー評価40％で算出しています。

      トレンドの強さと、
      現在位置からの入りやすさを
      分けて比較できます。

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

      総合順位は、
      現在実装されているテクニカル指標、
      サポート・レジスタンス、
      トレンド評価、
      エントリー評価を使った
      ルールベースの比較です。

      将来の株価上昇を保証するものではありません。

      J-Quantsの日足データは、
      契約プランに応じた提供範囲と
      更新時刻のデータを使用します。

    </div>


  </main>

</body>

</html>
  `;
}


// =====================================
// ランキングカード
// =====================================

function createRankingCard(item) {

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

          <div>

            <div class="score">
              ${item.score}点
            </div>

            <div class="score-caption">
              総合スコア
            </div>

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


        <div class="sub-scores">


          <div class="sub-score">

            <div class="sub-score-label">
              トレンド評価
            </div>

            <div
              class="
                sub-score-value
                trend-value
              "
            >
              ${item.trendScore}点
            </div>

          </div>


          <div class="sub-score">

            <div class="sub-score-label">
              エントリー評価
            </div>

            <div
              class="
                sub-score-value
                entry-value
              "
            >
              ${item.entryScore}点
            </div>

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
