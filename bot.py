
import time
import signal
import sys

running = True

def stop_bot(signum, frame):
    global running
    print("Python bot stopping...")
    running = False

signal.signal(signal.SIGTERM, stop_bot)

print("CADENZZA PYTHON BOT STARTED")
print("Python terminal connection ready.")

count = 0

while running:
    count += 1
    print(f"Python bot heartbeat: {count}")
    time.sleep(10)

print("Python bot stopped.")
sys.exit(0)
