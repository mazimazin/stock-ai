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
  calculateMACD
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

  async fetch(request, env) {

    try {

      const url =
        new URL(request.url);


      // =====================================
      // ランキング
      // =====================================

      if (
        url.searchParams.get("mode") ===
        "ranking"
      ) {

        const rankingType =
          url.searchParams.get("type") ||
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


      const rawTradeMode =
        (
          url.searchParams.get("trade") ||
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
          url.searchParams.get("margin"),
          30
        );


      // =====================================
      // コード
      // =====================================

      const apiCode =
        inputCode.length === 4
          ? `${inputCode}0`
          : inputCode;


      const stockName =
        STOCK_NAMES[inputCode] ||
        inputCode;


      // =====================================
      // 株価取得
      // =====================================

      const prices =
        await fetchDailyBars(
          apiCode,
          env.JQUANTS_API_KEY
        );


      if (!Array.isArray(prices)) {

        throw new Error(
          "STEP 1 株価取得：prices が配列ではありません"
        );
      }


      if (prices.length < 2) {

        throw new Error(
          "STEP 1 株価取得：株価データが不足しています"
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
        closes[
          closes.length - 1
        ];


      const previousClose =
        closes[
          closes.length - 2
        ];


      const change =
        latestClose -
        previousClose;


      const changePercent =
        previousClose !== 0
          ? (
              change /
              previousClose
            ) * 100
          : null;


      // =====================================
      // 移動平均
      // =====================================

      let ma5;
      let ma25;
      let ma75;
      let ma200;


      try {

        ma5 =
          calculateSMA(
            closes,
            5
          );

        ma25 =
          calculateSMA(
            closes,
            25
          );

        ma75 =
          calculateSMA(
            closes,
            75
          );

        ma200 =
          calculateSMA(
            closes,
            200
          );

      } catch (error) {

        throw new Error(
          `STEP 2 移動平均：${error.message}`
        );
      }


      // =====================================
      // RSI
      // =====================================

      let rsi14;


      try {

        rsi14 =
          calculateRSI(
            closes,
            14
          );

      } catch (error) {

        throw new Error(
          `STEP 3 RSI：${error.message}`
        );
      }


      // =====================================
      // ボリンジャー
      // =====================================

      let bollinger;


      try {

        bollinger =
          calculateBollingerBands(
            closes,
            20,
            2
          );

      } catch (error) {

        throw new Error(
          `STEP 4 ボリンジャー：${error.message}`
        );
      }


      // =====================================
      // 出来高
      // =====================================

      let averageVolume20;


      try {

        averageVolume20 =
          calculateSMA(
            volumes,
            20
          );

      } catch (error) {

        throw new Error(
          `STEP 5 出来高平均：${error.message}`
        );
      }


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
      // クロス
      // =====================================

      let crossSignal;


      try {

        crossSignal =
          detectMovingAverageCross(
            closes,
            5,
            25
          );

      } catch (error) {

        throw new Error(
          `STEP 6 クロス：${error.message}`
        );
      }


      // =====================================
      // ATR
      // =====================================

      let atr14;


      try {

        atr14 =
          calculateATR(
            highs,
            lows,
            closes,
            14
          );

      } catch (error) {

        throw new Error(
          `STEP 7 ATR：${error.message}`
        );
      }


      // =====================================
      // MACD
      // =====================================

      let macdData;


      try {

        macdData =
          calculateMACD(
            closes,
            12,
            26,
            9
          );

      } catch (error) {

        throw new Error(
          `STEP 8 MACD計算：${error.message}`
        );
      }


      if (
        !macdData ||
        typeof macdData !== "object"
      ) {

        throw new Error(
          "STEP 8 MACD計算：戻り値がありません"
        );
      }


      /*
       * indicators.js の実装差があっても
       * 対応できるように候補名を吸収する
       */

      const macdArray =
        Array.isArray(
          macdData.macd
        )
          ? macdData.macd
          : Array.isArray(
              macdData.macdLine
            )
            ? macdData.macdLine
            : [];


      const signalArray =
        Array.isArray(
          macdData.signal
        )
          ? macdData.signal
          : Array.isArray(
              macdData.signalLine
            )
            ? macdData.signalLine
            : [];


      const histogramArray =
        Array.isArray(
          macdData.histogram
        )
          ? macdData.histogram
          : Array.isArray(
              macdData.hist
            )
            ? macdData.hist
            : [];


      const latestMacd =
        getLastFiniteSafe(
          macdArray
        );


      const latestSignal =
        getLastFiniteSafe(
          signalArray
        );


      const latestHistogram =
        getLastFiniteSafe(
          histogramArray
        );


      // =====================================
      // 20日高値
      // =====================================

      const recentHighs =
        highs
          .slice(-20)
          .filter(
            Number.isFinite
          );


      const recent20High =
        recentHighs.length > 0
          ? Math.max(
              ...recentHighs
            )
          : null;


      // =====================================
      // サポート / レジスタンス
      // =====================================

      let supportResistance;


      try {

        supportResistance =
          detectSupportResistance(
            prices,
            latestClose
          );

      } catch (error) {

        throw new Error(
          `STEP 9 サポート・レジスタンス：${error.message}`
        );
      }


      // =====================================
      // 戦略
      // =====================================

      let strategy;


      try {

        strategy =
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

      } catch (error) {

        throw new Error(
          `STEP 10 戦略：${error.message}`
        );
      }


      // =====================================
      // チャート
      // =====================================

      const chartStart =
        Math.max(
          0,
          prices.length - 60
        );


      const chartPrices =
        prices.slice(
          chartStart
        );


      const chartData =
        chartPrices.map(
          (
            price,
            index
          ) => {

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
                calculateSMAAtSafe(
                  closes,
                  absoluteIndex,
                  5
                ),

              ma25:
                calculateSMAAtSafe(
                  closes,
                  absoluteIndex,
                  25
                ),

              ma75:
                calculateSMAAtSafe(
                  closes,
                  absoluteIndex,
                  75
                ),

              ma200:
                calculateSMAAtSafe(
                  closes,
                  absoluteIndex,
                  200
                ),

              bollinger:
                calculateBollingerAtSafe(
                  closes,
                  absoluteIndex,
                  20,
                  2
                ),

              macd:
                macdArray[
                  absoluteIndex
                ] ?? null,

              signal:
                signalArray[
                  absoluteIndex
                ] ?? null,

              histogram:
                histogramArray[
                  absoluteIndex
                ] ?? null
            };
          }
        );


      // =====================================
      // 直近10営業日
      // =====================================

      const recentPrices =
        prices
          .slice(-10)
          .reverse();


      // =====================================
      // HTML
      // =====================================

      let html;


      try {

        html =
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

      } catch (error) {

        throw new Error(
          `STEP 11 HTML：${error.message}`
        );
      }


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
// 最後の有限値
// =====================================

function getLastFiniteSafe(
  values
) {

  if (
    !Array.isArray(values)
  ) {

    return null;
  }


  for (
    let i =
      values.length - 1;

    i >= 0;

    i--
  ) {

    if (
      Number.isFinite(
        values[i]
      )
    ) {

      return values[i];
    }
  }


  return null;
}


// =====================================
// 指定位置 SMA
// =====================================

function calculateSMAAtSafe(
  values,
  index,
  period
) {

  if (
    !Array.isArray(values)
  ) {

    return null;
  }


  if (
    index + 1 <
    period
  ) {

    return null;
  }


  const selected =
    values.slice(
      index -
        period +
        1,
      index +
        1
    );


  if (
    selected.length !==
    period
  ) {

    return null;
  }


  if (
    selected.some(
      (value) =>
        !Number.isFinite(
          value
        )
    )
  ) {

    return null;
  }


  return (
    selected.reduce(
      (
        sum,
        value
      ) =>
        sum +
        value,
      0
    ) /
    period
  );
}


// =====================================
// 標準偏差
// =====================================

function standardDeviationSafe(
  values
) {

  if (
    !Array.isArray(values) ||
    values.length === 0
  ) {

    return null;
  }


  const average =
    values.reduce(
      (
        sum,
        value
      ) =>
        sum +
        value,
      0
    ) /
    values.length;


  const variance =
    values.reduce(
      (
        sum,
        value
      ) => {

        const diff =
          value -
          average;


        return (
          sum +
          diff *
          diff
        );
      },
      0
    ) /
    values.length;


  return Math.sqrt(
    variance
  );
}


// =====================================
// 指定位置ボリンジャー
// =====================================

function calculateBollingerAtSafe(
  values,
  index,
  period = 20,
  multiplier = 2
) {

  if (
    !Array.isArray(values)
  ) {

    return {
      middle: null,
      upper: null,
      lower: null
    };
  }


  if (
    index + 1 <
    period
  ) {

    return {
      middle: null,
      upper: null,
      lower: null
    };
  }


  const selected =
    values.slice(
      index -
        period +
        1,
      index +
        1
    );


  if (
    selected.length !==
    period ||
    selected.some(
      (value) =>
        !Number.isFinite(
          value
        )
    )
  ) {

    return {
      middle: null,
      upper: null,
      lower: null
    };
  }


  const middle =
    selected.reduce(
      (
        sum,
        value
      ) =>
        sum +
        value,
      0
    ) /
    period;


  const deviation =
    standardDeviationSafe(
      selected
    );


  if (
    !Number.isFinite(
      deviation
    )
  ) {

    return {
      middle,
      upper: null,
      lower: null
    };
  }


  return {

    middle,

    upper:
      middle +
      deviation *
      multiplier,

    lower:
      middle -
      deviation *
      multiplier
  };
}
