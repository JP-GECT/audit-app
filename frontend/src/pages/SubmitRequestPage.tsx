import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listScenarios, type Scenario } from "../lib/api";
import { BROKEN_DEVICE, CLEAN_DEVICE } from "../lib/demoDevices";
import { useRunStore } from "../store/runStore";
import type { ProvisioningRequest } from "../types";

const MODELS = ["ISR-4321", "ISR-4331", "Catalyst-9300", "Catalyst-9200", "Nexus-93180YC", "ASR-1001"];
const ROLES = ["edge", "core", "access", "distribution"] as const;
const CHANGE_TYPES = ["new_device", "config_push", "firmware_upgrade"] as const;

interface FormState {
  device_id: string;
  model: string;
  os: string;
  firmware_version: string;
  site: string;
  role: (typeof ROLES)[number];
  cert_issuer: string;
  cert_expires_at: string;
  cert_revoked: boolean;
  nac_compliant: boolean;
  nac_dot1x: boolean;
  nac_mab: boolean;
  fingerprint: string;
  proposed_config: string;
  change_type: (typeof CHANGE_TYPES)[number];
  requested_by: string;
}

function deviceToForm(device: typeof CLEAN_DEVICE): FormState {
  return {
    device_id: device.device_id,
    model: device.model,
    os: device.os,
    firmware_version: device.firmware_version,
    site: device.site,
    role: device.role,
    cert_issuer: device.certificate.issuer,
    cert_expires_at: device.certificate.expires_at.slice(0, 16),
    cert_revoked: device.certificate.revoked,
    nac_compliant: device.nac_posture.compliant,
    nac_dot1x: device.nac_posture.checks.dot1x ?? true,
    nac_mab: device.nac_posture.checks.mab ?? true,
    fingerprint: device.fingerprint,
    proposed_config: "hostname test\n",
    change_type: "new_device",
    requested_by: "ui-demo",
  };
}

const inputClass = "neu-inset w-full rounded-lg px-2.5 py-1.5 text-sm outline-none";
const labelClass = "mb-1 block text-xs font-semibold uppercase tracking-wide";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="text-sm">
      <span className={labelClass} style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

