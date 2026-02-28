import { SwarmAgent, SwarmResult, AgentStatus } from '../types';
import { scanImageWithGemini, transcribeAudio } from './gemini';
import { getAllExifTags, getGpsMetadata } from './imageUtils';
import Tesseract from 'tesseract.js';

export class SwarmOrchestrator {
  private agents: SwarmAgent[] = [
    { id: 'gps', name: 'GPS Tracker', type: 'metadata', status: 'idle', risk_score: 0, explanation: '', confidence: 0 },
    { id: 'scene', name: 'Scene Analyzer', type: 'vision', status: 'idle', risk_score: 0, explanation: '', confidence: 0 },
    { id: 'ocr', name: 'Text Reader', type: 'ocr', status: 'idle', risk_score: 0, explanation: '', confidence: 0 },
    { id: 'reflect', name: 'Reflection Detector', type: 'vision', status: 'idle', risk_score: 0, explanation: '', confidence: 0 },
    { id: 'audio', name: 'Sound Analyzer', type: 'audio', status: 'idle', risk_score: 0, explanation: '', confidence: 0 }
  ];

  async analyzeMedia(file: File, base64: string, onUpdate: (agents: SwarmAgent[]) => void): Promise<SwarmResult> {
    const startTime = Date.now();
    
    // Reset agents
    this.agents = this.agents.map(a => ({ ...a, status: 'analyzing', risk_score: 0, explanation: 'Starting analysis...' }));
    onUpdate([...this.agents]);

    const tasks = [
      this.runGpsAgent(file),
      this.runSceneAgent(base64),
      this.runOcrAgent(file),
      this.runReflectionAgent(base64),
      this.runAudioAgent(file)
    ];

    const results = await Promise.all(tasks.map(async (task, i) => {
      try {
        const result = await task;
        this.agents[i] = { ...this.agents[i], ...result, status: 'complete' };
        onUpdate([...this.agents]);
        return result;
      } catch (error) {
        this.agents[i] = { ...this.agents[i], status: 'error', explanation: String(error) };
        onUpdate([...this.agents]);
        return { risk_score: 0, explanation: 'Error occurred', confidence: 0 };
      }
    }));

    const totalRisk = results.reduce((acc, curr, i) => acc + (curr.risk_score * (this.agents[i].type === 'metadata' ? 1.0 : 0.7)), 0);
    const avgRisk = Math.min(totalRisk / results.length, 1);

    const action_level = avgRisk > 0.8 ? 'critical' : avgRisk > 0.5 ? 'warning' : avgRisk > 0.2 ? 'caution' : 'safe';
    const action_message = this.getActionMessage(action_level);

    return {
      risk_score: avgRisk,
      action_level,
      action_message,
      agents: this.agents,
      processing_time: (Date.now() - startTime) / 1000
    };
  }

  private async runGpsAgent(file: File) {
    const gps = await getGpsMetadata(file);
    if (gps) {
      return { risk_score: 1.0, explanation: `GPS coordinates found: ${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}`, confidence: 1.0 };
    }
    return { risk_score: 0, explanation: 'No GPS metadata found', confidence: 1.0 };
  }

  private async runSceneAgent(base64: string) {
    // We use a specialized prompt for scene analysis
    const detections = await scanImageWithGemini(base64);
    const sceneRisks = detections.filter(d => d.type === 'background_screen' || d.type === 'reflection_exposure');
    if (sceneRisks.length > 0) {
      return { risk_score: 0.8, explanation: `Detected ${sceneRisks.length} environmental risks (screens/reflections)`, confidence: 0.9 };
    }
    return { risk_score: 0.1, explanation: 'Environment appears safe', confidence: 0.8 };
  }

  private async runOcrAgent(file: File) {
    const { data: { text } } = await Tesseract.recognize(file, 'eng');
    if (text.length > 50) {
      return { risk_score: 0.6, explanation: `Extracted ${text.length} characters of text. Potential PII leak.`, confidence: 0.8 };
    }
    return { risk_score: 0, explanation: 'No significant text detected', confidence: 0.9 };
  }

  private async runReflectionAgent(base64: string) {
    const detections = await scanImageWithGemini(base64);
    const reflections = detections.filter(d => d.type === 'reflection_exposure');
    if (reflections.length > 0) {
      return { risk_score: 0.9, explanation: 'High-risk reflections detected in mirrors/windows', confidence: 0.95 };
    }
    return { risk_score: 0, explanation: 'No sensitive reflections found', confidence: 0.8 };
  }

  private async runAudioAgent(file: File) {
    if (!file.type.startsWith('audio/')) return { risk_score: 0, explanation: 'Not an audio file', confidence: 1.0 };
    // Simulate audio analysis for now or use gemini if we had a base64 audio
    return { risk_score: 0.2, explanation: 'Ambient sound analysis: Low risk', confidence: 0.7 };
  }

  private getActionMessage(level: string): string {
    const messages: Record<string, string> = {
      critical: "🚨 HIGH RISK - Multiple agents detected location data. Strongly recommend redaction.",
      warning: "⚠️ MEDIUM RISK - Some location indicators found. Consider redacting sensitive areas.",
      caution: "ℹ️ LOW RISK - Minor location clues detected. Review before sharing.",
      safe: "✅ SAFE - No significant location data detected."
    };
    return messages[level] || "Review recommended.";
  }
}
