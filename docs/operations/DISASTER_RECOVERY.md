# Disaster Recovery Procedures

This document outlines disaster recovery (DR) procedures for the Festivals platform.

## Overview

```mermaid
graph TB
    subgraph "Primary Region (EU-West-1)"
        P_LB[Load Balancer]
        P_API[API Cluster]
        P_DB[(Primary Database)]
        P_REDIS[(Redis)]
    end

    subgraph "DR Region (EU-Central-1)"
        DR_LB[Load Balancer]
        DR_API[API Cluster - Standby]
        DR_DB[(Replica Database)]
        DR_REDIS[(Redis Replica)]
    end

    DNS[Route 53] --> P_LB
    DNS -.->|Failover| DR_LB
    P_DB -->|Replication| DR_DB
```

## Recovery Objectives

| Metric | Target | Description |
|--------|--------|-------------|
| **RPO** (Recovery Point Objective) | 1 hour | Maximum acceptable data loss |
| **RTO** (Recovery Time Objective) | 4 hours | Maximum acceptable downtime |
| **MTTR** (Mean Time To Recovery) | 2 hours | Average recovery time |

## Disaster Scenarios

### Scenario 1: Single Service Failure

**Impact:** One component unavailable
**RTO:** 15 minutes

**Procedure:**
```bash
# Restart the failed service
kubectl rollout restart deployment/festivals-api -n festivals

# If persistent failure, check logs
kubectl logs -n festivals -l app=festivals-api --previous

# Rollback if recent deployment
kubectl rollout undo deployment/festivals-api -n festivals
```

### Scenario 2: Database Failure

**Impact:** Data access unavailable
**RTO:** 1 hour

**Procedure:**

1. **Assess the situation**
   ```bash
   # Check database status (RDS)
   aws rds describe-db-instances --db-instance-identifier festivals-production

   # Check replication lag
   aws rds describe-db-instances --query 'DBInstances[*].[DBInstanceIdentifier,StatusInfos]'
   ```

2. **Failover to replica**
   ```bash
   # For RDS Multi-AZ
   aws rds failover-db-cluster --db-cluster-identifier festivals-cluster

   # For manual failover
   aws rds promote-read-replica --db-instance-identifier festivals-replica
   ```

3. **Update connection strings**
   ```bash
   kubectl set env deployment/festivals-api \
     DATABASE_URL=postgres://user:pass@new-primary:5432/festivals -n festivals
   ```

4. **Verify recovery**
   ```bash
   kubectl exec -it deployment/festivals-api -n festivals -- \
     nc -zv $NEW_DB_HOST 5432
   ```

### Scenario 3: Region Failure

**Impact:** Entire region unavailable
**RTO:** 4 hours

**Procedure:**

1. **Activate DR region**
   ```bash
   # Scale up DR region services
   kubectl config use-context festivals-dr-eu-central-1

   kubectl scale deployment/festivals-api --replicas=5 -n festivals
   kubectl scale deployment/festivals-admin --replicas=3 -n festivals
   kubectl scale deployment/festivals-worker --replicas=5 -n festivals
   ```

2. **Promote database replica**
   ```bash
   # Promote RDS read replica to primary
   aws rds promote-read-replica \
     --db-instance-identifier festivals-replica-eu-central-1 \
     --region eu-central-1
   ```

3. **Update DNS**
   ```bash
   # Update Route 53 to point to DR region
   aws route53 change-resource-record-sets \
     --hosted-zone-id $HOSTED_ZONE_ID \
     --change-batch '{
       "Changes": [{
         "Action": "UPSERT",
         "ResourceRecordSet": {
           "Name": "api.festivals.app",
           "Type": "A",
           "AliasTarget": {
             "HostedZoneId": "'$DR_ALB_ZONE_ID'",
             "DNSName": "'$DR_ALB_DNS'",
             "EvaluateTargetHealth": true
           }
         }
       }]
     }'
   ```

4. **Update configuration**
   ```bash
   # Point to DR database and resources
   kubectl set env deployment/festivals-api \
     DATABASE_URL=$DR_DATABASE_URL \
     REDIS_URL=$DR_REDIS_URL \
     S3_BUCKET=$DR_S3_BUCKET \
     -n festivals
   ```

5. **Verify services**
   ```bash
   # Health check
   curl https://api.festivals.app/health

   # Functional test
   ./scripts/smoke-test.sh
   ```

### Scenario 4: Data Corruption

**Impact:** Data integrity compromised
**RTO:** 4 hours

**Procedure:**

1. **Stop writes immediately**
   ```bash
   # Scale to 0 to prevent further corruption
   kubectl scale deployment/festivals-api --replicas=0 -n festivals
   kubectl scale deployment/festivals-worker --replicas=0 -n festivals
   ```

2. **Identify corruption scope**
   ```sql
   -- Check data integrity
   SELECT schemaname, tablename, n_dead_tup, last_vacuum, last_analyze
   FROM pg_stat_user_tables;

   -- Check for constraint violations
   SELECT conname, conrelid::regclass
   FROM pg_constraint
   WHERE NOT convalidated;
   ```

3. **Restore from backup**
   ```bash
   # For RDS: Restore to point-in-time
   aws rds restore-db-instance-to-point-in-time \
     --source-db-instance-identifier festivals-production \
     --target-db-instance-identifier festivals-restored \
     --restore-time "2024-01-15T10:00:00Z"

   # For manual backup
   ./scripts/restore-postgres.sh s3://festivals-backups/postgres/latest.dump festivals_restored
   ```

