import { Detection } from "../types";

export interface PrivacyDNAReport {
  status: 'insufficient_data' | 'ready';
  health_score: number;
  risk_tolerance: string;
  top_audience: string;
  most_common_leak: string;
  sensitivity_by_type: Record<string, number>;
  total_scans: number;
  insights: string[];
  recommendations: string[];
  scans_needed?: number;
}

const STORAGE_KEY = 'mirage_privacy_dna';

interface DNAData {
  total_scans: number;
  type_accepted: Record<string, number>;
  type_rejected: Record<string, number>;
  audience_usage: Record<string, number>;
  sessions: any[];
}

export function recordDNAsession(detections: Detection[], decisions: Record<string, boolean>, audience: string) {
  const raw = localStorage.getItem(STORAGE_KEY);
  let data: DNAData = raw ? JSON.parse(raw) : {
    total_scans: 0,
    type_accepted: {},
    type_rejected: {},
    audience_usage: {},
    sessions: []
  };

  data.total_scans += 1;
  data.audience_usage[audience] = (data.audience_usage[audience] || 0) + 1;

  detections.forEach(d => {
    const isRedacted = decisions[d.id];
    const type = d.type;
    if (isRedacted) {
      data.type_rejected[type] = (data.type_rejected[type] || 0) + 1;
    } else {
      data.type_accepted[type] = (data.type_accepted[type] || 0) + 1;
    }
  });

  data.sessions.push({
    timestamp: new Date().toISOString(),
    audience,
    redacted_count: Object.values(decisions).filter(Boolean).length
  });

  if (data.sessions.length > 50) data.sessions.shift();

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getDNAReport(): PrivacyDNAReport {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { status: 'insufficient_data', scans_needed: 3, total_scans: 0, health_score: 0, risk_tolerance: '', top_audience: '', most_common_leak: '', sensitivity_by_type: {}, insights: [], recommendations: [] };

  const data: DNAData = JSON.parse(raw);
  if (data.total_scans < 3) {
    return { 
      status: 'insufficient_data', 
      scans_needed: 3 - data.total_scans, 
      total_scans: data.total_scans,
      health_score: 0,
      risk_tolerance: '',
      top_audience: '',
      most_common_leak: '',
      sensitivity_by_type: {},
      insights: [],
      recommendations: []
    };
  }

  const sensitivity: Record<string, number> = {};
  const allTypes = new Set([...Object.keys(data.type_accepted), ...Object.keys(data.type_rejected)]);
  
  let mostLeakedType = 'None';
  let maxLeaked = 0;

  allTypes.forEach(type => {
    const accepted = data.type_accepted[type] || 0;
    const rejected = data.type_rejected[type] || 0;
    const total = accepted + rejected;
    sensitivity[type] = Math.round((rejected / total) * 100);
    
    if (accepted > maxLeaked) {
      maxLeaked = accepted;
      mostLeakedType = type;
    }
  });

  const totalRejected = Object.values(data.type_rejected).reduce((a, b) => a + b, 0);
  const totalAccepted = Object.values(data.type_accepted).reduce((a, b) => a + b, 0);
  const healthScore = Math.round((totalRejected / (totalRejected + totalAccepted || 1)) * 100);

  let riskTolerance = 'Balanced';
  if (healthScore > 80) riskTolerance = 'Privacy Guardian';
  else if (healthScore < 40) riskTolerance = 'Casual Sharer';

  const topAudience = Object.entries(data.audience_usage).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';

  return {
    status: 'ready',
    health_score: healthScore,
    risk_tolerance: riskTolerance,
    top_audience: topAudience.replace('_', ' ').toUpperCase(),
    most_common_leak: mostLeakedType.replace('_', ' '),
    sensitivity_by_type: sensitivity,
    total_scans: data.total_scans,
    insights: [
      healthScore > 70 ? "You have a strong preference for redacting PII." : "You tend to leave some personal data exposed.",
      sensitivity['gps_location'] < 50 ? "You often share location metadata." : "You consistently strip location data."
    ],
    recommendations: [
      healthScore < 50 ? "Enable auto-redaction for all PII types." : "Keep up the good work on privacy!",
      "Review your 'Social Media' sharing habits."
    ]
  };
}
