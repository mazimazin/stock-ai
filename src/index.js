import {
  fetchDailyBars
} from "./api.js";

import {
  STOCK_NAMES
} from "./config.js";

import {
  calculateSMA,
  calculateBollingerBands,
  detectMovingAverageCross,
  calculateRSI,
  calculateATR,
  calculateMACD,
  getLastFinite
} from "./indicators.js";

import {
  createStrategy
} from "./strategy.js";

import {
  detectSupportResistance
} from "./support.js";

import {
  createHtml
} from "./html.js";

import {
  createRankingResponse
} from "./ranking.js";

import {
  normalizeNumber,
  htmlError
} from "./utils.js";


export default {

  async fetch(
    request,
    env
  ) {

    try {

      const url =
        new URL(
          request.url
        );


      // =====================================
      // ランキング
      // =====================================

      if (
        url.searchParams.get(
          "mode"
        ) === "ranking"
      ) {

        const rankingType =
          url.searchParams.get(
            "type"
          ) ||
          "overall";


        const allowedTypes = [
          "overall",
          "entry",
          "trend"
        ];


        const safeRankingType =
          allowedTypes.includes(
            rankingType
          )
            ? rankingType
            : "overall";


        return await createRankingResponse(
          env,
          safeRankingType
        );
      }


      // =====================================
      // 入力
      // =====================================

      const inputCode =
        (
          url.searchParams.get(
            "code"
          ) ||
          "285A"
        )
          .trim()
          .toUpperCase();


      const capital =
        normalizeNumber(
          url.searchParams.get(
            "capital"
          ),
          1000000
        );


      const riskPercent =
        normalizeNumber(
          url.searchParams.get(
            "risk"
          ),
          1
        );


      // =====================================
      // 現物 / 信用
      // =====================================

      const rawTradeMode =
        (
          url.searchParams.get(
            "trade"
          ) ||
          "margin"
        )
          .trim()
          .toLowerCase();


      const tradeMode =
        rawTradeMode === "cash"
          ? "cash"
          : "margin";


      const marginRate =
        normalizeNumber(
          url.searchParams.get(
            "margin"
          ),
          30
        );


      // =====================================
      // J-Quantsコード
      // =====================================

      const apiCode =
        inputCode.length === 4
          ? `${inputCode}0`
          : inputCode;


      const stockName =
        STOCK_NAMES[
          inputCode
        ] ||
        inputCode;


      // =====================================
      // データ取得
      // =====================================

      const prices =
        await fetchDailyBars(
          apiCode,
          env.JQUANTS_API_KEY
        );


      if (
        !Array.isArray(
          prices
        ) ||
        prices.length < 2
      ) {

        return htmlError(
          "株価データが不足しています。",
          500
        );
      }


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


      // =====================================
      // 最新値
      // =====================================

      const latest =
        prices[
          prices.length - 1
        ];


      const previous =
        prices[
          prices.length - 2
        ];


      const latestClose =
        Number(
          latest.AdjC ??
          latest.C
        );


      const previousClose =
        Number(
          previous.AdjC ??
          previous.C
        );


      const change =
        latestClose -
        previousClose;


      const changePercent =
        previousClose !== 0
          ? (
              change /
              previousClose
            ) *
            100
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

      const recent20Volumes =
        volumes
          .slice(
            -20
          )
          .filter(
            Number.isFinite
          );


      const averageVolume20 =
        recent20Volumes.length > 0
          ? recent20Volumes.reduce(
              (
                sum,
                value
              ) =>
                sum +
                value,
              0
            ) /
            recent20Volumes.length
          : null;


      const latestVolume =
        Number(
          latest.AdjVo ??
          latest.Vo
        );


      const volumeRatio =
        Number.isFinite(
          latestVolume
        ) &&
        Number.isFinite(
          averageVolume20
        ) &&
        averageVolume20 > 0
          ? latestVolume /
            averageVolume20
          : null;


      // =====================================
      // クロス
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
      // 20日高値
      // =====================================

      const recent20High =
        Math.max(
          ...highs
            .slice(
              -20
            )
            .filter(
              Number.isFinite
            )
        );


      // =====================================
      // サポート / レジスタンス
      // =====================================

      const supportResistance =
        detectSupportResistance(
          prices,
          latestClose
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

          capital,

          riskPercent,

          tradeMode,

          marginRate
        });


      // =====================================
      // チャート
      // =====================================

      const chartStart =
        Math.max(
          0,
          prices.length - 60
        );


      const chartData =
        prices
          .slice(
            chartStart
          )
          .map(
            (
              price,
              chartIndex
            ) => {

              const actualIndex =
                chartStart +
                chartIndex;


              return {

                date:
                  price.Date,

                open:
                  Number(
                    price.AdjO ??
                    price.O
                  ),

                close:
                  Number(
                    price.AdjC ??
                    price.C
                  ),

                volume:
                  Number(
                    price.AdjVo ??
                    price.Vo
                  ),

                ma5:
                  calculateSMAAt(
                    closes,
                    actualIndex,
                    5
                  ),

                ma25:
                  calculateSMAAt(
                    closes,
                    actualIndex,
                    25
                  ),

                ma75:
                  calculateSMAAt(
                    closes,
                    actualIndex,
                    75
                  ),

                ma200:
                  calculateSMAAt(
                    closes,
                    actualIndex,
                    200
                  ),

                bollinger:
                  calculateBollingerAt(
                    closes,
                    actualIndex,
                    20,
                    2
                  ),

                macd:
                  macdData
                    .macd?.[
                      actualIndex
                    ] ??
                  null,

                signal:
                  macdData
                    .signal?.[
                      actualIndex
                    ] ??
                  null,

                histogram:
                  macdData
                    .histogram?.[
                      actualIndex
                    ] ??
                  null
              };
            }
          );


      // =====================================
      // 直近10営業日
      // =====================================

      const recentPrices =
        [
          ...prices
        ]
          .slice(
            -10
          )
          .reverse();


      // =====================================
      // HTML
      // =====================================

      const html =
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

          supportResistance,

          chartData,

          capital,

          riskPercent,

          tradeMode,

          marginRate
        });


      return new Response(
        html,
        {
          headers: {

            "content-type":
              "text/html; charset=UTF-8",

            "cache-control":
              "no-store"
          }
        }
      );

    } catch (error) {

      console.error(
        error
      );


      return htmlError(
        error?.message ||
        "分析中にエラーが発生しました。",
        500
      );
    }
  }
};


