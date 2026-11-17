
const express = require("express");
const crypto = require("crypto");
const { spawn } = require("child_process");

const app = express();
app.use(express.json({ limit: "10kb" }));

let bot = null;
let logs = [];
let status = "STOPPED";

function log(message) {
  logs.push({
    time: new Date().toISOString(),
    message: String(message).slice(0, 2000)
  });
  if (logs.length > 200) logs.shift();
}

function authenticate(req, res, next) {
  const expected = process.env.API_TOKEN;
  const received = req.get("Authorization") || "";

  if (!expected || !received.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = Buffer.from(received.slice(7));
  const secret = Buffer.from(expected);

  if (
    token.length !== secret.length ||
    !crypto.timingSafeEqual(token, secret)
  ) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
}

app.get("/", (req, res) => {
  res.json({ service: "Terminal Bot Backend", status: "ONLINE" });
});

app.use(authenticate);

app.get("/status", (req, res) => {
  res.json({ status, pid: bot?.pid || null });
});

app.get("/logs", (req, res) => {
  res.json(logs);
});

app.post("/start", (req, res) => {
  if (bot) {
    return res.status(409).json({ error: "Already running" });
  }

  bot = spawn("node", ["bot.js"], {
    shell: false,
    stdio: ["ignore", "pipe", "pipe"]
  });

  status = "RUNNING";
  log("Bot process started");

  bot.stdout.on("data", data => log(data.toString()));
  bot.stderr.on("data", data => log(data.toString()));

  bot.on("error", error => {
    log("Process error: " + error.message);
    bot = null;
    status = "STOPPED";
  });

  bot.on("close", code => {
    log("Bot exited: " + code);
    bot = null;
    status = "STOPPED";
  });

  res.json({ status });
});

app.post("/stop", (req, res) => {
  if (!bot) {
    return res.status(409).json({ error: "Not running" });
  }

  bot.kill("SIGTERM");
  res.json({ message: "Stop requested" });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Backend listening on " + PORT);
});
