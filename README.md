# learn-eng
# 🌟 English Conversation Coach

**Offline English-speaking practice app powered by whisper.cpp (STT) and Piper (TTS).**
Practice real dialogues, speak naturally, and get pronunciation feedback — all processed on your device.

> 💡 Works **100% offline** once installed.
> No API keys. No internet. No cloud. Everything runs locally.

---

# 🚀 Quick Start (Recommended)

This project includes a **fully automated installer**.
After cloning, just run:

```bash
git clone https://github.com/rahulhumie/learn-eng
cd learn-eng
./setup.sh
```

The installer will automatically:

* ✓ Download & build **whisper.cpp**
* ✓ Download the **Whisper base.en model**
* ✓ Download **Piper TTS**
* ✓ Download the **Amy voice model**
* ✓ Install **Node.js dependencies**
* ✓ Install **ffmpeg** (if missing)
* ✓ Create the `.env` file with correct paths
* ✓ Make everything ready in **one step**

⏱ Takes **5–10 minutes** depending on your internet speed.

After setup:

```bash
npm start
```

Then open:

```
http://localhost:8000
```

---

# 🎯 What This App Does

* Speak through real conversation scenarios
* App speaks its part (Piper TTS)
* You speak your part (whisper.cpp STT)
* Your response is checked with simple NLP scoring
* Get instant feedback and retry
* Fully offline — no data leaves your device

Great for beginners, kids, or conversational practice.

---

# 📦 Prerequisites

You only need:

* **macOS or Linux**
  *(Windows users can use WSL2)*
* **Node.js 18+**
* **Python 3 + pip**
* **Homebrew (macOS)** or **apt (Linux)**
* Basic build tools (make, cmake)

> If something is missing, the setup script will tell you.

---

# 🛠 Manual Setup (If You Don’t Want the Script)

### 1. Install dependencies

```bash
npm install
pip3 install piper-tts
```

### 2. Install whisper.cpp

```bash
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp
make
```

Download Whisper model:

```bash
bash ./models/download-ggml-model.sh base.en
```

### 3. Download Piper voice model

```bash
mkdir -p models
curl -L "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx" \
 -o models/en_US-amy-medium.onnx

curl -L "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx.json" \
 -o models/en_US-amy-medium.onnx.json
```

### 4. Install ffmpeg

```bash
brew install ffmpeg           # macOS
sudo apt install ffmpeg       # Linux
```

### 5. Create `.env`

```bash
cp .env.example .env
```

Update model paths.

---

# ▶️ Running the App

```bash
npm start
```

Then visit:

```
http://localhost:8000
```

You can:

* Choose a scenario
* Listen to AI lines
* Speak your lines
* Retry mismatched sentences
* View conversation log

---

# 🧠 How It Works

### 🟦 Speech-to-Text (STT): whisper.cpp

Browser records audio → sent to server → converted with ffmpeg → transcribed locally.

### 🟩 Text-to-Speech (TTS): Piper

Server runs Piper with your model → returns WAV → browser plays it.

### 🟧 NLP Matching

Your reply is scored using:

* Token overlap (Jaccard)
* Levenshtein similarity
* ≥ 80% = accepted

---


# ❗ Troubleshooting

### ❌ No Audio?

* Increase volume
* Browser sometimes needs one click before playing sound

### ❌ Mic not working?

* Allow mic in browser
* Reload the page

### ❌ Setup script fails?

* Run it with debug:

```bash
bash -x setup.sh
```

---



