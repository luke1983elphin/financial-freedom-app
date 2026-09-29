"""Verify exported browser PDFs using pdfplumber (optional QA dependency)."""
import json, re, sys
from pathlib import Path
import pdfplumber

root = Path(sys.argv[1])
checks = json.loads((root / 'browser-checks.json').read_text(encoding='utf-8'))
normalise = lambda text: re.sub(r'\s+', '', text).replace('\u00a0', '')
results = []
for check in checks:
    with pdfplumber.open(root / (check['name'] + '.pdf')) as pdf:
        pages = [normalise(page.extract_text(use_text_flow=True) or '') for page in pdf.pages]
        content_counts = []
        for number, page in enumerate(pdf.pages, 1):
            # Margin-box footer is intentional; body text must remain above it.
            words = [word for word in page.extract_words() if word['top'] < page.height - 35]
            content_counts.append(len(words))
            assert words, f'Blank content page: {number}'
            for word in words:
                assert word['x0'] >= 32 and word['x1'] <= page.width - 32, (number, 'horizontal text overflow', word)
                assert word['top'] >= 37 and word['bottom'] <= page.height - 43, (number, 'vertical text overflow', word)
            for shape in page.rects:
                if shape['width'] > 20 and shape['height'] > 10:
                    assert shape['x0'] >= 32 and shape['x1'] <= page.width - 32, (number, 'box outside horizontal margins', shape)
                    assert shape['top'] >= 37 and shape['bottom'] <= page.height - 43, (number, 'box outside vertical margins', shape)
        for text in check['layout']['protectedText'] + check['layout']['headings']:
            needle = normalise(text)
            assert any(needle in page for page in pages), ('split or missing protected content', text[:120])
        for pair in check['layout']['headingPairs']:
            assert any(normalise(pair['heading']) in page and normalise(pair['first']) in page for page in pages), ('orphan heading', pair['heading'])
        assert content_counts[-1] >= 100, 'Mostly blank final page'
        results.append({'fixture': check['name'], 'pages': len(pdf.pages), 'protectedComponents':len(check['layout']['protectedText']), 'bodyWordsPerPage':content_counts, 'marginAndSplitChecks':'passed'})
(root / 'pdf-checks.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
print(json.dumps(results, indent=2))
