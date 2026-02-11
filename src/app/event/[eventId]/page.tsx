import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getEventDetail } from '@/lib/data/events';
import { TopNav } from '@/components/TopNav';
import { DualScore } from '@/components/DualScore';
import { AttentionBudget } from '@/components/AttentionBudget';
import { MixedBadge } from '@/components/MixedBadge';
import { MechanismBadge } from '@/components/MechanismBadge';
import { FrozenBadge } from '@/components/FrozenBadge';
import { ActionItem } from '@/components/ActionItem';
import { ScoreBar } from '@/components/ScoreBar';
import {
  A_DRIVER_KEYS,
  A_DRIVER_LABELS,
  A_DRIVER_WEIGHTS,
  B_LAYER1_KEYS,
  B_LAYER1_LABELS,
  B_LAYER2_KEYS,
  B_LAYER2_LABELS,
} from '@/lib/types';

interface EventPageProps {
  params: Promise<{ eventId: string }>;
}

export async function generateMetadata({ params }: EventPageProps) {
  const { eventId } = await params;
  const event = await getEventDetail(eventId);
  if (!event) return { title: 'Event Not Found' };

  const list = event.primary_list === 'A' ? 'Damage' : event.primary_list === 'B' ? 'Distraction' : 'Noise';
  return {
    title: `${event.title}`,
    description: `${list} event — A: ${event.a_score?.toFixed(1) ?? '—'} / B: ${event.b_score?.toFixed(1) ?? '—'}. ${event.summary?.slice(0, 150) ?? ''}`,
  };
}

