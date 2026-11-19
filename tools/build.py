"""Builds deploy/ from src/: every non-ASCII character is escaped so copy-paste
(or renaming to .txt) can never corrupt the Hebrew. Run: python tools/build.py"""
import pathlib, re
root = pathlib.Path(__file__).resolve().parent.parent
js = lambda s: ''.join(c if ord(c) < 128 else '\\u%04X' % ord(c) for c in s)
html = lambda s: ''.join(c if ord(c) < 128 else '&#x%04X;' % ord(c) for c in s)
(root / 'deploy').mkdir(exist_ok=True)
code = (root / 'src' / 'Code.gs').read_text(encoding='utf-8')
(root / 'deploy' / 'Code.gs').write_text(js(code), encoding='ascii')
idx = (root / 'src' / 'Index.html').read_text(encoding='utf-8')
parts = re.split(r'(<script>.*?</script>)', idx, flags=re.S)
(root / 'deploy' / 'Index.html').write_text(''.join(js(p) if p.startswith('<script>') else html(p) for p in parts), encoding='ascii')
print('deploy/ rebuilt (ASCII only)')
