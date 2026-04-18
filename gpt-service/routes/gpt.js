const express = require("express");
const axios = require("axios");
const verifyToken = require("../middleware/verifyToken");
const ChatMessage = require("../models/ChatMessage");

const router = express.Router();

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

router.post("/ask", verifyToken, async (req, res) => {
  const hfToken = process.env.HF_API_TOKEN;
  const modelCandidates = parseModelList();

  if (!hfToken) {
    return res.status(500).json({ message: "HF_API_TOKEN is not configured." });
  }

  const question = String(req.body?.question || "").trim();
  if (!question) {
    return res.status(400).json({ message: "Question is required." });
  }

  const userId = String(req.user?.id ?? req.user?.sub ?? "").trim() || "unknown";

  try {
    let lastFailure = null;
    for (const model of modelCandidates) {
      const response = await axios.post(
        HF_CHAT_URL,
        {
          model,
          messages: [
            {
              role: "system",
              content:
                "You are a concise educational assistant. Give clear, practical answers.",
            },
            { role: "user", content: question },
          ],
          max_tokens: 512,
        },
        {
          headers: {
            Authorization: `Bearer ${hfToken}`,
            "Content-Type": "application/json",
          },
          timeout: 120000,
          validateStatus: () => true,
        }
      );

      if (response.status >= 400) {
        const errBody = response.data;
        const hfMsg =
          typeof errBody?.error === "string"
            ? errBody.error
            : errBody?.error?.message || JSON.stringify(errBody);
        lastFailure = {
          status: response.status,
          detail: `${model}: ${hfMsg}`,
        };
        if (
          response.status === 400 ||
          response.status === 404 ||
          response.status === 422
        ) {
          continue;
        }
        if (response.status === 403) {
          return res.status(502).json({
            message:
              "Hugging Face denied access (403). Create a fine-grained token at https://huggingface.co/settings/tokens with permission: Make calls to Inference Providers. Then set HF_API_TOKEN in gpt-service/.env and restart.",
            detail: hfMsg,
          });
        }
        return res.status(502).json({
          message: "Hugging Face request failed.",
          detail: hfMsg,
        });
      }

      const answer = String(
        response.data?.choices?.[0]?.message?.content || ""
      ).trim();
      if (answer) {
        try {
          await ChatMessage.create({
            userId,
            question,
            answer,
            model,
          });
        } catch (dbErr) {
          console.error("ChatMessage save failed:", dbErr.message);
        }
        return res.status(200).json({
          success: true,
          data: { answer, model },
        });
      }
      lastFailure = {
        status: 502,
        detail: `${model}: empty answer payload`,
      };
    }

    return res.status(502).json({
      message: "Hugging Face request failed.",
      detail:
        lastFailure?.detail ||
        "No compatible model returned a valid response.",
    });
  } catch (error) {
    const detail =
      error.response?.data?.error ||
      error.response?.data ||
      error.message ||
      "Failed to call Hugging Face.";
    return res.status(500).json({
      message: "Failed to get response from Hugging Face.",
      detail: typeof detail === "string" ? detail : JSON.stringify(detail),
    });
  }
});

module.exports = router;
