// Monta a URL do endpoint /api/media-proxy para uma mídia do CDN do
// Instagram/Facebook, contornando o bloqueio de Cross-Origin-Resource-Policy
// que o CDN aplica a requisições vindas de outra origem.
export function mediaProxyUrl(url: string) {
  return `/api/media-proxy?url=${encodeURIComponent(url)}`;
}
