#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Motor do Validador de Palavras-chave (MediaGrowth) — skill do Kevin (SEO).
Cria clientes, publica o frontend no GitHub Pages e faz o deploy do backend na Hostinger.
Stdlib pura. Roda no Mac e na VPS.

Uso:
  publicar.py novo <slug> "Nome do Cliente" [--logo caminho.png]
  publicar.py publicar [-m "mensagem do commit"]     # git push -> GitHub Pages
  publicar.py backend                                 # scp api.php -> Hostinger (1 deploy serve todos)
  publicar.py link <slug>                             # imprime os links (cliente + admin)
  publicar.py listar                                  # lista os clientes existentes
"""
import os, sys, json, subprocess, shutil

REPO = os.path.dirname(os.path.abspath(__file__))
GH_OWNER = os.environ.get("KW_GH_OWNER", "mediagrowthmkt-debug")
GH_REPO  = os.environ.get("KW_GH_REPO",  "keyword-approval")
PAGES    = os.environ.get("KW_PAGES_URL", f"https://{GH_OWNER}.github.io/{GH_REPO}")
SSH      = os.environ.get("MG_HOSTINGER_SSH", "hostinger-mg")
REMOTE   = os.environ.get("KW_HOSTINGER_DIR", "domains/mediagrowth.com.br/public_html/keywords-api")
API_URL  = os.environ.get("KW_API_URL", "https://mediagrowth.com.br/keywords-api/api.php")

def sh(cmd, cwd=REPO, check=True):
    print("· " + " ".join(cmd))
    return subprocess.run(cmd, cwd=cwd, check=check)

def git(args, msg_env=False):
    base = ["git", "-c", "user.name=MediaGrowth Deploy", "-c", "user.email=mediagrowthmkt@gmail.com"]
    return sh(base + args)

def links(slug):
    print(f"  Cliente : {PAGES}/?c={slug}")
    print(f"  Admin   : {PAGES}/admin.html?c={slug}")
    print(f"  Backend : {API_URL}?action=get&slug={slug}")

def cmd_novo(slug, nome, logo=None):
    dest = os.path.join(REPO, "clients", f"{slug}.json")
    if os.path.exists(dest):
        print(f"⚠️  Já existe clients/{slug}.json — abra e edite, não sobrescrevo.")
        return
    tpl = json.load(open(os.path.join(REPO, "clients", "_template.json"), encoding="utf-8"))
    tpl["slug"] = slug
    tpl["client"] = nome
    tpl["brand"]["logo"] = f"logos/{slug}.png"
    tpl["intro"] = f"Estas são as palavras-chave que levantamos para o SEO da {nome}. Aprove as que fazem sentido, reprove as que não têm a ver e deixe observações. No fim você pode sugerir termos que faltaram."
    tpl["categories"] = [{"name": "Categoria de exemplo", "hint": "", "keywords": ["palavra chave 1", "palavra chave 2"]}]
    json.dump(tpl, open(dest, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"✅ Criado clients/{slug}.json (edite as categorias/keywords).")
    if logo and os.path.exists(logo):
        shutil.copy(logo, os.path.join(REPO, "logos", f"{slug}.png"))
        print(f"✅ Logo copiada -> logos/{slug}.png")
    else:
        print(f"⚠️  Coloque a logo em logos/{slug}.png (PNG, fundo transparente de preferência).")
    links(slug)

def cmd_publicar(msg=None):
    git(["add", "-A"])
    r = subprocess.run(["git", "status", "--porcelain"], cwd=REPO, capture_output=True, text=True)
    if not r.stdout.strip():
        print("Nada novo para publicar.")
        return
    git(["commit", "-m", msg or "atualiza validador de palavras-chave"])
    git(["push", "origin", "main"])
    print(f"✅ Publicado. Pages: {PAGES}/  (pode levar ~1 min pra atualizar)")

def cmd_backend():
    sh(["ssh", "-o", "ConnectTimeout=15", SSH,
        f"mkdir -p {REMOTE}/data && chmod 775 {REMOTE}/data && echo OK"])
    sh(["scp", "-o", "ConnectTimeout=15", os.path.join(REPO, "api", "api.php"), f"{SSH}:{REMOTE}/api.php"])
    print(f"✅ Backend no ar: {API_URL}  (1 deploy serve todos os slugs)")

def cmd_listar():
    d = os.path.join(REPO, "clients")
    for f in sorted(os.listdir(d)):
        if f.endswith(".json") and not f.startswith("_"):
            slug = f[:-5]
            try:
                nome = json.load(open(os.path.join(d, f), encoding="utf-8")).get("client", "")
            except Exception:
                nome = "?"
            print(f"  {slug:24} {nome}")

def main():
    a = sys.argv[1:]
    if not a: print(__doc__); return
    c = a[0]
    if c == "novo":
        logo = None
        if "--logo" in a: logo = a[a.index("--logo") + 1]
        cmd_novo(a[1], a[2], logo)
    elif c == "publicar":
        msg = None
        if "-m" in a: msg = a[a.index("-m") + 1]
        cmd_publicar(msg)
    elif c == "backend":
        cmd_backend()
    elif c == "link":
        links(a[1])
    elif c == "listar":
        cmd_listar()
    else:
        print(__doc__)

if __name__ == "__main__":
    main()
