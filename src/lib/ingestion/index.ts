// Re-export ingestion modules
export { fetchGdeltRecent, fetchGdeltForDateRange, searchGdelt } from './gdelt';
export { fetchGNewsRecent, fetchGNewsForDateRange, searchGNews } from './gnews';
export { fetchGoogleNewsRecent, searchGoogleNews } from './google-news';
export { deduplicateArticles } from './dedup';
export { clusterArticlesIntoEvents } from './cluster';
export { runIngestPipeline } from './pipeline';
export type { ArticleInput, IdentifiedEvent, ScoringResult } from './types';
