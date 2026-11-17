
const express = require("express");
const { spawn } = require("child_process");

const app = express();
app.use(express.json());

let bot = null;
let logs = [];
let status = "STOPPED";

function addLog(message) {
  logs.push({
    time: new Date().toISOString(),
    message: String(message)
  });
  if (logs.length > 200) logs.shift();
}

app.get("/", (req, res) => {
  res.json({
    name: "Terminal Bot Backend",
    status,
    message: "Backend online"
  });
});

app.get("/status", (req, res) => {
  res.json({ status });
});

app.get("/logs", (req, res) => {
  res.json(logs);
});

app.post("/start", (req, res) => {
  if (bot) {
    return res.status(409).json({
      error: "Bot already running"
    });
  }

  bot = spawn("node", ["bot.js"]);

  status = "RUNNING";
  addLog("Bot process started");

  bot.stdout.on("data", data => {
    addLog(data.toString());
  });

  bot.stderr.on("data", data => {
    addLog(data.toString());
  });

  bot.on("close", code => {
    addLog("Bot exited with code " + code);
    bot = null;
    status = "STOPPED";
  });

  res.json({ status });
});

app.post("/stop", (req, res) => {
  if (!bot) {
    return res.status(409).json({
      error: "Bot is not running"
    });
  }

  bot.kill("SIGTERM");
  addLog("Stop requested");

  res.json({ message: "Stop requested" });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Backend listening on " + PORT);
});
