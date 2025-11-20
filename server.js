/* eslint-disable no-console */
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 8000;
const WHISPER_BIN = process.env.WHISPER_BIN || "./whisper.cpp/main";
const WHISPER_MODEL = process.env.WHISPER_MODEL || "./whisper.cpp/models/ggml-base.en.bin";
const PIPER_BIN = process.env.PIPER_BIN || "./piper/piper";
const PIPER_MODEL = process.env.PIPER_MODEL || "./piper/en_US-amy-medium.onnx";
const FFMPEG_BIN = process.env.FFMPEG_BIN || "ffmpeg";

const uploadDir = path.join(os.tmpdir(), "learn-eng-audio");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname)));

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, options);
    let stderr = "";
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr || `Command ${command} exited with code ${code}`));
      }
    });
  });
}

async function convertToWav(inputPath, outputPath) {
  await runCommand(FFMPEG_BIN, ["-y", "-i", inputPath, "-ar", "16000", "-ac", "1", outputPath]);
}

async function transcribeWithWhisper(wavPath) {
  const baseOutput = path.join(uploadDir, `whisper-${Date.now()}`);
  await runCommand(WHISPER_BIN, [
    "-m",
    WHISPER_MODEL,
    "-f",
    wavPath,
    "-otxt",
    "-of",
    baseOutput,
    "-pp",
    "-nt",
  ]);
  const transcriptPath = `${baseOutput}.txt`;
  const transcript = fs.readFileSync(transcriptPath, "utf8").trim();
  fs.rmSync(transcriptPath, { force: true });
  return transcript;
}

async function synthesizeWithPiper(text) {
  const outputPath = path.join(uploadDir, `piper-${Date.now()}.wav`);
  const configPath = PIPER_MODEL.replace(/\.onnx$/, ".onnx.json");
  const args = ["-m", PIPER_MODEL, "-f", outputPath];
  if (fs.existsSync(configPath)) {
    args.push("-c", configPath);
  }
  await new Promise((resolve, reject) => {
    const proc = spawn(PIPER_BIN, args, {
      stdio: ["pipe", "inherit", "inherit"],
    });
    proc.stdin.write(text);
    proc.stdin.end();
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Piper exited with code ${code}`));
    });
    proc.on("error", reject);
  });
  const audio = fs.readFileSync(outputPath);
  fs.rmSync(outputPath, { force: true });
  return audio;
}

app.post("/api/stt", upload.single("audio"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Audio file missing" });
  }

  const sourcePath = req.file.path;
  const wavPath = `${sourcePath}.wav`;

  try {
    await convertToWav(sourcePath, wavPath);
    const transcript = await transcribeWithWhisper(wavPath);
    return res.json({ transcript });
  } catch (error) {
    console.error("STT error:", error);
    return res.status(500).json({ error: "Transcription failed" });
  } finally {
    fs.rmSync(sourcePath, { force: true });
    fs.rmSync(wavPath, { force: true });
  }
});

app.post("/api/tts", async (req, res) => {
  const { text } = req.body || {};
  if (!text) {
    return res.status(400).json({ error: "Text is required" });
  }
  try {
    const audio = await synthesizeWithPiper(text);
    res.setHeader("Content-Type", "audio/wav");
    res.send(audio);
  } catch (error) {
    console.error("TTS error:", error);
    res.status(500).json({ error: "TTS generation failed" });
  }
});

app.listen(PORT, () => {
  console.log(`English Conversation Coach running on http://localhost:${PORT}`);
});