4. **Verify restored data**
   ```bash
   # Run data validation
   ./scripts/validate-data-integrity.sh

   # Compare record counts
   psql -d festivals_restored -c "SELECT COUNT(*) FROM transactions;"
   ```

5. **Switch to restored database**
   ```bash
   # Update connection string
   kubectl set env deployment/festivals-api \
     DATABASE_URL=postgres://user:pass@festivals-restored:5432/festivals \
     -n festivals

   # Scale back up
   kubectl scale deployment/festivals-api --replicas=3 -n festivals
   ```

### Scenario 5: Security Breach

**Impact:** Potential data exposure
**RTO:** Immediate containment, 24 hours full recovery

**Procedure:**

1. **Immediate containment**
   ```bash
   # Isolate affected services
   kubectl scale deployment/festivals-api --replicas=0 -n festivals

   # Block network access
   kubectl apply -f - <<EOF
   apiVersion: networking.k8s.io/v1
   kind: NetworkPolicy
   metadata:
     name: deny-all
     namespace: festivals
   spec:
     podSelector: {}
     policyTypes:
       - Ingress
       - Egress
   EOF
   ```

2. **Rotate all credentials**
   ```bash
   # Database passwords
   aws rds modify-db-instance \
     --db-instance-identifier festivals-production \
     --master-user-password $(openssl rand -base64 32)

   # API keys
   ./scripts/rotate-all-api-keys.sh

   # JWT secrets
   kubectl create secret generic jwt-secrets \
     --from-literal=secret=$(openssl rand -base64 64) \
     -n festivals --dry-run=client -o yaml | kubectl apply -f -
   ```

3. **Restore from clean backup**
   ```bash
   # Use backup from before breach
   ./scripts/restore-postgres.sh s3://festivals-backups/postgres/pre-breach.dump
   ```

4. **Forensic analysis**
   - Preserve logs before rotation
   - Engage security team
   - Document timeline

5. **Notify stakeholders**
   - Legal/compliance team
   - Affected users (if data exposed)
   - Regulatory bodies (if required)

## DR Testing

### Monthly Tests

| Test | Procedure | Success Criteria |
|------|-----------|------------------|
| Backup restore | Restore latest backup to test DB | Data matches, app connects |
| Failover drill | Simulate AZ failure | RTO < 15 minutes |
| Runbook validation | Execute runbook steps | Procedures accurate |

### Quarterly Tests

| Test | Procedure | Success Criteria |
|------|-----------|------------------|
| Full DR activation | Activate DR region | Full functionality in DR |
| Data integrity check | Verify all backups | All backups valid |
| Recovery time validation | Measure actual RTO | RTO < target |

### Annual Tests

| Test | Procedure | Success Criteria |
|------|-----------|------------------|
| Complete region failover | Full DR region activation | RTO < 4 hours |
| Security incident simulation | Full IR procedure | Procedures effective |

## DR Checklist

### Pre-Disaster Preparation

- [ ] Backups running and verified
- [ ] DR region infrastructure provisioned
- [ ] Database replication active
- [ ] DNS failover configured
- [ ] Runbooks up to date
- [ ] Team trained on procedures
- [ ] Contact list current
- [ ] Communication templates ready

### During Disaster

- [ ] Incident declared and logged
- [ ] Team assembled
- [ ] Communication sent to stakeholders
- [ ] Recovery procedure initiated
- [ ] Progress logged
- [ ] Regular status updates sent

### Post-Disaster

- [ ] Services fully restored
- [ ] Data integrity verified
- [ ] Monitoring back to normal
- [ ] All-clear communicated
- [ ] Post-incident review scheduled
- [ ] Documentation updated
- [ ] Lessons learned captured

## Communication Templates

### Initial Notification

```
Subject: [INCIDENT] Festivals Platform - Service Disruption

We are currently experiencing a service disruption affecting [affected services].

Impact: [Description of impact]
Status: Investigating
Started: [Time]

Our team is actively working to restore service. We will provide updates every 30 minutes.

Next update: [Time]
```

### Update Template

```
Subject: [UPDATE] Festivals Platform - Service Disruption

Status: [Investigating/Identified/Monitoring/Resolved]

Current Impact: [Description]

Progress:
- [Action taken 1]
- [Action taken 2]

Next Steps:
- [Planned action 1]
- [Planned action 2]

ETA: [Estimated time to resolution]
Next update: [Time]
```

### Resolution Notification

```
Subject: [RESOLVED] Festivals Platform - Service Restored

The service disruption has been resolved.

Duration: [Start time] to [End time]
Root Cause: [Brief description]
Resolution: [What was done]

We apologize for any inconvenience. A detailed post-incident report will be shared within 48 hours.
```

## Key Contacts

| Role | Name | Phone | Email |
|------|------|-------|-------|
| On-Call Engineer | Rotating | PagerDuty | - |
| Engineering Lead | - | - | - |
| Operations Manager | - | - | - |
| Security Team | - | - | security@festivals.app |
| AWS Support | - | AWS Console | - |

## Related Documentation

- [Backup Procedures](../deployment/BACKUP.md)
- [Monitoring](./MONITORING.md)
- [Runbook](./RUNBOOK.md)
- [Alerting](./ALERTING.md)
