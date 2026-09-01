import { useState } from 'react';
import { Card, Input, Select, Button, Pill } from '../components/ui';
import { loadProviders, saveProviders, DEFAULT_PROVIDERS, type AIProvider } from '../lib/ai';
import { loadSettings, saveSettings, type PoolrSettings } from '../lib/settings';
import { applyThemeClass } from '../lib/theme';

type Tab = 'ai' | 'databases' | 'appearance' | 'screening' | 'export';

const DB_KEYS = [
  { id: 'scopus', name: 'Scopus (Elsevier)', link: 'https://dev.elsevier.com' },
  { id: 'wos', name: 'Web of Science (Clarivate)', link: 'https://developer.clarivate.com' },
  { id: 'embase', name: 'Embase (Elsevier)', link: 'https://dev.elsevier.com' },
  { id: 'crossref', name: 'Crossref', link: 'https://www.crossref.org' },
  { id: 'openalex', name: 'OpenAlex', link: 'https://openalex.org' },
];

export default function Settings() {
  const [tab, setTab] = useState<Tab>('ai');
  const [providers, setProviders] = useState<AIProvider[]>(loadProviders());
  const [settings, setSettings] = useState<PoolrSettings>(loadSettings());
  const [dbKeys, setDbKeys] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('poolr.dbKeys') || '{}'); } catch { return {}; }
  });

  const tabs: { key: Tab; label: string }[] = [
    { key: 'ai', label: 'AI Providers' },
    { key: 'databases', label: 'Databases' },
    { key: 'appearance', label: 'Appearance' },
    { key: 'screening', label: 'Screening' },
    { key: 'export', label: 'Export' },
  ];

  const updateProvider = (id: string, patch: Partial<AIProvider>) => {
    const next = providers.map(p => p.id === id ? { ...p, ...patch } : p);
    setProviders(next);
    saveProviders(next);
  };

  const addProvider = () => {
    const template = DEFAULT_PROVIDERS[0];
    const newProvider: AIProvider = {
      ...template,
      id: `provider_${Date.now()}`,
      apiKey: '',
      requestsUsed: 0,
      lastReset: new Date().toISOString().split('T')[0],
    };
    const next = [...providers, newProvider];
    setProviders(next);
    saveProviders(next);
  };

  const removeProvider = (id: string) => {
    const next = providers.filter(p => p.id !== id);
    setProviders(next);
    saveProviders(next);
  };

  const testConnection = async (provider: AIProvider) => {
    try {
      const res = await fetch(`${provider.baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${provider.apiKey}` },
      });
      if (res.ok) alert(`✓ Connected to ${provider.name}`);
      else alert(`✗ Failed: ${res.status}`);
    } catch (e) {
      alert(`✗ Connection failed`);
    }
  };

  const updateDbKey = (id: string, value: string) => {
    const next = { ...dbKeys, [id]: value };
    setDbKeys(next);
    localStorage.setItem('poolr.dbKeys', JSON.stringify(next));
  };

  const updateAppearance = (patch: Partial<PoolrSettings['appearance']>) => {
    const next = { ...settings, appearance: { ...settings.appearance, ...patch } };
    setSettings(next);
    saveSettings(next);
    if (patch.theme) applyThemeClass(patch.theme);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 border-b border-[var(--color-border)] pb-2">
        {tabs.map(t => (
          <button
            key={t.key}
            className={`btn-ghost ${tab === t.key ? '!text-[var(--color-text)] !border-[var(--color-border-strong)]' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'ai' && (
        <div className="space-y-3">
          <Card title="AI Providers" right={
            <Button variant="outline" size="sm" onClick={addProvider}>+ Add Provider</Button>
          }>
            <p className="mb-3 text-[12px] text-[var(--color-text-muted)]">
              Configure AI providers for screening assistance. Free tier providers track daily request limits.
            </p>
            {providers.length === 0 && (
              <div className="rounded-[5px] border border-dashed border-[var(--color-border)] p-6 text-center text-[12px] text-[var(--color-text-muted)]">
                No providers configured. Click "+ Add Provider" to get started.
              </div>
            )}
            {providers.map(p => (
              <div key={p.id} className="mb-3 rounded-[5px] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={p.enabled} onChange={e => updateProvider(p.id, { enabled: e.target.checked })} />
                    <span className="text-[13px] font-medium">{p.name}</span>
                    {p.freeTier && <Pill tone="neutral">Free Tier</Pill>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => testConnection(p)}>Test</Button>
                    <Button variant="ghost" size="sm" onClick={() => removeProvider(p.id)}>Remove</Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10.5px] text-[var(--color-text-muted)]">API Key</label>
                    <Input type="password" value={p.apiKey} onChange={e => updateProvider(p.id, { apiKey: e.target.value })} placeholder="sk-..." />
                  </div>
                  <div>
                    <label className="text-[10.5px] text-[var(--color-text-muted)]">Model</label>
                    <Input value={p.model} onChange={e => updateProvider(p.id, { model: e.target.value })} placeholder="model name" />
                  </div>
                  <div>
                    <label className="text-[10.5px] text-[var(--color-text-muted)]">Daily Limit</label>
                    <Input type="number" value={p.dailyLimit} onChange={e => updateProvider(p.id, { dailyLimit: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <label className="text-[10.5px] text-[var(--color-text-muted)]">Requests Used</label>
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 rounded-full bg-[var(--color-border)]">
                        <div className="h-full rounded-full bg-[var(--color-accent)]" style={{ width: `${Math.min(100, (p.requestsUsed / p.dailyLimit) * 100)}%` }} />
                      </div>
                      <span className="text-[11px] text-[var(--color-text-muted)]">{p.requestsUsed}/{p.dailyLimit}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}

      {tab === 'databases' && (
        <Card title="External Database APIs">
          <p className="mb-3 text-[12px] text-[var(--color-text-muted)]">
            Configure API keys for external databases. Some require registration.
          </p>
          <div className="space-y-2">
            {DB_KEYS.map(db => (
              <div key={db.id} className="flex items-center gap-2">
                <span className="w-40 text-[12px]">{db.name}</span>
                <Input type="password" placeholder="API Key (optional)" className="flex-1" value={dbKeys[db.id] || ''} onChange={e => updateDbKey(db.id, e.target.value)} />
                <a href={db.link} target="_blank" rel="noopener" className="text-[11px] text-[var(--color-accent)]">Get Key</a>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === 'appearance' && (
        <Card title="Appearance">
          <div className="space-y-3">
            <div>
              <label className="text-[10.5px] text-[var(--color-text-muted)]">Theme</label>
              <Select value={settings.appearance.theme} onChange={e => updateAppearance({ theme: e.target.value as 'light' | 'dark' })}>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </Select>
            </div>
            <div>
              <label className="text-[10.5px] text-[var(--color-text-muted)]">Density</label>
              <Select value={settings.appearance.density} onChange={e => updateAppearance({ density: e.target.value as 'compact' | 'comfortable' })}>
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
              </Select>
            </div>
            <div>
              <label className="text-[10.5px] text-[var(--color-text-muted)]">Font Size</label>
              <Input type="number" value={settings.appearance.fontSize} onChange={e => updateAppearance({ fontSize: parseFloat(e.target.value) || 12.5 })} />
            </div>
          </div>
        </Card>
      )}

      {tab === 'screening' && (
        <Card title="AI Screening Defaults">
          <div className="space-y-3">
            <div>
              <label className="text-[10.5px] text-[var(--color-text-muted)]">Batch Size (records per request)</label>
              <Input type="number" value={settings.ai.batchSize} onChange={e => { const next = { ...settings, ai: { ...settings.ai, batchSize: parseInt(e.target.value) || 50 } }; setSettings(next); saveSettings(next); }} />
            </div>
            <div>
              <label className="text-[10.5px] text-[var(--color-text-muted)]">Auto-Accept Threshold</label>
              <Input type="number" step="0.05" min="0" max="1" value={settings.ai.autoAcceptThreshold} onChange={e => { const next = { ...settings, ai: { ...settings.ai, autoAcceptThreshold: parseFloat(e.target.value) || 0.85 } }; setSettings(next); saveSettings(next); }} />
            </div>
            <div>
              <label className="text-[10.5px] text-[var(--color-text-muted)]">Human Review Threshold</label>
              <Input type="number" step="0.05" min="0" max="1" value={settings.ai.humanReviewThreshold} onChange={e => { const next = { ...settings, ai: { ...settings.ai, humanReviewThreshold: parseFloat(e.target.value) || 0.5 } }; setSettings(next); saveSettings(next); }} />
            </div>
          </div>
        </Card>
      )}

      {tab === 'export' && (
        <Card title="Export Defaults">
          <div className="space-y-3">
            <div>
              <label className="text-[10.5px] text-[var(--color-text-muted)]">Default Format</label>
              <Select value={settings.export.format} onChange={e => { const next = { ...settings, export: { ...settings.export, format: e.target.value as any } }; setSettings(next); saveSettings(next); }}>
                <option value="docx">Word (.docx)</option>
                <option value="latex">LaTeX (.tex)</option>
                <option value="json">JSON</option>
                <option value="md">Markdown</option>
              </Select>
            </div>
            <div>
              <label className="text-[10.5px] text-[var(--color-text-muted)]">Citation Style</label>
              <Select value={settings.export.citationStyle} onChange={e => { const next = { ...settings, export: { ...settings.export, citationStyle: e.target.value as any } }; setSettings(next); saveSettings(next); }}>
                <option value="vancouver">Vancouver</option>
                <option value="apa">APA</option>
                <option value="harvard">Harvard</option>
                <option value="bibtex">BibTeX</option>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={settings.export.includeFigures} onChange={e => { const next = { ...settings, export: { ...settings.export, includeFigures: e.target.checked } }; setSettings(next); saveSettings(next); }} />
              <span className="text-[12px]">Include figures</span>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={settings.export.includeRawData} onChange={e => { const next = { ...settings, export: { ...settings.export, includeRawData: e.target.checked } }; setSettings(next); saveSettings(next); }} />
              <span className="text-[12px]">Include raw data</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
