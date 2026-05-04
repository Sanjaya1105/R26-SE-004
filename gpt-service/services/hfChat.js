const axios = require("axios");

const HF_CHAT_URL =
  process.env.HF_CHAT_URL || "https://router.huggingface.co/v1/chat/completions";

function parseModelList() {
  const primary = String(process.env.HF_MODEL || "").trim();
  const envFallbacks = String(process.env.HF_MODEL_FALLBACKS || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  const defaults = [
    "openai/gpt-oss-120b:fastest",
    "meta-llama/Llama-3.1-8B-Instruct:fastest",
    "Qwen/Qwen2.5-7B-Instruct:fastest",
  ];
  return [primary, ...envFallbacks, ...defaults].filter(
    (m, i, arr) => Boolean(m) && arr.indexOf(m) === i
  );
}

/**
 * @param {{ role: string, content: string }[]} messages
 * @param {{ max_tokens?: number, temperature?: number }} [options]
 * @returns {Promise<{ text: string, model: string }>}
 */
async function hfChatCompletion(messages, options = {}) {
  const hfToken = process.env.HF_API_TOKEN;
  if (!hfToken) {
    throw new Error("HF_API_TOKEN is not configured.");
  }

  const modelCandidates = parseModelList();
  const max_tokens = options.max_tokens ?? 2048;
  const temperature = options.temperature ?? 0.2;

  let lastFailure = null;
  for (const model of modelCandidates) {
    let response;
    try {
      response = await axios.post(
        HF_CHAT_URL,
        {
          model,
          messages,
          max_tokens,
          temperature,
        },
        {
          headers: {
            Authorization: `Bearer ${hfToken}`,
            "Content-Type": "application/json",
          },
          timeout: 180000,
          validateStatus: () => true,
        }
      );
    } catch (e) {
      const netMsg = e?.message || "network error";
      lastFailure = { status: 0, detail: `${model}: ${netMsg}` };
      continue;
    }

    if (response.status >= 400) {
      const errBody = response.data;
      const hfMsg =
        typeof errBody?.error === "string"
          ? errBody.error
          : errBody?.error?.message || JSON.stringify(errBody);
      lastFailure = { status: response.status, detail: `${model}: ${hfMsg}` };
      if (
        response.status === 400 ||
        response.status === 404 ||
        response.status === 422
      ) {
        continue;
      }
      if (response.status === 403) {
        throw new Error(
          "Hugging Face denied access (403). Check HF_API_TOKEN permissions for Inference Providers."
        );
      }
      const err = new Error(`Hugging Face request failed: ${hfMsg}`);
      if (
        /depleted|included credits|pre-?paid credits|subscribe to PRO|monthly included/i.test(
          String(hfMsg)
        )
      ) {
        err.code = "HF_INSUFFICIENT_CREDITS";
      }
      throw err;
    }

    const text = String(
      response.data?.choices?.[0]?.message?.content || ""
    ).trim();
    if (text) {
      return { text, model };
    }
    lastFailure = { status: 502, detail: `${model}: empty answer payload` };
  }

  throw new Error(
    lastFailure?.detail ||
      "No compatible model returned a valid response."
  );
}

module.exports = { hfChatCompletion, parseModelList, HF_CHAT_URL };
