"""Turns the synthetic 137-person family into an app backup file (family.json) with some dates."""
import json, random, sys
src = open("/home/claude/tree/data.js", encoding="utf-8").read()
d = json.loads(src[len("window.DATA="):-1])
R = random.Random(5)
persons, unions = {}, {}
pid = lambda i: f"p{i:04d}"
uidf = lambda i: f"u{i:04d}"
base_year = {0: 1300, 1: 1328, 2: 1356, 3: 1386, 4: 1418}
for p in d["persons"]:
    q = {"id": pid(p["id"]), "name": p["name"], "gender": p["g"], "nick": "", "useNick": False,
         "ancestors": [p["father_name"]] if (not p["desc"] and p.get("father_name")) else [],
         "fam": p.get("fam") or "", "birth": None, "death": None, "deceased": False,
         "photos": [], "mainPhoto": None, "bio": "", "note": "", "blank": False}
    persons[q["id"]] = q
# dates for descendants by generation
gen_of = {pid(p["id"]): p["gen"] for p in d["persons"] if p["desc"]}
for k, g in gen_of.items():
    if R.random() < 0.65:
        y = base_year[g] + R.randint(0, 22)
        persons[k]["birth"] = {"cal": "h", "y": y, "m": None, "d": None, "approx": R.random() < 0.25}
root = pid(d["root"])
persons[root]["birth"] = {"cal": "h", "y": 1302, "m": None, "d": None, "approx": True}
persons[root]["death"] = {"cal": "h", "y": 1388, "m": 7, "d": None, "approx": False}
persons[root]["deceased"] = True
persons[root]["note"] = "تاجر"
for u in d["unions"]:
    unions[uidf(u["id"])] = {"id": uidf(u["id"]), "h": pid(u["h"]), "w": pid(u["w"]), "kids": [pid(k) for k in u["kids"]], "order": u["id"] + 1}
fam = {"format": "shajara-family", "version": 1, "id": "sample137", "name": "آل المنصور (تجريبية)", "rootId": root,
       "created": 1790000000000, "updated": 1790000000000, "seq": len(unions) + 1, "persons": persons, "unions": unions}
json.dump(fam, open(sys.argv[1], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(persons), "persons", len(unions), "unions")
