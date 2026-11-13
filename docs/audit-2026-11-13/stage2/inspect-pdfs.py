"""Run after browser-trace.mjs; inspect actual printed PDF text, not HTML alone."""
import hashlib
import json
import re
import subprocess
from pathlib import Path

root=Path(__file__).parent
browser=json.loads((root/'browser-trace.json').read_text())
rows=[]
for trace in browser['traces']:
    pdf=Path(trace['pdf']['localPath'])
    text=subprocess.check_output(['pdftotext','-layout',str(pdf),'-'],text=True)
    app=trace['base']['year1NetWorth']
    displayed=round(app/1.025)
    rows.append({'case':trace['case'],'pdfSha256':hashlib.sha256(pdf.read_bytes()).hexdigest(),
                 'pdfBytes':pdf.stat().st_size,'firstYearNominalApp':app,
                 'firstYearTodayDisplay':displayed,'independentTodayExpectation':round((2130380 if trace['case']=='TAX-linked' else 268000)/1.025),
                 'renderedAppAmountFoundInPDF':f'{displayed:,}' in text,
                 'debtProjectionZeroFound':bool(re.search(r'Projected debt\s+\$0',text)),
                 'note':'Today-dollar PDF; full PDFs retained in task /tmp. Digest and extracted text check are durable repository evidence.'})
    assert rows[-1]['renderedAppAmountFoundInPDF']
(root/'pdf-checks.json').write_text(json.dumps(rows,indent=2)+'\n')
print(json.dumps(rows,indent=2))
