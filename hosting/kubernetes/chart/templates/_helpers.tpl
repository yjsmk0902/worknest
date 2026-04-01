{{/*
Expand the name of the chart.
*/}}
{{- define "worknest.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "worknest.fullname" -}}
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
{{- define "worknest.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "worknest.labels" -}}
helm.sh/chart: {{ include "worknest.chart" . }}
{{ include "worknest.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "worknest.selectorLabels" -}}
app.kubernetes.io/name: {{ include "worknest.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "worknest.serviceAccountName" -}}
{{- if .Values.worknest.serviceAccount.create }}
{{- default (include "worknest.fullname" .) .Values.worknest.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.worknest.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Return the PostgreSQL hostname
*/}}
{{- define "worknest.postgresql.hostname" -}}
{{- printf "%s-postgresql" .Release.Name -}}
{{- end }}

{{/*
Return the Redis hostname
*/}}
{{- define "worknest.redis.hostname" -}}
{{- printf "%s-redis-primary" .Release.Name -}}
{{- end }}

{{/*
Return the MinIO hostname
*/}}
{{- define "worknest.minio.hostname" -}}
{{- printf "%s-minio" .Release.Name -}}
{{- end }}

{{/*
Return the default PVC name used for file storage
*/}}
{{- define "worknest.storagePvcName" -}}
{{- printf "%s-storage" (include "worknest.fullname" .) -}}
{{- end }}

{{/*
Return the config.json ConfigMap name
*/}}
{{- define "worknest.configJsonConfigMapName" -}}
{{- if .Values.worknest.configFile.existingConfigMap -}}
{{ .Values.worknest.configFile.existingConfigMap }}
{{- else if .Values.worknest.configFile.name }}
{{ .Values.worknest.configFile.name }}
{{- else }}
{{ printf "%s-config-json" (include "worknest.fullname" .) }}
{{- end }}
{{- end }}

{{/*
Helper to get value from secret key reference or direct value
Usage: {{ include "worknest.getValueOrSecret" (dict "key" "theKey" "value" .Values.path.to.value) }}
*/}}
{{- define "worknest.getValueOrSecret" -}}
{{- $value := .value -}}
{{- if and $value.existingSecret $value.secretKey -}}
valueFrom:
  secretKeyRef:
    name: {{ $value.existingSecret }}
    key: {{ $value.secretKey }}
{{- else if hasKey $value "value" -}}
value: {{ $value.value | quote }}
{{- end -}}
{{- end }}

{{/*
Helper to get required value from secret key reference or direct value
Usage: {{ include "worknest.getRequiredValueOrSecret" (dict "key" "theKey" "value" .Values.path.to.value) }}
*/}}
{{- define "worknest.getRequiredValueOrSecret" -}}
{{- $value := .value -}}
{{- if and $value.existingSecret $value.secretKey -}}
valueFrom:
  secretKeyRef:
    name: {{ $value.existingSecret }}
    key: {{ $value.secretKey }}
{{- else if hasKey $value "value" -}}
value: {{ $value.value | quote }}
{{- else -}}
{{ fail (printf "A value or a secret reference for key '%s' is required." .key) }}
{{- end -}}
{{- end }}

{{/*
Worknest Server Environment Variables
*/}}
{{- define "worknest.serverEnvVars" -}}
- name: NODE_ENV
  value: {{ default "production" .Values.worknest.nodeEnv | quote }}
- name: PORT
  value: {{ .Values.worknest.service.port | quote }}

- name: POSTGRES_PASSWORD
  valueFrom:
    secretKeyRef:
      name: {{ .Release.Name }}-postgresql
      key: postgres-password
- name: POSTGRES_URL
  value: "postgres://{{ .Values.postgresql.auth.username }}:$(POSTGRES_PASSWORD)@{{ include "worknest.postgresql.hostname" . }}:5432/{{ .Values.postgresql.auth.database }}"

- name: REDIS_PASSWORD
  {{- if .Values.redis.auth.existingSecret }}
  {{- include "worknest.getRequiredValueOrSecret" (dict
        "key" "redis.auth.password"
        "value" (dict
          "value"        .Values.redis.auth.password
          "existingSecret" .Values.redis.auth.existingSecret
          "secretKey"    .Values.redis.auth.secretKeys.redisPasswordKey )) | nindent 2 }}
  {{- else }}
  valueFrom:
    secretKeyRef:
      name: {{ .Release.Name }}-redis
      key: {{ .Values.redis.auth.secretKeys.redisPasswordKey }}
  {{- end }}
- name: REDIS_URL
  value: "redis://:$(REDIS_PASSWORD)@{{ include "worknest.redis.hostname" . }}:6379/0"

{{- $configFile := .Values.worknest.configFile }}
{{- $mountConfigFile := or $configFile.enabled $configFile.existingConfigMap }}
{{- if $mountConfigFile }}
- name: CONFIG
  value: "/config.json"
{{- end }}

{{- range $index, $env := .Values.worknest.additionalEnv }}
- name: {{ required (printf "worknest.additionalEnv[%d].name is required" $index) $env.name }}
  {{- if hasKey $env "valueFrom" }}
  valueFrom:
{{ toYaml $env.valueFrom | nindent 4 }}
  {{- else if hasKey $env "value" }}
  value: {{ $env.value | quote }}
  {{- else }}
  {{- fail (printf "Provide either value or valueFrom for worknest.additionalEnv[%d]" $index) }}
  {{- end }}
{{- end }}
{{- end }}

{{/*
Render extra volume mounts for file:// pointers
*/}}
{{- define "worknest.renderExtraVolumeMounts" -}}
{{- range $mount := . }}
- name: {{ required "worknest.extraVolumeMounts[].name is required" $mount.name }}
  mountPath: {{ required (printf "Specify mountPath for extraVolumeMount %s" $mount.name) $mount.mountPath }}
{{- with $mount.subPath }}
  subPath: {{ . }}
{{- end }}
{{- with $mount.readOnly }}
  readOnly: {{ . }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Render extra volumes (Secrets/ConfigMaps) for file:// pointers
*/}}
{{- define "worknest.renderExtraVolumes" -}}
{{- range $volume := . }}
-
{{ toYaml $volume | nindent 2 }}
{{- end }}
{{- end }}
