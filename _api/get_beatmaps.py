import requests
import json

API_KEY = ""

beatmap_json = {
    'stage': 'Quarterfinals',
    'abbreviation': 'QF',
    'beatmaps': []
}

with open("pool.txt", mode='r') as f:
    beatmaps = []
    for line in f.readlines():
        line = line.split()
        mods = line[0].rstrip('0123456789')
        if mods in ["FM", "TB", "ACC"]:
            mods = "NM"
        r = requests.get('https://osu.ppy.sh/api/get_beatmaps', params={'k': API_KEY, 'b': int(line[1])}).json()[0]
        beatmaps.append({
            'beatmap_id': int(line[1]),
            'identifier': line[0],
            'mods': mods,
            'beatmapset_id': r["beatmapset_id"],
            'artist': r["artist"],
            'title': r["title"],
            'difficulty': r["version"],
            'mapper': r["creator"],
            'multipliers': {}
        })
    beatmap_json['beatmaps'] = beatmaps


with open(f"beatmaps_{beatmap_json['abbreviation']}.json", "w") as f:
    json.dump(beatmap_json, f)
