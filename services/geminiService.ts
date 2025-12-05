import { GoogleGenAI } from "@google/genai";

// Ensure API Key is present
const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const analyzeBattlefield = async (base64Image: string): Promise<string> => {
  if (!apiKey) return "SYSTEM ERROR: API KEY NOT DETECTED.";

  try {
    // Remove data URL prefix if present for the raw data
    const base64Data = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: base64Data
            }
          },
          {
            text: "You are a Sci-Fi Tactical AI. Analyze this battle screen (Neon Garden Defense). Identify the threat level of the red blocks (Zombies) and advise the pilot (Green Unit) in 1 short, military-style sentence. Use terms like 'Sector 4', 'Bio-signatures', 'Critical'."
          }
        ]
      }
    });

    return response.text || "NO DATA RECEIVED.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "COMMUNICATION LINK SEVERED.";
  }
};
