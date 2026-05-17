const express = require("express");
const path = require("path");
const { spawn } = require("child_process");
const axios = require("axios");
const { ensureRagServiceReady, reloadRagService, RAG_SERVICE_URL } = require("../services/ragServiceManager");

const router = express.Router();
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || "";
const PYTHON_BIN = process.env.PYTHON_BIN || "python";

function requireAdminKey(req, res, next) {
  const incomingKey = req.headers["x-admin-key"];
  if (!ADMIN_API_KEY || incomingKey !== ADMIN_API_KEY) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

function runPythonScript(scriptName) {
  return new Promise((resolve, reject) => {
    const backendRoot = path.join(__dirname, "..");
    const processRef = spawn(PYTHON_BIN, [`python-scripts/${scriptName}`], {
      cwd: backendRoot,
      env: process.env,
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    processRef.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    processRef.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    processRef.on("error", (error) => {
      reject(error);
    });

    processRef.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
      } else {
        reject(new Error(stderr || stdout || `${scriptName} exited with code ${code}`));
      }
    });
  });
}

router.get("/rag/status", requireAdminKey, async (req, res) => {
  try {
    await ensureRagServiceReady();
    const status = await axios.get(`${RAG_SERVICE_URL}/health`, { timeout: 10000 });
    res.json(status.data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/rag/reload", requireAdminKey, async (req, res) => {
  try {
    const result = await reloadRagService();
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/rag/rebuild", requireAdminKey, async (req, res) => {
  try {
    const fetchResult = await runPythonScript("fetch_public_rag_sources.py");
    const populateResult = await runPythonScript("populate_chroma.py");
    const reloadResult = await reloadRagService();

    res.json({
      status: "ok",
      fetch: fetchResult.stdout,
      populate: populateResult.stdout,
      reload: reloadResult,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