export default async function EventPage({ params }: EventPageProps) {
  const { eventId } = await params;
  const event = await getEventDetail(eventId);

  if (!event) {
    notFound();
  }

  const list = event.primary_list;
  const isNoise = list === 'C';
  const color = list === 'A' ? 'damage' : list === 'B' ? 'distraction' : 'noise';
  const listLabel = list === 'A' ? 'Real Damage' : list === 'B' ? 'Distraction' : 'Noise';

  return (
    <div className="min-h-screen">
      <TopNav />

      <main className="max-w-[680px] mx-auto px-4 py-5">
        {/* Back link */}
        <Link
          href={`/week/${event.week_id}`}
          className="text-[10px] text-text-dim hover:text-text-muted no-underline mb-3 block"
        >
          ← Back to week
        </Link>

        {/* Header */}
        <div className="mb-4">
          <div className="flex gap-1.5 items-center flex-wrap mb-1">
            <span className={`text-[9.5px] font-bold uppercase tracking-widest text-${color}`}>
              {listLabel}
            </span>
            {event.is_mixed && <MixedBadge />}
            <FrozenBadge frozen={event.score_frozen} version={event.score_version} />
          </div>
          <h1 className="text-lg font-extrabold text-text-primary font-serif leading-tight m-0">
            {event.title}
          </h1>
          <div className="text-[10.5px] text-text-dim mt-0.5">
            {event.event_date} · {event.article_count} sources · {Math.round((event.confidence ?? 0.8) * 100)}% confidence
          </div>
          <MechanismBadge
            mechanism={event.mechanism_of_harm}
            scope={event.scope}
            affectedPopulation={event.affected_population}
          />
          {/* Metadata tags */}
          <div className="flex gap-1 flex-wrap mt-1">
            {event.institution && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-text-muted font-mono">
                🏛 {event.institution}
              </span>
            )}
            {event.actors && event.actors.length > 0 && event.actors.map((actor) => (
              <span key={actor} className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-text-muted font-mono">
                👤 {actor}
              </span>
            ))}
            {event.topic_tags && event.topic_tags.length > 0 && event.topic_tags.map((tag) => (
              <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-text-dim font-mono">
                #{tag}
              </span>
            ))}
          </div>
        </div>

        {/* Dual score display */}
        {!isNoise && (
          <div className="mb-4">
            <DualScore aScore={event.a_score} bScore={event.b_score} size="lg" />
            <div className="mt-1">
              <AttentionBudget aScore={event.a_score} bScore={event.b_score} />
            </div>
          </div>
        )}

        {/* Summary */}
        <section className="bg-white/[0.03] rounded-md p-3 mb-3">
          <SectionLabel>Summary</SectionLabel>
          <p className="text-[12.5px] text-text-secondary leading-relaxed m-0">
            {event.summary}
          </p>
        </section>

        {/* Score rationale */}
        {event.score_rationale && (
          <section className={`bg-${color}/[0.03] border border-${color}/[0.08] rounded-md p-3 mb-3`}>
            <SectionLabel className={`text-${color}`}>Why This Score</SectionLabel>
            <p className="text-[11.5px] text-text-secondary leading-relaxed m-0 italic">
              {event.score_rationale}
            </p>
          </section>
        )}

        {/* A-Score driver breakdown */}
        {event.a_components && (
          <section className="bg-damage/[0.03] border border-damage/[0.08] rounded-md p-3 mb-2">
            <SectionLabel className="text-damage">A-Score Drivers</SectionLabel>
            {A_DRIVER_KEYS.map((key) => (
              <ScoreBar
                key={key}
                label={A_DRIVER_LABELS[key]}
                value={event.a_components!.drivers[key]}
                color="damage"
                weight={A_DRIVER_WEIGHTS[key]}
              />
            ))}
            {event.a_components.severity && (
              <div className="mt-1.5 px-2 py-1 bg-damage/[0.05] rounded text-[9.5px] text-damage-light font-mono">
                Sev: durability={event.a_components.severity.durability} ·
                reversibility={event.a_components.severity.reversibility} ·
                precedent={event.a_components.severity.precedent}
                {event.a_components.mechanism_modifier != null && ` · mech=${event.a_components.mechanism_modifier}×`}
                {event.a_components.scope_modifier != null && ` scope=${event.a_components.scope_modifier}×`}
              </div>
            )}
          </section>
        )}

        {/* B-Score layer breakdown */}
        {event.b_layer1_hype && (
          <section className="bg-distraction/[0.03] border border-distraction/[0.08] rounded-md p-3 mb-2">
            <SectionLabel className="text-distraction">B-Score: Layer 1 — Hype (55%)</SectionLabel>
            {B_LAYER1_KEYS.map((key) => (
              <ScoreBar
                key={key}
                label={B_LAYER1_LABELS[key]}
                value={event.b_layer1_hype![key]}
                color="distraction"
              />
            ))}

            {event.b_layer2_distraction && (
              <>
                <div className="text-[9.5px] font-bold tracking-widest text-distraction mt-3 mb-1.5">
                  Layer 2 — Strategic (45%)
                </div>
                {B_LAYER2_KEYS.map((key) => (
                  <ScoreBar
                    key={key}
                    label={B_LAYER2_LABELS[key]}
                    value={event.b_layer2_distraction![key]}
                    color="distraction"
                  />
                ))}
              </>
            )}

            {event.b_intentionality_score != null && (
              <div className="mt-1.5 px-2 py-1 bg-distraction/[0.05] rounded text-[9.5px] text-distraction-light font-mono">
                Intentionality: {event.b_intentionality_score}/15 →{' '}
                {event.b_intentionality_score >= 8
                  ? 'Full (0.45)'
                  : event.b_intentionality_score >= 4
                    ? 'Reduced (0.25)'
                    : 'Minimal (0.10)'}
              </div>
            )}
          </section>
        )}

        {/* Smokescreen connections */}
        {event.smokescreen_for.length > 0 && (
          <section className="bg-damage/[0.03] border border-damage/[0.12] rounded-md p-3 mb-2">
            <SectionLabel className="text-damage">Covering For</SectionLabel>
            {event.smokescreen_for.map((pair) => (
              <div key={pair.id} className="py-1 border-t border-damage/[0.08] first:border-t-0">
                <Link
                  href={`/event/${pair.damage_event.id}`}
                  className="text-[11.5px] text-damage-light font-semibold no-underline hover:underline"
                >
                  {pair.damage_event.title}
                </Link>
                <div className="text-[9.5px] text-text-muted font-mono">
                  SI: {pair.smokescreen_index.toFixed(1)}{' '}
                  {pair.smokescreen_index > 50 ? '🔴' : '🟡'}
                  {pair.displacement_confidence != null && (
                    <>
                      {' · '}Displacement:{' '}
                      {pair.displacement_confidence >= 0.7
                        ? 'HIGH'
                        : pair.displacement_confidence >= 0.4
                          ? 'MED'
                          : 'LOW'}
                    </>
                  )}
                </div>
              </div>
            ))}
          </section>
        )}

        {event.smokescreened_by.length > 0 && (
          <section className="bg-distraction/[0.03] border border-distraction/[0.12] rounded-md p-3 mb-2">
            <SectionLabel className="text-distraction">Smokescreened By</SectionLabel>
            {event.smokescreened_by.map((pair) => (
              <div key={pair.id} className="py-1 border-t border-distraction/[0.08] first:border-t-0">
                <Link
                  href={`/event/${pair.distraction_event.id}`}
                  className="text-[11.5px] text-distraction-light font-semibold no-underline hover:underline"
                >
                  {pair.distraction_event.title}
                </Link>
                <div className="text-[9.5px] text-text-muted font-mono">
                  SI: {pair.smokescreen_index.toFixed(1)}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Score history */}
        {event.score_history.length > 0 && (
          <section className="bg-white/[0.02] rounded-md p-2.5 mb-2">
            <SectionLabel className="text-text-dim">Score History</SectionLabel>
            {event.score_history.map((change) => (
              <div key={change.id} className="text-[10.5px] text-text-muted font-mono">
                v{change.version_after} {new Date(change.changed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}:{' '}
                A={change.new_a_score?.toFixed(1) ?? '—'} B={change.new_b_score?.toFixed(1) ?? '—'}{' '}
                ({change.changed_by}){change.reason ? ` — ${change.reason}` : ''}
              </div>
            ))}
          </section>
        )}

        {/* Correction notice */}
        {event.correction_notice && (
          <section className="bg-distraction/[0.05] border border-distraction/20 rounded-md p-3 mb-2">
            <SectionLabel className="text-distraction">Correction</SectionLabel>
            <p className="text-[11.5px] text-text-secondary leading-relaxed m-0">
              {event.correction_notice}
            </p>
            {event.correction_at && (
              <div className="text-[9px] text-text-dim mt-1">
                Issued: {new Date(event.correction_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            )}
          </section>
        )}

        {/* Factual claims */}
        {event.factual_claims && event.factual_claims.length > 0 && (
          <section className="bg-white/[0.03] rounded-md p-3 mb-2">
            <SectionLabel className="text-text-dim">Factual Claims</SectionLabel>
            <div className="space-y-1">
              {event.factual_claims.map((fc, i) => (
                <div key={i} className="flex gap-1.5 text-[11px]">
                  <span className={fc.verified ? 'text-live' : 'text-text-dim'}>
                    {fc.verified ? '✓' : '○'}
                  </span>
                  <div>
                    <span className="text-text-secondary">{fc.claim}</span>
                    {fc.source && (
                      <span className="text-text-dim ml-1 text-[9.5px]">— {fc.source}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Articles */}
        {event.articles.length > 0 && (
          <section className="bg-white/[0.02] rounded-md p-2.5 mb-2">
            <SectionLabel className="text-text-dim">Sources ({event.articles.length})</SectionLabel>
            <div className="space-y-1">
              {event.articles.map((article) => (
                <div key={article.id} className="text-[11px]">
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-text-secondary hover:text-text-primary no-underline hover:underline"
                  >
                    {article.headline || article.url}
                  </a>
                  {article.publisher && (
                    <span className="text-text-dim ml-1">— {article.publisher}</span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Action item */}
        {event.action_item && <ActionItem text={event.action_item} />}
      </main>
    </div>
  );
}

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`text-[9.5px] font-bold uppercase tracking-widest mb-1 ${className ?? 'text-text-muted'}`}>
      {children}
    </div>
  );
}
