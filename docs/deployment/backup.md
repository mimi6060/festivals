# Backup and Disaster Recovery Guide

This guide covers backup strategies and disaster recovery procedures for the Festivals platform.

## Overview

Data backup strategy includes:

| Data Type | Backup Method | Frequency | Retention |
|-----------|--------------|-----------|-----------|
| PostgreSQL | pg_dump / WAL archiving | Hourly/Continuous | 30 days |
| Redis | RDB snapshots | Every 15 min | 7 days |
| Object Storage | Cross-region replication | Continuous | Indefinite |
| Kubernetes Configs | Git / Velero | On change | Indefinite |

## Database Backup

### PostgreSQL Backup Strategies

#### 1. Logical Backup (pg_dump)

For smaller databases or point-in-time exports:

```bash
# Full database dump
kubectl exec -n festivals-production deployment/postgres -- \
  pg_dump -U festivals -Fc festivals > backup-$(date +%Y%m%d-%H%M%S).dump

# Compressed SQL dump
kubectl exec -n festivals-production deployment/postgres -- \
  pg_dump -U festivals festivals | gzip > backup-$(date +%Y%m%d-%H%M%S).sql.gz

# Schema only
kubectl exec -n festivals-production deployment/postgres -- \
  pg_dump -U festivals --schema-only festivals > schema-$(date +%Y%m%d).sql

# Data only
kubectl exec -n festivals-production deployment/postgres -- \
  pg_dump -U festivals --data-only festivals > data-$(date +%Y%m%d).sql

# Specific tables
kubectl exec -n festivals-production deployment/postgres -- \
  pg_dump -U festivals -t users -t festivals -t tickets festivals > tables-$(date +%Y%m%d).sql
```

#### 2. Physical Backup (pg_basebackup)

For larger databases with continuous recovery:

```bash
# Base backup
kubectl exec -n festivals-production deployment/postgres -- \
  pg_basebackup -U replicator -D /backups/base -Fp -Xs -P

# With WAL files
kubectl exec -n festivals-production deployment/postgres -- \
  pg_basebackup -U replicator -D /backups/base -Ft -z -Xs -P
```

#### 3. Automated Backup CronJob

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
  namespace: festivals-production
spec:
  schedule: "0 */6 * * *"  # Every 6 hours
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: backup
              image: postgres:16-alpine
              env:
                - name: PGPASSWORD
                  valueFrom:
                    secretKeyRef:
                      name: postgres-credentials
                      key: password
                - name: AWS_ACCESS_KEY_ID
                  valueFrom:
                    secretKeyRef:
                      name: aws-credentials
                      key: access-key
                - name: AWS_SECRET_ACCESS_KEY
                  valueFrom:
                    secretKeyRef:
                      name: aws-credentials
                      key: secret-key
              command:
                - /bin/sh
                - -c
                - |
                  set -e
                  TIMESTAMP=$(date +%Y%m%d-%H%M%S)
                  BACKUP_FILE="festivals-${TIMESTAMP}.dump"

                  echo "Starting backup at ${TIMESTAMP}"

                  # Create backup
                  pg_dump -h postgres-service -U festivals -Fc festivals > /tmp/${BACKUP_FILE}

                  # Upload to S3
                  apk add --no-cache aws-cli
                  aws s3 cp /tmp/${BACKUP_FILE} s3://festivals-backups/postgres/${BACKUP_FILE}

                  # Verify upload
                  aws s3 ls s3://festivals-backups/postgres/${BACKUP_FILE}

                  echo "Backup completed successfully"

                  # Cleanup old backups (keep last 30 days)
                  aws s3 ls s3://festivals-backups/postgres/ | \
                    awk '{print $4}' | \
                    sort | \
                    head -n -120 | \
                    xargs -I {} aws s3 rm s3://festivals-backups/postgres/{}
          restartPolicy: OnFailure
```

#### 4. Continuous Archiving (WAL-G)

For point-in-time recovery:

```yaml
# PostgreSQL ConfigMap with WAL archiving
apiVersion: v1
kind: ConfigMap
metadata:
  name: postgres-config
  namespace: festivals-production
data:
  postgresql.conf: |
    wal_level = replica
    archive_mode = on
    archive_command = 'wal-g wal-push %p'
    archive_timeout = 60
