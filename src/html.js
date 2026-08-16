import {
  formatNumber,
  formatDecimal,
  formatSignedDecimal,
  formatRatio,
  formatCrossSignal,
  escapeHtml
} from "./utils.js";


export function createHtml({
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
  supportResistance,
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
    isPositive
      ? "+"
      : "";


  const trendScore =
    Number.isFinite(
      strategy.trendScore
    )
      ? strategy.trendScore
      : strategy.score;


  const entryScore =
    Number.isFinite(
      strategy.entryScore
    )
      ? strategy.entryScore
      : strategy.score;


  // =====================================
  // 最低売買単位100株のリスク判定
  // =====================================

  const minimumLotLoss =
    Number.isFinite(
      strategy.loss100Short
    )
      ? strategy.loss100Short
      : null;


  const allowedLoss =
    Number.isFinite(
      strategy.allowedLoss
    )
      ? strategy.allowedLoss
      : null;


  const minimumLotRiskExceeded =
    minimumLotLoss !== null &&
    allowedLoss !== null &&
    allowedLoss > 0 &&
    minimumLotLoss > allowedLoss;


  const minimumLotRiskMultiple =
    minimumLotRiskExceeded
      ? minimumLotLoss /
        allowedLoss
      : null;


  const minimumLotCapitalRiskPercent =
    minimumLotLoss !== null &&
    Number.isFinite(capital) &&
    capital > 0
      ? (
          minimumLotLoss /
          capital
        ) * 100
      : null;


  const rows =
    recentPrices
      .map((price) => {

        const open =
          Number(
            price.AdjO ??
            price.O
          );


        const high =
          Number(
            price.AdjH ??
            price.H
          );


        const low =
          Number(
            price.AdjL ??
            price.L
          );


        const close =
          Number(
            price.AdjC ??
            price.C
          );


        const volume =
          Number(
            price.AdjVo ??
            price.Vo
          );


        return `
          <tr>

            <td>
              ${escapeHtml(
                price.Date
              )}
            </td>

            <td>
              ${formatNumber(
                open
              )}
            </td>

            <td>
              ${formatNumber(
                high
              )}
            </td>

            <td>
              ${formatNumber(
                low
              )}
            </td>

            <td class="close">
              ${formatNumber(
                close
              )}
            </td>

            <td>
              ${formatNumber(
                volume
              )}
            </td>

          </tr>
        `;
      })
      .join("");


  const reasonItems =
    (
      strategy.reasons ||
      []
    )
      .map(
        (reason) =>
          `<li>${escapeHtml(
            reason
          )}</li>`
      )
      .join("");


  const cautionItems =
    (
      strategy.cautions ||
      []
    )
      .map(
        (reason) =>
          `<li>${escapeHtml(
            reason
          )}</li>`
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
        1fr
        1fr
        1fr
        auto;

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


    .buy {
      border:
        1px solid #22c55e;

      background:
        rgba(34, 197, 94, 0.18);

      color: #4ade80;
    }


    .wait {
      border:
        1px solid #eab308;

      background:
        rgba(234, 179, 8, 0.18);

      color: #facc15;
    }


    .danger {
      border:
        1px solid #ef4444;

      background:
        rgba(239, 68, 68, 0.18);

      color: #f87171;
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


    /* ================================= */
    /* リスク警告                        */
    /* ================================= */

    .risk-warning {
      margin-top: 18px;
      margin-bottom: 20px;

      padding: 20px;

      border:
        2px solid #ef4444;

      border-radius: 14px;

      background:
        rgba(239, 68, 68, 0.12);
    }


    .risk-warning-title {
      color: #f87171;

      font-size: 20px;
      font-weight: 900;
    }


    .risk-warning-main {
      margin-top: 12px;

      color: #fca5a5;

      font-size: 16px;
      font-weight: 700;

      line-height: 1.7;
    }


    .risk-warning-grid {
      display: grid;

      grid-template-columns:
        repeat(
          auto-fit,
          minmax(170px, 1fr)
        );

      gap: 10px;

      margin-top: 15px;
    }


    .risk-warning-box {
      padding: 12px;

      border-radius: 10px;

      background:
        rgba(15, 23, 42, 0.7);
    }


    .risk-warning-label {
      color: #94a3b8;

      font-size: 12px;
    }


    .risk-warning-value {
      margin-top: 4px;

      color: #f87171;

      font-size: 20px;
      font-weight: 900;
    }


    .risk-warning-note {
      margin-top: 14px;

      color: #fca5a5;

      font-size: 13px;
      line-height: 1.7;
    }


    table {
      width: 100%;

      min-width: 680px;

      border-collapse: collapse;
    }


    .table-wrap {
      overflow-x: auto;
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


    /* ================================= */
    /* AI評価                            */
    /* ================================= */

    .simple-card {
      padding: 30px;

      border:
        2px solid #334155;

      background:
        linear-gradient(
          145deg,
          #1e293b,
          #172033
        );
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


    .simple-top {
      display: grid;

      grid-template-columns:
        minmax(240px, 0.8fr)
        minmax(320px, 1.2fr);

      gap: 24px;

      align-items: stretch;
    }


    .simple-judgment {
      display: flex;

      min-height: 260px;

      flex-direction: column;
      justify-content: center;

      padding: 24px;

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

      font-size: 29px;
      font-weight: 900;

      line-height: 1.25;
    }


    .main-score {
      margin-top: 5px;

      font-size: 34px;
      font-weight: 900;
    }


    .score-name {
      margin-top: 4px;

      font-size: 13px;
      font-weight: 700;

      opacity: 0.85;
    }


    .score-breakdown {
      display: grid;

      grid-template-columns:
        repeat(
          2,
          1fr
        );

      gap: 9px;

      margin-top: 18px;
    }


    .score-breakdown-box {
      padding: 12px 8px;

      border-radius: 10px;

      background:
        rgba(
          15,
          23,
          42,
          0.55
        );
    }


    .score-breakdown-label {
      font-size: 12px;
      font-weight: 700;

      opacity: 0.8;
    }


    .score-breakdown-value {
      margin-top: 3px;

      font-size: 22px;
      font-weight: 900;
    }


    .simple-main {
      display: grid;

      grid-template-columns:
        repeat(
          2,
          minmax(0, 1fr)
        );

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
      grid-column:
        1 / -1;
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


    .ai-comment-title {
      margin-bottom: 7px;

      color: #60a5fa;

      font-size: 14px;
      font-weight: 900;
    }


    .strength-title {
      margin-top: 20px;

      color: #4ade80;
    }


    .reasons,
    .cautions {
      padding-left: 22px;

      line-height: 1.8;
    }


    .cautions {
      color: #fbbf24;
    }


    details.analysis-details {
      margin-top: 18px;

      padding-top: 16px;

      border-top:
        1px solid #334155;
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
        grid-template-columns:
          1fr;
      }


      .simple-card {
        padding: 18px;
      }


      .simple-top {
        grid-template-columns:
          1fr;
      }


      .simple-main {
        grid-template-columns:
          1fr;
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


      .score-breakdown {
        grid-template-columns:
          1fr;
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
        value="${escapeHtml(
          inputCode
        )}"
        placeholder="証券コード"
        maxlength="5"
      >


      <input
        type="number"
        name="capital"
        value="${Math.round(
          capital
        )}"
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


    <!-- ================================= -->
    <!-- AI評価                            -->
    <!-- ================================= -->

    <section class="card simple-card">


      <div class="simple-price-row">

        <span class="date">

          最新取得日：
          ${escapeHtml(
            latest.Date
          )}

        </span>


        <span class="simple-current-price">

          ${formatNumber(
            latestClose
          )}円

        </span>


        <span
          class="
            change
            ${changeClass}
          "
        >

          ${
            change !== null
              ? `${changeSign}${formatNumber(
                  change
                )}円`
              : "-"
          }

          ${
            changePercent !== null
              ? `（${changeSign}${changePercent.toFixed(
                  2
                )}%）`
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
            AI総合評価
          </div>


          <div class="simple-label">

            ${escapeHtml(
              strategy.label
            )}

          </div>


          <div class="main-score">
            ${strategy.score}点
          </div>


          <div class="score-name">
            総合スコア
          </div>


          <div class="score-breakdown">


            <div class="score-breakdown-box">

              <div class="score-breakdown-label">
                トレンド評価
              </div>

              <div class="score-breakdown-value">
                ${trendScore}点
              </div>

            </div>


            <div class="score-breakdown-box">

              <div class="score-breakdown-label">
                エントリー評価
              </div>

              <div class="score-breakdown-value">
                ${entryScore}点
              </div>

            </div>


          </div>

        </div>


        <div class="simple-main">


          <div
            class="
              simple-box
              simple-box-wide
            "
          >

            <div class="simple-box-label">
              買い候補
            </div>

            <div
              class="
                simple-box-value
                entry
              "
            >

              ${formatNumber(
                strategy.entryLow
              )}円

              ～

              ${formatNumber(
                strategy.entryHigh
              )}円

            </div>

          </div>


          <div class="simple-box">

            <div class="simple-box-label">
              損切り目安
            </div>

            <div
              class="
                simple-box-value
                short-stop
              "
            >

              ${formatNumber(
                strategy.shortStop
              )}円

            </div>

          </div>


          <div class="simple-box">

            <div class="simple-box-label">
              利確目安
            </div>

            <div
              class="
                simple-box-value
                target
              "
            >

              ${formatNumber(
                strategy.target1
              )}円

            </div>

          </div>


        </div>

      </div>


      <div class="simple-action">

        <div class="ai-comment-title">
          AIコメント
        </div>


        <div>

          ${escapeHtml(
            strategy.aiComment ||
            strategy.action
          )}

        </div>

      </div>


      <details class="analysis-details">

        <summary>
          AI分析の詳細を見る
        </summary>


        <h3 class="strength-title">
          強み
        </h3>


        <ul class="reasons">
          ${reasonItems}
        </ul>


        ${
          cautionItems
            ? `
              <h3>
                注意点
              </h3>

              <ul class="cautions">
                ${cautionItems}
              </ul>
            `
            : ""
        }

      </details>

    </section>


    <!-- ================================= -->
    <!-- 価格帯分析                        -->
    <!-- ================================= -->

    <section class="card">

      <h2>
        価格帯分析
      </h2>


      <div class="indicator-grid">


        ${detailBox(
          "直近サポート",
          supportResistance
            .nearestSupport
            ? `${formatNumber(
                supportResistance
                  .nearestSupport
                  .price
              )}円`
            : "-"
        )}


        ${detailBox(
          "第2サポート",
          supportResistance
            .supports[1]
            ? `${formatNumber(
                supportResistance
                  .supports[1]
                  .price
              )}円`
            : "-"
        )}


        ${detailBox(
          "第3サポート",
          supportResistance
            .supports[2]
            ? `${formatNumber(
                supportResistance
                  .supports[2]
                  .price
              )}円`
            : "-"
        )}


        ${detailBox(
          "直近レジスタンス",
          supportResistance
            .nearestResistance
            ? `${formatNumber(
                supportResistance
                  .nearestResistance
                  .price
              )}円`
            : "-"
        )}


        ${detailBox(
          "第2レジスタンス",
          supportResistance
            .resistances[1]
            ? `${formatNumber(
                supportResistance
                  .resistances[1]
                  .price
              )}円`
            : "-"
        )}


        ${detailBox(
          "第3レジスタンス",
          supportResistance
            .resistances[2]
            ? `${formatNumber(
                supportResistance
                  .resistances[2]
                  .price
              )}円`
            : "-"
        )}


        ${detailBox(
          "サポートまで",
          Number.isFinite(
            supportResistance
              .supportDistancePercent
          )
            ? `${supportResistance
                .supportDistancePercent
                .toFixed(2)}%`
            : "-"
        )}


        ${detailBox(
          "レジスタンスまで",
          Number.isFinite(
            supportResistance
              .resistanceDistancePercent
          )
            ? `+${supportResistance
                .resistanceDistancePercent
                .toFixed(2)}%`
            : "-"
        )}


      </div>


      <div class="notice">

        直近60営業日の高値・安値から、
        現在値の上下15％以内にある
        価格帯を自動検出しています。

        将来の反発や反落を保証するものではありません。

      </div>

    </section>


    <!-- ================================= -->
    <!-- 現在値                            -->
    <!-- ================================= -->

    <section class="card">

      <h2>
        現在値の詳細
      </h2>


      <div class="details">


        ${detailBox(
          "始値",
          `${formatNumber(
            latest.AdjO ??
            latest.O
          )}円`
        )}


        ${detailBox(
          "高値",
          `${formatNumber(
            latest.AdjH ??
            latest.H
          )}円`
        )}


        ${detailBox(
          "安値",
          `${formatNumber(
            latest.AdjL ??
            latest.L
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
            latest.AdjVo ??
            latest.Vo
          )}株`
        )}


      </div>

    </section>


    <!-- ================================= -->
    <!-- リスク管理                        -->
    <!-- ================================= -->

    <section class="card">

      <h2>
        リスク管理
      </h2>


      ${
        minimumLotRiskExceeded
          ? `
            <div class="risk-warning">


              <div class="risk-warning-title">

                ⚠ 100株では
                リスク上限を超えます

              </div>


              <div class="risk-warning-main">

                現在設定している
                「1回の許容損失
                ${riskPercent}%」
                では、

                日本株の最低売買単位
                100株を取引した場合の
                損失想定が
                許容範囲を超えています。

              </div>


              <div class="risk-warning-grid">


                <div class="risk-warning-box">

                  <div class="risk-warning-label">
                    100株の短期損失
                  </div>

                  <div class="risk-warning-value">

                    ${formatNumber(
                      minimumLotLoss
                    )}円

                  </div>

                </div>


                <div class="risk-warning-box">

                  <div class="risk-warning-label">
                    許容損失
                  </div>

                  <div class="risk-warning-value">

                    ${formatNumber(
                      allowedLoss
                    )}円

                  </div>

                </div>


                <div class="risk-warning-box">

                  <div class="risk-warning-label">
                    許容損失に対して
                  </div>

                  <div class="risk-warning-value">

                    約${
                      minimumLotRiskMultiple
                        .toFixed(1)
                    }倍

                  </div>

                </div>


                <div class="risk-warning-box">

                  <div class="risk-warning-label">
                    投資資金に対するリスク
                  </div>

                  <div class="risk-warning-value">

                    ${
                      Number.isFinite(
                        minimumLotCapitalRiskPercent
                      )
                        ? minimumLotCapitalRiskPercent
                            .toFixed(1)
                        : "-"
                    }%

                  </div>

                </div>


              </div>


              <div class="risk-warning-note">

                この条件では、
                100株単位で取引すると
                設定したリスク管理基準に
                収まりません。

                損切り位置を近づける、
                投資資金を増やす、
                または取引を見送るなどの
                判断が必要です。

              </div>


            </div>
          `
          : ""
      }


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

        日本株の100株単位に
        切り下げています。

      </div>

    </section>


    <!-- ================================= -->
    <!-- 株価チャート                      -->
    <!-- ================================= -->

    <section class="card">

      <h2>
        株価チャート
      </h2>


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

        ${createPriceChart(
          chartData
        )}

      </div>

    </section>


    <!-- ================================= -->
    <!-- 出来高                            -->
    <!-- ================================= -->

    <section class="card">

      <h2>
        出来高
      </h2>


      <div class="chart-wrap">

        ${createVolumeChart(
          chartData
        )}

      </div>

    </section>


    <!-- ================================= -->
    <!-- MACD                              -->
    <!-- ================================= -->

    <section class="card">

      <h2>
        MACD
      </h2>


      <div class="chart-legend">

        <span class="legend-macd">
          ● MACD
        </span>

        <span class="legend-signal">
          ● シグナル
        </span>

      </div>


      <div class="chart-wrap">

        ${createMacdChart(
          chartData
        )}

      </div>

    </section>


    <!-- ================================= -->
    <!-- テクニカル                        -->
    <!-- ================================= -->

    <section class="card">

      <h2>
        テクニカル指標
      </h2>


      <div class="indicator-grid">


        ${detailBox(
          "5日移動平均",
          `${formatNumber(
            ma5
          )}円`
        )}


        ${detailBox(
          "25日移動平均",
          `${formatNumber(
            ma25
          )}円`
        )}


        ${detailBox(
          "75日移動平均",
          `${formatNumber(
            ma75
          )}円`
        )}


        ${detailBox(
          "200日移動平均",
          `${formatNumber(
            ma200
          )}円`
        )}


        ${detailBox(
          "ボリンジャー上限（+2σ）",
          `${formatNumber(
            bollinger.upper
          )}円`
        )}


        ${detailBox(
          "ボリンジャー中心線",
          `${formatNumber(
            bollinger.middle
          )}円`
        )}


        ${detailBox(
          "ボリンジャー下限（-2σ）",
          `${formatNumber(
            bollinger.lower
          )}円`
        )}


        ${detailBox(
          "出来高20日平均",
          `${formatNumber(
            averageVolume20
          )}株`
        )}


        ${detailBox(
          "出来高倍率",
          Number.isFinite(
            volumeRatio
          )
            ? `${volumeRatio.toFixed(
                2
              )}倍`
            : "-"
        )}


        ${detailBox(
          "移動平均クロス",
          formatCrossSignal(
            crossSignal
          )
        )}


        ${detailBox(
          "RSI（14日）",
          formatDecimal(
            rsi14
          )
        )}


        ${detailBox(
          "ATR（14日）",
          `${formatNumber(
            atr14
          )}円`
        )}


        ${detailBox(
          "MACD",
          formatDecimal(
            latestMacd
          )
        )}


        ${detailBox(
          "シグナル",
          formatDecimal(
            latestSignal
          )
        )}


        ${detailBox(
          "ヒストグラム",
          formatSignedDecimal(
            latestHistogram
          )
        )}


      </div>

    </section>


    <!-- ================================= -->
    <!-- 最近10営業日                      -->
    <!-- ================================= -->

    <section class="card">

      <h2>
        直近10営業日
      </h2>


      <div class="table-wrap">

        <table>

          <thead>

            <tr>

              <th>
                日付
              </th>

              <th>
                始値
              </th>

              <th>
                高値
              </th>

              <th>
                安値
              </th>

              <th>
                終値
              </th>

              <th>
                出来高
              </th>

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

        無料プランでは
        現在価格ではありません。

      </div>

    </section>


  </main>

</body>

</html>
  `;
}


/* ===================================== */
/* 共通BOX                               */
/* ===================================== */

function detailBox(
  label,
  value
) {

  return `
    <div class="detail-item">

      <div class="detail-label">

        ${escapeHtml(
          label
        )}

      </div>

      <div class="detail-value">

        ${escapeHtml(
          value
        )}

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

        ${escapeHtml(
          label
        )}

      </div>

      <div
        class="
          detail-value
          ${className}
        "
      >

        ${escapeHtml(
          value
        )}

      </div>

    </div>
  `;
}


/* ===================================== */
/* 株価チャート                          */
/* ===================================== */

function createPriceChart(
  data
) {

  const values =
    data
      .flatMap(
        (item) => [
          item.close,
          item.ma5,
          item.ma25,
          item.ma75,
          item.ma200,
          item.bollinger?.upper,
          item.bollinger?.lower
        ]
      )
      .filter(
        Number.isFinite
      );


  if (
    values.length < 2
  ) {
    return `
      <p>
        チャートデータが不足しています。
      </p>
    `;
  }


  const width =
    900;


  const height =
    360;


  const padding = {
    top: 25,
    right: 75,
    bottom: 50,
    left: 20
  };


  const rawMin =
    Math.min(
      ...values
    );


  const rawMax =
    Math.max(
      ...values
    );


  const range =
    rawMax -
    rawMin ||
    1;


  const minValue =
    rawMin -
    range * 0.08;


  const maxValue =
    rawMax +
    range * 0.08;


  const plotWidth =
    width -
    padding.left -
    padding.right;


  const plotHeight =
    height -
    padding.top -
    padding.bottom;


  const x =
    (index) =>
      padding.left +
      (
        index /
        Math.max(
          1,
          data.length - 1
        )
      ) *
      plotWidth;


  const y =
    (value) =>
      padding.top +
      (
        (
          maxValue -
          value
        ) /
        (
          maxValue -
          minValue
        )
      ) *
      plotHeight;


  const makePoints =
    (key) =>
      data
        .map(
          (
            item,
            index
          ) => {

            if (
              !Number.isFinite(
                item[key]
              )
            ) {
              return null;
            }


            return `${
              x(
                index
              ).toFixed(1)
            },${
              y(
                item[key]
              ).toFixed(1)
            }`;
          }
        )
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

        formatter:
          (value) =>
            Math.round(
              value
            ).toLocaleString(
              "ja-JP"
            )
      })}


      ${createDateLabels(
        data,
        x,
        height
      )}


      <polyline
        points="${
          makePoints(
            "close"
          )
        }"
        fill="none"
        stroke="#e2e8f0"
        stroke-width="3"
      />


      <polyline
        points="${
          makePoints(
            "ma5"
          )
        }"
        fill="none"
        stroke="#38bdf8"
        stroke-width="2.5"
      />


      <polyline
        points="${
          makePoints(
            "ma25"
          )
        }"
        fill="none"
        stroke="#facc15"
        stroke-width="2.5"
      />


      <polyline
        points="${
          makePoints(
            "ma75"
          )
        }"
        fill="none"
        stroke="#a855f7"
        stroke-width="2.2"
      />


      <polyline
        points="${
          makePoints(
            "ma200"
          )
        }"
        fill="none"
        stroke="#fb7185"
        stroke-width="2.2"
      />


      <polyline
        points="${
          makeNestedPoints(
            data,
            x,
            y,
            "bollinger",
            "upper"
          )
        }"
        fill="none"
        stroke="#94a3b8"
        stroke-width="1.4"
        stroke-dasharray="6 5"
      />


      <polyline
        points="${
          makeNestedPoints(
            data,
            x,
            y,
            "bollinger",
            "lower"
          )
        }"
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
    .map(
      (
        item,
        index
      ) => {

        const value =
          item[
            parentKey
          ]?.[
            childKey
          ];


        if (
          !Number.isFinite(
            value
          )
        ) {
          return null;
        }


        return `${
          x(
            index
          ).toFixed(1)
        },${
          y(
            value
          ).toFixed(1)
        }`;
      }
    )
    .filter(Boolean)
    .join(" ");
}


/* ===================================== */
/* 出来高チャート                        */
/* ===================================== */

function createVolumeChart(
  data
) {

  const width =
    900;


  const height =
    250;


  const padding = {
    top: 20,
    right: 75,
    bottom: 50,
    left: 20
  };


  const maxVolume =
    Math.max(
      ...data.map(
        (item) =>
          Number.isFinite(
            item.volume
          )
            ? item.volume
            : 0
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
    plotWidth /
    Math.max(
      1,
      data.length
    );


  const barWidth =
    Math.max(
      3,
      step * 0.65
    );


  const bars =
    data
      .map(
        (
          item,
          index
        ) => {

          const volume =
            Number.isFinite(
              item.volume
            )
              ? item.volume
              : 0;


          const barHeight =
            (
              volume /
              maxVolume
            ) *
            plotHeight;


          const barX =
            padding.left +
            index *
            step +
            (
              step -
              barWidth
            ) /
            2;


          const barY =
            padding.top +
            plotHeight -
            barHeight;


          const fill =
            item.close >=
            item.open
              ? "#22c55e"
              : "#ef4444";


          return `
            <rect
              x="${barX}"
              y="${barY}"
              width="${barWidth}"
              height="${
                Math.max(
                  1,
                  barHeight
                )
              }"
              fill="${fill}"
              opacity="0.8"
            />
          `;
        }
      )
      .join("");


  const x =
    (index) =>
      padding.left +
      index *
      step +
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


/* ===================================== */
/* MACDチャート                          */
/* ===================================== */

function createMacdChart(
  data
) {

  const values =
    data
      .flatMap(
        (item) => [
          item.macd,
          item.signal,
          item.histogram
        ]
      )
      .filter(
        Number.isFinite
      );


  if (
    values.length < 2
  ) {
    return `
      <p>
        MACDデータが不足しています。
      </p>
    `;
  }


  const width =
    900;


  const height =
    320;


  const padding = {
    top: 25,
    right: 75,
    bottom: 50,
    left: 20
  };


  const rawMin =
    Math.min(
      0,
      ...values
    );


  const rawMax =
    Math.max(
      0,
      ...values
    );


  const range =
    rawMax -
    rawMin ||
    1;


  const minValue =
    rawMin -
    range * 0.1;


  const maxValue =
    rawMax +
    range * 0.1;


  const plotWidth =
    width -
    padding.left -
    padding.right;


  const plotHeight =
    height -
    padding.top -
    padding.bottom;


  const x =
    (index) =>
      padding.left +
      (
        index /
        Math.max(
          1,
          data.length - 1
        )
      ) *
      plotWidth;


  const y =
    (value) =>
      padding.top +
      (
        (
          maxValue -
          value
        ) /
        (
          maxValue -
          minValue
        )
      ) *
      plotHeight;


  const makePoints =
    (key) =>
      data
        .map(
          (
            item,
            index
          ) => {

            if (
              !Number.isFinite(
                item[key]
              )
            ) {
              return null;
            }


            return `${
              x(
                index
              ).toFixed(1)
            },${
              y(
                item[key]
              ).toFixed(1)
            }`;
          }
        )
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

        formatter:
          (value) =>
            value.toFixed(0)
      })}


      <line
        x1="${padding.left}"
        y1="${y(0)}"
        x2="${
          width -
          padding.right
        }"
        y2="${y(0)}"
        stroke="#64748b"
      />


      <polyline
        points="${
          makePoints(
            "macd"
          )
        }"
        fill="none"
        stroke="#60a5fa"
        stroke-width="2.5"
      />


      <polyline
        points="${
          makePoints(
            "signal"
          )
        }"
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


/* ===================================== */
/* グリッド線                            */
/* ===================================== */

function createGridLines({
  width,
  padding,
  minValue,
  maxValue,
  y,
  formatter
}) {

  const lines =
    [];


  for (
    let i = 0;
    i <= 4;
    i++
  ) {

    const value =
      maxValue -
      (
        (
          maxValue -
          minValue
        ) /
        4
      ) *
      i;


    const gridY =
      y(
        value
      );


    lines.push(`
      <line
        x1="${padding.left}"
        y1="${gridY}"
        x2="${
          width -
          padding.right
        }"
        y2="${gridY}"
        stroke="#334155"
      />


      <text
        x="${
          width -
          padding.right +
          8
        }"
        y="${gridY + 5}"
        fill="#94a3b8"
        font-size="12"
      >
        ${formatter(
          value
        )}
      </text>
    `);
  }


  return lines.join("");
}


/* ===================================== */
/* 日付ラベル                            */
/* ===================================== */

function createDateLabels(
  data,
  x,
  height
) {

  const interval =
    Math.max(
      1,
      Math.floor(
        data.length /
        6
      )
    );


  return data
    .map(
      (
        item,
        index
      ) => {

        if (
          index %
            interval !==
            0 &&
          index !==
            data.length - 1
        ) {
          return "";
        }


        return `
          <text
            x="${x(index)}"
            y="${
              height -
              18
            }"
            fill="#94a3b8"
            font-size="11"
            text-anchor="middle"
          >
            ${escapeHtml(
              item.date.slice(
                5
              )
            )}
          </text>
        `;
      }
    )
    .join("");
}
