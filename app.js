const SCENARIOS = {
  train: {
    title: "Scenario 1 – Train Inquiry",
    description: "Assist a traveler with train schedule details.",
    exchanges: [
      {
        prompt: "Excuse me, Madam.",
        response: "Yes, Please.",
      },
      {
        prompt: "Could you please tell me, what time is the next train to Ahmedabad?",
        response: "Yes. The next departure is scheduled at 6.45pm.",
      },
      {
        prompt: "Are you aware, what time it will reach Ahmedabad?",
        response: "Yes. It reaches Ahmedabad around 4 am, early morning.",
      },
    ],
    closings: ["Ok. Thank you for the information."],
  },
  loan: {
    title: "Scenario 2 – Home Loan Information",
    description: "Guide a visitor to the correct counter for loan queries.",
    exchanges: [
      {
        prompt:
          "Excuse me. Would you please tell me, who could give me information about the home loan?",
        response:
          "Yes. The lady at the 3rd counter is from the home loan department. She would assist you.",
      },
      {
        prompt: "Excuse me madam, I would like to get the information about the home loan.",
        response:
          "Sure. You please fill in this form and I would give you all the related information.",
      },
    ],
    closings: ["Thank you!", "Thank you!"],
  },
  college: {
    title: "Scenario 3 – College Function Chief Guest",
    description: "Share details about the special guest at the function.",
    exchanges: [
      {
        prompt: "Hello, who is the chief guest for today’s college function?",
        response: "Mr. Joshi has been invited as the chief guest.",
      },
      {
        prompt: "When will he be coming here?",
        response: "He has confirmed that he will reach the venue by 6 p.m.",
      },
      {
        prompt: "What is his occupation?",
        response: "Don’t you know him? He is a famous social worker.",
      },
      {
        prompt: "Okay, is he the one who was recently in the news for movement against child labour?",
        response: "Yes, you got it right.",
      },
    ],
    closings: [],
  },
};

const API_BASE = window.location.origin;

const state = {
  scenario: null,
  exchangeIndex: 0,
  pendingExchange: null,
  threshold: 0.8,
  isRecording: false,
  mediaStream: null,
  mediaRecorder: null,
  recordChunks: [],
  recordTimeout: null,
  manualResolver: null,
  lastTranscript: "",
};

const selectors = {
  panels: {
    landing: document.querySelector("#landing"),
    scenarioSelect: document.querySelector("#scenarioSelect"),
    conversation: document.querySelector("#conversation"),
  },
  buttons: {
    startLearning: document.querySelector("#startLearningBtn"),
    back: document.querySelector("#backToScenarios"),
    begin: document.querySelector("#beginConversationBtn"),
    repeat: document.querySelector("#repeatPromptBtn"),
    retry: document.querySelector("#retryBtn"),
    submitManual: document.querySelector("#submitManualBtn"),
    mic: document.querySelector("#micToggleBtn"),
  },
  scenarioCards: document.querySelectorAll(".scenario-card"),
  scenarioHeading: document.querySelector("#scenarioHeading"),
  statusBadge: document.querySelector("#statusBadge"),
  stepCounter: document.querySelector("#stepCounter"),
  aiLine: document.querySelector("#aiLine"),
  expectedLine: document.querySelector("#expectedLine"),
  transcript: document.querySelector("#transcriptText"),
  score: document.querySelector("#similarityScore"),
  manual: {
    container: document.querySelector("#manualInputContainer"),
    textarea: document.querySelector("#manualInput"),
  },
  logList: document.querySelector("#conversationLog"),
  logTemplate: document.querySelector("#logItemTemplate"),
};

const supportsMediaRecorder = Boolean(window.MediaRecorder && navigator.mediaDevices?.getUserMedia);

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "the",
  "to",
  "is",
  "of",
  "on",
  "in",
  "for",
  "it",
  "this",
  "that",
  "please",
  "you",
  "me",
  "i",
  "he",
  "she",
  "they",
  "we",
  "am",
  "be",
  "was",
  "were",
  "will",
  "would",
  "could",
  "should",
  "do",
  "does",
  "did",
  "have",
  "has",
  "had",
]);

function showPanel(panelKey) {
  Object.entries(selectors.panels).forEach(([key, panel]) => {
    panel.classList.toggle("active", key === panelKey);
  });

  const shouldShowBack = panelKey === "scenarioSelect" || panelKey === "conversation";
  selectors.buttons.back.classList.toggle("visible", shouldShowBack);
}

