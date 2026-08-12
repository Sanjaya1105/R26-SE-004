require("dotenv").config();
const express = require("express");
const cors = require("cors");
const deepseekRoutes = require("./routes/deepseek");

const app = express();
const port = process.env.PORT || 5004;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "deepseek-service" });
});

app.use("/api/deepseek", deepseekRoutes);

app.listen(port, () => {
  console.log(`deepseek-service listening on http://localhost:${port}`);
});
