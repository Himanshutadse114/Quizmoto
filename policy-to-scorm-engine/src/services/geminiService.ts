import { GoogleGenAI, Type } from "@google/genai";
import JSZip from "jszip";

const apiKey = (window as any).process?.env?.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey });

export interface PolicySlide {
  title: string;
  content: string;
  keyPoints: string[];
  imageQuery: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
}

export interface PolicyAnalysis {
  title: string;
  summary: string;
  slides: PolicySlide[];
  quiz: QuizQuestion[];
}

export type DetailLevel = 'detailed' | 'condensed' | 'summary';

async function extractTextFromPptx(fileData: string): Promise<string> {
  try {
    const zip = new JSZip();
    const contents = await zip.loadAsync(fileData, { base64: true });
    let fullText = "";
    
    const slideFiles = Object.keys(contents.files).filter(name => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'));
    slideFiles.sort((a, b) => {
      const numA = parseInt(a.replace(/[^\d]/g, '') || "0");
      const numB = parseInt(b.replace(/[^\d]/g, '') || "0");
      return numA - numB;
    });

    for (const slide of slideFiles) {
      const xmlText = await contents.file(slide)!.async("string");
      const textMatches = xmlText.match(/<a:t>([^<]+)<\/a:t>/g);
      if (textMatches) {
        fullText += textMatches.map(t => t.replace(/<a:t>|<\/a:t>/g, '')).join(" ") + "\n\n";
      }
    }
    return fullText;
  } catch (err) {
    console.error("PPTX Error:", err);
    return "Error extracting text from PowerPoint.";
  }
}

export async function analyzePolicy(
  fileData: string,
  mimeType: string,
  detailLevel: DetailLevel = 'detailed'
): Promise<PolicyAnalysis> {
  const levelConfigs = {
    detailed: { slides: "8–12", minWords: "100–150" },
    condensed: { slides: "5–7", minWords: "60–90" },
    summary: { slides: "3–4", minWords: "40–60" }
  };
  const config = levelConfigs[detailLevel];

  try {
    const parts: any[] = [];
    
    if (mimeType.includes('presentationml.presentation') || mimeType.includes('powerpoint')) {
      const text = await extractTextFromPptx(fileData);
      parts.push({ text: `SOURCE DOCUMENT (extracted from PowerPoint):\n\n${text}` });
    } else {
      parts.push({
        inlineData: {
          data: fileData,
          mimeType: mimeType,
        },
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          parts: [
            ...parts,
            {
              text: `You are an expert instructional designer. Analyze this policy document and transform it into a ${detailLevel}, engaging, corporate e-learning module.

RULES — follow all of these strictly:

1. SLIDES (generate ${config.slides} slides):
   - "title": A clear, professional slide title (title case, no ALL CAPS).
   - "content": A rich, well-written explanatory paragraph (minimum ${config.minWords} words). 
   - "keyPoints": Array of 3–5 short, punchy bullet points.
   - "imageQuery": A short 2-3 word search query for a professional photo (e.g. "teamwork", "security", "documents").

2. QUIZ (generate 5–8 questions):
   - Each question must test specific knowledge from the document.
   - 4 answer options per question.
   - "correctAnswer" is the 0-based index of the correct option.

3. OUTPUT must be valid JSON matching the schema exactly.`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            summary: { type: Type.STRING },
            slides: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  content: { type: Type.STRING },
                  keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                  imageQuery: { type: Type.STRING, description: "Keywords for image search" },
                },
                required: ["title", "content", "keyPoints", "imageQuery"],
              },
            },
            quiz: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctAnswer: { type: Type.INTEGER, description: "0-based index of the correct option" },
                },
                required: ["question", "options", "correctAnswer"],
              },
            },
          },
          required: ["title", "summary", "slides", "quiz"],
        },
      },
    });

    const text = response.text || "{}";
    return JSON.parse(text);
  } catch (error: any) {
    console.error("API Error:", error.message);
    throw error;
  }
}
