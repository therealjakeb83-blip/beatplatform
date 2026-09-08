"""
Usage :
    pip install spotifyscraper
    python scan_streams.py mon_catalogue.csv

Le CSV d'entree doit avoir une colonne contenant les liens Spotify
(le script detecte automatiquement la bonne colonne).
Sortie : resultats.csv, avec une ligne par morceau + play_count.
"""

import csv
import re
import sys
import time
from spotify_scraper import SpotifyClient

TRACK_URL_RE = re.compile(r"open\.spotify\.com/track/([a-zA-Z0-9]+)")


def find_track_id(row: dict) -> str | None:
    for value in row.values():
        if isinstance(value, str) and "open.spotify.com/track" in value:
            match = TRACK_URL_RE.search(value)
            if match:
                return match.group(1)
    return None


def main(input_csv: str) -> None:
    with open(input_csv, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    print(f"{len(rows)} lignes trouvees dans {input_csv}")

    results = []
    with SpotifyClient() as client:
        for i, row in enumerate(rows, start=1):
            track_id = find_track_id(row)
            if not track_id:
                results.append({"url": "", "erreur": "pas d'URL Spotify trouvee dans la ligne"})
                continue
            try:
                track = client.get_track(track_id)
                results.append({
                    "url": track.share_url or f"https://open.spotify.com/track/{track_id}",
                    "titre": track.name,
                    "artistes": ", ".join(a.name for a in track.artists),
                    "album": track.album.name if track.album else "",
                    "date_sortie": str(track.release_date) if track.release_date else "",
                    "duree_ms": track.duration_ms,
                    "play_count": track.play_count,
                })
            except Exception as e:
                results.append({"url": f"track/{track_id}", "erreur": str(e)})

            if i % 50 == 0:
                print(f"  ... {i}/{len(rows)}")
            time.sleep(0.2)  # petite pause, courtoisie envers le serveur

    fieldnames = ["url", "titre", "artistes", "album", "date_sortie", "duree_ms", "play_count", "erreur"]
    with open("resultats.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in results:
            writer.writerow({k: r.get(k, "") for k in fieldnames})

    print(f"Termine. Resultats dans resultats.csv ({len(results)} lignes)")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python scan_streams.py mon_catalogue.csv")
        sys.exit(1)
    main(sys.argv[1])
