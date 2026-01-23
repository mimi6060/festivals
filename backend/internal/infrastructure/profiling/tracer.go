package profiling

import (
	"context"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.21.0"
	"go.opentelemetry.io/otel/trace"
)

// TracerConfig holds configuration for OpenTelemetry tracing
type TracerConfig struct {
	// ServiceName is the name of the service
	ServiceName string
	// ServiceVersion is the version of the service
	ServiceVersion string
	// Environment is the deployment environment (development, staging, production)
	Environment string
	// OTLPEndpoint is the endpoint for the OTLP exporter
	OTLPEndpoint string
	// SampleRate is the fraction of traces to sample (0.0 to 1.0)
	SampleRate float64
	// Enabled determines if tracing is enabled
	Enabled bool
	// InsecureExporter uses insecure connection for the exporter
	InsecureExporter bool
}

// DefaultTracerConfig returns the default tracer configuration
func DefaultTracerConfig(serviceName string) TracerConfig {
	return TracerConfig{
		ServiceName:      serviceName,
		ServiceVersion:   "1.0.0",
		Environment:      "development",
		OTLPEndpoint:     "localhost:4317",
		SampleRate:       1.0,
		Enabled:          true,
		InsecureExporter: true,
	}
}

// TracerProvider wraps the OpenTelemetry tracer provider
type TracerProvider struct {
	provider *sdktrace.TracerProvider
	config   TracerConfig
}

// InitTracer initializes the OpenTelemetry tracer
func InitTracer(ctx context.Context, config TracerConfig) (*TracerProvider, error) {
	if !config.Enabled {
		return &TracerProvider{config: config}, nil
	}

	// Create OTLP exporter
	opts := []otlptracegrpc.Option{
		otlptracegrpc.WithEndpoint(config.OTLPEndpoint),
	}

	if config.InsecureExporter {
		opts = append(opts, otlptracegrpc.WithInsecure())
	}

	client := otlptracegrpc.NewClient(opts...)
	exporter, err := otlptrace.New(ctx, client)
	if err != nil {
		return nil, err
	}

	// Create resource with service information
	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceName(config.ServiceName),
			semconv.ServiceVersion(config.ServiceVersion),
			semconv.DeploymentEnvironment(config.Environment),
		),
	)
	if err != nil {
		return nil, err
	}

	// Create sampler based on sample rate
	var sampler sdktrace.Sampler
	if config.SampleRate >= 1.0 {
		sampler = sdktrace.AlwaysSample()
	} else if config.SampleRate <= 0.0 {
		sampler = sdktrace.NeverSample()
	} else {
		sampler = sdktrace.TraceIDRatioBased(config.SampleRate)
	}

	// Create trace provider
	provider := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
		sdktrace.WithSampler(sampler),
	)

	// Set global trace provider
	otel.SetTracerProvider(provider)

	// Set global propagator
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))

	return &TracerProvider{
		provider: provider,
		config:   config,
	}, nil
}

// Shutdown gracefully shuts down the tracer provider
func (tp *TracerProvider) Shutdown(ctx context.Context) error {
	if tp.provider == nil {
		return nil
	}
	return tp.provider.Shutdown(ctx)
}

// Tracer returns a named tracer
func (tp *TracerProvider) Tracer(name string) trace.Tracer {
	if tp.provider == nil {
		return otel.GetTracerProvider().Tracer(name)
	}
	return tp.provider.Tracer(name)
}

// Span wraps a trace span with helper methods
type Span struct {
	trace.Span
	startTime time.Time
}

// StartSpan starts a new span with the given name
func StartSpan(ctx context.Context, name string, opts ...trace.SpanStartOption) (context.Context, *Span) {
	tracer := otel.Tracer("festivals")
	ctx, span := tracer.Start(ctx, name, opts...)
	return ctx, &Span{Span: span, startTime: time.Now()}
}

// StartSpanWithTracer starts a new span with a specific tracer
func StartSpanWithTracer(ctx context.Context, tracer trace.Tracer, name string, opts ...trace.SpanStartOption) (context.Context, *Span) {
	ctx, span := tracer.Start(ctx, name, opts...)
	return ctx, &Span{Span: span, startTime: time.Now()}
}

// SetStringAttribute adds a string attribute to the span
func (s *Span) SetStringAttribute(key, value string) {
	s.SetAttributes(attribute.String(key, value))
}

// SetIntAttribute adds an int attribute to the span
func (s *Span) SetIntAttribute(key string, value int) {
	s.SetAttributes(attribute.Int(key, value))
}

// SetInt64Attribute adds an int64 attribute to the span
func (s *Span) SetInt64Attribute(key string, value int64) {
	s.SetAttributes(attribute.Int64(key, value))
}

// SetBoolAttribute adds a bool attribute to the span
func (s *Span) SetBoolAttribute(key string, value bool) {
	s.SetAttributes(attribute.Bool(key, value))
}

// SetFloatAttribute adds a float64 attribute to the span
func (s *Span) SetFloatAttribute(key string, value float64) {
	s.SetAttributes(attribute.Float64(key, value))
}

// RecordError records an error on the span
func (s *Span) RecordError(err error) {
	if err != nil {
		s.Span.RecordError(err)
	}
}

// Duration returns the duration since the span started
func (s *Span) Duration() time.Duration {
	return time.Since(s.startTime)
}

// EndWithError ends the span and records an error if present
func (s *Span) EndWithError(err error) {
	if err != nil {
		s.RecordError(err)
		s.SetStringAttribute("error", err.Error())
	}
	s.End()
}

// SpanFromContext extracts the span from context
func SpanFromContext(ctx context.Context) *Span {
	span := trace.SpanFromContext(ctx)
	return &Span{Span: span, startTime: time.Now()}
}

// HTTPAttributes creates common HTTP span attributes
func HTTPAttributes(method, path string, statusCode int) []attribute.KeyValue {
	return []attribute.KeyValue{
		semconv.HTTPMethod(method),
		semconv.HTTPRoute(path),
		semconv.HTTPStatusCode(statusCode),
	}
}

// DBAttributes creates common database span attributes
func DBAttributes(dbSystem, dbName, operation, table string) []attribute.KeyValue {
	attrs := []attribute.KeyValue{
		semconv.DBSystemKey.String(dbSystem),
		semconv.DBName(dbName),
		semconv.DBOperation(operation),
	}
	if table != "" {
		attrs = append(attrs, semconv.DBSQLTable(table))
	}
	return attrs
}

// CacheAttributes creates common cache span attributes
func CacheAttributes(cacheName string, hit bool) []attribute.KeyValue {
	return []attribute.KeyValue{
		attribute.String("cache.name", cacheName),
		attribute.Bool("cache.hit", hit),
	}
}
