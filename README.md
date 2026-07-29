# Validação de Palavras-chave — MediaGrowth

Sistema **multi-cliente** para o cliente aprovar / reprovar / comentar / sugerir palavras-chave de SEO.
Página estática (GitHub Pages) + backend PHP por slug (Hostinger ou VPS). Salva sozinho, todo mundo vê ao vivo, sem WhatsApp.

Primeira instância: **Magicis** (`?c=magicis`).

## Como o cliente usa

Você manda o link: `https://SEU-DOMINIO/keyword-approval/?c=<slug>`
O cliente vê a lista por categoria e, em cada palavra:
- **✓ Aprovar** (botão principal)
- **✕ Reprovar** (minimalista)
- **✎ Observação** (por que sim / por que não / um ajuste)
- No fim: **sugerir** palavras que faltaram.

Salva automático no backend. Ele pode fechar e voltar depois.

## Como você (MediaGrowth) vê o resultado

`admin.html?c=<slug>` → aprovadas (copiar lista pronta pro `mg-keywords`/campanha), reprovadas com motivo, sugestões e observações.

## Arquitetura

```
keyword-approval/
├── index.html        página do cliente (lê ?c=<slug>)
├── app.js            lógica (aprovar/reprovar/nota/sugestão + autosave)
├── style.css         visual minimalista, cor vinda do seed
├── admin.html        painel interno de resultado
├── config.js         { apiBase }  <- único ponto a configurar
├── clients/
│   ├── magicis.json  seed do cliente (marca + categorias + keywords)
│   └── _template.json copie para criar um novo cliente
├── logos/            logo por cliente (magicis.png ...)
└── api/
    └── api.php       backend (vai para a Hostinger/VPS, NÃO para o GitHub Pages)
```

O seed (`clients/<slug>.json`) fica no repo. O estado vivo (aprovações/observações/sugestões)
fica no backend em `data/<slug>.json`. A página junta os dois.

## Adicionar um novo cliente (3 passos)

1. `cp clients/_template.json clients/<slug>.json` e preencha (client, cor, intro, categorias, keywords).
2. Ponha a logo em `logos/<slug>.png` (o mesmo nome do `brand.logo` no JSON).
3. `git add . && git commit -m "cliente <slug>" && git push` → link pronto: `?c=<slug>`.

Nada de backend a mexer: o `api.php` já atende qualquer slug.

## Deploy

**Frontend (GitHub Pages):** repositório dedicado, branch `main`, Pages ligado na raiz.
Configure o domínio se quiser (`CNAME`).

**Backend (Hostinger ou VPS):** suba a pasta `api/` para um endereço com PHP, ex.:
`https://mediagrowth.com.br/keywords-api/` (fica `.../keywords-api/api.php`).
A pasta `data/` é criada sozinha (precisa de permissão de escrita).
Depois, ajuste `config.js` → `apiBase` para esse endereço.

> `config.js` aponta por padrão para `https://mediagrowth.com.br/keywords-api/api.php`.
> Se hospedar o backend em outro lugar, troque só essa linha.

## Endpoints do backend

- `GET  api.php?action=get&slug=<slug>` — estado atual
- `POST action=decide  slug kw status(approved|rejected|pending) note by`
- `POST action=suggest slug text note by`
- `POST action=delsuggest slug id`
- `POST action=reviewer slug by`

Trava de arquivo em cada escrita. CORS liberado (a página roda no GitHub Pages).

## Teste local

```
# na raiz do repo, com PHP:
php -S localhost:8080
# abra http://localhost:8080/?c=magicis   (backend local em api/api.php via ?)
```
Para testar com backend local, aponte `config.js` para `http://localhost:8080/api/api.php`.
