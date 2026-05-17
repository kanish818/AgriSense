const axios = require("axios");
const net = require("net");
const path = require("path");
const { spawn } = require("child_process");

const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || "http://127.0.0.1:8000";
const RAG_SERVICE_HEALTH_URL = `${RAG_SERVICE_URL.replace(/\/$/, "")}/health`;
const PYTHON_BIN = process.env.PYTHON_BIN || "python";
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || "";

let ragServiceProcess = null;
let startingPromise = null;
const serviceEndpoint = new URL(RAG_SERVICE_URL);
const serviceHost = serviceEndpoint.hostname || "127.0.0.1";
const servicePort = Number(serviceEndpoint.port || 80);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function isServiceHealthy() {
  try {
    const response = await axios.get(RAG_SERVICE_HEALTH_URL, { timeout: 1500 });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

async function waitForHealth(timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isServiceHealthy()) {
      return true;
    }
    await sleep(1000);
  }
  return false;
}

function isPortListening(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });

    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });

    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function ensureRagServiceReady() {
  if (await isServiceHealthy()) {
    return;
  }

  if (startingPromise) {
    return startingPromise;
  }

  startingPromise = (async () => {
    if (await isServiceHealthy()) {
      return;
    }

    if (await isPortListening(serviceHost, servicePort)) {
      const healthy = await waitForHealth(45000);
      if (healthy) {
        return;
      }
      throw new Error("RAG service port is occupied but health check never became ready");
    }

    const backendRoot = path.join(__dirname, "..");
    ragServiceProcess = spawn(PYTHON_BIN, ["python-scripts/rag_service.py"], {
      cwd: backendRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    ragServiceProcess.stdout.on("data", (chunk) => {
      process.stdout.write(`[rag-service] ${chunk}`);
    });

    ragServiceProcess.stderr.on("data", (chunk) => {
      process.stderr.write(`[rag-service] ${chunk}`);
    });

    ragServiceProcess.on("exit", (code) => {
      console.warn(`RAG service exited with code ${code}`);
      ragServiceProcess = null;
    });

    const healthy = await waitForHealth();
    if (!healthy) {
      throw new Error("RAG service failed to become healthy");
    }
  })();

  try {
    await startingPromise;
  } finally {
    startingPromise = null;
  }
}

module.exports = {
  RAG_SERVICE_URL: RAG_SERVICE_URL.replace(/\/$/, ""),
  ensureRagServiceReady,
  reloadRagService: async () => {
    await ensureRagServiceReady();
    const response = await axios.post(
      `${RAG_SERVICE_URL.replace(/\/$/, "")}/admin/reload`,
      { admin_key: ADMIN_API_KEY },
      { timeout: 10000 }
    );
    return response.data;
  },
};
