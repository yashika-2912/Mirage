import { ScreenActivity, DashboardStats } from '../types';

export class ScreenGuardian {
  private isMonitoring: boolean = false;
  private history: ScreenActivity[] = [];
  private stats: DashboardStats = {
    threats_blocked_today: 0,
    files_sanitized: 0,
    risk_trend: [],
    threat_breakdown: {
      phishing: { count: 0, percentage: 0 },
      data_leak: { count: 0, percentage: 0 },
      pii_exposure: { count: 0, percentage: 0 }
    },
    recent_events: []
  };

  startMonitoring(onUpdate: (activity: ScreenActivity) => void) {
    this.isMonitoring = true;
    this.runLoop(onUpdate);
  }

  stopMonitoring() {
    this.isMonitoring = false;
  }

  private async runLoop(onUpdate: (activity: ScreenActivity) => void) {
    const apps = ['Chrome', 'Slack', 'VS Code', 'Terminal', 'Zoom'];
    const domains = ['github.com', 'google.com', 'internal-dashboard.net', 'localhost', 'unknown-site.xyz'];

    while (this.isMonitoring) {
      const activity: ScreenActivity = {
        active_app: apps[Math.floor(Math.random() * apps.length)],
        window_title: 'Working on Project Mirage',
        domain: domains[Math.floor(Math.random() * domains.length)],
        timestamp: new Date().toISOString(),
        risk_score: Math.random()
      };

      this.history.push(activity);
      if (this.history.length > 50) this.history.shift();
      
      onUpdate(activity);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  getStats(): DashboardStats {
    // Mock stats generation
    return {
      ...this.stats,
      risk_trend: Array.from({ length: 10 }, (_, i) => ({
        timestamp: Date.now() - (9 - i) * 3600000,
        risk: Math.random()
      })),
      recent_events: this.history.slice(-5).map(h => ({
        type: h.risk_score > 0.7 ? 'block' : 'monitor',
        message: h.risk_score > 0.7 ? `Blocked potential leak in ${h.active_app}` : `Monitoring ${h.active_app}`,
        timestamp: h.timestamp
      }))
    };
  }
}