export default function SubmitRequestPage() {
  const navigate = useNavigate();
  const startRun = useRunStore((s) => s.startRun);
  const startScenario = useRunStore((s) => s.startScenario);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [form, setForm] = useState<FormState>(() => deviceToForm(CLEAN_DEVICE));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listScenarios().then(setScenarios).catch((err) => setError(String(err)));
  }, []);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleScenario(id: string) {
    setError(null);
    try {
      const runId = await startScenario(id);
      navigate(`/runs/${runId}`);
    } catch (err) {
      setError(String(err));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const request: ProvisioningRequest = {
        request_id: `req-${Date.now()}`,
        device: {
          device_id: form.device_id,
          model: form.model,
          os: form.os,
          firmware_version: form.firmware_version,
          site: form.site,
          role: form.role,
          certificate: {
            issuer: form.cert_issuer,
            expires_at: new Date(form.cert_expires_at).toISOString(),
            revoked: form.cert_revoked,
          },
          nac_posture: {
            compliant: form.nac_compliant,
            checks: { dot1x: form.nac_dot1x, mab: form.nac_mab },
          },
          fingerprint: form.fingerprint,
        },
        proposed_config: form.proposed_config,
        change_type: form.change_type,
        requested_by: form.requested_by,
      };
      const runId = await startRun(request);
      navigate(`/runs/${runId}`);
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Submit a provisioning request</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
        Load a canned scenario for a one-click demo, or fill in the form for a custom device.
      </p>

      {error && (
        <div className="neu-inset mt-4 rounded-lg px-3 py-2 text-sm" style={{ color: "var(--status-critical)" }}>
          {error}
        </div>
      )}

      {scenarios.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
            Demo scenarios
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {scenarios.map((s) => (
              <button
                key={s.id}
                onClick={() => handleScenario(s.id)}
                className="neu-raised neu-hover-lift rounded-2xl p-4 text-left"
              >
                <div className="font-medium" style={{ color: "var(--series-1)" }}>
                  {s.name}
                </div>
                <div className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                  {s.description}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
            Custom device request
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setForm(deviceToForm(CLEAN_DEVICE))}
              className="neu-chip rounded-lg px-2.5 py-1 text-xs font-medium"
              style={{ color: "var(--status-good)" }}
            >
              Fill clean example
            </button>
            <button
              type="button"
              onClick={() => setForm(deviceToForm(BROKEN_DEVICE))}
              className="neu-chip rounded-lg px-2.5 py-1 text-xs font-medium"
              style={{ color: "var(--status-critical)" }}
            >
              Fill broken example
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="neu-raised rounded-2xl p-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Device ID">
              <input className={inputClass} style={{ borderColor: "var(--border-strong)" }} value={form.device_id} onChange={(e) => update("device_id", e.target.value)} required />
            </Field>
            <Field label="Model">
              <select className={inputClass} style={{ borderColor: "var(--border-strong)" }} value={form.model} onChange={(e) => update("model", e.target.value)}>
                {MODELS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="OS">
              <input className={inputClass} style={{ borderColor: "var(--border-strong)" }} value={form.os} onChange={(e) => update("os", e.target.value)} required />
            </Field>
            <Field label="Firmware">
              <input className={inputClass} style={{ borderColor: "var(--border-strong)" }} value={form.firmware_version} onChange={(e) => update("firmware_version", e.target.value)} required />
            </Field>
            <Field label="Site">
              <input className={inputClass} style={{ borderColor: "var(--border-strong)" }} value={form.site} onChange={(e) => update("site", e.target.value)} required />
            </Field>
            <Field label="Role">
              <select className={inputClass} style={{ borderColor: "var(--border-strong)" }} value={form.role} onChange={(e) => update("role", e.target.value as FormState["role"])}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Certificate issuer">
              <input className={inputClass} style={{ borderColor: "var(--border-strong)" }} value={form.cert_issuer} onChange={(e) => update("cert_issuer", e.target.value)} required />
            </Field>
            <Field label="Certificate expires">
              <input type="datetime-local" className={inputClass} style={{ borderColor: "var(--border-strong)" }} value={form.cert_expires_at} onChange={(e) => update("cert_expires_at", e.target.value)} required />
            </Field>
            <Field label="Fingerprint">
              <input className={inputClass} style={{ borderColor: "var(--border-strong)" }} value={form.fingerprint} onChange={(e) => update("fingerprint", e.target.value)} required />
            </Field>
          </div>

          <div className="mt-4 flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.cert_revoked} onChange={(e) => update("cert_revoked", e.target.checked)} />
              Certificate revoked
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.nac_compliant} onChange={(e) => update("nac_compliant", e.target.checked)} />
              NAC compliant
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.nac_dot1x} onChange={(e) => update("nac_dot1x", e.target.checked)} />
              dot1x
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.nac_mab} onChange={(e) => update("nac_mab", e.target.checked)} />
              mab
            </label>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Change type">
              <select className={inputClass} style={{ borderColor: "var(--border-strong)" }} value={form.change_type} onChange={(e) => update("change_type", e.target.value as FormState["change_type"])}>
                {CHANGE_TYPES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Requested by">
              <input className={inputClass} style={{ borderColor: "var(--border-strong)" }} value={form.requested_by} onChange={(e) => update("requested_by", e.target.value)} required />
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Proposed config">
              <textarea
                className={`${inputClass} font-mono`}
                               rows={4}
                value={form.proposed_config}
                onChange={(e) => update("proposed_config", e.target.value)}
              />
            </Field>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="neu-btn mt-5 rounded-xl px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed"
            style={{ background: "var(--series-1)" }}
          >
            {submitting ? "Submitting…" : "Submit for validation"}
          </button>
        </form>
      </section>
    </div>
  );
}