function resetConversationState() {
  state.exchangeIndex = 0;
  state.pendingExchange = null;
  state.lastTranscript = "";
  selectors.aiLine.textContent = "Select a scenario to begin.";
  selectors.expectedLine.textContent = "—";
  selectors.transcript.textContent = "—";
  selectors.score.textContent = "0%";
  selectors.logList.innerHTML = "";
  selectors.buttons.begin.disabled = false;
  selectors.buttons.begin.textContent = "Begin Conversation";
  selectors.buttons.repeat.disabled = true;
  selectors.buttons.retry.disabled = true;
  selectors.buttons.mic.disabled = true;
  selectors.buttons.mic.classList.remove("recording");
  selectors.manual.container.classList.add("hidden");
  selectors.stepCounter.textContent = "0 / 0";
  setStatus("idle", "Idle");
}

function selectScenario(id) {
  const scenario = SCENARIOS[id];
  if (!scenario) return;
  state.scenario = scenario;
  resetConversationState();
  selectors.scenarioHeading.textContent = scenario.title;
  selectors.aiLine.textContent =
    "Great choice! When you are ready, tap “Begin Conversation”.";
  selectors.expectedLine.textContent = "Listen first, then respond when prompted.";
  selectors.stepCounter.textContent = `0 / ${scenario.exchanges.length}`;
  showPanel("conversation");
}

function setStatus(status, label) {
  selectors.statusBadge.className = `status ${status}`;
  selectors.statusBadge.textContent = label;
}

function playAudioUrl(url) {
  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    audio.onended = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    audio.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    audio.play().catch(reject);
  });
}

async function speakText(text) {
  selectors.aiLine.textContent = text;
  setStatus("speaking", "Generating audio…");
  try {
    const response = await fetch(`${API_BASE}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) {
      throw new Error(`TTS failed: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    await playAudioUrl(url);
    setStatus("speaking", "AI speaking");
  } catch (error) {
    console.warn("TTS fallback (showing text only):", error);
    setStatus("speaking", "AI prompt (read text)");
    // Add a small delay so user can read the text
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
}

function requestManualTranscript() {
  selectors.manual.container.classList.remove("hidden");
  selectors.manual.textarea.value = "";
  selectors.manual.textarea.focus();
  return new Promise((resolve) => {
    state.manualResolver = resolve;
  });
}

function manualFallback() {
  if (!state.pendingExchange) return;
  requestManualTranscript().then((text) => {
    if (!text) return;
    evaluateResponse(text, state.pendingExchange).catch((error) =>
      console.error("Manual evaluation failed", error),
    );
  });
}

async function ensureMicAccess() {
  if (!supportsMediaRecorder) {
    throw new Error("media-not-supported");
  }
  if (!state.mediaStream) {
    state.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  }
  return state.mediaStream;
}

function resetRecorderState() {
  state.recordChunks = [];
  if (state.recordTimeout) {
    clearTimeout(state.recordTimeout);
    state.recordTimeout = null;
  }
  selectors.buttons.mic.classList.remove("recording");
  selectors.buttons.mic.textContent = "🎙️ Molly Mic — Tap & Speak";
}

async function startRecording() {
  try {
    await ensureMicAccess();
  } catch (error) {
    console.error(error);
    setStatus("retry", "Microphone unavailable");
    manualFallback();
    return;
  }

  resetRecorderState();
  state.recordChunks = [];
  const recorder = new MediaRecorder(state.mediaStream, { mimeType: "audio/webm" });
  state.mediaRecorder = recorder;
  recorder.ondataavailable = (event) => {
    if (event.data.size) state.recordChunks.push(event.data);
  };
  recorder.onstop = handleRecordingStop;
  recorder.start();
  state.isRecording = true;
  selectors.buttons.mic.classList.add("recording");
  selectors.buttons.mic.textContent = "Stop Molly Mic";
  setStatus("listening", "Recording…");

  state.recordTimeout = setTimeout(() => {
    stopRecording();
  }, 7000);
}

function stopRecording() {
  if (!state.mediaRecorder) return;
  if (state.mediaRecorder.state !== "inactive") {
    state.mediaRecorder.stop();
  }
}

async function handleRecordingStop() {
  state.isRecording = false;
  selectors.buttons.mic.disabled = true;
  selectors.buttons.mic.classList.remove("recording");
  selectors.buttons.mic.textContent = "Processing…";
  const blob = new Blob(state.recordChunks, { type: "audio/webm" });
  if (!blob.size) {
    setStatus("retry", "No audio captured");
    selectors.buttons.mic.disabled = false;
    selectors.buttons.mic.textContent = "🎙️ Molly Mic — Tap & Speak";
    return;
  }
  try {
    await submitAudio(blob);
  } catch (error) {
    console.error(error);
    setStatus("retry", "Could not transcribe audio");
    selectors.buttons.mic.disabled = false;
    selectors.buttons.mic.textContent = "🎙️ Molly Mic — Tap & Speak";
    manualFallback();
  }
}

async function submitAudio(blob) {
  const formData = new FormData();
  formData.append("audio", blob, "response.webm");
  const response = await fetch(`${API_BASE}/api/stt`, {
    method: "POST",
    body: formData,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "stt-failed");
  }
  const transcript = payload.transcript || "";
  if (!transcript) throw new Error("empty-transcript");
  selectors.manual.container.classList.add("hidden");
  await evaluateResponse(transcript, state.pendingExchange);
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token && !STOP_WORDS.has(token));
}

function levenshtein(a, b) {
  const matrix = Array.from({ length: b.length + 1 }, () =>
    new Array(a.length + 1).fill(0),
  );

  for (let i = 0; i <= b.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= a.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i += 1) {
    for (let j = 1; j <= a.length; j += 1) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] =
          Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + 1);
      }
    }
  }

  return matrix[b.length][a.length];
}

