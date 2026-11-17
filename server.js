
const express = require("express");
const helmet = require("helmet");
const crypto = require("crypto");
const { spawn } = require("child_process");
const path = require("path");

const app = express();

app.use(helmet());
app.use(express.json({ limit: "10kb" }));

const PORT = process.env.PORT || 3000;
const API_TOKEN = process.env.API_TOKEN;

if (!API_TOKEN || API_TOKEN.length < 32) {
  console.error("API_TOKEN is missing or too short.");
  process.exit(1);
}

// Only these fixed demo scripts are allowed.
const BOT_CONFIG = {
  "node-demo": {
    runtime: "node",
    file: "bot.js"
  },
  "python-demo": {
    runtime: "python",
    file: "bot.py"
  }
};

const processes = new Map();

function authenticate(req, res, next) {
  const header = req.get("Authorization") || "";

  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const received = Buffer.from(header.slice(7));
  const expected = Buffer.from(API_TOKEN);

  if (
    received.length !== expected.length ||
    !crypto.timingSafeEqual(received, expected)
  ) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
}

function addLog(entry, message) {
  entry.logs.push({
    time: new Date().toISOString(),
    message: String(message).slice(0, 2000)
  });

  if (entry.logs.length > 200) {
    entry.logs.shift();
  }
}

function getBot(id) {
  if (!Object.hasOwn(BOT_CONFIG, id)) return null;
  return BOT_CONFIG[id];
}

app.get("/", (req, res) => {
  res.json({
    service: "CADENZZA TERMINAL",
    status: "ONLINE"
  });
});

app.use("/api", authenticate);

app.get("/api/bots", (req, res) => {
  const result = Object.keys(BOT_CONFIG).map(id => {
    const entry = processes.get(id);

    return {
      id,
      runtime: BOT_CONFIG[id].runtime,
      status: entry?.status || "STOPPED"
    };
  });

  res.json(result);
});

app.get("/api/bots/:id/logs", (req, res) => {
  if (!getBot(req.params.id)) {
    return res.status(404).json({ error: "Unknown bot" });
  }

  res.json(processes.get(req.params.id)?.logs || []);
});

app.post("/api/bots/:id/start", (req, res) => {
  const id = req.params.id;
  const config = getBot(id);

  if (!config) {
    return res.status(404).json({ error: "Unknown bot" });
  }

  const existing = processes.get(id);

  if (existing?.status === "RUNNING" ||
      existing?.status === "STARTING") {
    return res.status(409).json({ error: "Already running" });
  }

  const executable =
    config.runtime === "node" ? "node" : "python3";

  const filePath = path.join(__dirname, config.file);

  const entry = {
    status: "STARTING",
    logs: [],
    process: null
  };

  processes.set(id, entry);

  const child = spawn(executable, [filePath], {
    cwd: __dirname,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"]
  });

  entry.process = child;

  child.stdout.on("data", data => {
    addLog(entry, data.toString());
  });

  child.stderr.on("data", data => {
    addLog(entry, data.toString());
  });

  child.on("spawn", () => {
    entry.status = "RUNNING";
    addLog(entry, "Bot started");
  });

  child.on("error", error => {
    entry.status = "STOPPED";
    addLog(entry, "Process error: " + error.message);
    entry.process = null;
  });

  child.on("close", code => {
    entry.status = "STOPPED";
    addLog(entry, "Bot exited with code: " + code);
    entry.process = null;
  });

  res.status(202).json({
    id,
    status: "STARTING"
  });
});

app.post("/api/bots/:id/stop", (req, res) => {
  const id = req.params.id;
  const entry = processes.get(id);

  if (!getBot(id)) {
    return res.status(404).json({ error: "Unknown bot" });
  }

  if (!entry?.process) {
    return res.status(409).json({ error: "Not running" });
  }

  entry.process.kill("SIGTERM");

  res.json({
    id,
    status: "STOP_REQUESTED"
  });
});

app.get("/api/status", (req, res) => {
  const result = {};

  for (const id of Object.keys(BOT_CONFIG)) {
    result[id] = processes.get(id)?.status || "STOPPED";
  }

  res.json(result);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("CADENZZA TERMINAL listening on port " + PORT);
});
