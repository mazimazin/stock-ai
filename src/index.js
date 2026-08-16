import { fetchDailyBars } from "./api.js";

import {
  STOCK_NAMES
} from "./config.js";

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
          ) || "overall";


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
      // 個別銘柄
      // =====================================

      const inputCode =
        (
          url.searchParams.get(
            "code"
          ) || "285A"
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
      // J-Quants用コード
      // =====================================

      let apiCode =
        inputCode;


      if (
        inputCode.length === 4
      ) {
        apiCode =
          `${inputCode}0`;
      }


      // =====================================
      // 株価取得
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
        prices.length === 0
      ) {
        return htmlError(
          "株価データを取得できませんでした"
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

      const opens =
        prices.map(
          (price) =>
            Number(
              price.AdjO ??
              price.O
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


      const closes =
        prices.map(
          (price) =>
            Number(
              price.AdjC ??
              price.C
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

          capital,
          riskPercent
        });


      // =====================================
      // チャート用データ
      // =====================================

      const chartData =
        prices.map(
          (
            price,
            index
          ) => ({

            date:
              price.Date,

            open:
              opens[index],

            high:
              highs[index],

            low:
              lows[index],

            close:
              closes[index],

            volume:
              volumes[index],

            ma5:
              calculateSMAAt(
                closes,
                5,
                index
              ),

            ma25:
              calculateSMAAt(
                closes,
                25,
                index
              ),

            ma75:
              calculateSMAAt(
                closes,
                75,
                index
              ),

            ma200:
              calculateSMAAt(
                closes,
                200,
                index
              ),

            bollinger:
              calculateBollingerAt(
                closes,
                20,
                2,
                index
              ),

            macd:
              macdData
                .macd[index],

            signal:
              macdData
                .signal[index],

            histogram:
              macdData
                .histogram[index]
          })
        );


      // =====================================
      // 直近10営業日
      // =====================================

      const recentPrices =
        prices
          .slice(-10)
          .reverse();


      // =====================================
      // 銘柄名
      // =====================================

      const stockName =
        STOCK_NAMES[
          inputCode
        ] ||
        inputCode;


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
          riskPercent
        });


      return new Response(
        html,
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
          : "分析中にエラーが発生しました"
      );
    }
  }
};


// =====================================
// チャート計算用
// =====================================

function calculateSMAAt(
  values,
  period,
  index
) {

  if (
    index <
    period - 1
  ) {
    return null;
  }


  const slice =
    values.slice(
      index -
      period +
      1,
      index + 1
    );


  const valid =
    slice.filter(
      Number.isFinite
    );


  if (
    valid.length !==
    period
  ) {
    return null;
  }


  return (
    valid.reduce(
      (sum, value) =>
        sum + value,
      0
    ) /
    period
  );
}


function calculateBollingerAt(
  values,
  period,
  multiplier,
  index
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


  const slice =
    values.slice(
      index -
      period +
      1,
      index + 1
    );


  const valid =
    slice.filter(
      Number.isFinite
    );


  if (
    valid.length !==
    period
  ) {
    return {
      upper: null,
      middle: null,
      lower: null
    };
  }


  const middle =
    valid.reduce(
      (sum, value) =>
        sum + value,
      0
    ) /
    period;


  const variance =
    valid.reduce(
      (sum, value) =>
        sum +
        Math.pow(
          value -
          middle,
          2
        ),
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
