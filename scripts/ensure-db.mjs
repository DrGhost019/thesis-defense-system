import net from "net";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

function checkPg(port = 5432, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => {
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function main() {
  const isRunning = await checkPg();
  if (isRunning) {
    console.log("PostgreSQL is already running at 127.0.0.1:5432");
    return;
  }

  console.log("Starting PostgreSQL server in background...");
  const scriptPath = path.join(__dirname, "start-db.sh");
  
  const child = spawn(scriptPath, [], {
    detached: true,
    stdio: "ignore",
    cwd: projectRoot,
  });
  child.unref();

  // Wait for it to become ready
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await checkPg()) {
      console.log("PostgreSQL started and ready on 127.0.0.1:5432");
      return;
    }
  }

  console.warn("PostgreSQL did not report ready within 10 seconds. Check logs or start manually.");
}

main().catch(console.error);
