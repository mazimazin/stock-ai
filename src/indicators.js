export function calculateSMA(values, period) {
  if (values.length < period) {
    return null;
  }

  const selected = values.slice(-period);

  return (
    selected.reduce(
      (sum, value) => sum + value,
      0
    ) / period
  );
}

export function calculateSMAAt(values, index, period) {
  if (index + 1 < period) {
    return null;
  }

  const selected = values.slice(
    index - period + 1,
    index + 1
  );

  return (
    selected.reduce(
      (sum, value) => sum + value,
      0
    ) / period
  );
}

export function calculateStandardDeviation(values) {
  if (!values.length) {
    return null;
  }

  const average =
    values.reduce(
      (sum, value) => sum + value,
      0
    ) / values.length;

  const variance =
    values.reduce(
      (sum, value) =>
        sum + Math.pow(value - average, 2),
      0
    ) / values.length;

  return Math.sqrt(variance);
}

export function calculateBollingerBands(
  values,
  period = 20,
  multiplier = 2
) {
  if (values.length < period) {
    return {
      middle: null,
      upper: null,
      lower: null,
      bandwidth: null,
      percentB: null
    };
  }

  const selected = values.slice(-period);
  const middle = calculateSMA(values, period);
  const deviation = calculateStandardDeviation(
    selected
  );

  const upper =
    middle + deviation * multiplier;
  const lower =
    middle - deviation * multiplier;

  const latest = values[values.length - 1];
  const width = upper - lower;

  return {
    middle,
    upper,
    lower,
    bandwidth:
      middle !== 0
        ? (width / middle) * 100
        : null,
    percentB:
      width !== 0
        ? ((latest - lower) / width) * 100
        : null
  };
}

export function calculateBollingerAt(
  values,
  index,
  period = 20,
  multiplier = 2
) {
  if (index + 1 < period) {
    return {
      middle: null,
      upper: null,
      lower: null
    };
  }

  const selected = values.slice(
    index - period + 1,
    index + 1
  );

  const middle =
    selected.reduce(
      (sum, value) => sum + value,
      0
    ) / period;

  const deviation =
    calculateStandardDeviation(selected);

  return {
    middle,
    upper: middle + deviation * multiplier,
    lower: middle - deviation * multiplier
  };
}

export function detectMovingAverageCross(
  values,
  shortPeriod = 5,
  longPeriod = 25
) {
  if (values.length < longPeriod + 2) {
    return "none";
  }

  const currentShort =
    calculateSMAAt(
      values,
      values.length - 1,
      shortPeriod
    );
  const currentLong =
    calculateSMAAt(
      values,
      values.length - 1,
      longPeriod
    );
  const previousShort =
    calculateSMAAt(
      values,
      values.length - 2,
      shortPeriod
    );
  const previousLong =
    calculateSMAAt(
      values,
      values.length - 2,
      longPeriod
    );

  if (
    previousShort <= previousLong &&
    currentShort > currentLong
  ) {
    return "golden";
  }

  if (
    previousShort >= previousLong &&
    currentShort < currentLong
  ) {
    return "dead";
  }

  return "none";
}

export function calculateRSI(values, period = 14) {
  if (values.length <= period) {
    return null;
  }

  const recent = values.slice(
    -(period + 1)
  );

  let gains = 0;
  let losses = 0;

  for (let i = 1; i < recent.length; i++) {
    const difference =
      recent[i] - recent[i - 1];

    if (difference > 0) {
      gains += difference;
    } else {
      losses += Math.abs(difference);
    }
  }

  const averageGain =
    gains / period;

  const averageLoss =
    losses / period;

  if (averageLoss === 0) {
    return 100;
  }

  const relativeStrength =
    averageGain / averageLoss;

  return (
    100 -
    100 / (1 + relativeStrength)
  );
}

export function calculateATR(
  highs,
  lows,
  closes,
  period = 14
) {
  if (closes.length <= period) {
    return null;
  }

  const trueRanges = [];

  for (let i = 1; i < closes.length; i++) {
    const highLow =
      highs[i] - lows[i];

    const highPrevious = Math.abs(
      highs[i] - closes[i - 1]
    );

    const lowPrevious = Math.abs(
      lows[i] - closes[i - 1]
    );

    trueRanges.push(
      Math.max(
        highLow,
        highPrevious,
        lowPrevious
      )
    );
  }

  const recentRanges =
    trueRanges.slice(-period);

  return (
    recentRanges.reduce(
      (sum, value) => sum + value,
      0
    ) / period
  );
}

export function calculateEMA(values, period) {
  const result =
    new Array(values.length).fill(null);

  if (values.length < period) {
    return result;
  }

  const multiplier =
    2 / (period + 1);

  const initialValues =
    values.slice(0, period);

  let previousEma =
    initialValues.reduce(
      (sum, value) => sum + value,
      0
    ) / period;

  result[period - 1] =
    previousEma;

  for (
    let i = period;
    i < values.length;
    i++
  ) {
    const currentEma =
      (values[i] - previousEma) *
        multiplier +
      previousEma;

    result[i] = currentEma;
    previousEma = currentEma;
  }

  return result;
}

export function calculateMACD(
  values,
  shortPeriod = 12,
  longPeriod = 26,
  signalPeriod = 9
) {
  const shortEma = calculateEMA(
    values,
    shortPeriod
  );

  const longEma = calculateEMA(
    values,
    longPeriod
  );

  const macd = values.map((_, index) => {
    if (
      !Number.isFinite(shortEma[index]) ||
      !Number.isFinite(longEma[index])
    ) {
      return null;
    }

    return (
      shortEma[index] -
      longEma[index]
    );
  });

  const validMacd =
    macd.filter(Number.isFinite);

  const validSignal = calculateEMA(
    validMacd,
    signalPeriod
  );

  const signal =
    new Array(values.length).fill(null);

  let validIndex = 0;

  for (
    let i = 0;
    i < macd.length;
    i++
  ) {
    if (!Number.isFinite(macd[i])) {
      continue;
    }

    signal[i] =
      validSignal[validIndex];

    validIndex++;
  }

  const histogram = macd.map(
    (value, index) => {
      if (
        !Number.isFinite(value) ||
        !Number.isFinite(signal[index])
      ) {
        return null;
      }

      return value - signal[index];
    }
  );

  return {
    macd,
    signal,
    histogram
  };
}

export function getLastFinite(values) {
  for (
    let i = values.length - 1;
    i >= 0;
    i--
  ) {
    if (Number.isFinite(values[i])) {
      return values[i];
    }
  }

  return null;
}