```

```bash
# Setup WAL-G
export WALG_S3_PREFIX=s3://festivals-backups/wal-g
export AWS_REGION=eu-west-1

# Create base backup
wal-g backup-push /var/lib/postgresql/data

# List backups
wal-g backup-list

# Restore to point in time
wal-g backup-fetch /var/lib/postgresql/data LATEST
wal-g wal-fetch /var/lib/postgresql/pg_wal --until "2024-01-15 10:30:00"
```

### PostgreSQL Restore

#### Restore from pg_dump

```bash
# Restore full database
kubectl exec -i -n festivals-production deployment/postgres -- \
  pg_restore -U festivals -d festivals -c < backup-20240115.dump

# Restore specific tables
kubectl exec -i -n festivals-production deployment/postgres -- \
  pg_restore -U festivals -d festivals -t users -t festivals < backup-20240115.dump

# Restore from SQL dump
kubectl exec -i -n festivals-production deployment/postgres -- \
  psql -U festivals -d festivals < backup-20240115.sql

# Restore compressed dump
gunzip -c backup-20240115.sql.gz | kubectl exec -i -n festivals-production deployment/postgres -- \
  psql -U festivals -d festivals
```

#### Restore from S3

```bash
# Download backup
aws s3 cp s3://festivals-backups/postgres/festivals-20240115-060000.dump ./backup.dump

# Create restore job
kubectl apply -f - <<EOF
apiVersion: batch/v1
kind: Job
metadata:
  name: postgres-restore
  namespace: festivals-production
spec:
  template:
    spec:
      containers:
        - name: restore
          image: postgres:16-alpine
          env:
            - name: PGPASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgres-credentials
                  key: password
          command:
            - /bin/sh
            - -c
            - |
              # Download backup from S3
              apk add --no-cache aws-cli
              aws s3 cp s3://festivals-backups/postgres/festivals-20240115-060000.dump /tmp/backup.dump

              # Restore
              pg_restore -h postgres-service -U festivals -d festivals -c /tmp/backup.dump
      restartPolicy: Never
EOF
```

#### Point-in-Time Recovery

```bash
# Stop the application
kubectl scale deployment prod-festivals-api --replicas=0 -n festivals-production

# Restore base backup
wal-g backup-fetch /var/lib/postgresql/data LATEST

# Create recovery.conf
cat > /var/lib/postgresql/data/recovery.conf <<EOF
restore_command = 'wal-g wal-fetch %f %p'
recovery_target_time = '2024-01-15 10:30:00'
recovery_target_action = 'promote'
EOF

# Start PostgreSQL
pg_ctl start

# Restart application
kubectl scale deployment prod-festivals-api --replicas=3 -n festivals-production
```

## Redis Backup

### RDB Snapshots

```bash
# Trigger manual snapshot
kubectl exec -n festivals-production deployment/redis -- redis-cli BGSAVE

# Check snapshot status
kubectl exec -n festivals-production deployment/redis -- redis-cli LASTSAVE

# Copy RDB file
kubectl cp festivals-production/redis-pod:/data/dump.rdb ./redis-backup-$(date +%Y%m%d).rdb
```

### Automated Redis Backup

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: redis-backup
  namespace: festivals-production
spec:
  schedule: "*/15 * * * *"  # Every 15 minutes
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: backup
              image: redis:7-alpine
              command:
                - /bin/sh
                - -c
                - |
                  TIMESTAMP=$(date +%Y%m%d-%H%M%S)

                  # Trigger save
                  redis-cli -h redis-service BGSAVE
                  sleep 5

                  # Copy and upload
                  cp /data/dump.rdb /tmp/redis-${TIMESTAMP}.rdb

                  # Upload to S3 (requires aws-cli)
                  aws s3 cp /tmp/redis-${TIMESTAMP}.rdb s3://festivals-backups/redis/
              volumeMounts:
                - name: redis-data
                  mountPath: /data
          volumes:
            - name: redis-data
              persistentVolumeClaim:
                claimName: redis-data
          restartPolicy: OnFailure
```

### Redis Restore

```bash
# Stop Redis
kubectl scale deployment redis --replicas=0 -n festivals-production

# Download backup
aws s3 cp s3://festivals-backups/redis/redis-20240115-100000.rdb ./dump.rdb

# Copy to PVC
kubectl cp ./dump.rdb festivals-production/redis-restore-pod:/data/dump.rdb

# Start Redis
kubectl scale deployment redis --replicas=1 -n festivals-production
```

