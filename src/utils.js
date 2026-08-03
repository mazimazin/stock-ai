export function normalizeNumber(
  value,
  fallback
) {
  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    return fallback;
  }

  return number;
}

export function htmlError(message) {
  return new Response(
    `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
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

  <p>
    ${escapeHtml(message)}
  </p>
</body>
</html>
    `,
    {
      status: 500,
      headers: {
        "Content-Type":
          "text/html; charset=UTF-8"
      }
    }
  );
}

export function formatNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "-";
  }

  return Math.round(number)
    .toLocaleString("ja-JP");
}

export function formatDecimal(value) {
  if (!Number.isFinite(value)) {
    return "-";
  }

  return value.toFixed(2);
}

export function formatSignedDecimal(value) {
  if (!Number.isFinite(value)) {
    return "-";
  }

  const sign =
    value >= 0 ? "+" : "";

  return `${sign}${value.toFixed(2)}`;
}

export function formatRatio(value) {
  if (!Number.isFinite(value)) {
    return "-";
  }

  return value.toFixed(2);
}

export function formatCrossSignal(value) {
  if (value === "golden") {
    return "ゴールデンクロス発生";
  }

  if (value === "dead") {
    return "デッドクロス発生";
  }

  return "新規クロスなし";
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
