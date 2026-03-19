/**
 * MonitorService — API client for the folder-monitor feature.
 *
 * Endpoints:
 *   POST /api/monitor/start   { folder, car_name }
 *   POST /api/monitor/stop
 *   GET  /api/monitor/status
 *   GET  /api/monitor/events  (SSE — not handled here, managed by useMonitor hook)
 */
import { BaseService } from './BaseService';

class MonitorService extends BaseService {
  constructor() {
    super('/api/monitor');
  }

  /** Start monitoring a folder for the given car. */
  async start(folder, carName) {
    return this.post('/start', { folder, car_name: carName });
  }

  /** Stop the active monitor. */
  async stop() {
    return this.post('/stop');
  }

  /** Fetch current monitor state. */
  async status() {
    return this.get('/status');
  }
}

export default new MonitorService();
