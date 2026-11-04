// Minimal OpenAI-compatible chat client. Speaks /chat/completions, so it works
// against OpenAI, Anthropic's OpenAI-compatible endpoint, Google's, or a litellm
// proxy — anything that exposes that shape. No dependencies; uses global fetch.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function chat({
  baseURL,
  apiKey,
  model,
  system,
  user,
  maxTokens = 4096,
  temperature = 0,
  json = false,
  retries = 4,
}) {
  const url = baseURL.replace(/\/+$/, "") + "/chat/completions";
  const messages = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: user });
  const body = { model, messages, max_tokens: maxTokens, temperature };
  if (json) body.response_format = { type: "json_object" };

  let lastErr;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const t = await res.text();
        // Some models reject response_format; drop it and retry once.
        if (json && body.response_format && /response_format|json|not supported/i.test(t)) {
          delete body.response_format;
          lastErr = new Error(`HTTP ${res.status}`);
          continue;
        }
        // Some reasoning models reject a non-default temperature; drop it and retry.
        if ("temperature" in body && /temperature/i.test(t)) {
          delete body.temperature;
          lastErr = new Error(`HTTP ${res.status}`);
          continue;
        }
        // Retry transient server/rate errors; fail fast on client errors.
        if (res.status >= 500 || res.status === 429) {
          lastErr = new Error(`HTTP ${res.status}: ${t.slice(0, 200)}`);
          await sleep(800 * (attempt + 1));
          continue;
        }
        throw new Error(`HTTP ${res.status}: ${t.slice(0, 400)}`);
      }
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      return typeof content === "string" ? content : JSON.stringify(content ?? "");
    } catch (e) {
      lastErr = e;
      await sleep(800 * (attempt + 1));
    }
  }
  throw new Error(`chat failed after ${retries} attempts: ${lastErr?.message || lastErr}`);
}

// Tolerant JSON extraction: handles bare JSON, ```json fences, and prose-wrapped objects.
export function parseJSON(text) {
  if (text == null) throw new Error("empty response");
  const trimmed = String(text).trim();
  try {
    return JSON.parse(trimmed);
  } catch {}
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {}
  }
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) {
    try {
      return JSON.parse(trimmed.slice(first, last + 1));
    } catch {}
  }
  throw new Error(`could not parse JSON from response: ${trimmed.slice(0, 200)}`);
}

export async function chatJSON(opts) {
  const text = await chat({ ...opts, json: true });
  return parseJSON(text);
}
