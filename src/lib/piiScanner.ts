import { pipeline } from '@xenova/transformers';
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface PIIDetection {
  type: string;
  values: string[];
  source: string;
  confidence?: number;
}

export interface PIIResult {
  redacted_text: string;
  risk_score: number;
  triggered_by: string[];
  layers_used: string[];
  detections: PIIDetection[];
  privacy_note: string;
}

const REGEX_PATTERNS: Record<string, RegExp> = {
  EMAIL: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  PHONE: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
  PAN: /[A-Z]{5}[0-9]{4}[A-Z]{1}/g,
  AADHAAR: /\d{4}\s\d{4}\s\d{4}/g,
  CREDIT_CARD: /\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}/g,
};

let nerPipeline: any = null;

async function getNerPipeline() {
  if (!nerPipeline) {
    nerPipeline = await pipeline('token-classification', 'Xenova/distilbert-base-uncased-finetuned-conll03-english');
  }
  return nerPipeline;
}

export async function applyThreeLayerPipeline(text: string): Promise<PIIResult> {
  const detections: PIIDetection[] = [];
  const triggered_by: string[] = [];
  const layers_used: string[] = ['regex'];
  let redactedText = text;

  // --- Layer 1: Regex ---
  for (const [type, pattern] of Object.entries(REGEX_PATTERNS)) {
    const matches = text.match(pattern);
    if (matches) {
      detections.push({
        type,
        values: Array.from(new Set(matches)),
        source: 'regex'
      });
      if (!triggered_by.includes('layer1_regex')) triggered_by.push('layer1_regex');
      
      matches.forEach(match => {
        redactedText = redactedText.replace(match, `[${type}]`);
      });
    }
  }

  // --- Layer 2: DistilBERT (Local AI) ---
  // We run this on the ORIGINAL text but only keep detections that aren't already covered or are contextual
  try {
    layers_used.push('bert');
    const classifier = await getNerPipeline();
    const nerResults = await classifier(text);
    
    const bertDetections: Record<string, Set<string>> = {};
    
    nerResults.forEach((entity: any) => {
      // Map NER labels to our types
      // PER -> PERSON, LOC -> LOCATION, ORG -> ORGANIZATION
      let type = '';
      if (entity.entity.includes('PER')) type = 'PERSON';
      else if (entity.entity.includes('LOC')) type = 'LOCATION';
      else if (entity.entity.includes('ORG')) type = 'ORGANIZATION';
      
      if (type) {
        if (!bertDetections[type]) bertDetections[type] = new Set();
        bertDetections[type].add(entity.word);
      }
    });

    for (const [type, values] of Object.entries(bertDetections)) {
      const valueArray = Array.from(values);
      detections.push({
        type,
        values: valueArray,
        source: 'bert',
        confidence: 0.85 // Mock confidence for local model
      });
      if (!triggered_by.includes('layer2_bert')) triggered_by.push('layer2_bert');
      
      valueArray.forEach(val => {
        // Simple replacement, could be improved with better token reconstruction
        const escaped = val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escaped, 'g');
        redactedText = redactedText.replace(regex, `[${type}]`);
      });
    }
  } catch (error) {
    console.error("BERT Layer Error:", error);
  }

  // --- Layer 3: Gemini API (Fallback) ---
  // Invoke if risk seems high or we want a final check
  const currentRisk = detections.length > 0 ? 0.7 : 0.1;
  
  if (currentRisk > 0.5) {
    try {
      layers_used.push('gemini');
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze this text for any REMAINING sensitive PII that was missed. 
        Current redacted text: "${redactedText}"
        Original text: "${text}"
        
        Return a JSON object with:
        - missed_pii: array of {type, value, reason}
        - final_redacted_text: the text with all PII (including previously redacted) replaced with [TYPE]
        - risk_score: 0 to 1
        `,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              missed_pii: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: { type: Type.STRING },
                    value: { type: Type.STRING },
                    reason: { type: Type.STRING }
                  }
                }
              },
              final_redacted_text: { type: Type.STRING },
              risk_score: { type: Type.NUMBER }
            },
            required: ["missed_pii", "final_redacted_text", "risk_score"]
          }
        }
      });

      const result = JSON.parse(response.text || "{}");
      if (result.missed_pii && result.missed_pii.length > 0) {
        if (!triggered_by.includes('layer3_gemini')) triggered_by.push('layer3_gemini');
        result.missed_pii.forEach((item: any) => {
          detections.push({
            type: item.type,
            values: [item.value],
            source: 'gemini'
          });
        });
      }
      redactedText = result.final_redacted_text;
    } catch (error) {
      console.error("Gemini Layer Error:", error);
    }
  }

  const finalRisk = Math.min(1, detections.length * 0.2 + (triggered_by.length * 0.1));

  return {
    redacted_text: redactedText,
    risk_score: finalRisk,
    triggered_by,
    layers_used,
    detections,
    privacy_note: layers_used.includes('gemini') ? "Hybrid mode — some data processed via secure API" : "100% local — no data transmitted"
  };
}
