import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as mongoose from 'mongoose';
import * as apm from 'elastic-apm-node';

// API Service Monitor Configuration
interface ServiceConfig {
  name: string;
  url: string;
  interval: number; // in seconds
  threshold: number; // in ms
}

// API Response Model
interface ApiResponse {
  status: number;
  responseTime: number;
  error?: string;
}

// API Service Monitor Class
class ServiceMonitor {
  private config: ServiceConfig;
  private apmClient: any;

  constructor(config: ServiceConfig) {
    this.config = config;
    this.apmClient = apm.start({
      serviceName: config.name,
      serverUrl: 'http://localhost:8200',
      captureBody: 'all'
    });
  }

  async monitor() {
    try {
      const start = Date.now();
      const response = await fetch(this.config.url);
      const responseTime = Date.now() - start;
      const status = response.status;

      // Check if response time exceeds threshold
      if (responseTime > this.config.threshold) {
        this.apmClient.captureError(new Error(`Response time exceeded threshold: ${responseTime}ms`));
      }

      return {
        status,
        responseTime
      };
    } catch (error) {
      this.apmClient.captureError(error);
      return {
        status: 500,
        responseTime: 0,
        error: error.message
      };
    }
  }
}

// API Service Monitor Service
class ServiceMonitorService {
  private services: ServiceMonitor[];

  constructor() {
    this.services = [];
  }

  addService(config: ServiceConfig) {
    this.services.push(new ServiceMonitor(config));
  }

  async monitor() {
    const results: ApiResponse[] = [];

    for (const service of this.services) {
      const result = await service.monitor();
      results.push(result);
    }

    return results;
  }
}

// API Server
const app = express();
app.use(bodyParser.json());

const serviceMonitorService = new ServiceMonitorService();

// Add API services to monitor
serviceMonitorService.addService({
  name: 'Service A',
  url: 'https://service-a.com/api',
  interval: 30,
  threshold: 200
});

serviceMonitorService.addService({
  name: 'Service B',
  url: 'https://service-b.com/api',
  interval: 60,
  threshold: 500
});

// API endpoint to trigger monitoring
app.post('/monitor', async (req, res) => {
  const results = await serviceMonitorService.monitor();
  res.json(results);
});

// Start API server
const port = 3000;
app.listen(port, () => {
  console.log(`API service monitor running on port ${port}`);
});