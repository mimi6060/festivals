# Operational Runbook

This runbook provides step-by-step procedures for handling common operational issues with the Festivals platform.

## Quick Reference

| Issue | Severity | Runbook Section |
|-------|----------|-----------------|
| API not responding | Critical | [API Down](#api-down) |
| High error rate | Critical | [High Error Rate](#high-error-rate) |
| Database connection issues | Critical | [Database Issues](#database-issues) |
| Payment failures | Critical | [Payment Failures](#payment-failures) |
| High latency | Warning | [High Latency](#high-latency) |
| Memory/CPU high | Warning | [Resource Exhaustion](#resource-exhaustion) |
| Queue backlog | Warning | [Queue Backlog](#queue-backlog) |
| SSL certificate expiry | Warning | [SSL Certificate](#ssl-certificate-renewal) |

## API Down

### Symptoms
- Health check failures
- 5xx errors or connection refused
- Alert: `APIServiceDown`

### Diagnosis

```bash
# Check pod status
kubectl get pods -n festivals -l app=festivals-api

# Check recent events
kubectl get events -n festivals --sort-by='.lastTimestamp'

# Check logs
kubectl logs -n festivals -l app=festivals-api --tail=100

# Check ingress
kubectl get ingress -n festivals
kubectl describe ingress festivals-ingress -n festivals
```

### Resolution Steps

1. **Check if pods are running**
   ```bash
   kubectl get pods -n festivals -l app=festivals-api
   ```
   - If `CrashLoopBackOff`: Check logs for startup errors
   - If `Pending`: Check resource availability
   - If `Running` but unhealthy: Check readiness probe

2. **Check for recent deployments**
   ```bash
   kubectl rollout history deployment/festivals-api -n festivals
   ```
   - If recent deployment: Consider rollback
     ```bash
     kubectl rollout undo deployment/festivals-api -n festivals
     ```

3. **Check dependencies**
   ```bash
   # Database connectivity
   kubectl exec -it deployment/festivals-api -n festivals -- nc -zv postgres 5432

   # Redis connectivity
   kubectl exec -it deployment/festivals-api -n festivals -- nc -zv redis 6379
   ```

4. **Restart pods**
   ```bash
   kubectl rollout restart deployment/festivals-api -n festivals
   ```

5. **Scale up if needed**
   ```bash
   kubectl scale deployment/festivals-api --replicas=5 -n festivals
   ```

### Post-Incident
- Document timeline
- Identify root cause
- Update monitoring if needed

---

## High Error Rate

### Symptoms
- Error rate > 1%
- Increase in 5xx responses
- Alert: `HighErrorRate`

### Diagnosis

```bash
# Check error distribution
kubectl logs -n festivals -l app=festivals-api --tail=500 | grep -i error | head -50

# Check specific error types in Grafana/Loki
# Query: {app="festivals-api"} | json | status >= 500

# Check external dependencies
curl -s https://status.stripe.com/api/v2/status.json | jq .status
```

### Resolution Steps

1. **Identify error pattern**
   - Check logs for common error messages
   - Check which endpoints are failing
   - Check if errors correlate with specific users/festivals

2. **Check recent changes**
   - Recent deployments?
   - Config changes?
   - Traffic pattern changes?

3. **Check dependencies**
   - Database: Query performance, connections
   - Redis: Memory, connections
   - External APIs: Stripe, Auth0

4. **Mitigate**
   ```bash
   # If specific endpoint, consider feature flag
   # If database issue, check slow queries
   # If external service, enable fallback/cache

   # Rollback if deployment-related
   kubectl rollout undo deployment/festivals-api -n festivals
   ```

5. **Scale if traffic-related**
   ```bash
   kubectl scale deployment/festivals-api --replicas=5 -n festivals
   ```

---

## Database Issues

### Symptoms
- Connection timeouts
- Slow queries
- Alert: `DatabaseConnectionPoolExhausted` or `DatabaseDown`

### Diagnosis

```bash
# Check PostgreSQL status (if running in K8s)
kubectl exec -it postgres-0 -n festivals -- pg_isready

# Check connection count
kubectl exec -it postgres-0 -n festivals -- psql -U festivals -c \
  "SELECT count(*) FROM pg_stat_activity;"

# Check active queries
kubectl exec -it postgres-0 -n festivals -- psql -U festivals -c \
  "SELECT pid, now() - pg_stat_activity.query_start AS duration, query
   FROM pg_stat_activity
   WHERE state != 'idle'
   ORDER BY duration DESC
   LIMIT 10;"

# For RDS
aws rds describe-db-instances --db-instance-identifier festivals-production
```

### Resolution Steps

1. **If connection pool exhausted**
   ```sql
   -- Kill idle connections
   SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE state = 'idle'
   AND query_start < NOW() - INTERVAL '10 minutes';
   ```

2. **If slow queries**
   ```sql
   -- Find slow queries
   SELECT query, calls, mean_time, total_time
   FROM pg_stat_statements
   ORDER BY mean_time DESC
   LIMIT 10;

   -- Add missing indexes
   EXPLAIN ANALYZE <slow_query>;
   ```

3. **If database down (RDS)**
   ```bash
   # Check RDS status
   aws rds describe-db-instances --db-instance-identifier festivals-production

   # Reboot if needed
   aws rds reboot-db-instance --db-instance-identifier festivals-production
   ```

4. **Failover to replica**
   ```bash
   aws rds failover-db-cluster --db-cluster-identifier festivals-cluster
   ```

---

## Payment Failures

### Symptoms
- High payment failure rate
- Stripe webhook errors
- Alert: `HighPaymentFailureRate`

### Diagnosis

```bash
# Check Stripe status
curl -s https://status.stripe.com/api/v2/status.json | jq .

# Check recent payment logs
kubectl logs -n festivals -l app=festivals-api --tail=500 | grep -i payment

# Check Stripe dashboard for failed webhooks
# https://dashboard.stripe.com/webhooks
```

### Resolution Steps

1. **If Stripe outage**
   - Enable offline payment mode (if applicable)
   - Communicate to users
   - Monitor Stripe status page

2. **If webhook failures**
   ```bash
   # Check webhook endpoint health
   curl -X POST https://api.festivals.app/webhooks/stripe \
     -H "Content-Type: application/json" \
     -d '{"type": "test"}'

   # Retry failed webhooks from Stripe dashboard
   ```

3. **If card decline spike**
   - Check if specific BIN ranges affected
   - Contact Stripe support if systematic
   - Review fraud rules

4. **Manual intervention**
   ```bash
   # Retry failed transaction (if idempotent)
   curl -X POST https://api.festivals.app/admin/transactions/retry \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -d '{"transaction_id": "tx-123"}'
   ```

---

## High Latency

### Symptoms
- p99 latency > 500ms
- Slow page loads
- Alert: `HighLatencyP99`

### Diagnosis

```bash
# Check response times by endpoint
# Grafana query: histogram_quantile(0.99, sum(rate(festivals_http_request_duration_seconds_bucket[5m])) by (le, path))

# Check database query times
kubectl logs -n festivals -l app=festivals-api | grep -E "duration.*[0-9]{3,}ms"

# Check Redis latency
kubectl exec -it redis-0 -n festivals -- redis-cli --latency
```

### Resolution Steps

1. **Identify slow endpoints**
   - Check Grafana for latency by path
   - Focus on endpoints with high traffic

2. **Check database**
   ```sql
   -- Find slow queries
   SELECT query, mean_time, calls
   FROM pg_stat_statements
   ORDER BY mean_time DESC
   LIMIT 10;
   ```

3. **Check caching**
   ```bash
   # Cache hit rate
   # Query: festivals:cache_hits / (festivals:cache_hits + festivals:cache_misses)

   # Clear cache if stale
   kubectl exec -it redis-0 -n festivals -- redis-cli FLUSHDB
   ```

4. **Scale resources**
   ```bash
   kubectl scale deployment/festivals-api --replicas=5 -n festivals
   ```

---

## Resource Exhaustion

### Symptoms
- High CPU/Memory usage
- OOMKilled pods
- Alert: `HighCPUUsage` or `HighMemoryUsage`

### Diagnosis

```bash
# Check resource usage
kubectl top pods -n festivals

# Check for OOMKilled
kubectl get pods -n festivals -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.containerStatuses[0].lastState.terminated.reason}{"\n"}{end}'

# Check HPA status
kubectl get hpa -n festivals
```

### Resolution Steps

1. **Scale horizontally**
   ```bash
   kubectl scale deployment/festivals-api --replicas=5 -n festivals
   ```

2. **Increase resource limits**
   ```bash
   kubectl patch deployment festivals-api -n festivals --patch '
   spec:
     template:
       spec:
         containers:
         - name: api
           resources:
             limits:
               memory: 1Gi
               cpu: 1000m'
   ```

3. **Check for memory leaks**
   - Enable profiling temporarily
   - Analyze heap dumps
   - Check for goroutine leaks

---

## Queue Backlog

### Symptoms
- Jobs not processing
- Delayed notifications/emails
- Alert: `QueueBacklog`

### Diagnosis

```bash
# Check queue lengths
kubectl exec -it redis-0 -n festivals -- redis-cli LLEN festivals:queue:critical
kubectl exec -it redis-0 -n festivals -- redis-cli LLEN festivals:queue:default

# Check worker logs
kubectl logs -n festivals -l app=festivals-worker --tail=100

# Check worker pods
kubectl get pods -n festivals -l app=festivals-worker
```

### Resolution Steps

1. **Scale workers**
   ```bash
   kubectl scale deployment/festivals-worker --replicas=10 -n festivals
   ```

2. **Check for stuck jobs**
   ```bash
   # List failed jobs
   kubectl exec -it redis-0 -n festivals -- redis-cli LRANGE festivals:queue:failed 0 10
   ```

3. **Prioritize critical queue**
   ```bash
   # Increase critical queue weight
   kubectl set env deployment/festivals-worker QUEUE_CRITICAL_WEIGHT=10 -n festivals
   ```

4. **Clear stale jobs** (if safe)
   ```bash
   kubectl exec -it redis-0 -n festivals -- redis-cli DEL festivals:queue:low
   ```

---

## SSL Certificate Renewal

### Symptoms
- Certificate expiring warning
- Alert: `SSLCertificateExpiringSoon`

### Resolution Steps

1. **If using cert-manager**
   ```bash
   # Check certificate status
   kubectl get certificates -n festivals

   # Force renewal
   kubectl delete certificate festivals-tls -n festivals
   # cert-manager will recreate it
   ```

2. **If manual certificate**
   ```bash
   # Generate new certificate
   certbot certonly --dns-cloudflare -d api.festivals.app -d admin.festivals.app

   # Update secret
   kubectl create secret tls festivals-tls \
     --cert=/etc/letsencrypt/live/festivals.app/fullchain.pem \
     --key=/etc/letsencrypt/live/festivals.app/privkey.pem \
     -n festivals --dry-run=client -o yaml | kubectl apply -f -

   # Restart ingress
   kubectl rollout restart deployment/ingress-nginx-controller -n ingress-nginx
   ```

---

## Emergency Contacts

| Role | Contact | When to Escalate |
|------|---------|------------------|
| On-Call Engineer | PagerDuty | All critical alerts |
| Engineering Manager | Phone/Slack | 30 min no response |
| CTO | Phone | 1 hour, data breach, extended outage |
| Stripe Support | support@stripe.com | Payment system issues |
| AWS Support | AWS Console | Infrastructure issues |

## Related Documentation

- [Monitoring](./MONITORING.md)
- [Logging](./LOGGING.md)
- [Alerting](./ALERTING.md)
- [Disaster Recovery](./DISASTER_RECOVERY.md)
