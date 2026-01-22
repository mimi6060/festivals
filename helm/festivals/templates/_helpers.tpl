{{/*
Expand the name of the chart.
*/}}
{{- define "festivals.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "festivals.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "festivals.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "festivals.labels" -}}
helm.sh/chart: {{ include "festivals.chart" . }}
{{ include "festivals.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "festivals.selectorLabels" -}}
app.kubernetes.io/name: {{ include "festivals.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
API labels
*/}}
{{- define "festivals.api.labels" -}}
{{ include "festivals.labels" . }}
app.kubernetes.io/component: api
{{- end }}

{{/*
API selector labels
*/}}
{{- define "festivals.api.selectorLabels" -}}
{{ include "festivals.selectorLabels" . }}
app.kubernetes.io/component: api
{{- end }}

{{/*
Admin labels
*/}}
{{- define "festivals.admin.labels" -}}
{{ include "festivals.labels" . }}
app.kubernetes.io/component: admin
{{- end }}

{{/*
Admin selector labels
*/}}
{{- define "festivals.admin.selectorLabels" -}}
{{ include "festivals.selectorLabels" . }}
app.kubernetes.io/component: admin
{{- end }}

{{/*
Worker labels
*/}}
{{- define "festivals.worker.labels" -}}
{{ include "festivals.labels" . }}
app.kubernetes.io/component: worker
{{- end }}

{{/*
Worker selector labels
*/}}
{{- define "festivals.worker.selectorLabels" -}}
{{ include "festivals.selectorLabels" . }}
app.kubernetes.io/component: worker
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "festivals.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "festivals.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Image pull secrets
*/}}
{{- define "festivals.imagePullSecrets" -}}
{{- with .Values.global.imagePullSecrets }}
imagePullSecrets:
{{- toYaml . | nindent 2 }}
{{- end }}
{{- end }}

{{/*
Full image name for a component
*/}}
{{- define "festivals.image" -}}
{{- $registry := .root.Values.global.imageRegistry -}}
{{- $repository := .image.repository -}}
{{- $tag := .image.tag | default .root.Chart.AppVersion -}}
{{- printf "%s/%s:%s" $registry $repository $tag -}}
{{- end }}

{{/*
ConfigMap name
*/}}
{{- define "festivals.configMapName" -}}
{{- printf "%s-config" (include "festivals.fullname" .) }}
{{- end }}

{{/*
Secret name
*/}}
{{- define "festivals.secretName" -}}
{{- printf "%s-secrets" (include "festivals.fullname" .) }}
{{- end }}
