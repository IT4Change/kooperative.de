# Server-Daten

## `blz.json`

BLZ → Bankname-Mapping aus der offiziellen [Bundesbank-Bankleitzahlen-Datei](https://www.bundesbank.de/de/aufgaben/unbarer-zahlungsverkehr/serviceangebot/bankleitzahlen/download-bankleitzahlen-602592). Wird vierteljährlich aktualisiert (1. März, 1. Juni, 1. September, 1. Dezember).

Aktualisierung:

```bash
# 1. CSV von Bundesbank holen
curl -L "$(curl -s 'https://www.bundesbank.de/de/aufgaben/unbarer-zahlungsverkehr/serviceangebot/bankleitzahlen/download-bankleitzahlen-602592' \
  | grep -oE '/resource/blob/[^"]+blz-aktuell-csv-data\.csv' | head -1 | sed 's|^|https://www.bundesbank.de|')" -o /tmp/blz.csv

# 2. Konvertieren (filtert auf Merkmal=1 = Hauptbank)
python3 -c "
import csv, json
out = {}
with open('/tmp/blz.csv', 'r', encoding='cp1252') as f:
    for row in csv.DictReader(f, delimiter=';'):
        if row.get('Merkmal') != '1': continue
        blz = row['Bankleitzahl'].strip()
        name = row.get('Kurzbezeichnung','').strip() or row.get('Bezeichnung','').strip()
        city = row.get('Ort','').strip()
        if blz and name:
            out[blz] = f'{name} — {city}' if city else name
json.dump(out, open('app/server/data/blz.json','w',encoding='utf-8'), separators=(',', ':'), ensure_ascii=False)
print(f'{len(out)} Einträge')
"
```

Alternative-Coverage gegen die Produktions-Kundendaten lag bei 99,7%
(1841 von 1847 IBANs aufgelöst).
