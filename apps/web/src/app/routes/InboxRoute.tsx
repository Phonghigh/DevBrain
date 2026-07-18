import type { CaptureDto } from '@devbrain/shared';
import { useEffect, useState } from 'react';
import { createCapture, listCaptures } from '../../api/client';

const SOURCES = ['chatgpt', 'claude', 'manual'] as const;

export function InboxRoute() {
  const [captures, setCaptures] = useState<CaptureDto[]>([]);
  const [listState, setListState] = useState<'loading' | 'ready' | 'error'>('loading');

  const [source, setSource] = useState<string>(SOURCES[0]);
  const [task, setTask] = useState('');
  const [rawText, setRawText] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listCaptures('raw')
      .then((result) => {
        if (!cancelled) {
          setCaptures(result);
          setListState('ready');
        }
      })
      .catch(() => {
        if (!cancelled) setListState('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
    setSaveError(null);
    setSaving(true);
    try {
      const created = await createCapture({
        source,
        task: task.trim() === '' ? undefined : task,
        rawText,
      });
      // Prepend locally (matches the api's newest-first ordering) instead of
      // re-fetching — the just-created row is already exactly what a re-fetch
      // would return, one request cheaper.
      setCaptures((prev) => [created, ...prev]);
      setTask('');
      setRawText('');
    } catch {
      // Deliberately keep source/task/rawText as typed — friction-free capture
      // (spec §6.1) means a failed save must not force retyping the paste.
      setSaveError('Could not save this capture. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h1>Inbox</h1>
      <p>Paste a raw GPT/Claude dump here to capture it.</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSave();
        }}
      >
        <label htmlFor="capture-source">Source</label>
        <select id="capture-source" value={source} onChange={(e) => setSource(e.target.value)}>
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <label htmlFor="capture-task">Task (optional)</label>
        <input
          id="capture-task"
          type="text"
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="what were you doing when you dumped this?"
        />

        <label htmlFor="capture-raw-text">Raw text</label>
        <textarea
          id="capture-raw-text"
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          rows={10}
          required
        />

        <button type="submit" disabled={saving || rawText.trim() === ''}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saveError && <p role="alert">{saveError}</p>}
      </form>

      <h2>Raw captures</h2>
      {listState === 'loading' && <p>Loading…</p>}
      {listState === 'error' && <p role="alert">Could not load captures.</p>}
      {listState === 'ready' && captures.length === 0 && <p>No raw captures yet.</p>}
      {listState === 'ready' && captures.length > 0 && (
        <ul>
          {captures.map((c) => (
            <li key={c.id}>
              <strong>{c.source}</strong>
              {c.task && <> — {c.task}</>}
              <br />
              {c.rawText}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
