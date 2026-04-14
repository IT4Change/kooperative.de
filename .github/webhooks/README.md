# Webhook Deployment

Automatisches Deployment via GitHub Webhook auf einem Alpine-Linux-Server.
Der Hook lauscht auf **Releases** (nicht auf Branch-Pushes) und checkt das
veröffentlichte Tag aus, bevor er das Build-/Restart-Skript ausführt.

## Inhalt

| Datei                  | Zweck                                                          |
|------------------------|----------------------------------------------------------------|
| `hooks.json.template`  | Konfiguration für [`webhook`](https://github.com/adnanh/webhook) -- prüft Signatur und `action == "published"`, übergibt `release.tag_name` an `deploy.sh` |
| `deploy.sh`            | Checkout des Tags, Build und (Re-)Start des Services via `pm2` |
| `ecosystem.config.js`  | `pm2`-Service-Definition für die Anwendung                     |
| `webhook.template`     | OpenRC-Init-Skript für den `webhook`-Daemon                    |
| `.gitignore`           | Hält die ausgefüllte `hooks.json` (Secret!) aus dem Repo       |

## Variablen

Vor dem Deployment in `hooks.json` und im OpenRC-Skript ersetzen:

| Variable                  | Bedeutung                                                |
|---------------------------|----------------------------------------------------------|
| `$PROJECT_ROOT`           | Absoluter Pfad zum Projekt-Checkout auf dem Server       |
| `$WEBHOOK_GITHUB_SECRET`  | Shared Secret, identisch zur Konfiguration in GitHub     |

## Setup auf Alpine

```sh
apk add webhook git nodejs npm
npm install -g pm2

# 1. Hook-Konfiguration erstellen und Variablen ersetzen
cp .github/webhooks/hooks.json.template .github/webhooks/hooks.json
vi .github/webhooks/hooks.json

# 2. OpenRC-Service einrichten
cp .github/webhooks/webhook.template /etc/init.d/webhook
vi /etc/init.d/webhook            # $PROJECT_ROOT ersetzen
chmod +x /etc/init.d/webhook

service webhook start
rc-update add webhook boot
```

## Nginx (Reverse Proxy)

`webhook` lauscht standardmäßig auf Port 9000. Beispiel-Snippet für
`/etc/nginx/http.d/default.conf`:

```nginx
location /hooks/ {
    proxy_http_version 1.1;
    proxy_set_header   Upgrade $http_upgrade;
    proxy_set_header   Connection 'upgrade';
    proxy_set_header   X-Forwarded-For $remote_addr;
    proxy_set_header   X-Real-IP  $remote_addr;
    proxy_set_header   Host $host;

    proxy_pass         http://127.0.0.1:9000/hooks/;
    proxy_redirect     off;
}

# GitHub-Payloads können groß werden -- verhindert 413-Fehler
client_body_buffer_size 10M;
client_max_body_size    10M;
```

## GitHub-Konfiguration

Repository → **Settings → Webhooks → Add webhook**:

| Feld              | Wert                                       |
|-------------------|--------------------------------------------|
| Payload URL       | `https://<host>/hooks/github`              |
| Content type      | `application/json`                         |
| Secret            | identisch zu `$WEBHOOK_GITHUB_SECRET`      |
| SSL verification  | enabled                                    |
| Events            | **Let me select individual events → Releases** |
| Active            | [x]                                        |

## Ablauf

1. Maintainer veröffentlicht ein Release auf GitHub.
2. GitHub schickt einen signierten `release`-Payload an `/hooks/github`.
3. `webhook` validiert die HMAC-Signatur und prüft `action == "published"`.
4. `deploy.sh` bekommt `release.tag_name` als Argument, fetched die Tags,
   checkt das Tag aus, baut das Projekt und startet den `pm2`-Service neu.

Ohne Argument fällt `deploy.sh` auf `master` zurück -- nützlich für
manuelles Auslösen auf dem Server.
