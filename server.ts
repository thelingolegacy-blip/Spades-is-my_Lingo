/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Modality } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = 3000;

// Initialize GoogleGenAI client lazily & safely to avoid crashing if the key is missing
let aiClient: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required but missing. Add it in AI Studio Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// 1. Gemini AI Coach Strategy Chat Route
app.post("/api/gemini/chat", async (req, res) => {
  try {
    const { playerHand, gameLogs, userMessage, chatHistory } = req.body;
    const ai = getAI();

    const formattedHand = playerHand && Array.isArray(playerHand) 
      ? playerHand.map((c: any) => `${c.rank} of ${c.suit}`).join(", ")
      : "None";

    const formattedHistory = chatHistory && Array.isArray(chatHistory)
      ? chatHistory.map((h: any) => `${h.role === 'user' ? 'Player' : 'Coach'}: ${h.text}`).join("\n")
      : "";

    const systemPrompt = `You are "Sassy Ace", an elite, trash-talking, incredibly knowledgeable Spades coach. 
You know the street rules, "reneging", "sluffing", "getting set", and the danger of "sandbagging".
The player is asking you for help, trash-talking you, or asking for strategy. 
Provide a snappy, highly-personalized, street-smart response. Tell them what you think of their hand if relevant.
Keep it compact (max 2-3 sentences), highly engaging, and use authentic Spades slang/lingo!

PLAYER'S CURRENT HAND: [${formattedHand}]
RECENT TABLE ACTION:
${gameLogs ? gameLogs.slice(0, 5).join("\n") : "No action yet."}

CONVERSATION SO FAR:
${formattedHistory}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: userMessage || "Give me a quick tip on how to play my current hand!",
      config: {
        systemInstruction: systemPrompt,
        temperature: 1.0,
      }
    });

    res.json({ reply: response.text });
  } catch (err: any) {
    console.error("Gemini Chat Error:", err);
    res.status(500).json({ error: err.message || "Failed to contact Gemini AI Coach." });
  }
});

// 2. Gemini Live Announcer Commentary Route
app.post("/api/gemini/commentary", async (req, res) => {
  try {
    const { recentTrick, logs, leadSuit, tricksHistoryCount } = req.body;
    const ai = getAI();

    const formattedTrick = recentTrick && Array.isArray(recentTrick)
      ? recentTrick.map((p: any) => `${p.playerId} played ${p.card.rank} of ${p.card.suit}`).join(", ")
      : "None";

    const systemPrompt = `You are "Vince the Voice", a legendary live-action tournament Spades announcer, co-anchoring the Lingo World Series.
You are providing quick 1-sentence reactive commentary on the trick that was just completed.
Keep it extremely exciting, authentic, punchy, and short. Do not exceed 20 words.
Use terms like "Oh, they cut it with the trump!", "A masterclass sluff!", "They are sandbagging heavy!", "Caught 'em reneging!" if appropriate.

RECENT COMPLETED TRICK: ${formattedTrick}
LEAD SUIT WAS: ${leadSuit || "None"}
TOTAL TRICKS PLAYED SO FAR: ${tricksHistoryCount || 0}
RECENT GAME LOGS: ${logs ? logs.slice(0, 3).join(" | ") : ""}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: "Announce the play!",
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.95,
      }
    });

    res.json({ commentary: response.text });
  } catch (err: any) {
    console.error("Gemini Commentary Error:", err);
    res.status(500).json({ error: err.message || "Announcer offline." });
  }
});

// 3. Gemini Custom Player Avatar Generator Route
app.post("/api/gemini/generate-avatar", async (req, res) => {
  try {
    const { prompt, style } = req.body;
    const ai = getAI();

    const imagePrompt = `A high-quality 3D digital character avatar card of a Spades card game player, ${prompt || "cool person looking confident"}, styled in ${style || "cyberpunk neon street style"} theme, 1x1 aspect ratio, clean dark background, vector game art illustration card, vibrant colors.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-image",
      contents: {
        parts: [{ text: imagePrompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        }
      }
    });

    let base64Image = "";
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          base64Image = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
          break;
        }
      }
    }

    if (base64Image) {
      res.json({ imageUrl: base64Image });
    } else {
      res.status(500).json({ error: "Failed to extract image data from response." });
    }
  } catch (err: any) {
    console.error("Avatar Generation Error:", err);
    res.status(500).json({ error: err.message || "Image engine is currently busy or needs a valid billing setup." });
  }
});

// 4. Gemini AI Music Generation Route
app.post("/api/gemini/generate-music", async (req, res) => {
  try {
    const { mood } = req.body;
    const ai = getAI();

    const prompt = `Generate a high-energy, immersive, jazzy, or synthwave Spades lounge background music track for a virtual high-stakes elite Spades tournament. Mood: ${mood || "intense elite club rhythm"}. Ensure it sounds professional, authentic, and retro-luxurious.`;

    // Attempt to call the Lyria music generator
    const response = await ai.models.generateContentStream({
      model: "lyria-3-clip-preview",
      contents: prompt,
      config: {
        responseModalities: [Modality.AUDIO],
      }
    });

    let audioBase64 = "";
    let mimeType = "audio/wav";

    for await (const chunk of response) {
      const parts = chunk.candidates?.[0]?.content?.parts;
      if (!parts) continue;
      for (const part of parts) {
        if (part.inlineData?.data) {
          if (!audioBase64 && part.inlineData.mimeType) {
            mimeType = part.inlineData.mimeType;
          }
          audioBase64 += part.inlineData.data;
        }
      }
    }

    if (audioBase64) {
      res.json({ audioData: audioBase64, mimeType });
    } else {
      res.status(500).json({ error: "No audio tracks returned from model." });
    }
  } catch (err: any) {
    console.error("Music Generation Error:", err);
    res.status(500).json({ error: err.message || "Music engine is currently busy." });
  }
});

// Vite Middleware integration for Full-stack dev support & Production serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Spades Server] running on http://localhost:${PORT} under NODE_ENV=${process.env.NODE_ENV || "development"}`);
  });
}

startServer();
