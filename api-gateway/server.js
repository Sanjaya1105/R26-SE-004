const express = require("express");
const cors = require("cors");
const { createProxyMiddleware } = require("http-proxy-middleware");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const FRONTEND_URLS = process.env.FRONTEND_URLS || "";
const BACKEND_SERVICE_URL =
  process.env.BACKEND_SERVICE_URL || "http://localhost:5001";
const EXPLAINABLE_AI_BACKEND_URL =
  process.env.EXPLAINABLE_AI_BACKEND_URL || "http://localhost:8000";
const allowedOrigins = [
  FRONTEND_URL,
  ...FRONTEND_URLS.split(",").map((origin) => origin.trim()).filter(Boolean),
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.get("/", (req, res) => {
  res.json({
    message: "API Gateway server is running",
    backendService: BACKEND_SERVICE_URL,
  });
});

app.use(
  "/api/auth",
  createProxyMiddleware({
    target: BACKEND_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path) => `/api/auth${path}`,
  })
);

app.use(
  "/api/dashboard",
  createProxyMiddleware({
    target: BACKEND_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path) => `/api/dashboard${path}`,
  })
);

app.use(
  "/api/lessons",
  createProxyMiddleware({
    target: BACKEND_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path) => `/api/lessons${path}`,
  })
);

app.use(
  "/api/explainable",
  createProxyMiddleware({
    target: EXPLAINABLE_AI_BACKEND_URL,
    changeOrigin: true,
    pathRewrite: (path) => `/api${path}`,
  })
);

app.listen(PORT, () => {
  console.log(`API Gateway running on http://localhost:${PORT}`);
});
