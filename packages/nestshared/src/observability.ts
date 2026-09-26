/**
 * Distributed tracing for the Node services, matching
 * `packages/goshared/observability`.
 *
 * Must be imported before anything else in main.ts: the SDK patches modules as
 * they load, and a module already required is a module already unpatched.
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { ParentBasedSampler, TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-base';

export interface TracingOptions {
  serviceName: string;
  environment: string;
  endpoint: string;
  sampleRatio?: number;
}

export function startTracing(options: TracingOptions): { shutdown: () => Promise<void> } {
  if (!options.endpoint) {
    return { shutdown: async () => undefined };
  }

  const ratio = options.sampleRatio ?? (options.environment === 'production' ? 0.1 : 1.0);

  const sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: options.serviceName,
      'deployment.environment': options.environment,
    }),
    traceExporter: new OTLPTraceExporter({ url: `${options.endpoint}/v1/traces` }),
    // ParentBased keeps one browser request as one trace across every hop.
    sampler: new ParentBasedSampler({ root: new TraceIdRatioBasedSampler(ratio) }),
    instrumentations: [
      getNodeAutoInstrumentations({
        // Health probes would otherwise dominate the trace volume.
        '@opentelemetry/instrumentation-http': {
          ignoreIncomingRequestHook: (request) =>
            request.url === '/healthz' || request.url === '/readyz',
        },
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();
  return { shutdown: () => sdk.shutdown() };
}