function computeSimilarity(input, expected) {
  const cleanInputTokens = tokenize(input);
  const cleanExpectedTokens = tokenize(expected);
  if (!cleanInputTokens.length || !cleanExpectedTokens.length) {
    return 0;
  }

  const setInput = new Set(cleanInputTokens);
  const setExpected = new Set(cleanExpectedTokens);
  const intersection = [...setInput].filter((token) => setExpected.has(token)).length;
  const union = new Set([...cleanInputTokens, ...cleanExpectedTokens]).size || 1;
  const jaccard = intersection / union;

  const cleanInput = cleanInputTokens.join(" ");
  const cleanExpected = cleanExpectedTokens.join(" ");
  const distance = levenshtein(cleanInput, cleanExpected);
  const maxLen = Math.max(cleanInput.length, cleanExpected.length) || 1;
  const normalizedLevenshtein = 1 - distance / maxLen;

  const combined = (jaccard * 0.5 + normalizedLevenshtein * 0.5) * 100;
  return Math.max(0, Math.min(100, Math.round(combined)));
}

function appendLog({ prompt, transcript, score }) {
  const clone = selectors.logTemplate.content.cloneNode(true);
  clone.querySelector(".log-ai").textContent = `AI: ${prompt}`;
  clone.querySelector(".log-user").textContent = `You: ${transcript}`;
  clone.querySelector(".log-score").textContent = `Similarity: ${score}%`;
  selectors.logList.appendChild(clone);
}

async function evaluateResponse(transcript, exchange) {
  selectors.buttons.mic.disabled = false;
  selectors.buttons.mic.textContent = "🎙️ Molly Mic — Tap & Speak";
  state.lastTranscript = transcript;
  selectors.transcript.textContent = transcript || "—";
  const score = computeSimilarity(transcript, exchange.response);
  selectors.score.textContent = `${score}%`;

  if (score >= state.threshold * 100) {
    setStatus("match", "Great match!");
    appendLog({ prompt: exchange.prompt, transcript, score });
    selectors.buttons.retry.disabled = true;
    selectors.manual.container.classList.add("hidden");
    state.exchangeIndex += 1;
    selectors.stepCounter.textContent = `${Math.min(state.exchangeIndex, state.scenario.exchanges.length)} / ${state.scenario.exchanges.length}`;

    if (state.exchangeIndex >= state.scenario.exchanges.length) {
      await finishScenario();
      return;
    }

    state.pendingExchange = null;
    setTimeout(() => {
      playCurrentExchange();
    }, 800);
  } else {
    setStatus("retry", "Please try again");
    selectors.buttons.retry.disabled = false;
    selectors.buttons.mic.disabled = false;
  }
}

