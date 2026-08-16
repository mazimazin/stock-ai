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
      // 基本入力
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
      // J-Quants用コード
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
        Number.isFinite(
          latestClose
        ) &&
        Number.isFinite(
          previousClose
        )
          ? latestClose -
            previousClose
          : null;


      const changePercent =
        Number.isFinite(
          change
        ) &&
        Number.isFinite(
          previousClose
        ) &&
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

      const ma5Series =
        calculateSMA(
          closes,
          5
        );


      const ma25Series =
        calculateSMA(
          closes,
          25
        );


      const ma75Series =
        calculateSMA(
          closes,
          75
        );


      const ma200Series =
        calculateSMA(
          closes,
          200
        );


      const ma5 =
        getLastFinite(
          ma5Series
        );


      const ma25 =
        getLastFinite(
          ma25Series
        );


      const ma75 =
        getLastFinite(
          ma75Series
        );


      const ma200 =
        getLastFinite(
          ma200Series
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
      // 移動平均クロス
      // =====================================

      const crossSignal =
        detectMovingAverageCross(
          ma5Series,
          ma25Series
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

      const recent20HighValues =
        highs
          .slice(
            -20
          )
          .filter(
            Number.isFinite
          );


      const recent20High =
        recent20HighValues.length > 0
          ? Math.max(
              ...recent20HighValues
            )
          : null;


      // =====================================
      // サポート / レジスタンス
      // =====================================

      const supportResistance =
        detectSupportResistance(
          prices,
          latestClose
        );


      // =====================================
      // 売買戦略
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
      // チャートデータ
      // =====================================

      const chartData =
        prices.map(
          (
            price,
            index
          ) => {

            const open =
              Number(
                price.AdjO ??
                price.O
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


            const currentBollinger =
              calculateBollingerAt(
                closes,
                index,
                20,
                2
              );


            return {

              date:
                price.Date,

              open,

              close,

              volume,

              ma5:
                calculateSMAAt(
                  closes,
                  index,
                  5
                ),

              ma25:
                calculateSMAAt(
                  closes,
                  index,
                  25
                ),

              ma75:
                calculateSMAAt(
                  closes,
                  index,
                  75
                ),

              ma200:
                calculateSMAAt(
                  closes,
                  index,
                  200
                ),

              bollinger:
                currentBollinger,

              macd:
                macdData
                  .macd?.[
                    index
                  ] ?? null,

              signal:
                macdData
                  .signal?.[
                    index
                  ] ?? null,

              histogram:
                macdData
                  .histogram?.[
                    index
                  ] ?? null
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
// 指定位置の移動平均
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


  const start =
    index -
    period +
    1;


  const section =
    values.slice(
      start,
      index + 1
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


  const total =
    section.reduce(
      (
        sum,
        value
      ) =>
        sum +
        value,
      0
    );


  return total /
    period;
}


// =====================================
// 指定位置のボリンジャーバンド
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


  const start =
    index -
    period +
    1;


  const section =
    values.slice(
      start,
      index + 1
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
