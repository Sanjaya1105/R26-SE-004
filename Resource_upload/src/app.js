const express = require("express");
const uploadRoutes = require("./routes/upload.routes");
const handleErrors = require("./middleware/error.middleware");

const app = express();

app.use(express.json());
app.use("/", uploadRoutes);
app.use(handleErrors);

module.exports = app;
