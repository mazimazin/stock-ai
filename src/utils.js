export function normalizeNumber(
  value,
  fallback
) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return fallback;
  }

  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}


export function escapeHtml(value) {
  return String(
    value ?? ""
  ).replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[char]
  );
}


export function formatNumber(value) {
  const number =
    Number(value);

  return Number.isFinite(number)
    ? Math.round(number)
        .toLocaleString("ja-JP")
    : "-";
}


export function formatDecimal(value) {
  return Number.isFinite(value)
    ? value.toFixed(2)
    : "-";
}


export function formatSignedDecimal(value) {
  return Number.isFinite(value)
    ? `${
        value >= 0
          ? "+"
          : ""
      }${value.toFixed(2)}`
    : "-";
}


export function formatRatio(value) {
  return Number.isFinite(value)
    ? value.toFixed(2)
    : "-";
}


export function formatCrossSignal(value) {
  if (value === "golden") {
    return "ゴールデンクロス";
  }

  if (value === "dead") {
    return "デッドクロス";
  }

  return "新規クロスなし";
}


export function htmlError(
  message,
  status = 500
) {
  return new Response(
    `
<!doctype html>

<html lang="ja">

<head>
  <meta charset="utf-8">

  <meta
    name="viewport"
    content="width=device-width"
  >

  <title>
    データ取得エラー
  </title>
</head>

<body
  style="
    font-family:sans-serif;
    background:#0f172a;
    color:#fff;
    padding:30px;
  "
>

  <h1>
    データ取得エラー
  </h1>

  <p>
    ${escapeHtml(message)}
  </p>

</body>

</html>
    `,
    {
      status,

      headers: {
        "Content-Type":
          "text/html; charset=UTF-8",

        "Cache-Control":
          "no-store"
      }
    }
  );
}
