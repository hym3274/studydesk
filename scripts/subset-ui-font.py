"""Create the self-hosted Noto Sans JP UI font using an existing FontTools install.

Usage: python scripts/subset-ui-font.py /path/to/NotoSansJP-VF.ttf
The generated asset is committed; Node builds do not need Python or FontTools.
"""
import argparse
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("font", type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    source = "\n".join(
        path.read_text(encoding="utf-8")
        for path in sorted((root / "src").rglob("*"))
        if path.suffix in {".ts", ".tsx", ".css", ".svg"}
    ) + (root / "index.html").read_text(encoding="utf-8")
    required = {ord(char) for char in source if not char.isspace()}
    # Include ASCII, Japanese punctuation/kana, and fullwidth/halfwidth forms
    # as well as every character in the current app's source (including kanji).
    requested = required | set(range(0x20, 0x7F)) | set(range(0x3000, 0x3100)) | set(range(0xFF00, 0xFFF0))
    font = TTFont(args.font, recalcTimestamp=False)
    if font["name"].getDebugName(1) != "Noto Sans JP":
        raise ValueError("Expected the Noto Sans JP variable font")
    missing = required - set(font.getBestCmap())
    if missing:
        raise ValueError("Missing source characters: " + ", ".join(f"U+{code:04X}" for code in sorted(missing)))
    options = subset.Options()
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
    options.name_legacy = True
    options.name_languages = ["*"]
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=requested)
    subsetter.subset(font)
    font.flavor = "woff"  # WOFF uses built-in zlib; no Brotli dependency needed.
    output = root / "src/assets/fonts/noto-sans-jp-ui.woff"
    output.parent.mkdir(parents=True, exist_ok=True)
    font.save(output)
    with TTFont(output) as verified:
        assert required <= set(verified.getBestCmap())
    print(f"Created {output.name}: {output.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