// =====================================
// 指定位置SMA
// =====================================

function calculateSMAAt(
  values,
  index,
  period
) {

  if (
    index <
    period - 1
  ) {

    return null;
  }


  const section =
    values.slice(
      index -
        period +
        1,
      index +
        1
    );


  if (
    section.some(
      (value) =>
        !Number.isFinite(
          value
        )
    )
  ) {

    return null;
  }


  return section.reduce(
    (
      sum,
      value
    ) =>
      sum +
      value,
    0
  ) /
  period;
}


// =====================================
// 指定位置ボリンジャー
// =====================================

function calculateBollingerAt(
  values,
  index,
  period = 20,
  multiplier = 2
) {

  if (
    index <
    period - 1
  ) {

    return {
      upper: null,
      middle: null,
      lower: null
    };
  }


  const section =
    values.slice(
      index -
        period +
        1,
      index +
        1
    );


  if (
    section.some(
      (value) =>
        !Number.isFinite(
          value
        )
    )
  ) {

    return {
      upper: null,
      middle: null,
      lower: null
    };
  }


  const middle =
    section.reduce(
      (
        sum,
        value
      ) =>
        sum +
        value,
      0
    ) /
    period;


  const variance =
    section.reduce(
      (
        sum,
        value
      ) => {

        const diff =
          value -
          middle;


        return sum +
          diff *
          diff;
      },
      0
    ) /
    period;


  const standardDeviation =
    Math.sqrt(
      variance
    );


  return {

    upper:
      middle +
      standardDeviation *
      multiplier,

    middle,

    lower:
      middle -
      standardDeviation *
      multiplier
  };
}