async function playCurrentExchange() {
  if (!state.scenario) {
    console.error("No scenario selected");
    return;
  }
  if (state.exchangeIndex >= state.scenario.exchanges.length) {
    await finishScenario();
    return;
  }

  const exchange = state.scenario.exchanges[state.exchangeIndex];
  selectors.expectedLine.textContent = exchange.response;
  selectors.buttons.repeat.disabled = true;
  selectors.buttons.mic.disabled = true;
  try {
    await speakText(exchange.prompt);
  } catch (error) {
    console.error("Error speaking text:", error);
  }
  state.pendingExchange = exchange;
  selectors.buttons.mic.disabled = false;
  selectors.buttons.mic.textContent = "🎙️ Molly Mic — Tap & Speak";
  setStatus("listening", "Tap Molly Mic to answer");
}

async function finishScenario() {
  setStatus("match", "Scenario complete!");
  selectors.buttons.begin.disabled = false;
  selectors.buttons.begin.textContent = "Restart Scenario";
  selectors.buttons.repeat.disabled = true;
  selectors.buttons.retry.disabled = true;
  selectors.buttons.mic.disabled = true;
  selectors.expectedLine.textContent = "All required responses completed.";

  for (const line of state.scenario.closings || []) {
    await speakText(line);
  }
}

function handleBeginConversation() {
  if (!state.scenario) {
    console.error("Cannot begin: no scenario selected");
    return;
  }
  console.log("Beginning conversation for scenario:", state.scenario.title);
  state.exchangeIndex = 0;
  state.pendingExchange = null;
  selectors.logList.innerHTML = "";
  selectors.buttons.begin.disabled = true;
  selectors.buttons.repeat.disabled = true;
  selectors.buttons.retry.disabled = true;
  selectors.buttons.mic.disabled = true;
  selectors.manual.container.classList.add("hidden");
  selectors.stepCounter.textContent = `0 / ${state.scenario.exchanges.length}`;
  playCurrentExchange().catch(error => {
    console.error("Error in playCurrentExchange:", error);
    setStatus("retry", "Error starting conversation");
    selectors.buttons.begin.disabled = false;
  });
}

function handleRetry() {
  if (!state.scenario) return;
  if (state.exchangeIndex >= state.scenario.exchanges.length) return;
  setStatus("listening", "Tap Molly Mic to answer");
  selectors.buttons.mic.disabled = false;
  selectors.buttons.mic.textContent = "🎙️ Molly Mic — Tap & Speak";
  selectors.buttons.retry.disabled = true;
}

async function handleRepeat() {
  if (!state.scenario) return;
  if (state.exchangeIndex >= state.scenario.exchanges.length) return;
  const exchange = state.scenario.exchanges[state.exchangeIndex];
  await speakText(exchange.prompt);
  selectors.buttons.mic.disabled = false;
  state.pendingExchange = exchange;
  setStatus("listening", "Tap Molly Mic to answer");
}

function handleManualSubmit() {
  const value = selectors.manual.textarea.value.trim();
  if (!value) return;
  if (state.manualResolver) {
    state.manualResolver(value);
    state.manualResolver = null;
    selectors.manual.container.classList.add("hidden");
  }
}

function handleBack() {
  if (state.isRecording) {
    stopRecording();
  }
  state.scenario = null;
  resetConversationState();
  showPanel("scenarioSelect");
}

function handleMicToggle() {
  if (selectors.buttons.mic.disabled) return;
  if (!state.pendingExchange) return;
  if (!supportsMediaRecorder) {
    manualFallback();
    return;
  }
  if (state.isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
}

function initEvents() {
  selectors.buttons.startLearning.addEventListener("click", () => {
    showPanel("scenarioSelect");
  });

  selectors.buttons.back.addEventListener("click", handleBack);

  selectors.buttons.begin.addEventListener("click", handleBeginConversation);
  selectors.buttons.retry.addEventListener("click", handleRetry);
  selectors.buttons.repeat.addEventListener("click", handleRepeat);
  selectors.buttons.submitManual.addEventListener("click", handleManualSubmit);
  selectors.buttons.mic.addEventListener("click", handleMicToggle);
  selectors.manual.textarea.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleManualSubmit();
    }
  });

  selectors.scenarioCards.forEach((card) => {
    card.addEventListener("click", () => {
      const scenarioId = card.getAttribute("data-scenario-id");
      selectScenario(scenarioId);
    });
  });
}

function init() {
  if (!supportsMediaRecorder) {
    selectors.manual.container.classList.remove("hidden");
    selectors.manual.container.querySelector("label").textContent =
      "Microphone APIs unavailable. Type your responses:";
  }
  showPanel("landing");
  setStatus("idle", "Idle");
  initEvents();
}

document.addEventListener("DOMContentLoaded", init);

