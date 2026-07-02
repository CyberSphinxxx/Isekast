export interface MediaItem {
  id: string;
  type: string;
  title: string;
  alt_titles?: string | null;
  overview?: string | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  genres?: string | null;
  status?: string | null;
  source_provider?: string | null;
  metadata?: string | null;
  cached_at?: string | null;
  stale_after?: string | null;
  external_ids?: string | null;
}

export interface Extension {
  id: string;
  name: string;
  version: string;
  manifest_url: string;
  resource_types: string;
  enabled: boolean;
  last_updated: string;
}
