# Datenbank (alte Shop-Daten)

MariaDB via Docker für die alte osCommerce/xtCommerce-Datenbank.

## Starten

```bash
docker compose up -d
```

## SQL-Dump einspielen

```bash
docker exec -i koop-mariadb mariadb -ukoop -pkoop kooperative < old/kooperative_db2.sql
```

## Verbinden

```bash
docker exec -it koop-mariadb mariadb -ukoop -pkoop kooperative
```

## Zugangsdaten

| Feld     | Wert          |
|----------|---------------|
| Host     | localhost     |
| Port     | 3306          |
| Database | kooperative   |
| User     | koop          |
| Password | koop          |
| Root PW  | koop-root     |

## Stoppen

```bash
docker compose down        # Container stoppen
docker compose down -v     # + Daten löschen
```
