function isObjectLike(value) {
  return value != null && typeof value === "object";
}

function isBodySerializable(body) {
  return (
    body != null &&
    !(body instanceof FormData) &&
    !(body instanceof URLSearchParams) &&
    typeof body !== "string"
  );
}

function countHeaders(headers) {
  if (headers instanceof Headers) {
    return [...headers.keys()].length;
  }

  if (!isObjectLike(headers)) {
    return 0;
  }

  return Object.keys(headers).length;
}

export async function resolveRequestValue(value, context = {}) {
  if (typeof value === "function") {
    return value(context);
  }

  return value;
}

export async function resolveRequestHeaders(headers, context = {}) {
  const resolved = await resolveRequestValue(headers, context);

  if (resolved instanceof Headers) {
    return resolved;
  }

  return new Headers(resolved || {});
}

export async function resolveRequestUrl(url, context = {}) {
  const resolved = await resolveRequestValue(url, context);

  if (typeof resolved !== "string" || !resolved) {
    return "";
  }

  const rowId = context.rowId != null ? String(context.rowId) : "";

  return resolved.replaceAll(":id", encodeURIComponent(rowId));
}

export async function parseResponsePayload(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function buildRequestError(response, payload, fallbackMessage) {
  const message =
    (isObjectLike(payload) && (payload.message || payload.error)) ||
    fallbackMessage ||
    `Request failed with status ${response.status}`;

  const error = new Error(message);
  error.status = response.status;
  error.payload = payload;

  return error;
}

export async function requestJson(config = {}, context = {}) {
  const method = String(config.method || "GET").toUpperCase();
  const url = await resolveRequestUrl(config.url, context);

  if (!url) {
    throw new Error("A request URL is required.");
  }

  const headers = await resolveRequestHeaders(config.headers, {
    ...context,
    method,
    url,
  });
  const requireHeaders =
    config.requireHeaders ?? !["GET", "HEAD"].includes(method);

  if (requireHeaders && countHeaders(headers) === 0) {
    throw new Error(
      `Custom headers are required for ${method} requests. Provide ${String(
        context.action || "request"
      )} headers for authentication.`
    );
  }

  const body =
    typeof config.buildBody === "function"
      ? await config.buildBody(context.data, {
          ...context,
          method,
          url,
        })
      : context.data;
  const payloadBody = isBodySerializable(body) ? JSON.stringify(body) : body;

  if (
    payloadBody != null &&
    isBodySerializable(body) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(new URL(url, window.location.href), {
    method,
    headers,
    body: ["GET", "HEAD"].includes(method) ? undefined : payloadBody,
    credentials: config.credentials,
    signal: config.signal,
  });
  const payload = await parseResponsePayload(response);

  if (!response.ok) {
    throw buildRequestError(response, payload);
  }

  return {
    response,
    payload,
    headers,
  };
}
