import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, 
  Upload, 
  Eye, 
  EyeOff, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  MapPin, 
  User, 
  CreditCard, 
  Mail, 
  Phone, 
  Globe, 
  Dna,
  Zap,
  ChevronRight,
  Info,
  BarChart3,
  ShieldAlert,
  UserCheck,
  Image as ImageIcon,
  Settings,
  LayoutDashboard,
  Search,
  Copy,
  Share2,
  Terminal,
  Activity,
  ExternalLink,
  MousePointer2,
  Lock,
  ShieldCheck,
  Layers
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { 
  Detection, 
  DetectionType, 
  AUDIENCE_PROFILES, 
  AudienceProfile, 
  TrustStamp,
  LedgerEntry,
  SwarmAgent,
  SwarmResult,
  ScreenActivity,
  DashboardStats
} from './types';
import { scanImageWithGemini, analyzeUrlForPhishing, sanitizeText, analyzeDeepfake, transcribeAudio } from './lib/gemini';
import { applyThreeLayerPipeline, PIIResult } from './lib/piiScanner';
import Tesseract from 'tesseract.js';
import { 
  getGpsMetadata, 
  getAllExifTags,
  sampleBackgroundColor, 
  getContrastingColor, 
  calculateFileHash 
} from './lib/imageUtils';
import { generateSynthetic } from './lib/synthetic';
import { recordDNAsession, getDNAReport, PrivacyDNAReport } from './lib/privacyDna';
import { SwarmOrchestrator } from './lib/swarm';
import { ScreenGuardian } from './lib/screenGuardian';
import { SwarmVisualizer } from './components/SwarmVisualizer';
import { DashboardPanel } from './components/DashboardPanel';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [step, setStep] = useState<'audience' | 'upload' | 'review' | 'stamp'>('audience');
  const [audience, setAudience] = useState<AudienceProfile>(AUDIENCE_PROFILES[0]);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [decisions, setDecisions] = useState<Record<string, boolean>>({});
  const [exifTags, setExifTags] = useState<Record<string, any>>({});
  const [isScanning, setIsScanning] = useState(false);
  const [riskScore, setRiskScore] = useState(0);
  const [trustStamp, setTrustStamp] = useState<TrustStamp | null>(null);
  const [dnaReport, setDnaReport] = useState<PrivacyDNAReport | null>(null);
  const [paranoia, setParanoia] = useState(50);
  const [activePersona, setActivePersona] = useState<'public' | 'work' | 'family'>('public');
  const [activeTab, setActiveTab] = useState<'overview' | 'intel' | 'sanitizer' | 'pii_scanner' | 'stripper' | 'deepfake' | 'swarm' | 'guardian' | 'settings'>('overview');
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [audioDetections, setAudioDetections] = useState<string[]>([]);

  // Swarm State
  const [swarmAgents, setSwarmAgents] = useState<SwarmAgent[]>([]);
  const [swarmResult, setSwarmResult] = useState<SwarmResult | null>(null);
  const [isSwarmAnalyzing, setIsSwarmAnalyzing] = useState(false);
  const swarmOrchestrator = useRef(new SwarmOrchestrator());

  // Screen Guardian State
  const [isGuardianActive, setIsGuardianActive] = useState(false);
  const [currentActivity, setCurrentActivity] = useState<ScreenActivity | null>(null);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const guardian = useRef(new ScreenGuardian());

  // Ghost Sanitizer State
  const [sanitizerInput, setSanitizerInput] = useState("Hello, my name is John Doe. My credit card number is 4532 2345 2345 1234 and my email is john.doe@example.com. I live at 123 Main St, New York.");
  const [sanitizerOutput, setSanitizerOutput] = useState("");
  const [isSanitizing, setIsSanitizing] = useState(false);
  const [sanitizerReport, setSanitizerReport] = useState<any[]>([]);
  const [showOriginal, setShowOriginal] = useState(false);

  // Phishing Intel State
  const [phishingUrl, setPhishingUrl] = useState("https://free-movies-hd.net");
  const [isAnalyzingUrl, setIsAnalyzingUrl] = useState(false);
  const [phishingLogs, setPhishingLogs] = useState<string[]>([]);
  const [phishingRisk, setPhishingRisk] = useState({ dangerous: 2, suspicious: 1, safe: 2 });
  const [phishingResult, setPhishingResult] = useState<{
    page_title: string;
    page_description: string;
    indicators: { label: string; severity: 'dangerous' | 'suspicious' | 'safe'; description: string }[];
  } | null>(null);
  const [showPhishingResult, setShowPhishingResult] = useState(false);

  // Deepfake Analysis State
  const [deepfakeImage, setDeepfakeImage] = useState<string | null>(null);
  const [isAnalyzingDeepfake, setIsAnalyzingDeepfake] = useState(false);
  const [deepfakeResult, setDeepfakeResult] = useState<{
    risk_level: string;
    summary: string;
    vectors: { label: string; status: string; confidence: number; description: string }[];
    manipulations: { label: string; box_2d: number[] }[];
  } | null>(null);
  const deepfakeImgRef = useRef<HTMLImageElement>(null);

  // PII Scanner State
  const [piiInput, setPiiInput] = useState("My PAN is ABCDE1234F and email is john@example.com. I live at 123 Main St, New York.");
  const [piiResult, setPiiResult] = useState<PIIResult | null>(null);
  const [isScanningPii, setIsScanningPii] = useState(false);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDnaReport(getDNAReport());
    fetchLedger();
    setDashboardStats(guardian.current.getStats());
  }, []);

  const toggleGuardian = () => {
    if (isGuardianActive) {
      guardian.current.stopMonitoring();
      setIsGuardianActive(false);
    } else {
      setIsGuardianActive(true);
      guardian.current.startMonitoring((activity) => {
        setCurrentActivity(activity);
        setDashboardStats(guardian.current.getStats());
      });
    }
  };

  const handleSwarmUpload = async (file: File) => {
    setIsSwarmAnalyzing(true);
    setSwarmResult(null);
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      const result = await swarmOrchestrator.current.analyzeMedia(file, base64, (agents) => {
        setSwarmAgents(agents);
      });
      setSwarmResult(result);
      setIsSwarmAnalyzing(false);
    };
    reader.readAsDataURL(file);
  };

  const fetchLedger = async () => {
    try {
      const response = await fetch('/api/ledger');
      if (response.ok) {
        const data = await response.json();
        setLedger(data);
      }
    } catch (error) {
      console.error("Failed to fetch ledger:", error);
      const savedLedger = localStorage.getItem('mirage_ledger');
      if (savedLedger) setLedger(JSON.parse(savedLedger));
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = async (file: File) => {
    setOriginalFile(file);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      setOriginalImage(base64);
      setIsScanning(true);
      setStep('review');

      // 1. Scan for GPS and EXIF
      const gps = await getGpsMetadata(file);
      const tags = await getAllExifTags(file);
      setExifTags(tags);
      
      // 2. Scan with Gemini
      const aiDetections = await scanImageWithGemini(base64);
      
      const allDetections = [...aiDetections];
      
      if (gps) {
        allDetections.push({
          id: 'gps-0',
          type: 'gps_location',
          box: [0, 0, 100, 100], // Visual indicator
          confidence: 1.0,
          reason: `📍 GPS coordinates detected: ${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}`,
          sensitive: true,
          replacement_mode: 'strip',
          redact_by_default: true,
          text: `GPS: ${gps.lat}, ${gps.lng}`
        });
      }

      // Apply audience profile
      const finalDetections = allDetections.map(d => ({
        ...d,
        redact_by_default: audience.redact.includes(d.type) && d.sensitive
      }));

      setDetections(finalDetections);
      
      const initialDecisions: Record<string, boolean> = {};
      finalDetections.forEach(d => {
        initialDecisions[d.id] = d.redact_by_default;
      });
      setDecisions(initialDecisions);
      
      calculateRisk(finalDetections, initialDecisions);
      setIsScanning(false);
    };
    reader.readAsDataURL(file);
  };

  const calculateRisk = (dets: Detection[], decs: Record<string, boolean>) => {
    const weights: Record<string, number> = {
      credit_card: 30, ssn: 35, face: 10, address: 20, phone: 15, email: 10,
      reflection_exposure: 25, background_screen: 15, gps_location: 40, name: 8,
      license_plate: 20, barcode: 15, qr_code: 20, sensitive_document: 35
    };
    
    let score = 0;
    dets.forEach(d => {
      if (decs[d.id]) return; // If redacted, no risk
      score += weights[d.type] || 5;
    });
    setRiskScore(Math.min(score, 100));
  };

  const toggleDecision = (id: string) => {
    const newDecisions = { ...decisions, [id]: !decisions[id] };
    setDecisions(newDecisions);
    calculateRisk(detections, newDecisions);
  };

  const renderRedactedCanvas = () => {
    if (!canvasRef.current || !originalImage) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.src = originalImage;
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      detections.forEach(d => {
        if (!decisions[d.id]) return;

        // Convert normalized 0-1000 to pixels with safety padding
        const padding = 10; // 10px safety padding
        const x1 = Math.max(0, (d.box[0] / 1000) * canvas.width - padding);
        const y1 = Math.max(0, (d.box[1] / 1000) * canvas.height - padding);
        const x2 = Math.min(canvas.width, (d.box[2] / 1000) * canvas.width + padding);
        const y2 = Math.min(canvas.height, (d.box[3] / 1000) * canvas.height + padding);
        const w = x2 - x1;
        const h = y2 - y1;

        if (d.type === 'face' || d.type === 'reflection_exposure' || d.type === 'background_screen' || d.type === 'license_plate' || d.type === 'barcode' || d.type === 'qr_code' || d.type === 'sensitive_document') {
          // Ghost Replacement for Visuals (Faces/Screens)
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = w;
          tempCanvas.height = h;
          const tempCtx = tempCanvas.getContext('2d')!;
          tempCtx.drawImage(canvas, x1, y1, w, h, 0, 0, w, h);
          
          ctx.save();
          ctx.filter = 'blur(45px)'; 
          ctx.drawImage(tempCanvas, x1, y1, w, h);
          ctx.restore();
          
          // Darker "Ghost" overlay
          ctx.fillStyle = 'rgba(0, 0, 0, 0.95)'; 
          ctx.fillRect(x1, y1, w, h);
          
          // Ghost Silhouette for Faces
          if (d.type === 'face') {
            ctx.strokeStyle = 'rgba(139, 92, 246, 0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.ellipse(x1 + w/2, y1 + h/2, w/3, h/2.5, 0, 0, Math.PI * 2);
            ctx.stroke();
          }

          ctx.strokeStyle = '#8b5cf6';
          ctx.lineWidth = 2;
          ctx.strokeRect(x1, y1, w, h);
          
          // "PROTECTED" Watermark - centered and clipped to stay within box
          ctx.save();
          ctx.beginPath();
          ctx.rect(x1, y1, w, h);
          ctx.clip();
          
          ctx.fillStyle = 'rgba(139, 92, 246, 0.5)';
          const fontSize = Math.min(h * 0.25, w * 0.15, 24);
          ctx.font = `bold ${fontSize}px Inter, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('PROTECTED', x1 + w/2, y1 + h/2);
          ctx.restore();
        } else if (d.type === 'gps_location') {
          // Metadata indicator (doesn't actually paint on image usually, but for demo)
          ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
          ctx.fillRect(0, 0, canvas.width, 4); // Top strip
        } else if (d.type === 'credit_card') {
          // Hyper-Realistic Credit Card Ghost Swap
          const bgColor = sampleBackgroundColor(ctx, x1, y1, x2, y2);
          
          ctx.save();
          // 1. Create a seamless patch with subtle noise to match image grain
          ctx.fillStyle = bgColor;
          ctx.fillRect(x1, y1, w, h);
          
          // Add micro-noise for realism
          for (let i = 0; i < 50; i++) {
            const nx = x1 + Math.random() * w;
            const ny = y1 + Math.random() * h;
            ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
            ctx.fillRect(nx, ny, 1, 1);
          }
          
          // 2. Advanced Metallic Sheen
          const sheen = ctx.createLinearGradient(x1, y1, x1 + w, y1 + h);
          sheen.addColorStop(0, 'rgba(255,255,255,0.2)');
          sheen.addColorStop(0.4, 'rgba(255,255,255,0)');
          sheen.addColorStop(0.6, 'rgba(255,255,255,0)');
          sheen.addColorStop(1, 'rgba(255,255,255,0.1)');
          ctx.fillStyle = sheen;
          ctx.fillRect(x1, y1, w, h);
          
          // 3. Embossed Synthetic Numbers
          const textColor = getContrastingColor(bgColor);
          const syntheticNumber = generateSynthetic('credit_card');
          const fontSize = h * 0.82; 
          ctx.font = `bold ${fontSize}px "Courier New", monospace`;
          ctx.textBaseline = 'middle';
          
          // Layer 1: Deep Inner Shadow (the "punch" in the plastic)
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.fillText(syntheticNumber, x1 + 5, y1 + h/2 + 1);
          
          // Layer 2: Main Text with Metallic Tint
          const textGrad = ctx.createLinearGradient(x1, y1, x1, y1 + h);
          if (textColor === 'white') {
            textGrad.addColorStop(0, '#ffffff');
            textGrad.addColorStop(1, '#d1d1d1');
          } else {
            textGrad.addColorStop(0, '#333333');
            textGrad.addColorStop(1, '#000000');
          }
          ctx.fillStyle = textGrad;
          ctx.fillText(syntheticNumber, x1 + 4, y1 + h/2);
          
          // Layer 3: Outer Highlight (the "raised" edge)
          ctx.strokeStyle = textColor === 'white' ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.1)';
          ctx.lineWidth = 0.5;
          ctx.strokeText(syntheticNumber, x1 + 4, y1 + h/2);
          
          ctx.restore();
        } else {
          // Ghost Replacement for other Data (Text)
          const bgColor = sampleBackgroundColor(ctx, x1, y1, x2, y2);
          ctx.fillStyle = bgColor;
          ctx.fillRect(x1, y1, w, h);
          
          const textColor = getContrastingColor(bgColor);
          ctx.fillStyle = textColor;
          
          const fontSize = Math.max(12, h * 0.75);
          ctx.font = `${fontSize}px "JetBrains Mono", monospace`;
          ctx.textBaseline = 'middle';
          const syntheticText = generateSynthetic(d.type);
          
          ctx.fillText(syntheticText, x1 + 4, y1 + h/2);
          
          ctx.shadowColor = 'rgba(139, 92, 246, 0.3)';
          ctx.shadowBlur = 4;
          ctx.strokeStyle = 'rgba(139, 92, 246, 0.2)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x1, y1, w, h);
          ctx.shadowBlur = 0;
        }
      });
    };
  };

  useEffect(() => {
    if (step === 'review') renderRedactedCanvas();
  }, [step, detections, decisions, originalImage]);

  const handleExport = async () => {
    if (!canvasRef.current || !originalFile) return;
    
    const hash = await calculateFileHash(originalFile);
    const redactedCount = Object.values(decisions).filter(Boolean).length;
    const facesProtected = detections.filter(d => d.type === 'face' && decisions[d.id]).length;

    const stamp: TrustStamp = {
      stamp_id: `MRG-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      timestamp: new Date().toISOString(),
      audience_profile: audience.label,
      output_hash_sha256: hash,
      privacy_level: riskScore < 10 ? 'SAFE' : riskScore < 40 ? 'MODERATE' : 'REVIEW NEEDED',
      risk_score_before: 100 - (100 - riskScore), // Simplified
      risk_score_after: riskScore,
      items_detected: detections.length,
      items_redacted: redactedCount,
      metadata_stripped: true,
      faces_protected: facesProtected,
      verified: true
    };

    const newEntry: LedgerEntry = {
      id: stamp.stamp_id,
      timestamp: stamp.timestamp,
      file_hash: hash,
      audience: audience.label,
      risk_score_before: 100, // Mock
      risk_score_after: riskScore,
      items_redacted: redactedCount,
      items_detected: detections.length
    };

    try {
      await fetch('/api/ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEntry)
      });
      fetchLedger();
    } catch (error) {
      console.error("Failed to save to ledger API:", error);
      const updatedLedger = [newEntry, ...ledger].slice(0, 50);
      setLedger(updatedLedger);
      localStorage.setItem('mirage_ledger', JSON.stringify(updatedLedger));
    }

    setTrustStamp(stamp);
    recordDNAsession(detections, decisions, audience.id);
    setDnaReport(getDNAReport());
    
    // Trigger download
    const link = document.createElement('a');
    link.download = `mirage_protected_${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
    
    setStep('stamp');
  };

  const reset = () => {
    setStep('audience');
    setOriginalImage(null);
    setDetections([]);
    setDecisions({});
    setTrustStamp(null);
  };

  const handleSanitize = async () => {
    if (!sanitizerInput.trim()) return;
    setIsSanitizing(true);
    try {
      const result = await sanitizeText(sanitizerInput);
      setSanitizerOutput(result.sanitized_text);
      setSanitizerReport(result.replacements);
    } catch (error) {
      console.error("Sanitization error:", error);
    } finally {
      setIsSanitizing(false);
    }
  };

  const handleAnalyzeUrl = async () => {
    if (!phishingUrl.trim()) return;
    setIsAnalyzingUrl(true);
    setShowPhishingResult(false);
    setPhishingLogs([]);
    
    try {
      const result = await analyzeUrlForPhishing(phishingUrl);
      
      // Stream logs for effect
      for (let i = 0; i < result.logs.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 400));
        setPhishingLogs(prev => [...prev, result.logs[i]]);
      }
      
      setPhishingRisk({
        dangerous: result.dangerous_count,
        suspicious: result.suspicious_count,
        safe: result.safe_count
      });
      
      setPhishingResult({
        page_title: result.page_title,
        page_description: result.page_description,
        indicators: result.indicators.map((ind: any) => ({
          label: ind.label,
          severity: ind.severity.toLowerCase() as any,
          description: ind.description
        }))
      });
      
      setShowPhishingResult(true);
    } catch (error) {
      console.error("URL Analysis error:", error);
      setPhishingLogs(prev => [...prev, "! ERROR: Failed to analyze URL. Check console for details."]);
    } finally {
      setIsAnalyzingUrl(false);
    }
  };

  const handleDeepfakeAnalysis = async (file: File) => {
    setIsAnalyzingDeepfake(true);
    setDeepfakeResult(null);
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      setDeepfakeImage(base64);
      
      try {
        const result = await analyzeDeepfake(base64);
        setDeepfakeResult(result);
      } catch (error) {
        console.error("Deepfake analysis error:", error);
      } finally {
        setIsAnalyzingDeepfake(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePiiScan = async () => {
    if (!piiInput.trim()) return;
    setIsScanningPii(true);
    try {
      const result = await applyThreeLayerPipeline(piiInput);
      setPiiResult(result);
    } catch (error) {
      console.error("PII Scan error:", error);
    } finally {
      setIsScanningPii(false);
    }
  };

  const handleOcrUpload = async (file: File) => {
    setIsOcrLoading(true);
    try {
      const { data: { text } } = await Tesseract.recognize(file, 'eng');
      setPiiInput(prev => prev + "\n\n[OCR RESULT]:\n" + text);
    } catch (error) {
      console.error("OCR error:", error);
    } finally {
      setIsOcrLoading(false);
    }
  };

  const handleAudioUpload = async (file: File) => {
    setIsAudioLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        const transcript = await transcribeAudio(base64);
        setPiiInput(prev => prev + "\n\n[AUDIO TRANSCRIPT]:\n" + transcript);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Audio error:", error);
    } finally {
      setIsAudioLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#02040a] text-[#f0f0f0] font-sans selection:bg-cyan-500/30 flex">
      
      {/* Sidebar */}
      <aside className="w-72 bg-[#05070f] border-r border-zinc-800/50 flex flex-col shrink-0">
        <div className="p-8 flex items-center gap-3">
          <Shield className="w-8 h-8 text-cyan-400 fill-cyan-400/10" />
          <h1 className="text-2xl font-black tracking-tighter text-cyan-400">
            MIRAGE
          </h1>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2">
          <SidebarItem 
            icon={<BarChart3 className="w-5 h-5" />} 
            label="Overview" 
            active={activeTab === 'overview'} 
            onClick={() => setActiveTab('overview')} 
          />
          <SidebarItem 
            icon={<ShieldAlert className="w-5 h-5" />} 
            label="Phishing Intel" 
            active={activeTab === 'intel'} 
            onClick={() => setActiveTab('intel')} 
          />
          <SidebarItem 
            icon={<UserCheck className="w-5 h-5" />} 
            label="Ghost Sanitizer" 
            active={activeTab === 'sanitizer'} 
            onClick={() => setActiveTab('sanitizer')} 
          />
          <SidebarItem 
            icon={<Search className="w-5 h-5" />} 
            label="PII Scanner" 
            active={activeTab === 'pii_scanner'} 
            onClick={() => setActiveTab('pii_scanner')} 
          />
          <SidebarItem 
            icon={<ImageIcon className="w-5 h-5" />} 
            label="EXIF Stripper" 
            active={activeTab === 'stripper'} 
            onClick={() => setActiveTab('stripper')} 
          />
          <SidebarItem 
            icon={<Zap className="w-5 h-5" />} 
            label="Deepfake Analysis" 
            active={activeTab === 'deepfake'} 
            onClick={() => setActiveTab('deepfake')} 
          />
          <SidebarItem 
            icon={<Activity className="w-5 h-5" />} 
            label="Swarm Intelligence" 
            active={activeTab === 'swarm'} 
            onClick={() => setActiveTab('swarm')} 
          />
          <SidebarItem 
            icon={<ShieldCheck className="w-5 h-5" />} 
            label="Screen Guardian" 
            active={activeTab === 'guardian'} 
            onClick={() => setActiveTab('guardian')} 
          />
          <div className="pt-8">
            <SidebarItem 
              icon={<Settings className="w-5 h-5" />} 
              label="Settings" 
              active={activeTab === 'settings'} 
              onClick={() => setActiveTab('settings')} 
            />
          </div>
        </nav>

        <div className="p-6 border-t border-zinc-800/50 space-y-4">
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-3 space-y-2">
            <div className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">Security Status</div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
              <span className="text-[10px] font-bold text-zinc-300">Core Engine Active</span>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
            <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400 font-bold">
              SA
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold truncate">Sana Azimudin</div>
              <div className="text-[10px] text-zinc-500 truncate uppercase tracking-widest">Pro Member</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <header className="h-16 border-b border-zinc-800/50 flex items-center justify-between px-8 bg-[#02040a]/80 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500">
              {activeTab.replace('_', ' ')}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input 
                type="text" 
                placeholder="Search privacy logs..." 
                className="bg-zinc-900/50 border border-zinc-800 rounded-lg py-1.5 pl-10 pr-4 text-xs focus:outline-none focus:border-cyan-500/50 transition-colors w-64"
              />
            </div>
            <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
              <Info className="w-4 h-4" />
            </div>
          </div>
        </header>

        <div className="p-8 max-w-6xl mx-auto w-full">
          <main>
            <AnimatePresence mode="wait">
              
              {activeTab === 'sanitizer' && (
              <motion.div
                key="sanitizer-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-black tracking-tight flex items-center gap-3">
                      <UserCheck className="w-8 h-8 text-cyan-400" /> Ghost Sanitizer
                    </h2>
                    <p className="text-zinc-500">Surgical PII replacement with realistic substitutes</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-zinc-900/50 p-1 rounded-full border border-zinc-800">
                      <button 
                        onClick={() => setShowOriginal(!showOriginal)}
                        className={cn(
                          "px-4 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all",
                          showOriginal ? "bg-zinc-800 text-zinc-400" : "bg-cyan-500 text-[#02040a]"
                        )}
                      >
                        {showOriginal ? 'Show Original' : 'Hide Original'}
                      </button>
                    </div>
                    <button 
                      onClick={handleSanitize}
                      disabled={isSanitizing}
                      className="px-6 py-2 bg-cyan-500 hover:bg-cyan-400 text-[#02040a] rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all"
                    >
                      {isSanitizing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                      Sanitize Content
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Raw Input */}
                  <div className="bg-[#05070f] border border-zinc-800/50 rounded-2xl overflow-hidden flex flex-col h-[400px]">
                    <div className="p-4 border-b border-zinc-800/50 flex items-center justify-between bg-zinc-900/20">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                        <ImageIcon className="w-3 h-3" /> Raw Input Data
                      </div>
                      <div className="text-[10px] font-bold text-zinc-600 uppercase">UTF-8</div>
                    </div>
                    <textarea 
                      value={sanitizerInput}
                      onChange={(e) => setSanitizerInput(e.target.value)}
                      className="flex-1 bg-transparent p-6 text-sm font-mono text-zinc-400 focus:outline-none resize-none leading-relaxed"
                      placeholder="Enter text containing PII..."
                    />
                  </div>

                  {/* Sanitized Output */}
                  <div className={cn(
                    "bg-[#05070f] border rounded-2xl overflow-hidden flex flex-col h-[400px] transition-all",
                    sanitizerOutput ? "border-cyan-500/50 shadow-[0_0_30px_rgba(34,211,238,0.05)]" : "border-zinc-800/50"
                  )}>
                    <div className="p-4 border-b border-zinc-800/50 flex items-center justify-between bg-zinc-900/20">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-cyan-400 uppercase tracking-widest">
                        <CheckCircle2 className="w-3 h-3" /> Sanitized Phantom Layer
                      </div>
                      <div className="px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded text-[8px] font-bold">MIRAGE-8MPP8YRW</div>
                    </div>
                    <div className="flex-1 p-6 text-sm font-mono text-zinc-200 leading-relaxed overflow-y-auto">
                      {isSanitizing ? (
                        <div className="flex items-center gap-2 text-zinc-500 italic">
                          <RefreshCw className="w-4 h-4 animate-spin" /> Generating phantom layer...
                        </div>
                      ) : sanitizerOutput ? (
                        sanitizerOutput
                      ) : (
                        <div className="text-zinc-600 italic">Sanitized content will appear here...</div>
                      )}
                    </div>
                    <div className="p-4 border-t border-zinc-800/50 flex items-center justify-between bg-zinc-900/10">
                      <div className="flex items-center gap-4">
                        <button className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 hover:text-white transition-colors">
                          <Copy className="w-3 h-3" /> Copy Phantom
                        </button>
                      </div>
                      <div className="flex items-center gap-4">
                        <button className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 hover:text-white transition-colors">
                          <Share2 className="w-3 h-3" /> Share Safely
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Forensic Report */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    <Eye className="w-4 h-4" /> Forensic Intelligence Report
                    <span className="ml-auto px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded text-[10px] font-bold">{sanitizerReport.length} Interceptions</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {sanitizerReport.length > 0 ? sanitizerReport.map((item, i) => (
                      <div key={i} className="bg-zinc-900/30 border border-zinc-800/50 p-4 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {item.type === 'PERSON' && <User className="w-3 h-3 text-cyan-400" />}
                            {item.type === 'CREDIT_CARD' && <CreditCard className="w-3 h-3 text-cyan-400" />}
                            {item.type === 'EMAIL' && <Mail className="w-3 h-3 text-cyan-400" />}
                            {item.type === 'ADDRESS' && <MapPin className="w-3 h-3 text-cyan-400" />}
                            <span className="text-[10px] font-bold text-zinc-400">{item.type}</span>
                          </div>
                          <span className="text-[8px] font-bold text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">{Math.round(item.confidence * 100)}% Confidence</span>
                        </div>
                        <div className="space-y-1">
                          <div className="text-[8px] font-bold text-zinc-600 uppercase">Original Value</div>
                          <div className="text-xs font-mono text-zinc-500 blur-[2px]">{item.original}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-[8px] font-bold text-cyan-500/50 uppercase">Ghost Replacement</div>
                          <div className="text-xs font-mono text-cyan-400">{item.ghost}</div>
                        </div>
                      </div>
                    )) : (
                      <div className="col-span-full py-12 text-center bg-zinc-900/20 border border-dashed border-zinc-800 rounded-xl">
                        <p className="text-zinc-600 text-sm italic">Run sanitization to see forensic report...</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'pii_scanner' && (
              <motion.div
                key="pii-scanner-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-black tracking-tight flex items-center gap-3">
                      <Search className="w-8 h-8 text-cyan-400" /> PII Scanner
                    </h2>
                    <p className="text-zinc-500">Automatically detect and redact PII using three-layer intelligence</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={handlePiiScan}
                      disabled={isScanningPii}
                      className="px-8 py-3 bg-cyan-500 hover:bg-cyan-400 text-[#02040a] rounded-full font-bold flex items-center gap-2 transition-all shadow-lg shadow-cyan-500/20"
                    >
                      {isScanningPii ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                      Scan Content
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Input Workspace */}
                  <div className="bg-[#05070f] border border-zinc-800/50 rounded-3xl p-8 space-y-6">
                    <div className="flex items-center justify-between border-b border-zinc-800/50 pb-4">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                        <Terminal className="w-3 h-3 text-cyan-400" /> Input Workspace
                      </div>
                      <div className="flex items-center gap-2">
                        <input 
                          type="file" 
                          id="ocr-upload" 
                          className="hidden" 
                          accept="image/*"
                          onChange={(e) => e.target.files?.[0] && handleOcrUpload(e.target.files[0])}
                        />
                        <button 
                          onClick={() => document.getElementById('ocr-upload')?.click()}
                          disabled={isOcrLoading}
                          className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-400 hover:text-cyan-400 transition-all flex items-center gap-2 text-[10px] font-bold uppercase"
                          title="OCR from Image"
                        >
                          {isOcrLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />}
                          OCR
                        </button>
                        
                        <input 
                          type="file" 
                          id="audio-upload" 
                          className="hidden" 
                          accept="audio/*"
                          onChange={(e) => e.target.files?.[0] && handleAudioUpload(e.target.files[0])}
                        />
                        <button 
                          onClick={() => document.getElementById('audio-upload')?.click()}
                          disabled={isAudioLoading}
                          className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-400 hover:text-cyan-400 transition-all flex items-center gap-2 text-[10px] font-bold uppercase"
                          title="Transcribe Audio"
                        >
                          {isAudioLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Phone className="w-3 h-3" />}
                          Audio
                        </button>
                      </div>
                    </div>
                    <textarea 
                      value={piiInput}
                      onChange={(e) => setPiiInput(e.target.value)}
                      placeholder="Paste text, OCR results, or audio transcripts here..."
                      className="w-full h-64 bg-zinc-900/30 border border-zinc-800 rounded-2xl p-6 text-sm font-mono focus:outline-none focus:border-cyan-500/50 transition-all resize-none"
                    />
                  </div>

                  {/* Redacted Output */}
                  <div className="bg-[#05070f] border border-zinc-800/50 rounded-3xl p-8 space-y-6">
                    <div className="flex items-center justify-between border-b border-zinc-800/50 pb-4">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                        <ShieldCheck className="w-3 h-3 text-cyan-400" /> Redacted Output
                      </div>
                      {piiResult && (
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "px-2 py-0.5 rounded text-[8px] font-bold uppercase",
                            piiResult.risk_score > 0.7 ? "bg-red-500/10 text-red-500" : "bg-emerald-500/10 text-emerald-500"
                          )}>
                            Risk: {Math.round(piiResult.risk_score * 100)}%
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="w-full h-64 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 text-sm font-mono overflow-y-auto whitespace-pre-wrap">
                      {isScanningPii ? (
                        <div className="h-full flex flex-col items-center justify-center space-y-4">
                          <RefreshCw className="w-8 h-8 text-cyan-500 animate-spin" />
                          <p className="text-zinc-500 text-xs animate-pulse">Running Multi-Layer Pipeline...</p>
                        </div>
                      ) : piiResult ? (
                        piiResult.redacted_text
                      ) : (
                        <p className="text-zinc-700 italic">Scan content to view redacted output</p>
                      )}
                    </div>
                  </div>
                </div>

                {piiResult && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Detection Details */}
                    <div className="lg:col-span-2 bg-[#05070f] border border-zinc-800/50 rounded-3xl p-8 space-y-6">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-800/50 pb-4">
                        <Activity className="w-3 h-3 text-cyan-400" /> Detection Intelligence
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {piiResult.detections.map((d, i) => (
                          <div key={i} className="bg-zinc-900/30 border border-zinc-800/50 p-4 rounded-xl flex items-center justify-between group hover:border-zinc-700 transition-all">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-bold text-cyan-400 uppercase">{d.type}</span>
                                <span className="text-[8px] font-bold text-zinc-600 uppercase bg-zinc-800 px-1 rounded">{d.source}</span>
                              </div>
                              <div className="text-xs font-bold text-zinc-300 truncate max-w-[200px]">
                                {d.values.join(', ')}
                              </div>
                            </div>
                            <div className="text-[10px] font-bold text-zinc-500">
                              {d.confidence ? `${Math.round(d.confidence * 100)}%` : '100%'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Pipeline Status */}
                    <div className="bg-[#05070f] border border-zinc-800/50 rounded-3xl p-8 space-y-6">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-800/50 pb-4">
                        <Layers className="w-3 h-3 text-cyan-400" /> Pipeline Status
                      </div>
                      <div className="space-y-4">
                        {[
                          { id: 'regex', label: 'Layer 1: Regex', desc: 'Pattern matching' },
                          { id: 'bert', label: 'Layer 2: DistilBERT', desc: 'Local NER context' },
                          { id: 'gemini', label: 'Layer 3: Gemini', desc: 'AI Fallback' },
                        ].map((layer) => (
                          <div key={layer.id} className="flex items-center gap-4">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                              piiResult.layers_used.includes(layer.id) ? "bg-cyan-500/20 text-cyan-400" : "bg-zinc-900 text-zinc-700"
                            )}>
                              {piiResult.triggered_by.some(t => t.includes(layer.id)) ? <CheckCircle2 className="w-4 h-4" /> : <div className="w-1 h-1 rounded-full bg-current" />}
                            </div>
                            <div>
                              <div className={cn(
                                "text-xs font-bold",
                                piiResult.layers_used.includes(layer.id) ? "text-zinc-200" : "text-zinc-600"
                              )}>{layer.label}</div>
                              <div className="text-[8px] text-zinc-500 uppercase tracking-widest">{layer.desc}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="pt-4 border-t border-zinc-800/50">
                        <div className="flex items-center gap-2 text-[8px] font-bold text-zinc-500 uppercase tracking-widest">
                          <Info className="w-3 h-3" /> {piiResult.privacy_note}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'intel' && (
              <motion.div
                key="intel-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-black tracking-tight flex items-center gap-3">
                      <ShieldAlert className="w-8 h-8 text-cyan-400" /> Phishing Intel
                    </h2>
                    <p className="text-zinc-500">Heuristic analysis of suspicious URLs and domains</p>
                  </div>
                </div>

                {/* URL Bar */}
                <div className="flex gap-4">
                  <div className="flex-1 relative">
                    <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input 
                      type="text" 
                      value={phishingUrl}
                      onChange={(e) => setPhishingUrl(e.target.value)}
                      placeholder="Enter suspicious URL..."
                      className="w-full bg-[#05070f] border border-zinc-800 rounded-xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-cyan-500/50 transition-all"
                    />
                  </div>
                  <button 
                    onClick={handleAnalyzeUrl}
                    disabled={isAnalyzingUrl}
                    className="px-8 bg-cyan-500 hover:bg-cyan-400 text-[#02040a] rounded-xl font-bold transition-all shadow-lg shadow-cyan-500/20 flex items-center gap-2"
                  >
                    {isAnalyzingUrl ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Activity className="w-5 h-5" />}
                    Analyze Page
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Browser Preview */}
                  <div className="lg:col-span-2 bg-[#05070f] border border-zinc-800/50 rounded-2xl overflow-hidden flex flex-col h-[500px]">
                    <div className="p-3 border-b border-zinc-800/50 flex items-center gap-2 bg-zinc-900/20">
                      <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                      </div>
                      <div className="flex-1 bg-zinc-900/50 rounded-md py-1 px-3 text-[10px] text-zinc-500 font-mono truncate">
                        {phishingUrl}
                      </div>
                    </div>
                    <div className="flex-1 p-12 flex flex-col items-center justify-center text-center relative">
                      {isAnalyzingUrl ? (
                        <div className="space-y-4">
                          <RefreshCw className="w-12 h-12 text-cyan-500 animate-spin mx-auto" />
                          <p className="text-zinc-500 font-bold">Crawling DOM structure...</p>
                        </div>
                      ) : showPhishingResult && phishingResult ? (
                        <div className="w-full max-w-md space-y-8">
                          <h3 className="text-4xl font-black tracking-tighter">{phishingResult.page_title}</h3>
                          <p className="text-zinc-500 text-sm">{phishingResult.page_description}</p>
                          <div className="grid grid-cols-2 gap-4">
                            {phishingResult.indicators.map((ind, i) => (
                              <div 
                                key={i} 
                                className={cn(
                                  "p-4 border rounded-xl flex items-center justify-between",
                                  ind.severity === 'dangerous' ? "border-red-500/30 bg-red-500/5" :
                                  ind.severity === 'suspicious' ? "border-yellow-500/30 bg-yellow-500/5" :
                                  "border-cyan-500/30 bg-cyan-500/5"
                                )}
                              >
                                <span className="text-xs font-bold">{ind.label}</span>
                                {ind.severity === 'safe' ? (
                                  <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                                ) : ind.severity === 'suspicious' ? (
                                  <Info className="w-4 h-4 text-yellow-500" />
                                ) : (
                                  <AlertTriangle className="w-4 h-4 text-red-500" />
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="h-24 bg-zinc-900/50 border border-dashed border-zinc-800 rounded-xl flex items-center justify-center text-zinc-700 text-[10px] font-bold uppercase tracking-widest">
                            Heuristic Analysis Complete
                          </div>
                        </div>
                      ) : (
                        <div className="text-zinc-700">
                          <Globe className="w-16 h-16 mx-auto mb-4 opacity-20" />
                          <p className="text-sm font-bold">Enter a URL to begin heuristic analysis</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sidebar Info */}
                  <div className="space-y-6">
                    {/* Heuristic Console */}
                    <div className="bg-[#05070f] border border-zinc-800/50 rounded-2xl flex flex-col h-[300px]">
                      <div className="p-4 border-b border-zinc-800/50 flex items-center gap-2 bg-zinc-900/20">
                        <Terminal className="w-3 h-3 text-cyan-400" />
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Heuristic Console</span>
                      </div>
                      <div className="flex-1 p-4 font-mono text-[10px] space-y-2 overflow-y-auto">
                        {phishingLogs.map((log, i) => (
                          <div key={i} className={cn(
                            log.startsWith('!') ? "text-red-400" : 
                            log.startsWith('>') ? "text-cyan-400" : 
                            "text-zinc-500"
                          )}>
                            {log}
                          </div>
                        ))}
                        {isAnalyzingUrl && <div className="text-cyan-400 animate-pulse">_</div>}
                      </div>
                    </div>

                    {/* Risk Distribution */}
                    <div className="bg-[#05070f] border border-zinc-800/50 rounded-2xl p-6 space-y-6">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Risk Distribution</span>
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between text-[10px] font-bold">
                            <span className="text-zinc-500">Dangerous</span>
                            <span className="text-red-500">{phishingRisk.dangerous}</span>
                          </div>
                          <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: showPhishingResult ? '40%' : 0 }}
                              className="h-full bg-red-500"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-[10px] font-bold">
                            <span className="text-zinc-500">Suspicious</span>
                            <span className="text-yellow-500">{phishingRisk.suspicious}</span>
                          </div>
                          <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: showPhishingResult ? '20%' : 0 }}
                              className="h-full bg-yellow-500"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-[10px] font-bold">
                            <span className="text-zinc-500">Verified Safe</span>
                            <span className="text-cyan-500">{phishingRisk.safe}</span>
                          </div>
                          <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: showPhishingResult ? '40%' : 0 }}
                              className="h-full bg-cyan-500"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-8 border-t border-zinc-800/50">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">2026 MIRAGE Privacy & Phishing Intelligence Engine</span>
                  </div>
                  <div className="flex items-center gap-6 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                    <span>Compliance: GDPR/CCPA Ready</span>
                    <span>API: Operational</span>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'stripper' && (
              <motion.div
                key="stripper-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                {/* Step 1: Audience */}
                {step === 'audience' && (
                  <motion.section
                    key="audience"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="space-y-8"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-3xl font-black tracking-tight mb-2">
                          EXIF Data Stripper
                        </h2>
                        <p className="text-zinc-500">Select an audience profile to begin the anonymization process.</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <h2 className="text-2xl font-bold border-l-4 border-violet-500 pl-4">Who are you sharing with?</h2>
                  {dnaReport?.status === 'ready' && (
                    <button 
                      onClick={() => setStep('upload')}
                      className="text-violet-400 hover:text-violet-300 flex items-center gap-1 text-sm font-bold"
                    >
                      Skip to Upload <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  {AUDIENCE_PROFILES.map((profile) => (
                    <button
                      key={profile.id}
                      onClick={() => {
                        setAudience(profile);
                        setStep('upload');
                      }}
                      className={cn(
                        "group relative p-6 rounded-2xl border-2 transition-all duration-300 text-center overflow-hidden",
                        audience.id === profile.id 
                          ? "bg-violet-500/10 border-violet-500 shadow-[0_0_30px_rgba(139,92,246,0.2)]" 
                          : "bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 hover:translate-y-[-4px]"
                      )}
                    >
                      <div className="text-4xl mb-4">{profile.icon}</div>
                      <div className="font-bold mb-1">{profile.label}</div>
                      <div className="text-xs text-zinc-500 leading-tight">{profile.desc}</div>
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-violet-500/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                    </button>
                  ))}
                </div>

                {dnaReport?.status === 'ready' && (
                  <div className="mt-12 p-8 bg-zinc-900/50 border border-zinc-800 rounded-3xl">
                    <div className="flex items-center gap-3 mb-6">
                      <Dna className="w-6 h-6 text-violet-500" />
                      <h3 className="text-xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">Your Privacy DNA</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div className="text-center">
                        <div className="text-5xl font-black text-violet-500 mb-2">{dnaReport.health_score}</div>
                        <div className="text-sm text-zinc-500 uppercase tracking-widest font-bold">Health Score</div>
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="px-2 py-1 bg-violet-500/10 text-violet-400 rounded-md font-bold border border-violet-500/20">{dnaReport.risk_tolerance}</span>
                        </div>
                        <div className="text-sm text-zinc-400">
                          <span className="text-zinc-500">Top Audience:</span> {dnaReport.top_audience}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs font-bold text-zinc-500 uppercase">Recent Insights</div>
                        {dnaReport.insights.map((insight, i) => (
                          <div key={i} className="text-sm text-zinc-300 flex items-start gap-2">
                            <span className="text-violet-500 mt-1">→</span> {insight}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </motion.section>
            )}

            {/* Step 2: Upload */}
            {step === 'upload' && (
              <motion.section
                key="upload"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="max-w-2xl mx-auto"
              >
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file) processFile(file);
                  }}
                  className="group relative bg-zinc-900/50 border-2 border-dashed border-zinc-800 rounded-[2.5rem] p-16 text-center cursor-pointer hover:border-violet-500 hover:bg-violet-500/5 transition-all duration-500 overflow-hidden"
                >
                  <div className="relative z-10">
                    <div className="w-24 h-24 bg-violet-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 group-hover:scale-110 transition-transform duration-500">
                      <Upload className="w-12 h-12 text-violet-500" />
                    </div>
                    <h3 className="text-3xl font-bold mb-4">Drop your image here</h3>
                    <p className="text-zinc-500 mb-8 max-w-xs mx-auto">PNG, JPG, or WebP — Processed entirely on your device with MIRAGE Ghost Replacement</p>
                    <button className="px-8 py-4 bg-violet-600 hover:bg-violet-500 text-white rounded-full font-bold shadow-lg shadow-violet-500/20 transition-all">
                      Choose File
                    </button>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileSelect} 
                    className="hidden" 
                    accept="image/*" 
                  />
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="mt-8 flex justify-center">
                  <button onClick={() => setStep('audience')} className="text-zinc-500 hover:text-zinc-300 text-sm font-bold flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" /> Change Audience Profile
                  </button>
                </div>
              </motion.section>
            )}

            {/* Step 3: Review */}
            {step === 'review' && (
              <motion.section
                key="review"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-12"
              >
                {/* Progress */}
                <div className="flex items-center gap-4 bg-zinc-900/50 p-2 rounded-full border border-zinc-800 max-w-md mx-auto">
                  <div className="flex-1 text-center py-2 rounded-full bg-violet-500/10 text-violet-400 text-xs font-bold">1. SCAN</div>
                  <div className="flex-1 text-center py-2 rounded-full bg-violet-500 text-white text-xs font-bold">2. REVIEW</div>
                  <div className="flex-1 text-center py-2 rounded-full text-zinc-600 text-xs font-bold">3. EXPORT</div>
                </div>

                {/* Preview Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Original</h3>
                    </div>
                    <div className="aspect-video bg-zinc-900 rounded-3xl border border-zinc-800 overflow-hidden flex items-center justify-center relative group">
                      {originalImage && <img src={originalImage} className="max-h-full object-contain" alt="Original" />}
                      
                      {/* EXIF Overlay */}
                      <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity p-6 overflow-y-auto">
                        <h4 className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-4">Embedded Metadata (EXIF)</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(exifTags).length > 0 ? Object.entries(exifTags).map(([key, val], i) => (
                            typeof val !== 'object' && (
                              <div key={i} className="space-y-0.5">
                                <div className="text-[8px] font-bold text-zinc-500 uppercase">{key}</div>
                                <div className="text-[10px] font-mono text-zinc-300 truncate">{String(val)}</div>
                              </div>
                            )
                          )) : (
                            <div className="col-span-2 text-zinc-600 italic text-[10px]">No metadata found</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                        MIRAGE Protected <span className="px-2 py-0.5 bg-violet-500 text-white rounded text-[10px] animate-pulse">LIVE</span>
                      </h3>
                    </div>
                    <div className="aspect-video bg-zinc-900 rounded-3xl border border-zinc-800 overflow-hidden flex items-center justify-center relative">
                      <canvas ref={canvasRef} className="max-h-full max-w-full object-contain" />
                      {isScanning && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center">
                          <RefreshCw className="w-12 h-12 text-violet-500 animate-spin mb-4" />
                          <p className="text-lg font-bold">AI Reflection Hunter Scanning...</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Detections */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-[2rem] p-8">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div>
                      <h3 className="text-2xl font-bold mb-2 flex items-center gap-3">
                        🔍 AI Detected {detections.length} Items
                      </h3>
                      <p className="text-zinc-500 text-sm">Review and toggle redactions before exporting</p>
                    </div>
                    <div className={cn(
                      "px-6 py-3 rounded-2xl border flex items-center gap-3",
                      riskScore > 50 ? "bg-red-500/10 border-red-500/30 text-red-500" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                    )}>
                      {riskScore > 50 ? <AlertTriangle className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
                      <span className="font-black text-xl">Risk Score: {riskScore}%</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {detections.map((d) => (
                      <div 
                        key={d.id}
                        className={cn(
                          "group flex items-center gap-4 p-5 rounded-2xl border transition-all duration-200",
                          d.wow_moment ? "bg-red-500/5 border-red-500/20" : "bg-zinc-900 border-zinc-800 hover:border-zinc-700",
                          decisions[d.id] && "ring-1 ring-violet-500/50"
                        )}
                      >
                        <button 
                          onClick={() => toggleDecision(d.id)}
                          className={cn(
                            "w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors",
                            decisions[d.id] ? "bg-violet-500 border-violet-500" : "border-zinc-700"
                          )}
                        >
                          {decisions[d.id] && <CheckCircle2 className="w-4 h-4 text-white" />}
                        </button>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider",
                              d.type === 'face' ? "bg-blue-500/20 text-blue-400" :
                              d.type === 'credit_card' || d.type === 'ssn' ? "bg-red-500/20 text-red-400" :
                              d.type === 'gps_location' ? "bg-orange-500/20 text-orange-400" :
                              "bg-violet-500/20 text-violet-400"
                            )}>
                              {d.type.replace('_', ' ')}
                            </span>
                            {d.wow_moment && (
                              <span className="px-2 py-0.5 bg-red-500 text-white rounded text-[10px] font-black animate-pulse">
                                WOW MOMENT
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium text-zinc-300">{d.reason}</p>
                        </div>

                        <div className="text-right">
                          <div className="text-[10px] font-bold text-zinc-600 uppercase">Confidence</div>
                          <div className="text-sm font-black text-zinc-400">{Math.round(d.confidence * 100)}%</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Paranoia Dial */}
                  <div className="mt-12 p-8 bg-zinc-950/50 rounded-3xl border border-zinc-800">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <Zap className="w-6 h-6 text-violet-500" />
                        <h4 className="text-lg font-bold">Paranoia Dial</h4>
                      </div>
                      <span className="text-2xl font-black text-violet-500">{paranoia}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={paranoia}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setParanoia(val);
                        const threshold = (100 - val) / 100;
                        const newDecisions = { ...decisions };
                        detections.forEach(d => {
                          if (d.sensitive) newDecisions[d.id] = d.confidence >= threshold;
                        });
                        setDecisions(newDecisions);
                        calculateRisk(detections, newDecisions);
                      }}
                      className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-violet-500"
                    />
                    <div className="flex justify-between mt-4 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                      <span>Casual</span>
                      <span>Balanced</span>
                      <span>Maximum Privacy</span>
                    </div>
                  </div>

                  <button 
                    onClick={handleExport}
                    disabled={isScanning}
                    className="w-full mt-12 py-6 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-[2rem] text-xl font-black shadow-2xl shadow-violet-500/20 transition-all flex items-center justify-center gap-3"
                  >
                    <Shield className="w-6 h-6" /> Export Protected Image
                  </button>
                </div>
              </motion.section>
            )}

            {/* Step 4: Stamp */}
            {step === 'stamp' && trustStamp && (
              <motion.section
                key="stamp"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-3xl mx-auto space-y-8"
              >
                <div className={cn(
                  "p-12 rounded-[3rem] border-4 text-center space-y-8 relative overflow-hidden",
                  trustStamp.privacy_level === 'SAFE' ? "bg-emerald-500/5 border-emerald-500 shadow-[0_0_50px_rgba(16,185,129,0.2)]" : "bg-orange-500/5 border-orange-500"
                )}>
                  <div className="relative z-10">
                    <div className="flex items-center justify-center gap-4 mb-6">
                      <div className="text-6xl">🛰</div>
                      <div className="text-left">
                        <h3 className={cn(
                          "text-3xl font-black tracking-tighter",
                          trustStamp.privacy_level === 'SAFE' ? "text-emerald-500" : "text-orange-500"
                        )}>
                          MIRAGE VERIFIED — {trustStamp.privacy_level}
                        </h3>
                        <p className="text-zinc-500 font-mono text-sm">ID: {trustStamp.stamp_id}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-zinc-900/80 rounded-2xl border border-zinc-800">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Risk Before</div>
                        <div className="text-2xl font-black text-red-500">100%</div>
                      </div>
                      <div className="p-4 bg-zinc-900/80 rounded-2xl border border-zinc-800">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Risk After</div>
                        <div className="text-2xl font-black text-emerald-500">{trustStamp.risk_score_after}%</div>
                      </div>
                      <div className="p-4 bg-zinc-900/80 rounded-2xl border border-zinc-800">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Redacted</div>
                        <div className="text-2xl font-black">{trustStamp.items_redacted}</div>
                      </div>
                      <div className="p-4 bg-zinc-900/80 rounded-2xl border border-zinc-800">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Faces</div>
                        <div className="text-2xl font-black">{trustStamp.faces_protected}</div>
                      </div>
                    </div>

                    <div className="pt-8 border-t border-zinc-800 flex flex-wrap justify-center gap-6 text-xs font-bold text-zinc-500 uppercase tracking-widest">
                      <span className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Metadata Stripped</span>
                      <span className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> GPS Removed</span>
                      <span className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Ghost Replaced</span>
                    </div>
                  </div>
                  <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                    <Shield className="w-64 h-64" />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <button 
                    onClick={reset}
                    className="px-12 py-5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-full font-bold transition-all"
                  >
                    Process Another Image
                  </button>
                  <button 
                    onClick={() => {
                      const link = document.createElement('a');
                      link.download = `mirage_protected_${Date.now()}.png`;
                      link.href = canvasRef.current!.toDataURL('image/png');
                      link.click();
                    }}
                    className="px-12 py-5 bg-violet-600 hover:bg-violet-500 text-white rounded-full font-bold shadow-lg shadow-violet-500/20 transition-all flex items-center gap-2"
                  >
                    <Download className="w-5 h-5" /> Download Again
                  </button>
                </div>
              </motion.section>
            )}
          </motion.div>
        )}

        {activeTab === 'overview' && (
          <motion.div
            key="overview-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            {/* Hero Section */}
            <div className="relative overflow-hidden bg-gradient-to-br from-cyan-500/10 via-transparent to-transparent border border-zinc-800/50 rounded-[2.5rem] p-12">
              <div className="relative z-10 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-6">
                  V2.4.0 Deployment Active
                </div>
                <h2 className="text-5xl font-black tracking-tighter mb-6 leading-[0.9]">
                  Advanced <span className="text-cyan-400">Privacy Intelligence</span> for the Modern Web
                </h2>
                <p className="text-zinc-400 text-lg mb-8 leading-relaxed">
                  MIRAGE provides real-time protection against phishing, surgical PII redaction, and deepfake detection using context-aware privacy engines.
                </p>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setActiveTab('stripper')}
                    className="px-8 py-3 bg-cyan-500 hover:bg-cyan-400 text-[#02040a] rounded-full font-bold flex items-center gap-2 transition-all shadow-lg shadow-cyan-500/20"
                  >
                    Initialize Scan <ChevronRight className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setActiveTab('sanitizer')}
                    className="px-8 py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-full font-bold transition-all"
                  >
                    Open Ghost Sanitizer
                  </button>
                </div>
              </div>
              <div className="absolute top-0 right-0 w-1/2 h-full bg-[radial-gradient(circle_at_70%_30%,rgba(34,211,238,0.15),transparent_70%)]" />
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Threats Blocked', value: '1,284', change: '+12% this week', icon: <Shield className="w-4 h-4" />, color: 'cyan' },
                { label: 'PII Sanitized', value: '45.2k', change: '+5% from yesterday', icon: <Lock className="w-4 h-4" />, color: 'blue' },
                { label: 'Phishing Sites Flagged', value: '312', change: '-2% overall', icon: <AlertTriangle className="w-4 h-4 text-red-500" />, color: 'red' },
                { label: 'Integrity Checks', value: '8,941', change: '100% success rate', icon: <Activity className="w-4 h-4 text-emerald-500" />, color: 'emerald' },
              ].map((stat, i) => (
                <div key={i} className="bg-[#05070f] border border-zinc-800/50 p-6 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{stat.label}</span>
                    <div className={cn("p-2 rounded-lg bg-zinc-900 border border-zinc-800", stat.color === 'red' ? 'text-red-500' : stat.color === 'emerald' ? 'text-emerald-500' : 'text-cyan-400')}>
                      {stat.icon}
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-black">{stat.value}</div>
                    <div className={cn("text-[10px] font-bold", stat.change.includes('+') ? 'text-emerald-500' : stat.change.includes('-') ? 'text-red-500' : 'text-zinc-500')}>
                      {stat.change}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Core Engine Status */}
              <div className="lg:col-span-2 bg-[#05070f] border border-zinc-800/50 rounded-2xl p-8 space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest mb-1">Core Engine Status</h3>
                    <p className="text-[10px] text-zinc-500">Real-time telemetry from MIRAGE neural layers</p>
                  </div>
                  <Activity className="w-5 h-5 text-cyan-400" />
                </div>
                
                <div className="space-y-6">
                  {[
                    { label: 'Heuristic Phishing Analysis', status: 'Optimal', value: 94, color: 'cyan' },
                    { label: 'Ghost Data Generation', status: 'Normal', value: 82, color: 'cyan' },
                    { label: 'EXIF Forensic Engine', status: 'Optimal', value: 88, color: 'cyan' },
                    { label: 'Deepfake Vector Scan', status: 'High Load', value: 65, color: 'yellow' },
                  ].map((engine, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-zinc-400">{engine.label}</span>
                        <span className={cn(
                          "text-[8px] font-bold px-1.5 py-0.5 rounded uppercase",
                          engine.status === 'Optimal' ? "bg-emerald-500/10 text-emerald-500" :
                          engine.status === 'Normal' ? "bg-cyan-500/10 text-cyan-400" :
                          "bg-yellow-500/10 text-yellow-500"
                        )}>{engine.status}</span>
                      </div>
                      <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${engine.value}%` }}
                          className={cn("h-full", engine.color === 'yellow' ? 'bg-yellow-500' : 'bg-cyan-500')}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Security Feed */}
              <div className="bg-[#05070f] border border-zinc-800/50 rounded-2xl p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest mb-1">Security Feed</h3>
                    <p className="text-[10px] text-zinc-500">Most recent interceptions</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {[
                    { type: 'PHISHING', message: 'Blocked linkjacking on movi-net.com', time: '2m ago', color: 'red' },
                    { type: 'PII', message: 'Sanitized CC info in upload_01.pdf', time: '15m ago', color: 'cyan' },
                    { type: 'DEEPFAKE', message: 'Detected forged ID signature', time: '1h ago', color: 'red' },
                    { type: 'METADATA', message: 'Stripped GPS from vacation.jpg', time: '3h ago', color: 'zinc' },
                  ].map((event, i) => (
                    <div key={i} className="flex items-start justify-between gap-4 group">
                      <div className="space-y-1">
                        <div className={cn(
                          "inline-block px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-tighter",
                          event.color === 'red' ? "bg-red-500/10 text-red-500" :
                          event.color === 'cyan' ? "bg-cyan-500/10 text-cyan-400" :
                          "bg-zinc-800 text-zinc-400"
                        )}>
                          {event.type}
                        </div>
                        <div className="text-[10px] font-bold text-zinc-300 leading-tight group-hover:text-white transition-colors">
                          {event.message}
                        </div>
                      </div>
                      <div className="text-[8px] font-bold text-zinc-600 whitespace-nowrap pt-1">
                        {event.time}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'deepfake' && (
          <motion.div
            key="deepfake-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-black tracking-tight flex items-center gap-3">
                  <Zap className="w-8 h-8 text-cyan-400" /> Multi-Vector Deepfake Analysis
                </h2>
                <p className="text-zinc-500">Detect forged documents, manipulated images, and GAN-generated content</p>
              </div>
              <div className="flex items-center gap-4">
                <input 
                  type="file" 
                  id="deepfake-upload" 
                  className="hidden" 
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleDeepfakeAnalysis(e.target.files[0])}
                />
                <button 
                  onClick={() => document.getElementById('deepfake-upload')?.click()}
                  disabled={isAnalyzingDeepfake}
                  className="px-6 py-2 bg-cyan-500 hover:bg-cyan-400 text-[#02040a] rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all"
                >
                  {isAnalyzingDeepfake ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Upload for Analysis
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Forensic Workspace */}
              <div className="lg:col-span-2 bg-[#05070f] border border-zinc-800/50 rounded-2xl overflow-hidden flex flex-col h-[600px] relative">
                <div className="p-4 border-b border-zinc-800/50 flex items-center gap-2 bg-zinc-900/20">
                  <MousePointer2 className="w-3 h-3 text-cyan-400" />
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Forensic Workspace</span>
                </div>
                
                <div className="flex-1 relative flex items-center justify-center bg-black/40 overflow-hidden">
                  {deepfakeImage ? (
                    <div className="relative inline-block">
                      <img 
                        ref={deepfakeImgRef}
                        src={deepfakeImage} 
                        className="max-h-[500px] object-contain" 
                        alt="Deepfake Analysis" 
                      />
                      {deepfakeResult?.manipulations.map((m, i) => {
                        const [ymin, xmin, ymax, xmax] = m.box_2d;
                        return (
                          <div 
                            key={i}
                            className="absolute border-2 border-red-500"
                            style={{
                              top: `${ymin / 10}%`,
                              left: `${xmin / 10}%`,
                              width: `${(xmax - xmin) / 10}%`,
                              height: `${(ymax - ymin) / 10}%`
                            }}
                          >
                            <div className="absolute -top-6 left-0 bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 whitespace-nowrap uppercase">
                              {m.label}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto border border-zinc-800">
                        <ImageIcon className="w-8 h-8 text-zinc-700" />
                      </div>
                      <p className="text-zinc-600 text-sm font-bold">No image loaded in workspace</p>
                    </div>
                  )}

                  {isAnalyzingDeepfake && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                      <RefreshCw className="w-12 h-12 text-cyan-500 animate-spin mb-4" />
                      <p className="text-cyan-400 font-bold animate-pulse">Running Forensic Vectors...</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Forensic Intelligence Sidebar */}
              <div className="space-y-6">
                <div className="bg-[#05070f] border border-zinc-800/50 rounded-2xl p-6 space-y-6">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-800/50 pb-4">
                    <Activity className="w-3 h-3 text-cyan-400" /> Forensic Intelligence
                  </div>
                  
                  <div className="space-y-6">
                    {deepfakeResult ? (
                      deepfakeResult.vectors.map((v, i) => (
                        <div key={i} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-tight">{v.label}</span>
                            <span className={cn(
                              "text-[8px] font-bold px-1.5 py-0.5 rounded",
                              v.status === 'SAFE' ? "bg-emerald-500/10 text-emerald-500" :
                              v.status === 'SUSPICIOUS' ? "bg-yellow-500/10 text-yellow-500" :
                              "bg-red-500/10 text-red-500"
                            )}>{v.status}</span>
                          </div>
                          <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${v.confidence * 100}%` }}
                              className={cn(
                                "h-full transition-all duration-1000",
                                v.status === 'SAFE' ? "bg-emerald-500" :
                                v.status === 'SUSPICIOUS' ? "bg-yellow-500" :
                                "bg-red-500"
                              )}
                            />
                          </div>
                          <div className="flex justify-between text-[8px] font-bold text-zinc-600">
                            <span>{v.description}</span>
                            <span>{Math.round(v.confidence * 100)}% Confidence</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-12 text-center space-y-2">
                        <p className="text-zinc-600 text-[10px] font-bold uppercase">Waiting for analysis...</p>
                      </div>
                    )}
                  </div>
                </div>

                {deepfakeResult && (
                  <div className={cn(
                    "p-6 rounded-2xl border flex gap-4 transition-all",
                    deepfakeResult.risk_level === 'HIGH' ? "bg-red-500/5 border-red-500/20" :
                    deepfakeResult.risk_level === 'MEDIUM' ? "bg-yellow-500/5 border-yellow-500/20" :
                    "bg-emerald-500/5 border-emerald-500/20"
                  )}>
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                      deepfakeResult.risk_level === 'HIGH' ? "bg-red-500/20 text-red-500" :
                      deepfakeResult.risk_level === 'MEDIUM' ? "bg-yellow-500/20 text-yellow-500" :
                      "bg-emerald-500/20 text-emerald-500"
                    )}>
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className={cn(
                        "text-sm font-bold mb-1",
                        deepfakeResult.risk_level === 'HIGH' ? "text-red-400" :
                        deepfakeResult.risk_level === 'MEDIUM' ? "text-yellow-400" :
                        "text-emerald-400"
                      )}>{deepfakeResult.risk_level} Risk Detected</h4>
                      <p className="text-xs text-zinc-500 leading-relaxed">{deepfakeResult.summary}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'swarm' && (
          <motion.div
            key="swarm-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-black tracking-tight flex items-center gap-3">
                  <Activity className="w-8 h-8 text-cyan-400" /> Swarm Intelligence
                </h2>
                <p className="text-zinc-500">Parallel AI agent network for deep media analysis</p>
              </div>
              <div className="flex items-center gap-4">
                <input 
                  type="file" 
                  id="swarm-upload" 
                  className="hidden" 
                  onChange={(e) => e.target.files?.[0] && handleSwarmUpload(e.target.files[0])}
                />
                <button 
                  onClick={() => document.getElementById('swarm-upload')?.click()}
                  disabled={isSwarmAnalyzing}
                  className="px-6 py-2 bg-cyan-500 hover:bg-cyan-400 text-[#02040a] rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all"
                >
                  {isSwarmAnalyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Start Swarm Analysis
                </button>
              </div>
            </div>

            <SwarmVisualizer 
              agents={swarmAgents} 
              result={swarmResult} 
              isAnalyzing={isSwarmAnalyzing} 
            />
          </motion.div>
        )}

        {activeTab === 'guardian' && (
          <motion.div
            key="guardian-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-black tracking-tight flex items-center gap-3">
                  <ShieldCheck className="w-8 h-8 text-cyan-400" /> Screen Guardian
                </h2>
                <p className="text-zinc-500">Real-time screen monitoring and data leak prevention</p>
              </div>
              <button 
                onClick={toggleGuardian}
                className={cn(
                  "px-8 py-3 rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg",
                  isGuardianActive 
                    ? "bg-red-500 hover:bg-red-400 text-white shadow-red-500/20" 
                    : "bg-cyan-500 hover:bg-cyan-400 text-[#02040a] shadow-cyan-500/20"
                )}
              >
                {isGuardianActive ? <Lock className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                {isGuardianActive ? "Stop Guardian" : "Activate Guardian"}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                {/* Live Activity Monitor */}
                <div className="bg-[#05070f] border border-zinc-800/50 rounded-[2.5rem] p-8 relative overflow-hidden">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-cyan-500/20 rounded-xl flex items-center justify-center border border-cyan-500/30">
                        <Activity className="w-5 h-5 text-cyan-400" />
                      </div>
                      <h3 className="text-lg font-bold text-white">Live Activity Monitor</h3>
                    </div>
                    {isGuardianActive && (
                      <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Scanning</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-8 relative z-10">
                    {currentActivity ? (
                      <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-1">
                          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Active Application</div>
                          <div className="text-2xl font-black text-white">{currentActivity.active_app}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Domain Context</div>
                          <div className="text-2xl font-black text-cyan-400">{currentActivity.domain}</div>
                        </div>
                        <div className="col-span-2 space-y-4">
                          <div className="flex items-center justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                            <span>Real-time Risk Score</span>
                            <span className={cn(
                              currentActivity.risk_score > 0.7 ? "text-red-400" : "text-emerald-400"
                            )}>
                              {Math.round(currentActivity.risk_score * 100)}%
                            </span>
                          </div>
                          <div className="h-2 bg-zinc-900 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${currentActivity.risk_score * 100}%` }}
                              className={cn(
                                "h-full transition-all duration-500",
                                currentActivity.risk_score > 0.7 ? "bg-red-500" : "bg-emerald-500"
                              )}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="py-12 text-center">
                        <p className="text-zinc-600 italic">Activate Guardian to start real-time monitoring...</p>
                      </div>
                    )}
                  </div>

                  {/* Background Visualizer */}
                  <div className="absolute bottom-0 left-0 right-0 h-32 opacity-20 pointer-events-none">
                    <div className="flex items-end justify-around h-full px-8 gap-1">
                      {Array.from({ length: 40 }).map((_, i) => (
                        <motion.div
                          key={i}
                          animate={{ height: isGuardianActive ? `${Math.random() * 100}%` : '10%' }}
                          className="w-1 bg-cyan-500 rounded-t-full"
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {dashboardStats && <DashboardPanel stats={dashboardStats} />}
              </div>

              <div className="space-y-6">
                <div className="bg-[#05070f] border border-zinc-800/50 rounded-3xl p-6 space-y-6">
                  <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    <Shield className="w-3 h-3 text-cyan-400" /> Guardian Policies
                  </h4>
                  <div className="space-y-4">
                    {[
                      { label: 'Anti-Phishing', active: true },
                      { label: 'PII Detection', active: true },
                      { label: 'Screen Recording Block', active: false },
                      { label: 'Domain Whitelisting', active: true },
                      { label: 'Behavioral Analysis', active: isGuardianActive },
                    ].map((policy, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5">
                        <span className="text-xs font-medium text-zinc-300">{policy.label}</span>
                        <div className={cn(
                          "w-8 h-4 rounded-full relative transition-colors",
                          policy.active ? "bg-cyan-500" : "bg-zinc-800"
                        )}>
                          <div className={cn(
                            "w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all",
                            policy.active ? "right-0.5" : "left-0.5"
                          )} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-cyan-500/20 to-transparent border border-cyan-500/30 rounded-3xl p-6">
                  <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-4">Transparency Note</h4>
                  <p className="text-[10px] text-zinc-400 leading-relaxed">
                    Screen Guardian processes all visual data locally using on-device neural engines. No screen content or activity logs ever leave your machine.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'settings' && (
          <motion.div
            key="settings-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-black tracking-tight flex items-center gap-3">
                  <Settings className="w-8 h-8 text-cyan-400" /> Intelligence Configuration
                </h2>
                <p className="text-zinc-500">Calibrate the MIRAGE engine sensitivity and privacy behavior</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Paranoia Dial */}
              <div className="bg-[#05070f] border border-zinc-800/50 rounded-2xl p-8 space-y-8">
                <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-800/50 pb-4">
                  <ShieldAlert className="w-3 h-3 text-cyan-400" /> Paranoia Dial
                </div>
                
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="relative w-48 h-48 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90">
                      <circle
                        cx="96"
                        cy="96"
                        r="88"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="8"
                        className="text-zinc-900"
                      />
                      <motion.circle
                        cx="96"
                        cy="96"
                        r="88"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="8"
                        strokeDasharray="552.92"
                        initial={{ strokeDashoffset: 552.92 }}
                        animate={{ strokeDashoffset: 552.92 - (552.92 * paranoia) / 100 }}
                        className="text-cyan-400"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-4xl font-black tracking-tighter">{paranoia}%</span>
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Sensitivity</span>
                    </div>
                  </div>
                  
                  <div className="w-full mt-12 space-y-4">
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={paranoia}
                      onChange={(e) => setParanoia(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-zinc-900 rounded-full appearance-none cursor-pointer accent-cyan-400"
                    />
                    <div className="flex justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                      <span>Relaxed</span>
                      <span>Paranoid</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-xl flex gap-3">
                  <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-zinc-400 leading-relaxed">
                    <span className="font-bold text-cyan-400">Balanced Mode:</span> Optimized for daily use. Detects most phishing and PII patterns.
                  </p>
                </div>
              </div>

              {/* Adaptive Persona */}
              <div className="bg-[#05070f] border border-zinc-800/50 rounded-2xl p-8 space-y-8">
                <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-800/50 pb-4">
                  <UserCheck className="w-3 h-3 text-cyan-400" /> Adaptive Persona
                </div>

                <div className="space-y-4">
                  {[
                    { id: 'public', label: 'Public Persona', desc: 'Maximum redaction. Only show what\'s strictly necessary.', icon: <Globe className="w-5 h-5" /> },
                    { id: 'work', label: 'Work Persona', desc: 'Mask IDs and external faces, but preserve office context.', icon: <Lock className="w-5 h-5" /> },
                    { id: 'family', label: 'Family Persona', desc: 'Minimal masking. Only protect extreme financial data.', icon: <User className="w-5 h-5" /> },
                  ].map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setActivePersona(p.id as any)}
                      className={cn(
                        "w-full p-6 rounded-2xl border flex items-start gap-4 text-left transition-all group",
                        activePersona === p.id 
                          ? "bg-cyan-500/5 border-cyan-500/50 shadow-[0_0_20px_rgba(34,211,238,0.1)]" 
                          : "bg-zinc-900/30 border-zinc-800/50 hover:border-zinc-700"
                      )}
                    >
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                        activePersona === p.id ? "bg-cyan-500 text-[#02040a]" : "bg-zinc-900 text-zinc-500 group-hover:text-zinc-300"
                      )}>
                        {p.icon}
                      </div>
                      <div>
                        <h4 className={cn(
                          "font-bold mb-1 transition-colors",
                          activePersona === p.id ? "text-white" : "text-zinc-400 group-hover:text-zinc-200"
                        )}>{p.label}</h4>
                        <p className="text-[10px] text-zinc-500 leading-relaxed">{p.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Advanced Heuristics */}
              <div className="lg:col-span-2 bg-[#05070f] border border-zinc-800/50 rounded-2xl p-8 space-y-8">
                <div className="flex items-center justify-between border-b border-zinc-800/50 pb-4">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest mb-1">Advanced Heuristics</h3>
                    <p className="text-[10px] text-zinc-500">Fine-tune neural analysis parameters</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    { label: 'Lookalike Domain Levenshtein', value: '2.0', desc: 'Character substitution distance threshold' },
                    { label: 'Deepfake Noise Threshold', value: '0.15', desc: 'Sensitivity to pixel frequency variance' },
                    { label: 'Metadata Forensic Depth', value: 'High', desc: 'Recursive scan levels for hidden EXIF' },
                    { label: 'Neural Entity Cache', value: 'Active', desc: 'In-memory storage for context persistence' },
                  ].map((h, i) => (
                    <div key={i} className="bg-zinc-900/30 border border-zinc-800/50 p-6 rounded-2xl flex items-center justify-between group hover:border-zinc-700 transition-all">
                      <div>
                        <h4 className="text-xs font-bold text-zinc-300 mb-1">{h.label}</h4>
                        <p className="text-[10px] text-zinc-500">{h.desc}</p>
                      </div>
                      <div className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-[10px] font-bold text-cyan-400">
                        {h.value}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-4">
                  <button className="text-[10px] font-bold text-zinc-500 hover:text-white flex items-center gap-2 transition-all">
                    <RefreshCw className="w-3 h-3" /> Reset Engine to Factory Defaults
                  </button>
                  <button className="px-12 py-3 bg-cyan-500 hover:bg-cyan-400 text-[#02040a] rounded-full font-bold shadow-lg shadow-cyan-500/20 transition-all">
                    Save Intelligence Profile
                  </button>
                </div>
              </div>

              {/* System Logs */}
              <div className="lg:col-span-2 bg-black/40 border border-zinc-800/50 rounded-xl p-4 font-mono text-[10px] space-y-1">
                <div className="text-cyan-400/80">
                  <span className="text-zinc-600 mr-2">[2026-02-27 15:44:01]</span> ENGINE: MIRAGE Neural Core v2.4 initialized.
                </div>
                <div className="text-zinc-500">
                  <span className="text-zinc-600 mr-2">[2026-02-27 15:44:01]</span> CONFIG: Syncing user profile 'PUBLIC_PERSONA'.
                </div>
                <div className="text-zinc-500">
                  <span className="text-zinc-600 mr-2">[2026-02-27 15:44:02]</span> NETWORK: Heuristic subnets loaded from global threat DB.
                </div>
              </div>
            </div>
          </motion.div>
        )}

          </AnimatePresence>
        </main>
      </div>

      {/* Loading Overlay for Scan */}
      <AnimatePresence>
        {isScanning && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="relative mb-12">
              <div className="w-32 h-32 border-4 border-cyan-500/20 rounded-full animate-ping" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Shield className="w-16 h-16 text-cyan-400 animate-pulse" />
              </div>
            </div>
            <h2 className="text-4xl font-black mb-4 tracking-tighter">MIRAGE is Scanning...</h2>
            <div className="space-y-2 max-w-xs">
              <p className="text-zinc-400 font-medium">Detecting faces, PII, and background screens</p>
              <div className="flex items-center justify-center gap-2 text-cyan-400 text-sm font-bold">
                <Zap className="w-4 h-4 animate-bounce" /> Reflection Hunter Active
              </div>
            </div>
            <div className="mt-12 w-64 h-1 bg-zinc-800 rounded-full overflow-hidden">
              <motion.div 
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                className="w-1/2 h-full bg-cyan-500 shadow-[0_0_15px_rgba(34,211,238,0.8)]"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  </div>
  );
}

function SidebarItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all group",
        active 
          ? "bg-cyan-400 text-[#02040a] shadow-[0_0_20px_rgba(34,211,238,0.3)]" 
          : "text-zinc-400 hover:text-white hover:bg-zinc-900/50"
      )}
    >
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-sm font-bold">{label}</span>
      </div>
      {active && <ChevronRight className="w-4 h-4" />}
    </button>
  );
}
