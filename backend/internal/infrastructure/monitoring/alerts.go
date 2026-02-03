package monitoring

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// AlertSeverity represents the severity level of an alert
type AlertSeverity string

const (
	SeverityCritical AlertSeverity = "critical"
	SeverityWarning  AlertSeverity = "warning"
	SeverityInfo     AlertSeverity = "info"
)

// AlertState represents the current state of an alert
type AlertState string

const (
	AlertStateFiring   AlertState = "firing"
	AlertStatePending  AlertState = "pending"
	AlertStateResolved AlertState = "resolved"
)

// Alert represents a business alert
type Alert struct {
	Name        string            `json:"alertname"`
	Severity    AlertSeverity     `json:"severity"`
	State       AlertState        `json:"state"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	Value       float64           `json:"value"`
	Threshold   float64           `json:"threshold"`
	StartsAt    time.Time         `json:"startsAt"`
	EndsAt      time.Time         `json:"endsAt,omitempty"`
	FiredAt     time.Time         `json:"firedAt,omitempty"`
}

// AlertRule defines a custom alerting rule
type AlertRule struct {
	Name           string
	Description    string
	Severity       AlertSeverity
	Team           string
	Category       string
	Threshold      float64
	Duration       time.Duration // How long condition must be true before firing
	EvaluateFunc   func(ctx context.Context) (float64, error)
	ConditionFunc  func(value, threshold float64) bool
	RunbookURL     string
	Labels         map[string]string
	silencedUntil  time.Time
	pendingSince   time.Time
	lastValue      float64
	lastEvaluation time.Time
	mu             sync.RWMutex
}

// BusinessAlertManager manages custom business alerts
type BusinessAlertManager struct {
	rules           map[string]*AlertRule
	activeAlerts    map[string]*Alert
	silences        map[string]time.Time
	alertHistory    []*Alert
	webhookURL      string
	evaluationTick  time.Duration
	historyLimit    int
	mu              sync.RWMutex
	registry        *prometheus.Registry
	metricsAlerts   *prometheus.GaugeVec
	metricsEvals    *prometheus.CounterVec
	metricsDuration *prometheus.HistogramVec
}

// NewBusinessAlertManager creates a new alert manager
func NewBusinessAlertManager(webhookURL string, registry *prometheus.Registry) *BusinessAlertManager {
	bam := &BusinessAlertManager{
		rules:          make(map[string]*AlertRule),
		activeAlerts:   make(map[string]*Alert),
		silences:       make(map[string]time.Time),
		alertHistory:   make([]*Alert, 0),
		webhookURL:     webhookURL,
		evaluationTick: 30 * time.Second,
		historyLimit:   1000,
		registry:       registry,
	}

	// Register metrics
	bam.metricsAlerts = promauto.With(registry).NewGaugeVec(
		prometheus.GaugeOpts{
			Namespace: "festivals",
			Name:      "business_alerts_active",
			Help:      "Number of active business alerts",
		},
		[]string{"alertname", "severity", "team"},
	)

	bam.metricsEvals = promauto.With(registry).NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "festivals",
			Name:      "business_alert_evaluations_total",
			Help:      "Total number of alert rule evaluations",
		},
		[]string{"alertname", "result"},
	)

	bam.metricsDuration = promauto.With(registry).NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: "festivals",
			Name:      "business_alert_evaluation_duration_seconds",
			Help:      "Duration of alert rule evaluations",
			Buckets:   []float64{.001, .005, .01, .025, .05, .1, .25, .5, 1},
		},
		[]string{"alertname"},
	)

	return bam
}

// RegisterRule registers a new alert rule
func (bam *BusinessAlertManager) RegisterRule(rule *AlertRule) {
	bam.mu.Lock()
	defer bam.mu.Unlock()
	bam.rules[rule.Name] = rule
}

// UnregisterRule removes an alert rule
func (bam *BusinessAlertManager) UnregisterRule(name string) {
	bam.mu.Lock()
	defer bam.mu.Unlock()
	delete(bam.rules, name)
}

// Silence silences an alert for the specified duration
func (bam *BusinessAlertManager) Silence(alertName string, duration time.Duration) {
	bam.mu.Lock()
	defer bam.mu.Unlock()
	bam.silences[alertName] = time.Now().Add(duration)
}

// Unsilence removes a silence for an alert
func (bam *BusinessAlertManager) Unsilence(alertName string) {
	bam.mu.Lock()
	defer bam.mu.Unlock()
	delete(bam.silences, alertName)
}

// IsSilenced checks if an alert is currently silenced
func (bam *BusinessAlertManager) IsSilenced(alertName string) bool {
	bam.mu.RLock()
	defer bam.mu.RUnlock()
	if silenceUntil, ok := bam.silences[alertName]; ok {
		return time.Now().Before(silenceUntil)
	}
	return false
}

// Start begins the alert evaluation loop
func (bam *BusinessAlertManager) Start(ctx context.Context) {
	ticker := time.NewTicker(bam.evaluationTick)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			bam.evaluateAllRules(ctx)
		}
	}
}

// evaluateAllRules evaluates all registered alert rules
func (bam *BusinessAlertManager) evaluateAllRules(ctx context.Context) {
	bam.mu.RLock()
	rules := make([]*AlertRule, 0, len(bam.rules))
	for _, rule := range bam.rules {
		rules = append(rules, rule)
	}
	bam.mu.RUnlock()

	for _, rule := range rules {
		bam.evaluateRule(ctx, rule)
	}
}

// evaluateRule evaluates a single alert rule
func (bam *BusinessAlertManager) evaluateRule(ctx context.Context, rule *AlertRule) {
	start := time.Now()
	defer func() {
		bam.metricsDuration.WithLabelValues(rule.Name).Observe(time.Since(start).Seconds())
	}()

	// Execute the evaluation function
	value, err := rule.EvaluateFunc(ctx)
	if err != nil {
		bam.metricsEvals.WithLabelValues(rule.Name, "error").Inc()
		return
	}

	rule.mu.Lock()
	rule.lastValue = value
	rule.lastEvaluation = time.Now()
	rule.mu.Unlock()

	// Check if condition is met
	conditionMet := rule.ConditionFunc(value, rule.Threshold)

	if conditionMet {
		bam.handleConditionMet(ctx, rule, value)
	} else {
		bam.handleConditionNotMet(ctx, rule)
	}
}

// handleConditionMet handles when an alert condition is met
func (bam *BusinessAlertManager) handleConditionMet(ctx context.Context, rule *AlertRule, value float64) {
	rule.mu.Lock()

	// Check if already pending or firing
	if rule.pendingSince.IsZero() {
		// Start pending state
		rule.pendingSince = time.Now()
		rule.mu.Unlock()
		bam.metricsEvals.WithLabelValues(rule.Name, "pending").Inc()
		return
	}

	// Check if duration threshold has been met
	if time.Since(rule.pendingSince) < rule.Duration {
		rule.mu.Unlock()
		bam.metricsEvals.WithLabelValues(rule.Name, "pending").Inc()
		return
	}
	rule.mu.Unlock()

	// Check if silenced
	if bam.IsSilenced(rule.Name) {
		bam.metricsEvals.WithLabelValues(rule.Name, "silenced").Inc()
		return
	}

	// Fire the alert
	bam.fireAlert(ctx, rule, value)
}

// handleConditionNotMet handles when an alert condition is not met
func (bam *BusinessAlertManager) handleConditionNotMet(ctx context.Context, rule *AlertRule) {
	rule.mu.Lock()
	rule.pendingSince = time.Time{} // Reset pending state
	rule.mu.Unlock()

	// Check if there's an active alert to resolve
	bam.mu.RLock()
	_, hasActiveAlert := bam.activeAlerts[rule.Name]
	bam.mu.RUnlock()

	if hasActiveAlert {
		bam.resolveAlert(ctx, rule)
	}

	bam.metricsEvals.WithLabelValues(rule.Name, "ok").Inc()
}

// fireAlert fires an alert
func (bam *BusinessAlertManager) fireAlert(ctx context.Context, rule *AlertRule, value float64) {
	bam.mu.Lock()
	defer bam.mu.Unlock()

	// Check if already firing
	if _, exists := bam.activeAlerts[rule.Name]; exists {
		bam.metricsEvals.WithLabelValues(rule.Name, "firing").Inc()
		return
	}

	// Create the alert
	labels := map[string]string{
		"alertname": rule.Name,
		"severity":  string(rule.Severity),
		"team":      rule.Team,
		"category":  rule.Category,
	}
	for k, v := range rule.Labels {
		labels[k] = v
	}

	alert := &Alert{
		Name:     rule.Name,
		Severity: rule.Severity,
		State:    AlertStateFiring,
		Labels:   labels,
		Annotations: map[string]string{
			"summary":     rule.Description,
			"description": fmt.Sprintf("%s: current value %.2f, threshold %.2f", rule.Description, value, rule.Threshold),
			"runbook_url": rule.RunbookURL,
		},
		Value:     value,
		Threshold: rule.Threshold,
		StartsAt:  time.Now(),
		FiredAt:   time.Now(),
	}

	bam.activeAlerts[rule.Name] = alert
	bam.addToHistory(alert)

	// Update metrics
	bam.metricsAlerts.WithLabelValues(rule.Name, string(rule.Severity), rule.Team).Set(1)
	bam.metricsEvals.WithLabelValues(rule.Name, "fired").Inc()

	// Send webhook notification
	go bam.sendWebhook(ctx, alert)
}

// resolveAlert resolves an active alert
func (bam *BusinessAlertManager) resolveAlert(ctx context.Context, rule *AlertRule) {
	bam.mu.Lock()
	defer bam.mu.Unlock()

	alert, exists := bam.activeAlerts[rule.Name]
	if !exists {
		return
	}

	alert.State = AlertStateResolved
	alert.EndsAt = time.Now()

	// Remove from active alerts
	delete(bam.activeAlerts, rule.Name)

	// Update metrics
	bam.metricsAlerts.WithLabelValues(rule.Name, string(rule.Severity), rule.Team).Set(0)
	bam.metricsEvals.WithLabelValues(rule.Name, "resolved").Inc()

	// Add resolved alert to history
	bam.addToHistory(alert)

	// Send webhook notification for resolved alert
	go bam.sendWebhook(ctx, alert)
}

// addToHistory adds an alert to the history
func (bam *BusinessAlertManager) addToHistory(alert *Alert) {
	bam.alertHistory = append(bam.alertHistory, alert)

	// Trim history if needed
	if len(bam.alertHistory) > bam.historyLimit {
		bam.alertHistory = bam.alertHistory[len(bam.alertHistory)-bam.historyLimit:]
	}
}

// sendWebhook sends a webhook notification
func (bam *BusinessAlertManager) sendWebhook(ctx context.Context, alert *Alert) {
	if bam.webhookURL == "" {
		return
	}

	payload := map[string]interface{}{
		"version":  "4",
		"status":   string(alert.State),
		"receiver": "business-alerts",
		"alerts": []map[string]interface{}{
			{
				"status":      string(alert.State),
				"labels":      alert.Labels,
				"annotations": alert.Annotations,
				"startsAt":    alert.StartsAt.Format(time.RFC3339),
				"endsAt":      alert.EndsAt.Format(time.RFC3339),
			},
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return
	}

	req, err := http.NewRequestWithContext(ctx, "POST", bam.webhookURL, strings.NewReader(string(body)))
	if err != nil {
		return
	}

	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()
}

// GetActiveAlerts returns all active alerts
func (bam *BusinessAlertManager) GetActiveAlerts() []*Alert {
	bam.mu.RLock()
	defer bam.mu.RUnlock()

	alerts := make([]*Alert, 0, len(bam.activeAlerts))
	for _, alert := range bam.activeAlerts {
		alerts = append(alerts, alert)
	}
	return alerts
}

// GetAlertHistory returns the alert history
func (bam *BusinessAlertManager) GetAlertHistory(limit int) []*Alert {
	bam.mu.RLock()
	defer bam.mu.RUnlock()

	if limit <= 0 || limit > len(bam.alertHistory) {
		limit = len(bam.alertHistory)
	}

	// Return most recent alerts first
	start := len(bam.alertHistory) - limit
	if start < 0 {
		start = 0
	}

	result := make([]*Alert, limit)
	for i := 0; i < limit; i++ {
		result[limit-1-i] = bam.alertHistory[start+i]
	}
	return result
}

// GetRuleStatus returns the status of a specific rule
func (bam *BusinessAlertManager) GetRuleStatus(name string) map[string]interface{} {
	bam.mu.RLock()
	rule, exists := bam.rules[name]
	bam.mu.RUnlock()

	if !exists {
		return nil
	}

	rule.mu.RLock()
	defer rule.mu.RUnlock()

	status := map[string]interface{}{
		"name":           rule.Name,
		"severity":       rule.Severity,
		"threshold":      rule.Threshold,
		"duration":       rule.Duration.String(),
		"lastValue":      rule.lastValue,
		"lastEvaluation": rule.lastEvaluation,
		"pendingSince":   rule.pendingSince,
		"silenced":       bam.IsSilenced(rule.Name),
	}

	// Check if alert is active
	bam.mu.RLock()
	if alert, ok := bam.activeAlerts[rule.Name]; ok {
		status["state"] = alert.State
		status["firedAt"] = alert.FiredAt
	} else if !rule.pendingSince.IsZero() {
		status["state"] = AlertStatePending
	} else {
		status["state"] = AlertStateResolved
	}
	bam.mu.RUnlock()

	return status
}

// CreateDefaultBusinessRules creates default business alert rules
func CreateDefaultBusinessRules(bam *BusinessAlertManager, metrics *Metrics) {
	// High failed transaction rate
	bam.RegisterRule(&AlertRule{
		Name:        "HighFailedTransactionRate",
		Description: "Transaction failure rate is above threshold",
		Severity:    SeverityCritical,
		Team:        "business",
		Category:    "transactions",
		Threshold:   0.05, // 5% failure rate
		Duration:    5 * time.Minute,
		RunbookURL:  "https://docs.festivals.io/runbooks/transaction-failures",
		EvaluateFunc: func(ctx context.Context) (float64, error) {
			// This would query Prometheus in a real implementation
			// For now, return a placeholder
			return 0.02, nil
		},
		ConditionFunc: func(value, threshold float64) bool {
			return value > threshold
		},
	})

	// Low wallet balance causing failed transactions
	bam.RegisterRule(&AlertRule{
		Name:        "HighInsufficientBalanceRate",
		Description: "High rate of transactions failing due to insufficient balance",
		Severity:    SeverityWarning,
		Team:        "business",
		Category:    "wallets",
		Threshold:   1.0, // 1 per second
		Duration:    10 * time.Minute,
		RunbookURL:  "https://docs.festivals.io/runbooks/low-balance",
		EvaluateFunc: func(ctx context.Context) (float64, error) {
			return 0.5, nil
		},
		ConditionFunc: func(value, threshold float64) bool {
			return value > threshold
		},
	})

	// Ticket scan failure rate
	bam.RegisterRule(&AlertRule{
		Name:        "HighTicketScanFailureRate",
		Description: "High rate of ticket scan failures",
		Severity:    SeverityWarning,
		Team:        "operations",
		Category:    "tickets",
		Threshold:   0.10, // 10% failure rate
		Duration:    10 * time.Minute,
		RunbookURL:  "https://docs.festivals.io/runbooks/ticket-scan-failures",
		EvaluateFunc: func(ctx context.Context) (float64, error) {
			return 0.05, nil
		},
		ConditionFunc: func(value, threshold float64) bool {
			return value > threshold
		},
	})

	// Suspicious wallet creation rate
	bam.RegisterRule(&AlertRule{
		Name:        "SuspiciousWalletCreationRate",
		Description: "Unusually high wallet creation rate detected",
		Severity:    SeverityWarning,
		Team:        "security",
		Category:    "fraud",
		Threshold:   10.0, // 10 per second
		Duration:    5 * time.Minute,
		RunbookURL:  "https://docs.festivals.io/runbooks/suspicious-wallet-creation",
		EvaluateFunc: func(ctx context.Context) (float64, error) {
			return 2.0, nil
		},
		ConditionFunc: func(value, threshold float64) bool {
			return value > threshold
		},
	})

	// Revenue drop alert
	bam.RegisterRule(&AlertRule{
		Name:        "RevenueDropAlert",
		Description: "Revenue has dropped significantly compared to previous period",
		Severity:    SeverityWarning,
		Team:        "business",
		Category:    "revenue",
		Threshold:   0.5, // 50% of previous period
		Duration:    30 * time.Minute,
		RunbookURL:  "https://docs.festivals.io/runbooks/revenue-drop",
		EvaluateFunc: func(ctx context.Context) (float64, error) {
			return 0.8, nil
		},
		ConditionFunc: func(value, threshold float64) bool {
			return value < threshold
		},
	})

	// No transactions during active festival
	bam.RegisterRule(&AlertRule{
		Name:        "NoTransactionsDuringFestival",
		Description: "No transactions recorded while festival is active",
		Severity:    SeverityWarning,
		Team:        "business",
		Category:    "transactions",
		Threshold:   0.0,
		Duration:    15 * time.Minute,
		RunbookURL:  "https://docs.festivals.io/runbooks/no-transactions",
		EvaluateFunc: func(ctx context.Context) (float64, error) {
			return 10.0, nil
		},
		ConditionFunc: func(value, threshold float64) bool {
			return value == threshold
		},
	})
}

// AlertThreshold represents configurable alert thresholds
type AlertThreshold struct {
	Name        string  `json:"name"`
	Threshold   float64 `json:"threshold"`
	Duration    string  `json:"duration"`
	Severity    string  `json:"severity"`
	Enabled     bool    `json:"enabled"`
	Description string  `json:"description"`
}

// AlertThresholdManager manages configurable alert thresholds
type AlertThresholdManager struct {
	thresholds map[string]*AlertThreshold
	mu         sync.RWMutex
	onChange   func(name string, threshold *AlertThreshold)
}

// NewAlertThresholdManager creates a new threshold manager
func NewAlertThresholdManager() *AlertThresholdManager {
	return &AlertThresholdManager{
		thresholds: make(map[string]*AlertThreshold),
	}
}

// SetThreshold sets a threshold value
func (atm *AlertThresholdManager) SetThreshold(name string, threshold *AlertThreshold) {
	atm.mu.Lock()
	atm.thresholds[name] = threshold
	atm.mu.Unlock()

	if atm.onChange != nil {
		atm.onChange(name, threshold)
	}
}

// GetThreshold gets a threshold value
func (atm *AlertThresholdManager) GetThreshold(name string) *AlertThreshold {
	atm.mu.RLock()
	defer atm.mu.RUnlock()
	return atm.thresholds[name]
}

// GetAllThresholds returns all thresholds
func (atm *AlertThresholdManager) GetAllThresholds() map[string]*AlertThreshold {
	atm.mu.RLock()
	defer atm.mu.RUnlock()

	result := make(map[string]*AlertThreshold, len(atm.thresholds))
	for k, v := range atm.thresholds {
		result[k] = v
	}
	return result
}

// OnChange sets the callback for threshold changes
func (atm *AlertThresholdManager) OnChange(fn func(name string, threshold *AlertThreshold)) {
	atm.onChange = fn
}

// SLODefinition represents a Service Level Objective
type SLODefinition struct {
	Name            string  `json:"name"`
	Description     string  `json:"description"`
	Target          float64 `json:"target"`          // e.g., 0.999 for 99.9%
	Window          string  `json:"window"`          // e.g., "30d"
	BurnRateThreshold float64 `json:"burnRateThreshold"` // e.g., 14.4 for 7-day budget burn
	Indicator       string  `json:"indicator"`       // SLI metric name
}

// SLOTracker tracks SLO compliance and error budget
type SLOTracker struct {
	definitions map[string]*SLODefinition
	mu          sync.RWMutex
	registry    *prometheus.Registry
	errorBudget *prometheus.GaugeVec
	burnRate    *prometheus.GaugeVec
}

// NewSLOTracker creates a new SLO tracker
func NewSLOTracker(registry *prometheus.Registry) *SLOTracker {
	tracker := &SLOTracker{
		definitions: make(map[string]*SLODefinition),
		registry:    registry,
	}

	tracker.errorBudget = promauto.With(registry).NewGaugeVec(
		prometheus.GaugeOpts{
			Namespace: "festivals",
			Name:      "slo_error_budget_remaining",
			Help:      "Remaining error budget as a percentage",
		},
		[]string{"slo_name"},
	)

	tracker.burnRate = promauto.With(registry).NewGaugeVec(
		prometheus.GaugeOpts{
			Namespace: "festivals",
			Name:      "slo_burn_rate",
			Help:      "Current error budget burn rate",
		},
		[]string{"slo_name"},
	)

	return tracker
}

// RegisterSLO registers a new SLO definition
func (st *SLOTracker) RegisterSLO(slo *SLODefinition) {
	st.mu.Lock()
	defer st.mu.Unlock()
	st.definitions[slo.Name] = slo
}

// UpdateErrorBudget updates the error budget for an SLO
func (st *SLOTracker) UpdateErrorBudget(name string, remaining float64) {
	st.mu.RLock()
	_, exists := st.definitions[name]
	st.mu.RUnlock()

	if exists {
		st.errorBudget.WithLabelValues(name).Set(remaining)
	}
}

// UpdateBurnRate updates the burn rate for an SLO
func (st *SLOTracker) UpdateBurnRate(name string, rate float64) {
	st.mu.RLock()
	_, exists := st.definitions[name]
	st.mu.RUnlock()

	if exists {
		st.burnRate.WithLabelValues(name).Set(rate)
	}
}

// GetSLOStatus returns the current status of an SLO
func (st *SLOTracker) GetSLOStatus(name string) map[string]interface{} {
	st.mu.RLock()
	slo, exists := st.definitions[name]
	st.mu.RUnlock()

	if !exists {
		return nil
	}

	return map[string]interface{}{
		"name":              slo.Name,
		"description":       slo.Description,
		"target":            slo.Target,
		"window":            slo.Window,
		"burnRateThreshold": slo.BurnRateThreshold,
	}
}

// GetAllSLOs returns all SLO definitions and their status
func (st *SLOTracker) GetAllSLOs() []map[string]interface{} {
	st.mu.RLock()
	defer st.mu.RUnlock()

	result := make([]map[string]interface{}, 0, len(st.definitions))
	for _, slo := range st.definitions {
		result = append(result, map[string]interface{}{
			"name":              slo.Name,
			"description":       slo.Description,
			"target":            slo.Target,
			"window":            slo.Window,
			"burnRateThreshold": slo.BurnRateThreshold,
		})
	}
	return result
}

// CreateDefaultSLOs creates default SLO definitions
func CreateDefaultSLOs(tracker *SLOTracker) {
	// API Availability SLO
	tracker.RegisterSLO(&SLODefinition{
		Name:            "api_availability",
		Description:     "API should be available 99.9% of the time",
		Target:          0.999,
		Window:          "30d",
		BurnRateThreshold: 14.4, // 7-day budget burn warning
		Indicator:       "festivals:sli:availability_1h",
	})

	// API Latency SLO
	tracker.RegisterSLO(&SLODefinition{
		Name:            "api_latency",
		Description:     "99% of requests should complete within 500ms",
		Target:          0.99,
		Window:          "30d",
		BurnRateThreshold: 14.4,
		Indicator:       "festivals:sli:latency_1h",
	})

	// Transaction Success Rate SLO
	tracker.RegisterSLO(&SLODefinition{
		Name:            "transaction_success",
		Description:     "99.5% of transactions should succeed",
		Target:          0.995,
		Window:          "30d",
		BurnRateThreshold: 14.4,
		Indicator:       "festivals:transactions:success_rate_5m",
	})

	// Ticket Scan Success Rate SLO
	tracker.RegisterSLO(&SLODefinition{
		Name:            "ticket_scan_success",
		Description:     "99% of ticket scans should succeed",
		Target:          0.99,
		Window:          "30d",
		BurnRateThreshold: 14.4,
		Indicator:       "festivals:tickets:scan_success_rate_5m",
	})
}
