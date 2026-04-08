import type { Metadata } from 'next';
import { resolveWeekParam, getWeekLabel, getWeekNumber, isCurrentWeek, toWeekId } from '@/lib/weeks';
import { getWeekData } from '@/lib/data/weeks';
import { getAllWeekSnapshots } from '@/lib/data/weeks';
import { notFound } from 'next/navigation';

import { TopNav } from '@/components/TopNav';
import { FirstVisitExplainer } from '@/components/FirstVisitExplainer';
import { WeekSelector } from '@/components/WeekSelector';
import { HeroPullQuote } from '@/components/HeroPullQuote';
import { WeekSummary } from '@/components/WeekSummary';
import { SmokescreenAlert } from '@/components/SmokescreenAlert';
import { NarrativeStrips } from '@/components/NarrativeStrips';
import { ListColumn } from '@/components/ListColumn';
import { KeyStories } from '@/components/KeyStories';
import { FullIndexToggle } from '@/components/FullIndexToggle';
import { WeekBriefing } from '@/components/WeekBriefing';
import { ShareButtons } from '@/components/ShareButtons';
import { NewsletterSignup } from '@/components/NewsletterSignup';
import { SupportCTA } from '@/components/SupportCTA';

// ISR: serve cached page, regenerate in background every 60s.
// Frozen weeks return identical content; live week stays near-realtime.
export const revalidate = 60;

interface WeekPageProps {
  params: Promise<{ weekId: string }>;
}

export async function generateMetadata({ params }: WeekPageProps): Promise<Metadata> {
  const { weekId } = await params;
  const weekStart = resolveWeekParam(weekId);
  if (!weekStart) return { title: 'Week Not Found' };

  const label = getWeekLabel(weekStart);
  const weekNum = getWeekNumber(weekStart);
  const live = isCurrentWeek(weekStart);
  const wid = toWeekId(weekStart);
  const description = `The Distraction Index for ${label}. ${live ? 'Live updates throughout the week.' : 'Frozen weekly edition.'} Tracking democratic damage vs. manufactured distractions.`;

  return {
    title: `Week ${weekNum}: ${label}${live ? ' (Live)' : ''}`,
    description,
    openGraph: {
      title: `Week ${weekNum}: ${label}${live ? ' (Live)' : ''}`,
      description,
      url: `/week/${wid}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: `Week ${weekNum}: ${label}${live ? ' (Live)' : ''} | The Distraction Index`,
      description,
    },
    alternates: {
      canonical: `/week/${wid}`,
    },
  };
}

export default async function WeekPage({ params }: WeekPageProps) {
  const { weekId } = await params;
  const weekStart = resolveWeekParam(weekId);

  if (!weekStart) {
    notFound();
  }

  const wid = toWeekId(weekStart);
  const live = isCurrentWeek(weekStart);

  // Fetch week data and all snapshots in parallel
  const [weekData, allWeeks] = await Promise.all([
    getWeekData(wid),
    getAllWeekSnapshots(),
  ]);

  // Even if there's no data yet, we still show the page shell
  const snapshot = weekData?.snapshot ?? null;

  // Find prior week snapshot for week-over-week deltas
  const currentIdx = snapshot ? allWeeks.findIndex((w) => w.week_id === snapshot.week_id) : -1;
  const priorSnapshot = currentIdx >= 0 && currentIdx < allWeeks.length - 1
    ? allWeeks[currentIdx + 1]
    : null;

  const weekNum = getWeekNumber(weekStart);
  const weekIdStr = wid;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: `Distraction Index — Week ${weekNum}`,
    description: `Political events scored for constitutional damage and media distraction. Week of ${weekIdStr}.`,
    url: `https://distractionindex.org/week/${weekIdStr}`,
    datePublished: snapshot?.created_at,
    dateModified: snapshot?.frozen_at ?? snapshot?.created_at,
    creator: { '@type': 'Organization', name: 'The Distraction Index', url: 'https://distractionindex.org' },
    license: 'https://opensource.org/licenses/MIT',
  };

  return (
    <div className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <TopNav />
      <FirstVisitExplainer />
      <main>

      {/* Week selector */}
      {snapshot && allWeeks.length > 0 && (
        <WeekSelector allWeeks={allWeeks} currentSnapshot={snapshot} />
      )}

      {/* Share buttons */}
      {snapshot && (
        <div className="max-w-[900px] mx-auto px-5 flex justify-end py-1">
          <ShareButtons url={`/week/${wid}`} title={`Distraction Index — Week ${getWeekNumber(weekStart)}: ${getWeekLabel(weekStart)}`} />
        </div>
      )}

      {/* Smokescreen alert */}
      {snapshot && <SmokescreenAlert snapshot={snapshot} />}

      {/* Weekly summary (frozen weeks) */}
      {snapshot && <WeekSummary snapshot={snapshot} />}

      {/* Main content */}
      {weekData ? (
        <>
          {/* Hero: Pull-quote + sidebar stats */}
          <HeroPullQuote
            snapshot={weekData.snapshot}
            priorSnapshot={priorSnapshot}
            topDamage={weekData.events.A[0] ?? null}
            topDistraction={weekData.events.B[0] ?? null}
            topSmokescreenPair={
              weekData.smokescreenPairs[0]?.smokescreen_index >= 25
                ? { pair: weekData.smokescreenPairs[0] }
                : null
            }
          />

          {/* Live briefing (live weeks only) */}
          <WeekBriefing
            snapshot={weekData.snapshot}
            topDamage={weekData.events.A}
            topDistraction={weekData.events.B}
          />

          {/* Narrative strips: Look at this / They want you to look at */}
          <NarrativeStrips
            topDamage={weekData.events.A}
            topDistraction={weekData.events.B}
          />

          {/* Key stories — top damage, distraction, smokescreen */}
          <KeyStories
            topDamage={weekData.events.A[0] ?? null}
            topDistraction={weekData.events.B[0] ?? null}
            topSmokescreenPair={
              weekData.smokescreenPairs[0]?.smokescreen_index >= 25
                ? { pair: weekData.smokescreenPairs[0] }
                : null
            }
          />

          {/* Three-column full index */}
          <FullIndexToggle>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              <ListColumn list="A" events={weekData.events.A} staleDaysThreshold={live ? 14 : undefined} />
              <ListColumn list="B" events={weekData.events.B} staleDaysThreshold={live ? 14 : undefined} />
              <ListColumn list="C" events={weekData.events.C} staleDaysThreshold={live ? 14 : undefined} />
            </div>
          </FullIndexToggle>

          {/* Newsletter signup */}
          <NewsletterSignup />

          {/* Support CTA */}
          <SupportCTA />
        </>
      ) : (
        /* Empty state */
        <div className="max-w-[600px] mx-auto text-center py-16 px-5">
          <div className="text-4xl mb-3">📭</div>
          <h2 className="text-lg text-text-primary font-serif font-bold mb-1.5">
            Week {getWeekNumber(weekStart)}: {getWeekLabel(weekStart)}
          </h2>
          <p className="text-[13px] text-text-dim leading-relaxed">
            {live
              ? 'This week is live but no events have been scored yet. Check back as the week progresses.'
              : 'No data available for this week yet. The pipeline may not have processed this week.'}
          </p>
        </div>
      )}
      </main>
    </div>
  );
}
