"""
Actualisation quotidienne du dossier Airtable avec le vrai nombre de streams Spotify.

Installation sur le serveur (une seule fois) :
    pip install spotifyscraper requests

Variables d'environnement necessaires (a definir avant de lancer, voir instructions) :
    AIRTABLE_TOKEN   -> ton Personal Access Token Airtable
    AIRTABLE_BASE_ID -> l'ID de ta base (commence par "app...")
    AIRTABLE_TABLE   -> le nom de ta table (ex: "IMPORT SACEM")
    AIRTABLE_URL_FIELD    -> nom de la colonne contenant le lien Spotify (ex: "LIEN")
    AIRTABLE_STREAMS_FIELD -> nom de la colonne a mettre a jour (ex: "STREAMS")

Usage :
    python scan_airtable_auto.py
"""

import os
import re
import sys
import time
import logging
from datetime import datetime, timezone

import requests
from spotify_scraper import SpotifyClient

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[
        logging.FileHandler("scan_airtable.log"),
        logging.StreamHandler(),
    ],
)
log = logging.getLogger(__name__)

TRACK_URL_RE = re.compile(r"open\.spotify\.com/track/([a-zA-Z0-9]+)")

AIRTABLE_TOKEN = os.environ.get("AIRTABLE_TOKEN")
BASE_ID = os.environ.get("AIRTABLE_BASE_ID")
TABLE = os.environ.get("AIRTABLE_TABLE")
URL_FIELD = os.environ.get("AIRTABLE_URL_FIELD", "LIEN")
STREAMS_FIELD = os.environ.get("AIRTABLE_STREAMS_FIELD", "STREAMS")

API_ROOT = f"https://api.airtable.com/v0/{BASE_ID}/{requests.utils.quote(TABLE, safe='')}"
HEADERS = {"Authorization": f"Bearer {AIRTABLE_TOKEN}", "Content-Type": "application/json"}


def fetch_all_records():
    records = []
    offset = None
    while True:
        params = {"pageSize": 100}
        if offset:
            params["offset"] = offset
        resp = requests.get(API_ROOT, headers=HEADERS, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        records.extend(data.get("records", []))
        offset = data.get("offset")
        if not offset:
            break
    return records


def update_records_batch(updates):
    # Airtable accepte jusqu'a 10 enregistrements par requete PATCH
    for i in range(0, len(updates), 10):
        chunk = updates[i:i + 10]
        resp = requests.patch(API_ROOT, headers=HEADERS, json={"records": chunk}, timeout=30)
        if not resp.ok:
            log.error("Echec mise a jour batch: %s", resp.text[:300])
        resp.raise_for_status()


def main():
    missing = [name for name, val in [
        ("AIRTABLE_TOKEN", AIRTABLE_TOKEN), ("AIRTABLE_BASE_ID", BASE_ID), ("AIRTABLE_TABLE", TABLE)
    ] if not val]
    if missing:
        log.error("Variables manquantes: %s", ", ".join(missing))
        sys.exit(1)

    log.info("Debut du scan quotidien")
    records = fetch_all_records()
    log.info("%d lignes recuperees depuis Airtable", len(records))

    updates = []
    errors = 0
    with SpotifyClient() as client:
        for i, rec in enumerate(records, start=1):
            url = rec.get("fields", {}).get(URL_FIELD, "")
            match = TRACK_URL_RE.search(url) if url else None
            if not match:
                continue
            track_id = match.group(1)
            try:
                track = client.get_track(track_id)
                updates.append({
                    "id": rec["id"],
                    "fields": {STREAMS_FIELD: track.play_count},
                })
            except Exception as e:
                errors += 1
                log.warning("Echec sur %s (%s): %s", track_id, url, e)

            if i % 100 == 0:
                log.info("... %d/%d traites", i, len(records))
            time.sleep(0.3)

    log.info("Ecriture de %d mises a jour dans Airtable", len(updates))
    update_records_batch(updates)

    log.info(
        "Termine: %d/%d morceaux mis a jour, %d erreurs",
        len(updates), len(records), errors,
    )


if __name__ == "__main__":
    main()
