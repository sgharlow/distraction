'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Event, Article, ScoreChange, MechanismOfHarm, Scope, AffectedPopulation, PrimaryList } from '@/lib/types';

const MECHANISMS: MechanismOfHarm[] = [
  'policy_change', 'enforcement_action', 'personnel_capture', 'resource_reallocation',
  'election_admin_change', 'judicial_legal_action', 'norm_erosion_only', 'information_operation',
];
const SCOPES: Scope[] = ['federal', 'multi_state', 'single_state', 'local', 'international'];
const POPULATIONS: AffectedPopulation[] = ['narrow', 'moderate', 'broad'];
const LISTS: PrimaryList[] = ['A', 'B', 'C'];

export default function AdminEventEditorPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const router = useRouter();

  const [event, setEvent] = useState<Event | null>(null);
  const [scoreChanges, setScoreChanges] = useState<ScoreChange[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rescoring, setRescoring] = useState(false);
  const [message, setMessage] = useState('');

  // Editable fields
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [actionItem, setActionItem] = useState('');
  const [scoreRationale, setScoreRationale] = useState('');
  const [actorsStr, setActorsStr] = useState('');
  const [institution, setInstitution] = useState('');
  const [topicTagsStr, setTopicTagsStr] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [mechanism, setMechanism] = useState<string>('');
  const [scope, setScope] = useState<string>('');
  const [affectedPop, setAffectedPop] = useState<string>('');
  const [aScore, setAScore] = useState('');
  const [bScore, setBScore] = useState('');
  const [primaryList, setPrimaryList] = useState('');
  const [isMixed, setIsMixed] = useState(false);
  const [noiseFlag, setNoiseFlag] = useState(false);
  const [scoreFrozen, setScoreFrozen] = useState(false);
  const [humanReviewed, setHumanReviewed] = useState(false);
  const [correctionNotice, setCorrectionNotice] = useState('');
  const [overrideReason, setOverrideReason] = useState('');

  const fetchEvent = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/events/${eventId}`);
    const data = await res.json();
    const e = data.event as Event;
    setEvent(e);
    setScoreChanges(data.score_changes || []);
    setArticles(data.articles || []);

    // Populate form fields
    setTitle(e.title || '');
    setSummary(e.summary || '');
    setActionItem(e.action_item || '');
    setScoreRationale(e.score_rationale || '');
    setActorsStr((e.actors || []).join(', '));
    setInstitution(e.institution || '');
    setTopicTagsStr((e.topic_tags || []).join(', '));
    setEventDate(e.event_date?.split('T')[0] || '');
    setMechanism(e.mechanism_of_harm || '');
    setScope(e.scope || '');
    setAffectedPop(e.affected_population || '');
    setAScore(e.a_score != null ? String(Math.round(e.a_score)) : '');
    setBScore(e.b_score != null ? String(Math.round(e.b_score)) : '');
    setPrimaryList(e.primary_list || '');
    setIsMixed(e.is_mixed);
    setNoiseFlag(e.noise_flag);
    setScoreFrozen(e.score_frozen);
    setHumanReviewed(e.human_reviewed);
    setCorrectionNotice(e.correction_notice || '');

    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  const saveChanges = async () => {
    setSaving(true);
    setMessage('');

    const body: Record<string, unknown> = {
      title,
      summary,
      action_item: actionItem || null,
      score_rationale: scoreRationale || null,
      actors: actorsStr ? actorsStr.split(',').map((s) => s.trim()).filter(Boolean) : [],
      institution: institution || null,
      topic_tags: topicTagsStr ? topicTagsStr.split(',').map((s) => s.trim()).filter(Boolean) : [],
      event_date: eventDate || null,
      mechanism_of_harm: mechanism || null,
      scope: scope || null,
      affected_population: affectedPop || null,
      is_mixed: isMixed,
      noise_flag: noiseFlag,
      score_frozen: scoreFrozen,
      human_reviewed: humanReviewed,
    };

    // Score override
    const newA = aScore !== '' ? Number(aScore) : null;
    const newB = bScore !== '' ? Number(bScore) : null;
    if (event && (newA !== event.a_score || newB !== event.b_score)) {
      if (newA !== null) body.a_score = newA;
      if (newB !== null) body.b_score = newB;
      body.override_reason = overrideReason || 'Admin override';
    }

    // List override
    if (primaryList && primaryList !== event?.primary_list) {
      body.primary_list = primaryList;
    }

    // Correction
    if (correctionNotice && correctionNotice !== event?.correction_notice) {
      body.correction_notice = correctionNotice;
    }

    const res = await fetch(`/api/admin/events/${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setMessage('Saved successfully');
      fetchEvent();
    } else {
      const err = await res.json();
      setMessage(`Error: ${err.error}`);
    }
    setSaving(false);
  };

  const rescoreEvent = async () => {
    setRescoring(true);
    setMessage('');

    const res = await fetch(`/api/admin/events/${eventId}`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      setMessage(`Re-scored: A=${Math.round(data.a_score)}, B=${Math.round(data.b_score)}, List=${data.primary_list}`);
      fetchEvent();
    } else {
      const err = await res.json();
      setMessage(`Re-score error: ${err.error}`);
    }
    setRescoring(false);
  };

  if (loading) {
    return <div className="text-text-dim py-8">Loading event...</div>;
  }

  if (!event) {
    return <div className="text-damage py-8">Event not found</div>;
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="text-text-dim hover:text-text-secondary text-sm cursor-pointer bg-transparent border-none">
          ← Back
        </button>
        <h2 className="text-lg font-bold">Edit Event</h2>
        {event.score_frozen && (
          <span className="text-xs bg-mixed/20 text-mixed px-2 py-0.5 rounded">FROZEN</span>
        )}
        {event.human_reviewed && (
          <span className="text-xs bg-action/20 text-action px-2 py-0.5 rounded">REVIEWED</span>
        )}
      </div>

      {message && (
        <div className={`text-sm rounded px-3 py-2 mb-4 ${message.startsWith('Error') || message.startsWith('Re-score error') ? 'bg-damage/10 text-damage border border-damage/30' : 'bg-action/10 text-action border border-action/30'}`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Left column: Text fields */}
        <div className="col-span-2 space-y-4">
          <Field label="Title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" />
          </Field>

          <Field label="Summary">
            <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} className="input-field" />
          </Field>

          <Field label="Score Rationale">
            <textarea value={scoreRationale} onChange={(e) => setScoreRationale(e.target.value)} rows={3} className="input-field" />
          </Field>

          <Field label="Action Item">
            <textarea value={actionItem} onChange={(e) => setActionItem(e.target.value)} rows={2} className="input-field" />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Actors (comma-separated)">
              <input value={actorsStr} onChange={(e) => setActorsStr(e.target.value)} className="input-field" />
            </Field>
            <Field label="Institution">
              <input value={institution} onChange={(e) => setInstitution(e.target.value)} className="input-field" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Topic Tags (comma-separated)">
              <input value={topicTagsStr} onChange={(e) => setTopicTagsStr(e.target.value)} className="input-field" />
            </Field>
            <Field label="Event Date">
              <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="input-field" />
            </Field>
          </div>

          {/* Correction notice */}
          {event.score_frozen && (
            <Field label="Correction Notice (post-freeze)">
              <textarea
                value={correctionNotice}
                onChange={(e) => setCorrectionNotice(e.target.value)}
                rows={2}
                className="input-field"
                placeholder="Describe the correction..."
              />
            </Field>
          )}
        </div>

        {/* Right column: Scores and metadata */}
        <div className="space-y-4">
          {/* Score params */}
          <div className="bg-surface-raised border border-surface-border rounded-lg p-4">
            <h3 className="text-xs font-semibold text-text-dim mb-3 uppercase tracking-wide">Metadata</h3>

            <Field label="Mechanism of Harm">
              <select value={mechanism} onChange={(e) => setMechanism(e.target.value)} className="input-field">
                <option value="">None</option>
                {MECHANISMS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>

            <Field label="Scope">
              <select value={scope} onChange={(e) => setScope(e.target.value)} className="input-field">
                <option value="">None</option>
                {SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>

            <Field label="Affected Population">
              <select value={affectedPop} onChange={(e) => setAffectedPop(e.target.value)} className="input-field">
                <option value="">None</option>
                {POPULATIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
          </div>

          {/* Score override */}
          <div className="bg-surface-raised border border-surface-border rounded-lg p-4">
            <h3 className="text-xs font-semibold text-text-dim mb-3 uppercase tracking-wide">Scores</h3>

            <div className="grid grid-cols-2 gap-3">
              <Field label="A-Score">
                <input type="number" min="0" max="100" value={aScore} onChange={(e) => setAScore(e.target.value)} className="input-field text-damage" />
              </Field>
              <Field label="B-Score">
                <input type="number" min="0" max="100" value={bScore} onChange={(e) => setBScore(e.target.value)} className="input-field text-distraction" />
              </Field>
            </div>

            <Field label="Primary List">
              <select value={primaryList} onChange={(e) => setPrimaryList(e.target.value)} className="input-field">
                <option value="">Auto</option>
                {LISTS.map((l) => <option key={l} value={l}>List {l}</option>)}
              </select>
            </Field>

            <Field label="Override Reason">
              <input
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Reason for score change"
                className="input-field"
              />
            </Field>

            <div className="flex flex-col gap-2 mt-3">
              <label className="flex items-center gap-2 text-sm text-text-secondary">
                <input type="checkbox" checked={isMixed} onChange={(e) => setIsMixed(e.target.checked)} />
                Mixed
              </label>
              <label className="flex items-center gap-2 text-sm text-text-secondary">
                <input type="checkbox" checked={noiseFlag} onChange={(e) => setNoiseFlag(e.target.checked)} />
                Noise
              </label>
              <label className="flex items-center gap-2 text-sm text-text-secondary">
                <input type="checkbox" checked={scoreFrozen} onChange={(e) => setScoreFrozen(e.target.checked)} />
                Frozen
              </label>
              <label className="flex items-center gap-2 text-sm text-text-secondary">
                <input type="checkbox" checked={humanReviewed} onChange={(e) => setHumanReviewed(e.target.checked)} />
                Reviewed
              </label>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            <button
              onClick={saveChanges}
              disabled={saving}
              className="bg-mixed text-white rounded px-4 py-2 text-sm font-semibold hover:bg-mixed/90 disabled:opacity-50 cursor-pointer w-full"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={rescoreEvent}
              disabled={rescoring || event.score_frozen}
              className="bg-surface-base border border-surface-border text-text-secondary rounded px-4 py-2 text-sm hover:border-mixed/30 disabled:opacity-50 cursor-pointer w-full"
            >
              {rescoring ? 'Re-scoring...' : 'Re-score with Claude'}
            </button>
          </div>

          {/* Info */}
          <div className="text-xs text-text-dim space-y-1">
            <p>Version: {event.score_version}</p>
            <p>Confidence: {event.confidence?.toFixed(2) ?? '—'}</p>
            <p>Dominance: {event.dominance_margin?.toFixed(1) ?? '—'}</p>
            <p>Articles: {event.article_count}</p>
            <p>Week: {event.week_id}</p>
          </div>
        </div>
      </div>

      {/* Score history */}
      <div className="mt-8">
        <h3 className="text-sm font-semibold mb-3">Score History</h3>
        {scoreChanges.length === 0 ? (
          <p className="text-text-dim text-sm">No score changes recorded.</p>
        ) : (
          <div className="bg-surface-raised border border-surface-border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-surface-border text-text-dim">
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-right">Old A</th>
                  <th className="px-3 py-2 text-right">New A</th>
                  <th className="px-3 py-2 text-right">Old B</th>
                  <th className="px-3 py-2 text-right">New B</th>
                  <th className="px-3 py-2 text-left">List</th>
                  <th className="px-3 py-2 text-left">By</th>
                  <th className="px-3 py-2 text-left">Reason</th>
                </tr>
              </thead>
              <tbody>
                {scoreChanges.map((sc) => (
                  <tr key={sc.id} className="border-b border-surface-border">
                    <td className="px-3 py-1.5 text-text-dim">{new Date(sc.changed_at).toLocaleString()}</td>
                    <td className="px-3 py-1.5">
                      <span className={`px-1.5 py-0.5 rounded ${sc.change_type === 'override' ? 'bg-distraction/20 text-distraction' : sc.change_type === 'rescore' ? 'bg-mixed/20 text-mixed' : 'bg-surface-border text-text-muted'}`}>
                        {sc.change_type}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-text-muted">{sc.old_a_score != null ? Math.round(sc.old_a_score) : '—'}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-damage">{sc.new_a_score != null ? Math.round(sc.new_a_score) : '—'}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-text-muted">{sc.old_b_score != null ? Math.round(sc.old_b_score) : '—'}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-distraction">{sc.new_b_score != null ? Math.round(sc.new_b_score) : '—'}</td>
                    <td className="px-3 py-1.5">{sc.old_list}→{sc.new_list}</td>
                    <td className="px-3 py-1.5 text-text-dim">{sc.changed_by}</td>
                    <td className="px-3 py-1.5 text-text-dim max-w-48 truncate">{sc.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Articles */}
      <div className="mt-8">
        <h3 className="text-sm font-semibold mb-3">Articles ({articles.length})</h3>
        {articles.length === 0 ? (
          <p className="text-text-dim text-sm">No articles linked.</p>
        ) : (
          <div className="space-y-2">
            {articles.map((a) => (
              <div key={a.id} className="bg-surface-raised border border-surface-border rounded p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-text-primary">{a.headline || 'No headline'}</p>
                    <p className="text-xs text-text-dim mt-0.5">
                      {a.publisher || 'Unknown'} &middot; {a.source_type || '—'} &middot;{' '}
                      {a.published_at ? new Date(a.published_at).toLocaleDateString() : '—'}
                    </p>
                  </div>
                  {a.url && (
                    <Link href={a.url} target="_blank" className="text-mixed text-xs shrink-0 no-underline hover:underline">
                      Open
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inline styles for form fields */}
      <style>{`
        .input-field {
          width: 100%;
          background: var(--color-surface-base);
          border: 1px solid var(--color-surface-border);
          border-radius: 4px;
          padding: 6px 10px;
          font-size: 13px;
          color: var(--color-text-primary);
        }
        .input-field:focus {
          outline: none;
          border-color: var(--color-mixed);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 mb-2">
      <span className="text-xs text-text-dim">{label}</span>
      {children}
    </label>
  );
}
