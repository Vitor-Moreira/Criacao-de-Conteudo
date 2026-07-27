# Deploy — Plataforma de Inteligência de Conteúdo

Este documento descreve como o deploy de produção foi feito e como reproduzi-lo (ex.: em caso de precisar recriar o projeto do zero).

## Visão geral da infraestrutura

- **Hospedagem**: Vercel (projeto `vitao-dev/criacao-de-conteudo`)
- **Repositório**: [github.com/Vitor-Moreira/Criacao-de-Conteudo](https://github.com/Vitor-Moreira/Criacao-de-Conteudo) — push na branch `main` dispara deploy automático de produção
- **Banco de dados**: Postgres via integração nativa **Neon** da Vercel (marketplace), plano Hobby
- **Cron / polling de scraping**: **GitHub Actions** (não o cron nativo da Vercel — ver [Por que GitHub Actions](#por-que-github-actions-e-não-o-cron-da-vercel))
- **URL de produção**: https://criacao-de-conteudo-three.vercel.app

## Variáveis de ambiente

Configuradas na Vercel (Project Settings → Environment Variables) para `production`, `preview` e `development`:

| Variável | Origem | Observação |
|---|---|---|
| `DATABASE_URL` | Integração Neon (automática) | Contém `neon.tech` — necessário para `src/lib/db.ts` escolher o adapter `@prisma/adapter-neon` corretamente |
| `DIRECT_URL` | Cópia manual de `DATABASE_URL_UNPOOLED` (Neon) | Usada por `prisma.config.ts` para rodar migrations (conexão não-pooled) |
| `AUTH_SECRET` | Manual | Chave do Auth.js (NextAuth v5) |
| `NEXTAUTH_URL` | Manual | URL de produção (`https://criacao-de-conteudo-three.vercel.app`); a Vercel confia automaticamente no host via a env `VERCEL` que ela mesma injeta |
| `ANTHROPIC_API_KEY` | Manual | Usada pelo Estúdio de Geração e Pesquisa de Mercado |
| `APIFY_TOKEN` | Manual | Scraping de perfis do Instagram |
| `CRON_SECRET` | Manual | Protege `/api/cron/poll-scrape-jobs`; mesmo valor precisa estar no secret do GitHub Actions (ver abaixo) |

A integração Neon também injeta várias outras vars (`PGHOST`, `PGUSER`, `POSTGRES_*`, etc.) que não são usadas diretamente pelo código — apenas `DATABASE_URL`/`DATABASE_URL_UNPOOLED` importam.

## Build command

Definido em `vercel.json`:

```json
{
  "buildCommand": "prisma migrate deploy && next build"
}
```

Isso garante que as migrations do Prisma sejam aplicadas ao banco de produção antes de cada build. O `postinstall` do `package.json` (`prisma generate`) garante que o client do Prisma seja gerado em `src/generated/prisma` (diretório gitignored) em qualquer checkout novo, incluindo o da Vercel.

## Por que GitHub Actions e não o cron da Vercel

O endpoint `/api/cron/poll-scrape-jobs` precisa rodar a cada 5 minutos para verificar o status dos runs do Apify e ingerir posts prontos. O plano **Hobby** da Vercel só permite cron nativo com frequência mínima de 1x/dia — insuficiente. Por isso o `vercel.json` não define `crons`, e o workflow `.github/workflows/poll-scrape-jobs.yml` faz esse papel via `schedule: cron: "*/5 * * * *"`, chamando o endpoint com `curl` e autenticação `Authorization: Bearer <CRON_SECRET>`.

Configuração necessária no GitHub (Settings → Secrets and variables → Actions):
- **Secret** `CRON_SECRET`: mesmo valor da variável de ambiente `CRON_SECRET` na Vercel
- **Variable** `CRON_TARGET_URL`: `https://criacao-de-conteudo-three.vercel.app`

O workflow também pode ser disparado manualmente (aba Actions → "Poll scrape jobs" → "Run workflow"), útil para validar a configuração sem esperar o próximo ciclo de 5 minutos.

## Passo a passo para recriar do zero (referência)

1. `git init`, configurar `user.name`/`user.email` locais, `git add -A`, commit inicial (conferir que `.env*` e `src/generated/prisma` não estão no commit).
2. Criar repositório no GitHub e configurar o remote via SSH (deploy key com "Allow write access", mais simples que gerenciar PAT):
   ```
   ssh-keygen -t ed25519 -f ~/.ssh/<nome> -N ""
   # adicionar a chave pública em Settings → Deploy keys do repo, com write access
   git remote set-url origin git@<alias>:<usuario>/<repo>.git
   ```
3. `npx vercel login` (abre navegador para autenticação via device flow) e `npx vercel link --yes --project <nome-do-projeto>` (nome deve ser lowercase, sem `---`).
4. Conectar a conta GitHub à Vercel em [vercel.com/account/login-connections](https://vercel.com/account/login-connections) (uma vez por conta) e instalar o GitHub App da Vercel no repositório em [github.com/apps/vercel/installations/new](https://github.com/apps/vercel/installations/new).
5. `npx vercel git connect` para linkar o repositório ao projeto.
6. `npx vercel install neon` — aceitar os termos do marketplace na URL retornada (`verification_uri`) e rodar o comando de novo. Isso provisiona o Postgres e já baixa as env vars para `.env.local`.
7. Adicionar manualmente `DIRECT_URL` (= `DATABASE_URL_UNPOOLED`) e os demais secrets (`AUTH_SECRET`, `ANTHROPIC_API_KEY`, `APIFY_TOKEN`, `CRON_SECRET`) via `npx vercel env add <NOME> <ambiente>`.
8. Definir `buildCommand` no `vercel.json` (ver acima), commitar e dar push — isso dispara o primeiro deploy automaticamente.
9. Depois do primeiro deploy, pegar o domínio de produção (`npx vercel ls`) e configurar `NEXTAUTH_URL` com esse valor; rodar `npx vercel redeploy <deployment> --target production` para que o novo valor seja aplicado.
10. Criar o workflow do GitHub Actions (`.github/workflows/poll-scrape-jobs.yml`) e configurar o secret `CRON_SECRET` + variable `CRON_TARGET_URL` no repositório.
11. Validar: chamar o endpoint com `curl` diretamente e disparar o workflow manualmente (`workflow_dispatch`) para confirmar que a cadeia completa funciona.

## Deploys subsequentes

Qualquer push para `main` dispara um novo deploy de produção automaticamente (build → `prisma migrate deploy` → `next build`). Não é necessário nenhum passo manual adicional, a menos que uma nova variável de ambiente seja introduzida no código.
