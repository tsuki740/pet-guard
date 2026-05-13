# -*- coding: utf-8 -*-
"""Convert HTML/CSS/JS from GB18030 to UTF-8 BOM."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FILES = ("index.html", "style.css", "script.js")
SRC_ENC = "gb18030"


def main():
    for name in FILES:
        path = ROOT / name
        data = path.read_bytes()
        if data.startswith(b"\xef\xbb\xbf"):
            data = data[3:]
        text = data.decode(SRC_ENC)
        path.write_text(text, encoding="utf-8-sig", newline="\n")
        print("converted:", name)


if __name__ == "__main__":
    main()
