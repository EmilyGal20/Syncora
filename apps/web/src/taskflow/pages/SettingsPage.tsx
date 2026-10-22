// @ts-nocheck
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Database, Download, Keyboard, Laptop, Moon, Palette, RotateCcw, Sun, Trash2, Upload, User } from 'lucide-react';
import { useData } from '../store/DataContext';
import { useUI } from '../store/UIContext';
import { sanitizeData } from '../lib/storage';
import { downloadFile } from '../lib/utils';
import { toISODate } from '../lib/date';
import { PageHeader } from '../components/layout/PageHeader';
import { Segmented, Select, Toggle } from '../components/ui/Controls';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../components/ui/ConfirmDialog';
import type { ThemePreference } from '../types';

export function SettingsPage() {
  const data = useData();
  const { settings, updateSettings } = data;
  const { setShortcutsOpen } = useUI();
  const toast = useToast();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(settings.userName);
  const [nameError, setNameError] = useState<string | null>(null);
  const [goal, setGoal] = useState(String(settings.dailyGoal));

  // Keep the inputs in sync when settings change elsewhere (import, reset, another tab).
  useEffect(() => setName(settings.userName), [settings.userName]);
  useEffect(() => setGoal(String(settings.dailyGoal)), [settings.dailyGoal]);

  const saveName = () => {
    const clean = name.trim();
    if (!clean) return setNameError('Name cannot be empty.');
    if (clean.length > 40) return setNameError('Name must be 40 characters or fewer.');
    setNameError(null);
    if (clean !== settings.userName) {
      updateSettings({ userName: clean });
      toast({ title: 'Profile updated' });
    }
    setName(clean);
  };

  const saveGoal = (raw: string) => {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > 50) {
      setGoal(String(settings.dailyGoal));
      toast({ title: 'Invalid daily goal', description: 'Choose a whole number between 1 and 50.', tone: 'error' });
      return;
    }
    if (n !== settings.dailyGoal) {
      updateSettings({ dailyGoal: n });
      toast({ title: 'Daily goal updated', description: `${n} tasks per day` });
    }
  };

  const exportData = () => {
    const { version, tasks, projects, activity, notifications, notificationKeys, settings: s } = data;
    downloadFile(
      `taskflow-backup-${toISODate(new Date())}.json`,
      JSON.stringify({ version, tasks, projects, activity, notifications, notificationKeys, settings: s }, null, 2),
    );
    toast({ title: 'Export complete', description: `${tasks.length} tasks and ${projects.length} projects saved.` });
  };

  const importData = async (file: File) => {
    try {
      if (file.size > 5_000_000) throw new Error('File is too large (max 5 MB).');
      const parsed = sanitizeData(JSON.parse(await file.text()));
      if (!parsed) throw new Error('This file is not a valid TaskFlow backup.');
      const ok = await confirm({
        title: 'Replace current data?',
        message: `Importing will replace your ${data.tasks.length} tasks and ${data.projects.length} projects with ${parsed.tasks.length} tasks and ${parsed.projects.length} projects from the file.`,
        confirmLabel: 'Import and replace',
      });
      if (!ok) return;
      data.replaceData(parsed);
      setName(parsed.settings.userName);
      setGoal(String(parsed.settings.dailyGoal));
      toast({ title: 'Import complete', description: `${parsed.tasks.length} tasks loaded.` });
    } catch (err) {
      toast({ title: 'Import failed', description: err instanceof Error ? err.message : 'Could not read the file.', tone: 'error' });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <>
      <PageHeader title="Settings" description="Personalize TaskFlow and manage your data." />

      <div className="mx-auto max-w-3xl space-y-6">
        <Section icon={<User className="h-4 w-4" />} title="Profile" description="How TaskFlow greets you.">
          <Row label="Display name" htmlFor="settings-name">
            <div className="w-full sm:w-72">
              <input
                id="settings-name"
                className={`input ${nameError ? 'input-error' : ''}`}
                value={name}
                maxLength={60}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameError(null);
                }}
                onBlur={saveName}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              />
              {nameError && <p className="mt-1 text-xs font-medium text-rose-600">{nameError}</p>}
            </div>
          </Row>
        </Section>

        <Section icon={<Palette className="h-4 w-4" />} title="Appearance" description="Choose a theme. System follows your OS setting.">
          <Row label="Theme">
            <Segmented<ThemePreference>
              label="Theme"
              value={settings.theme}
              onChange={(theme) => updateSettings({ theme })}
              options={[
                { value: 'light', label: <><Sun className="h-3.5 w-3.5" /> Light</> },
                { value: 'dark', label: <><Moon className="h-3.5 w-3.5" /> Dark</> },
                { value: 'system', label: <><Laptop className="h-3.5 w-3.5" /> System</> },
              ]}
            />
          </Row>
        </Section>

        <Section icon={<Keyboard className="h-4 w-4" />} title="Preferences" description="Tune how TaskFlow measures and reminds you.">
          <Row label="Daily goal" hint="Tasks you aim to complete each day" htmlFor="settings-goal">
            <input
              id="settings-goal"
              type="number"
              min={1}
              max={50}
              className="input w-24"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onBlur={(e) => saveGoal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
          </Row>
          <Row label="Week starts on" htmlFor="settings-week">
            <Select
              id="settings-week"
              className="w-40"
              value={settings.weekStartsOn}
              onChange={(e) => updateSettings({ weekStartsOn: Number(e.target.value) as 0 | 1 })}
            >
              <option value={1}>Monday</option>
              <option value={0}>Sunday</option>
            </Select>
          </Row>
          <Row label="Deadline alerts" hint="Notify me about overdue tasks and tasks due today">
            <Toggle label="Deadline alerts" checked={settings.deadlineAlerts} onChange={(v) => updateSettings({ deadlineAlerts: v })} />
          </Row>
          <Row label="Keyboard shortcuts" hint="Press ? anywhere to see them">
            <button className="btn-secondary" onClick={() => setShortcutsOpen(true)}>
              View shortcuts
            </button>
          </Row>
        </Section>

        <Section icon={<Database className="h-4 w-4" />} title="Data" description={`Stored locally in this browser · ${data.tasks.length} tasks, ${data.projects.length} projects.`}>
          {data.storageError && (
            <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-[13px] text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
              Your browser blocked saving. Changes may be lost when you close this tab.
            </p>
          )}
          <Row label="Export data" hint="Download a JSON backup of everything">
            <button className="btn-secondary" onClick={exportData}>
              <Download className="h-4 w-4" /> Export
            </button>
          </Row>
          <Row label="Import data" hint="Restore from a TaskFlow backup file">
            <button className="btn-secondary" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> Import
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && void importData(e.target.files[0])}
            />
          </Row>
          <Row label="Reset sample data" hint="Replace everything with fresh demo content">
            <button
              className="btn-secondary"
              onClick={async () => {
                if (
                  await confirm({
                    title: 'Reset to sample data?',
                    message: 'All your current tasks, projects and activity will be replaced with sample content.',
                    confirmLabel: 'Reset data',
                  })
                ) {
                  data.resetToSampleData();
                  toast({ title: 'Sample data restored' });
                }
              }}
            >
              <RotateCcw className="h-4 w-4" /> Reset
            </button>
          </Row>
          <Row label="Delete all data" hint="Permanently remove every task and project">
            <button
              className="btn-secondary text-rose-600 hover:!border-rose-200 hover:!bg-rose-50 dark:text-rose-400 dark:hover:!bg-rose-500/10"
              onClick={async () => {
                if (
                  await confirm({
                    title: 'Delete all data?',
                    message: 'This permanently removes all tasks, projects, activity and notifications. Consider exporting a backup first.',
                    confirmLabel: 'Delete everything',
                  })
                ) {
                  data.clearAllData();
                  toast({ title: 'All data deleted', tone: 'info' });
                }
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete all
            </button>
          </Row>
        </Section>

        <p className="pb-4 text-center text-xs text-slate-400">TaskFlow v1.0 · Your data never leaves this device.</p>
      </div>
    </>
  );
}

function Section({ icon, title, description, children }: { icon: ReactNode; title: string; description: string; children: ReactNode }) {
  return (
    <section className="card overflow-hidden">
      <header className="flex items-start gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/[0.06]">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">{icon}</span>
        <div>
          <h2 className="section-title">{title}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
        </div>
      </header>
      <div className="divide-y divide-slate-100 px-5 dark:divide-white/[0.05]">{children}</div>
    </section>
  );
}

function Row({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <label htmlFor={htmlFor} className="text-sm font-medium text-slate-800 dark:text-slate-200">
          {label}
        </label>
        {hint && <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}