## Object Storage Backup

### S3 Cross-Region Replication

```json
{
  "Rules": [
    {
      "ID": "festivals-replication",
      "Status": "Enabled",
      "Priority": 1,
      "Filter": {
        "Prefix": ""
      },
      "Destination": {
        "Bucket": "arn:aws:s3:::festivals-backup-eu-west-2",
        "StorageClass": "STANDARD_IA"
      },
      "DeleteMarkerReplication": {
        "Status": "Enabled"
      }
    }
  ]
}
```

### MinIO Backup (Self-hosted)

```bash
# Mirror to S3
mc mirror --watch minio/festivals s3/festivals-backup

# Sync specific bucket
mc cp --recursive minio/festivals s3/festivals-backup/

# Scheduled sync
0 * * * * mc mirror minio/festivals s3/festivals-backup >> /var/log/minio-backup.log 2>&1
```

## Kubernetes Configuration Backup

### Velero Installation

```bash
# Install Velero
velero install \
  --provider aws \
  --plugins velero/velero-plugin-for-aws:v1.8.0 \
  --bucket festivals-velero-backups \
  --backup-location-config region=eu-west-1 \
  --snapshot-location-config region=eu-west-1 \
  --secret-file ./credentials-velero

# Create backup
velero backup create festivals-backup-$(date +%Y%m%d) \
  --include-namespaces festivals-production \
  --wait

# Schedule daily backups
velero schedule create daily-backup \
  --schedule="0 2 * * *" \
  --include-namespaces festivals-production \
  --ttl 720h  # 30 days retention
```

### Velero Restore

```bash
# List available backups
velero backup get

# Restore specific backup
velero restore create --from-backup festivals-backup-20240115 \
  --include-namespaces festivals-production

# Restore to different namespace
velero restore create --from-backup festivals-backup-20240115 \
  --namespace-mappings festivals-production:festivals-restore
```

### Git-based Config Backup

All Kubernetes manifests should be in Git. Ensure:

```bash
# Export current state
kubectl get all,configmap,secret,ingress,pvc -n festivals-production -o yaml > cluster-state.yaml

# Compare with Git
diff cluster-state.yaml k8s/overlays/production/

# Restore from Git
kubectl apply -k k8s/overlays/production/
```

## Disaster Recovery Procedures

### RTO and RPO Targets

| Scenario | RPO (Data Loss) | RTO (Downtime) |
|----------|-----------------|----------------|
| Single pod failure | 0 | < 1 minute |
| Node failure | 0 | < 5 minutes |
| Database corruption | < 1 hour | < 30 minutes |
| Region outage | < 6 hours | < 2 hours |
| Complete data loss | < 24 hours | < 4 hours |

### Scenario 1: Database Corruption

```bash
# 1. Stop application to prevent further writes
kubectl scale deployment prod-festivals-api --replicas=0 -n festivals-production
kubectl scale deployment prod-festivals-worker --replicas=0 -n festivals-production

# 2. Identify last good backup
aws s3 ls s3://festivals-backups/postgres/ --recursive | sort | tail -10

# 3. Restore from backup
kubectl exec -i -n festivals-production deployment/postgres -- \
  pg_restore -U festivals -d festivals -c < backup.dump

# 4. Verify data integrity
kubectl exec -n festivals-production deployment/postgres -- \
  psql -U festivals -c "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM festivals;"

# 5. Restart application
kubectl scale deployment prod-festivals-api --replicas=3 -n festivals-production
kubectl scale deployment prod-festivals-worker --replicas=3 -n festivals-production

# 6. Monitor for issues
kubectl logs -f deployment/prod-festivals-api -n festivals-production
```

### Scenario 2: Region Outage

```bash
# 1. Verify outage
kubectl cluster-info
curl -sf https://api.festivals.app/health || echo "Primary region down"

# 2. Activate DR region
export KUBECONFIG=~/.kube/config-dr-region
kubectl config use-context dr-cluster

# 3. Restore latest backup to DR database
./scripts/restore-to-dr.sh

# 4. Update DNS to point to DR region
aws route53 change-resource-record-sets \
  --hosted-zone-id Z123456789 \
  --change-batch file://dns-failover.json

# 5. Scale up DR deployment
kubectl scale deployment prod-festivals-api --replicas=5 -n festivals-production

# 6. Monitor and notify
./scripts/send-incident-notification.sh "DR Activated"
```

