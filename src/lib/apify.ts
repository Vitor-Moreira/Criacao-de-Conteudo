import { ApifyClient } from "apify-client";

// Singleton do ApifyClient, no mesmo padrão do singleton do Prisma (evita recriar
// o client a cada hot-reload em dev).
const globalForApify = globalThis as unknown as {
  apifyClient: ApifyClient | undefined;
};

export const apifyClient =
  globalForApify.apifyClient ?? new ApifyClient({ token: process.env.APIFY_TOKEN });

if (process.env.NODE_ENV !== "production") {
  globalForApify.apifyClient = apifyClient;
}

export const INSTAGRAM_SCRAPER_ACTOR_ID = "apify/instagram-scraper";

/// Custo aproximado do apify/instagram-scraper: US$ 2,70 a cada 1.000 resultados.
export const APIFY_INSTAGRAM_CENTS_PER_RESULT = 0.27;
