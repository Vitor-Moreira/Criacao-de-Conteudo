import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Faz proxy de mídia hospedada no CDN do Instagram/Facebook.
//
// O CDN do Instagram (cdninstagram.com / fbcdn.net) responde com o header
// `Cross-Origin-Resource-Policy: same-origin`, que faz o navegador bloquear o
// carregamento da imagem/vídeo quando ela é referenciada via <img>/<video> a
// partir de outra origem (nosso domínio). Buscar o arquivo aqui no servidor e
// reenviá-lo sem esse header contorna a restrição — ela só se aplica a
// requisições feitas pelo navegador, não a chamadas servidor-a-servidor.
//
// O allowlist de hosts evita que essa rota vire um proxy aberto para
// qualquer URL arbitrária (risco de SSRF).

const ALLOWED_HOST_SUFFIXES = ["cdninstagram.com", "fbcdn.net"];

function isAllowedHost(hostname: string) {
  return ALLOWED_HOST_SUFFIXES.some(
    (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
  );
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Não autenticado.", { status: 401 });
  }

  const targetUrl = request.nextUrl.searchParams.get("url");
  if (!targetUrl) {
    return new NextResponse("Parâmetro 'url' ausente.", { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return new NextResponse("URL inválida.", { status: 400 });
  }

  if (parsed.protocol !== "https:" || !isAllowedHost(parsed.hostname)) {
    return new NextResponse("Host não permitido.", { status: 400 });
  }

  const range = request.headers.get("range");
  const upstream = await fetch(parsed.toString(), {
    headers: range ? { range } : undefined,
  });

  if (!upstream.ok && upstream.status !== 206) {
    return new NextResponse("Falha ao buscar mídia.", { status: upstream.status });
  }

  const headers = new Headers();
  const passthroughHeaders = [
    "content-type",
    "content-length",
    "accept-ranges",
    "content-range",
  ];
  for (const key of passthroughHeaders) {
    const value = upstream.headers.get(key);
    if (value) headers.set(key, value);
  }
  headers.set("cache-control", "public, max-age=86400, immutable");

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers,
  });
}
