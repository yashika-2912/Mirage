import { GoogleGenAI, Type } from "@google/genai";
import { Detection, DetectionType } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const DETECTION_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      type: {
        type: Type.STRING,
        description: "The type of sensitive data detected (face, credit_card, ssn, phone, email, address, passport, reflection_exposure, background_screen, license_plate, barcode, qr_code, sensitive_document, name)",
      },
      box_2d: {
        type: Type.ARRAY,
        items: { type: Type.NUMBER },
        description: "Bounding box [ymin, xmin, ymax, xmax] in normalized coordinates (0-1000)",
      },
      reason: {
        type: Type.STRING,
        description: "Brief explanation of why this was flagged",
      },
      text: {
        type: Type.STRING,
        description: "The actual text found in the image (if applicable)",
      },
      wow_moment: {
        type: Type.BOOLEAN,
        description: "True if this is a subtle reflection or background exposure that would normally be missed",
      }
    },
    required: ["type", "box_2d", "reason"],
  },
};

export async function scanImageWithGemini(base64Image: string): Promise<Detection[]> {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Analyze this image for sensitive data and privacy risks. 
    Look for:
    1. PII: Credit cards, SSNs, phone numbers, emails, home addresses, passports, full names.
    2. Faces: Human faces that should be anonymized.
    3. Reflections: Text or screens visible in glasses, mirrors, or shiny surfaces (Reflection Hunter).
    4. Background Screens: Laptop or monitor screens in the background with readable content.
    5. Dangerous Identifiers: Vehicle license plates, barcodes, QR codes.
    6. Sensitive Documents: ID cards, driver's licenses, bank statements, medical records, or any document containing personal data.
    
    Return a list of detections with their bounding boxes.
    IMPORTANT: Bounding boxes must be [ymin, xmin, ymax, xmax] in normalized coordinates (0-1000).
    Be extremely thorough. If something looks like it could be sensitive, include it.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Image.split(",")[1],
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: DETECTION_SCHEMA,
      },
    });

    const rawDetections = JSON.parse(response.text || "[]");
    
    return rawDetections.map((d: any, index: number) => {
      // Convert normalized [ymin, xmin, ymax, xmax] to [x1, y1, x2, y2]
      const [ymin, xmin, ymax, xmax] = d.box_2d;
      
      return {
        id: `det-${index}-${Date.now()}`,
        type: d.type as DetectionType,
        box: [xmin, ymin, xmax, ymax],
        confidence: 0.95, // Gemini is usually very confident if it returns a box
        reason: d.reason,
        sensitive: true,
        replacement_mode: d.type === 'face' ? 'blur' : 'synthetic',
        redact_by_default: true,
        text: d.text,
        wow_moment: d.wow_moment || d.type === 'reflection_exposure'
      };
    });
  } catch (error) {
    console.error("Gemini Scan Error:", error);
    return [];
  }
}

export async function analyzeUrlForPhishing(url: string) {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Analyze the website at ${url} for phishing indicators and security risks.
    Check for:
    1. Visual Deception: Does it mimic a well-known brand?
    2. Suspicious Forms: Does it ask for credentials or sensitive data over insecure channels?
    3. Malicious Scripts: Are there indicators of drive-by downloads or credential harvesting?
    4. Domain Reputation: Does the domain look like a typosquatted or look-alike domain?
    5. Hidden Elements: Are there invisible overlays or deceptive UI patterns?

    Provide a detailed analysis including:
    - A risk score (0-100)
    - Specific indicators found
    - A breakdown of Dangerous, Suspicious, and Safe elements.
    - A set of logs describing the analysis steps.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        tools: [{ urlContext: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            risk_score: { type: Type.NUMBER },
            summary: { type: Type.STRING },
            page_title: { type: Type.STRING },
            page_description: { type: Type.STRING },
            dangerous_count: { type: Type.NUMBER },
            suspicious_count: { type: Type.NUMBER },
            safe_count: { type: Type.NUMBER },
            logs: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            indicators: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  severity: { type: Type.STRING },
                  description: { type: Type.STRING }
                }
              }
            }
          },
          required: ["risk_score", "summary", "page_title", "page_description", "dangerous_count", "suspicious_count", "safe_count", "logs", "indicators"]
        }
      },
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("URL Analysis Error:", error);
    throw error;
  }
}

export async function sanitizeText(text: string) {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Analyze the following text and identify all sensitive PII (Personally Identifiable Information).
    Replace each piece of sensitive data with a realistic but synthetic "Ghost" substitute.
    
    PII and Sensitive Data to identify:
    - Full Names and Usernames
    - Credit Card Numbers, CVVs, and Expiry Dates
    - Social Security Numbers or National ID Numbers
    - Email Addresses and Login Credentials
    - Phone Numbers
    - Physical Addresses and GPS Coordinates
    - Passwords, API Keys, and Secret Tokens
    - Bank Account Numbers and IBANs
    - Medical Record Numbers or Health Identifiers
    - IP Addresses and Device Identifiers
    
    Return the sanitized text and a report of all replacements made.
    Text to sanitize:
    """
    ${text}
    """
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sanitized_text: { type: Type.STRING },
            replacements: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  original: { type: Type.STRING },
                  ghost: { type: Type.STRING },
                  confidence: { type: Type.NUMBER }
                }
              }
            }
          },
          required: ["sanitized_text", "replacements"]
        }
      },
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Text Sanitization Error:", error);
    throw error;
  }
}

export async function transcribeAudio(base64Audio: string): Promise<string> {
  const model = "gemini-3-flash-preview";
  
  const prompt = "Transcribe this audio file accurately. Identify the speakers if possible. Return only the transcript text.";

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "audio/mpeg", // Adjust as needed
                data: base64Audio.split(",")[1] || base64Audio,
              },
            },
          ],
        },
      ],
    });

    return response.text || "";
  } catch (error) {
    console.error("Audio Transcription Error:", error);
    throw error;
  }
}

export async function analyzeDeepfake(base64Image: string) {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Analyze this image for signs of deepfake manipulation, AI generation (GAN/Diffusion), or forensic forgery.
    Look for:
    1. Pixel Anomalies: Unexpected noise patterns, frequency inconsistencies, or blending artifacts.
    2. Metadata/Compression: Signs of prohibited software traces (e.g., Photoshop) or abnormal DCT coefficients.
    3. GAN Artifacts: Checkerboard patterns, color bleeding, or unrealistic textures characteristic of generative models.
    4. Geometric Integrity: Misalignments in perspective, lighting, or anatomical features.
    5. Manipulation Regions: Identify specific areas that show signs of being edited or generated.

    Return a detailed forensic report with bounding boxes for manipulated regions.
    Bounding boxes must be [ymin, xmin, ymax, xmax] in normalized coordinates (0-1000).
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Image.split(",")[1],
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            risk_level: { type: Type.STRING, description: "HIGH, MEDIUM, or LOW" },
            summary: { type: Type.STRING },
            vectors: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  status: { type: Type.STRING, description: "SUSPICIOUS, FAILED, or SAFE" },
                  confidence: { type: Type.NUMBER },
                  description: { type: Type.STRING }
                }
              }
            },
            manipulations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  box_2d: {
                    type: Type.ARRAY,
                    items: { type: Type.NUMBER }
                  }
                }
              }
            }
          },
          required: ["risk_level", "summary", "vectors", "manipulations"]
        }
      },
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Deepfake Analysis Error:", error);
    throw error;
  }
}
