export type DetectionType = 
  | 'face' 
  | 'credit_card' 
  | 'ssn' 
  | 'phone' 
  | 'email' 
  | 'address' 
  | 'passport' 
  | 'reflection_exposure' 
  | 'background_screen' 
  | 'gps_location'
  | 'license_plate'
  | 'barcode'
  | 'qr_code'
  | 'sensitive_document'
  | 'name'
  | 'swarm_consensus';

export type AgentStatus = 'idle' | 'analyzing' | 'complete' | 'error';

export interface SwarmAgent {
  id: string;
  name: string;
  type: 'metadata' | 'vision' | 'ocr' | 'audio' | 'behavior';
  status: AgentStatus;
  risk_score: number;
  explanation: string;
  confidence: number;
  processing_time?: number;
}

export interface SwarmResult {
  risk_score: number;
  action_level: 'safe' | 'caution' | 'warning' | 'critical';
  action_message: string;
  agents: SwarmAgent[];
  processing_time: number;
}

export interface ScreenActivity {
  active_app: string;
  window_title: string;
  domain: string;
  timestamp: string;
  risk_score: number;
}

export interface DashboardStats {
  threats_blocked_today: number;
  files_sanitized: number;
  risk_trend: { timestamp: number; risk: number }[];
  threat_breakdown: Record<string, { count: number; percentage: number }>;
  recent_events: any[];
}
export interface Detection {
  id: string;
  type: DetectionType;
  box: [number, number, number, number]; // [x1, y1, x2, y2]
  confidence: number;
  reason: string;
  sensitive: boolean;
  replacement_mode: 'synthetic' | 'blur' | 'strip' | 'none';
  redact_by_default: boolean;
  text?: string;
  wow_moment?: boolean;
}

export interface TrustStamp {
  stamp_id: string;
  timestamp: string;
  audience_profile: string;
  output_hash_sha256: string;
  privacy_level: 'SAFE' | 'MODERATE' | 'REVIEW NEEDED';
  risk_score_before: number;
  risk_score_after: number;
  items_detected: number;
  items_redacted: number;
  metadata_stripped: boolean;
  faces_protected: number;
  verified: boolean;
}

export interface LedgerEntry {
  id: string;
  timestamp: string;
  file_hash: string;
  audience: string;
  risk_score_before: number;
  risk_score_after: number;
  items_redacted: number;
  items_detected: number;
}

export interface AudienceProfile {
  id: string;
  icon: string;
  label: string;
  desc: string;
  redact: DetectionType[];
  paranoia_level: number;
}

export const AUDIENCE_PROFILES: AudienceProfile[] = [
  { 
    id: 'public_social', 
    icon: '🌍', 
    label: 'Social Media', 
    desc: 'Public posts, maximum privacy',
    redact: ['face', 'credit_card', 'ssn', 'phone', 'email', 'address', 'passport', 'reflection_exposure', 'background_screen', 'gps_location', 'license_plate', 'barcode', 'qr_code', 'sensitive_document'],
    paranoia_level: 90
  },
  { 
    id: 'support_ticket', 
    icon: '🎧', 
    label: 'Support Ticket', 
    desc: 'Customer service only',
    redact: ['credit_card', 'ssn', 'passport', 'address', 'phone'],
    paranoia_level: 70
  },
  { 
    id: 'work_colleague', 
    icon: '💼', 
    label: 'Work / Slack', 
    desc: 'Professional context',
    redact: ['credit_card', 'ssn', 'passport'],
    paranoia_level: 40
  },
  { 
    id: 'doctor_lawyer', 
    icon: '⚕️', 
    label: 'Doctor / Lawyer', 
    desc: 'Trusted professionals',
    redact: ['background_screen', 'reflection_exposure', 'gps_location'],
    paranoia_level: 15
  },
  { 
    id: 'family_friend', 
    icon: '👨‍👩‍👧', 
    label: 'Family / Friend', 
    desc: 'Trusted contacts',
    redact: ['credit_card', 'ssn', 'gps_location'],
    paranoia_level: 25
  }
];
