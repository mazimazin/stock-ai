import {
  normalizeNumber,
  htmlError
} from "./utils.js";

import {
  STOCK_NAMES
} from "./config.js";

import {
  fetchDailyBars
} from "./api.js";

import {
  calculateSMA,
  calculateSMAAt,
  calculateBollingerBands,
  calculateBollingerAt,
  detectMovingAverageCross,
  calculateRSI,
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

import {
  createHtml
} from "./html.js";

import {
  createRankingResponse
} from "./ranking.js";


export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (
      url.searchParams.get("mode") === "ranking"
    ) {
      return createRankingResponse(env);
    }


    const inputCode =
      (
        url.searchParams.get("code") ||
        "285A"
      )
        .trim()
        .toUpperCase();


    const capital =
      normalizeNumber(
        url.searchParams.get("capital"),
        1000000
      );


    const riskPercent =
      normalizeNumber(
        url.searchParams.get("risk"),
        1
      );


    const code =
      inputCode.length === 4
        ? `${inputCode}0`
        : inputCode;


    const stockName =
      STOCK_NAMES[inputCode] ||
      `銘柄コード ${inputCode}`;


    if (!env.JQUANTS_API_KEY) {
      return htmlError(
        "JQUANTS_API_KEYが設定されていません"
      );
    }


    try {
      const prices =
        await fetchDailyBars(
          code,
          env.JQUANTS_API_KEY
        );


      if (prices.length === 0) {
        return htmlError(
          `${inputCode}の株価データが見つかりませんでした`
        );
      }


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


      const supportResistance =
        detectSupportResistance(
          highs,
          lows,
          closes
        );


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
          riskPercent
        });


      const recentPrices =
        prices
          .slice(-10)
          .reverse();


      const chartStart =
        Math.max(
          0,
          prices.length - 60
        );


      const chartData =
        prices
          .slice(chartStart)
          .map(
            (price, index) => {
              const absoluteIndex =
                chartStart +
                index;

              return {
                date:
                  price.Date,

                open:
                  Number(
                    price.AdjO ??
                    price.O
                  ),

                close:
                  closes[
                    absoluteIndex
                  ],

                volume:
                  volumes[
                    absoluteIndex
                  ],

                ma5:
                  calculateSMAAt(
                    closes,
                    absoluteIndex,
                    5
                  ),

                ma25:
                  calculateSMAAt(
                    closes,
                    absoluteIndex,
                    25
                  ),

                ma75:
                  calculateSMAAt(
                    closes,
                    absoluteIndex,
                    75
                  ),

                ma200:
                  calculateSMAAt(
                    closes,
                    absoluteIndex,
                    200
                  ),

                bollinger:
                  calculateBollingerAt(
                    closes,
                    absoluteIndex,
                    20,
                    2
                  ),

                macd:
                  macdData.macd[
                    absoluteIndex
                  ],

                signal:
                  macdData.signal[
                    absoluteIndex
                  ],

                histogram:
                  macdData.histogram[
                    absoluteIndex
                  ]
              };
            }
          );


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
          supportResistance,

          chartData,

          capital,
          riskPercent
        }),
        {
          headers: {
            "Content-Type":
              "text/html; charset=UTF-8",

            "Cache-Control":
              "no-store"
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
