// Real Unsplash API search for the hero photo. Needs UNSPLASH_ACCESS_KEY set
// (https://unsplash.com/developers — free tier, 50 req/hour). Falls back to
// the icon treatment when the key is missing or nothing matches — never
// blocks generation on this.
export interface UnsplashPhoto {
  url: string;
  credit: { name: string; profileUrl: string };
  downloadLocation: string;
}

export async function searchHeroPhoto(industry: string, page = 1): Promise<UnsplashPhoto | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;

  const query = industry.split(/[,/]/)[0].trim();
  const res = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&page=${page}&orientation=landscape&content_filter=high`,
    { headers: { Authorization: `Client-ID ${key}` } },
  );
  if (!res.ok) return null;
  const data = await res.json();
  const first = data?.results?.[0];
  if (!first) return null;

  return {
    url: first.urls?.regular,
    credit: { name: first.user?.name ?? "Unknown", profileUrl: first.user?.links?.html ?? "https://unsplash.com" },
    downloadLocation: first.links?.download_location,
  };
}

/** Unsplash API terms: ping this once the photo is actually used (i.e. once
 *  the case study is published), not on every preview render. */
export async function pingUnsplashDownload(downloadLocation: string): Promise<void> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key || !downloadLocation) return;
  await fetch(downloadLocation, { headers: { Authorization: `Client-ID ${key}` } }).catch(() => {});
}
