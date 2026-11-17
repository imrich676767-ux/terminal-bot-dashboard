
console.log("BOT PROCESS STARTED");
console.log("Terminal connection ready.");

let count = 0;

const timer = setInterval(() => {
  count++;
  console.log("Bot heartbeat:", count);
}, 10000);

process.on("SIGTERM", () => {
  console.log("Bot stopping...");
  clearInterval(timer);
  process.exit(0);
});