### Scenario 3: Complete Cluster Recovery

```bash
# 1. Create new cluster
eksctl create cluster -f cluster-config.yaml

# 2. Install prerequisites
helm install ingress-nginx ingress-nginx/ingress-nginx -n ingress-nginx --create-namespace
helm install cert-manager jetstack/cert-manager -n cert-manager --create-namespace

# 3. Restore Velero backups
velero install --provider aws --bucket festivals-velero-backups
velero restore create --from-backup festivals-backup-latest

# 4. Restore database
kubectl apply -f k8s/jobs/postgres-restore.yaml
kubectl wait --for=condition=complete job/postgres-restore -n festivals-production

# 5. Restore Redis
kubectl apply -f k8s/jobs/redis-restore.yaml

# 6. Update DNS
aws route53 change-resource-record-sets --hosted-zone-id Z123456789 --change-batch file://dns-update.json

# 7. Verify
curl -sf https://api.festivals.app/health/ready
```

## Backup Verification

### Automated Backup Testing

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: backup-verification
  namespace: festivals-production
spec:
  schedule: "0 4 * * 0"  # Weekly on Sunday
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: verify
              image: postgres:16-alpine
              command:
                - /bin/sh
                - -c
                - |
                  set -e

                  # Download latest backup
                  LATEST=$(aws s3 ls s3://festivals-backups/postgres/ | sort | tail -1 | awk '{print $4}')
                  aws s3 cp s3://festivals-backups/postgres/${LATEST} /tmp/backup.dump

                  # Create test database
                  createdb -h postgres-service -U festivals festivals_test

                  # Restore backup
                  pg_restore -h postgres-service -U festivals -d festivals_test /tmp/backup.dump

                  # Verify data
                  USERS=$(psql -h postgres-service -U festivals -d festivals_test -t -c "SELECT COUNT(*) FROM users")
                  FESTIVALS=$(psql -h postgres-service -U festivals -d festivals_test -t -c "SELECT COUNT(*) FROM festivals")

                  echo "Users: ${USERS}, Festivals: ${FESTIVALS}"

                  # Cleanup
                  dropdb -h postgres-service -U festivals festivals_test

                  # Notify success
                  curl -X POST $SLACK_WEBHOOK -d '{"text":"Backup verification passed"}'
          restartPolicy: OnFailure
```

### Manual Verification Checklist

- [ ] Download latest backup
- [ ] Restore to test environment
- [ ] Verify row counts match production
- [ ] Test sample queries
- [ ] Verify foreign key relationships
- [ ] Test application connectivity
- [ ] Document verification results

## Backup Monitoring

### Prometheus Alerts

```yaml
groups:
  - name: backup-alerts
    rules:
      - alert: BackupJobFailed
        expr: kube_job_status_failed{namespace="festivals-production",job_name=~".*backup.*"} > 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Backup job failed"

      - alert: BackupTooOld
        expr: time() - backup_last_success_timestamp > 86400
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "No successful backup in last 24 hours"

      - alert: BackupSizeDrop
        expr: backup_size_bytes < backup_size_bytes offset 1d * 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Backup size dropped significantly"
```

### Backup Metrics

```bash
# Check backup sizes
aws s3 ls s3://festivals-backups/postgres/ --summarize --human-readable

# Check backup age
aws s3 ls s3://festivals-backups/postgres/ | sort | tail -1

# List recent backups
velero backup get --output json | jq '.items | sort_by(.metadata.creationTimestamp) | .[-5:]'
```

## Security Considerations

1. **Encrypt backups at rest** - Use S3 server-side encryption
2. **Encrypt in transit** - Use HTTPS for all transfers
3. **Restrict access** - Use IAM roles with minimum permissions
4. **Audit access** - Enable S3 access logging
5. **Test restores regularly** - Verify backups work
6. **Geographically distribute** - Store backups in multiple regions
7. **Retain appropriately** - Follow data retention policies

```bash
# S3 bucket policy for backup encryption
aws s3api put-bucket-encryption \
  --bucket festivals-backups \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "aws:kms",
        "KMSMasterKeyID": "arn:aws:kms:eu-west-1:123456789:key/xxx"
      }
    }]
  }'
```
