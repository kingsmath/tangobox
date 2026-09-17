# source/ 의 조각들을 하나의 실행 파일(tango_auto_dj.html)로 합칩니다.
#   python source/assemble.py
import json, pathlib

here = pathlib.Path(__file__).resolve().parent
out = here.parent / "tango_auto_dj.html"

template = (here / "template.html").read_text(encoding="utf-8")
app_js = (here / "app.js").read_text(encoding="utf-8")
data = json.loads((here / "tango_data.json").read_text(encoding="utf-8"))
info = json.loads((here / "info.json").read_text(encoding="utf-8"))

html = template.replace("__TANGO_DATA_JSON__", json.dumps(data, ensure_ascii=False, separators=(",", ":")))
html = html.replace("__TANGO_INFO_JSON__", json.dumps(info, ensure_ascii=False, separators=(",", ":")))
html = html.replace("__APP_JS__", app_js)

for ph in ("__TANGO_DATA_JSON__", "__TANGO_INFO_JSON__", "__APP_JS__"):
    assert ph not in html, ph
out.write_text(html, encoding="utf-8")
print(f"wrote {out} ({len(html):,} chars)")
