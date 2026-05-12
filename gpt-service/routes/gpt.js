const express = require("express");
const axios = require("axios");
const verifyToken = require("../middleware/verifyToken");
const ChatMessage = require("../models/ChatMessage");
const {
  buildPedagogicalPrompt,
  COGNITIVE_STYLES,
  LOAD_LEVELS,
  FRUSTRATION_LEVELS,
} = require("../components/promptBuilder");
const { buildEducationalVisual } = require("../services/educationalVisualService");
const { hfChatCompletion } = require("../services/hfChat");

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

/**
 * Assembles the pedagogical prompt from client-provided subsection extracts.
 * Public (no JWT): course detail page is public; payload is user-supplied text only.
 */
router.post("/build-prompt", (req, res) => {
  try {
    const body = req.body || {};
    const prompt = buildPedagogicalPrompt({
      courseName: body.courseName,
      subsectionTitle: body.subsectionTitle,
      transcriptText: body.transcriptText,
      pptText: body.pptText,
      pdfText: body.pdfText,
      studentProfile: body.studentProfile,
      cognitiveStyle: body.cognitiveStyle,
      cognitiveLoad: body.cognitiveLoad,
    });
    return res.status(200).json({
      success: true,
      data: {
        prompt,
        schema: {
          cognitiveStyles: COGNITIVE_STYLES,
          loadLevels: LOAD_LEVELS,
          frustrationLevels: FRUSTRATION_LEVELS,
        },
      },
    });
  } catch (error) {
    return res.status(400).json({
      message: error?.message || "Failed to build prompt.",
    });
  }
});

/**
 * Summarize extracted PPT + PDF content for visual learners.
 * Public (no JWT): used on public course detail page.
 */
router.post("/summarize-material", async (req, res) => {
  try {
    const body = req.body || {};
    const pptText = String(body.pptText || "").trim();
    const pdfText = String(body.pdfText || "").trim();
    const subsectionTitle = String(body.subsectionTitle || "").trim();
    const courseName = String(body.courseName || "").trim();
    const cognitiveStyle = String(body.cognitiveStyle || "").trim().toLowerCase();

    if (!pptText && !pdfText) {
      return res.status(400).json({
        message: "At least one extracted source (PPT or PDF) is required.",
      });
    }

    const system = `You are an educational summarizer.
Return ONLY valid JSON:
{
  "summary": string,
  "main_points": string[]
}
Rules:
- The summary must include all major ideas from the provided material.
- Keep it concise and classroom-friendly.
- main_points should contain 4-10 concrete bullets.
- Do not invent facts not present in the source.`;

    const user = [
      courseName ? `Course: ${courseName}` : "",
      subsectionTitle ? `Subsection: ${subsectionTitle}` : "",
      cognitiveStyle ? `Learner preference: ${cognitiveStyle}` : "",
      "",
      "Extracted PPT text:",
      pptText || "(none)",
      "",
      "Extracted PDF text:",
      pdfText || "(none)",
      "",
      "Task: Create a merged summary that includes all main points.",
    ]
      .filter(Boolean)
      .join("\n");

    const { text, model } = await hfChatCompletion(
      [
        { role: "system", content: system },
        { role: "user", content: user.slice(0, 16000) },
      ],
      { max_tokens: 1400, temperature: 0.15 }
    );

    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }

    const summary =
      String(parsed?.summary || "").trim() || String(text || "").trim();
    const main_points = Array.isArray(parsed?.main_points)
      ? parsed.main_points.map((x) => String(x).trim()).filter(Boolean)
      : [];

    return res.status(200).json({
      success: true,
      data: { summary, main_points, model },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to summarize extracted materials.",
      detail: error?.message || "Unknown error",
    });
  }
});

/**
 * Analyze lesson text and produce structured visuals (diagram spec and/or optional raster image).
 */
router.post("/images/generate", verifyToken, async (req, res) => {
  try {
    const body = req.body || {};
    const data = await buildEducationalVisual({
      lessonText: body.lessonText,
      studentAge: body.studentAge,
      imageStyle: body.imageStyle,
      language: body.language,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("[gpt images/generate]", error?.message || error);
    const msg = error?.message || "Failed to generate educational visual.";
    if (
      error?.code === "HF_INSUFFICIENT_CREDITS" ||
      /depleted your monthly|included credits|pre-?paid credits|subscribe to PRO/i.test(msg)
    ) {
      return res.status(503).json({
        code: "HF_INSUFFICIENT_CREDITS",
        message:
          "Hugging Face inference credits for this token are used up. Add credits or upgrade at https://huggingface.co/settings/billing — or use another HF_API_TOKEN in gpt-service/.env.",
      });
    }
    const status = /required|Invalid|Empty/i.test(msg) ? 400 : 500;
    return res.status(status).json({
      message: msg,
      detail: error?.response?.data ? String(JSON.stringify(error.response.data)) : undefined,
    });
  }
});

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
          max_tokens: 1500,
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
