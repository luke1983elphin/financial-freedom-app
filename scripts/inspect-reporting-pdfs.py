"""Render every generated PDF page and make review sheets; inspect text bounds."""
import json, sys
from pathlib import Path
import pypdfium2 as pdfium
import pdfplumber
from PIL import Image, ImageOps, ImageDraw

folder = Path(sys.argv[1])
results = []
for file in folder.glob('*.pdf'):
    doc = pdfium.PdfDocument(str(file))
    thumbs = []
    with pdfplumber.open(file) as textdoc:
        for i, page in enumerate(doc):
            im = page.render(scale=1.4).to_pil().convert('RGB')
            im.save(folder / f'{file.stem}-page{i+1}.png')
            thumb = ImageOps.contain(im, (300, 410))
            tile = Image.new('RGB', (320, 440), 'white')
            tile.paste(thumb, ((320-thumb.width)//2, 20))
            ImageDraw.Draw(tile).text((10, 425), f'{file.stem} / {i+1}', fill='black')
            thumbs.append(tile)
        pages = textdoc.pages
        results.append({'file':file.name, 'pages':len(pages), 'sizes':sorted(set((p.width,p.height) for p in pages)),
            'opening':pages[0].extract_text()[:160],
            'textOutsidePage':sum(1 for p in pages for c in p.chars if c['x0'] < 0 or c['x1'] > p.width+1 or c['top'] < 0 or c['bottom'] > p.height+1),
            'pageTextLengths':[len(p.extract_text()) for p in pages]})
    for start in range(0,len(thumbs),12):
        batch=thumbs[start:start+12]
        sheet=Image.new('RGB',(320*3,440*((len(batch)+2)//3)), '#cccccc')
        for i,tile in enumerate(batch): sheet.paste(tile,((i%3)*320,(i//3)*440))
        sheet.save(folder/f'{file.stem}-review-{start//12+1}.png')
(folder/'pdf-inspection.json').write_text(json.dumps(results,indent=2))
print(json.dumps(results,indent=2))
