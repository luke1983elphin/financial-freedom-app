"""Read-only government-source capture. Uses stdlib and inherited HTTPS proxy/trust."""
import concurrent.futures
import hashlib
import json
import pathlib
import urllib.request
from html.parser import HTMLParser

SOURCES = {
    "resident-tax": "https://www.ato.gov.au/tax-rates-and-codes/tax-rates-australian-residents",
    "lito": "https://www.ato.gov.au/tax-rates-and-codes/tax-offsets-low-and-middle-income-earners",
    "help": "https://www.ato.gov.au/tax-rates-and-codes/study-and-training-support-loans-rates-and-repayment-thresholds",
    "super-tax": "https://www.ato.gov.au/individuals-and-families/super-for-individuals-and-families/super/growing-and-keeping-track-of-your-super/tax-on-super-contributions",
    "div293": "https://www.ato.gov.au/individuals-and-families/super-for-individuals-and-families/super/growing-and-keeping-track-of-your-super/tax-on-super-contributions/division-293-tax-on-concessional-contributions-by-high-income-earners",
    "franking": "https://www.ato.gov.au/individuals-and-families/investments-and-assets/shares-funds-and-trusts/shares-and-dividends/dividends",
    "pension-rates": "https://www.servicesaustralia.gov.au/how-much-age-pension-you-can-get?context=22526",
    "pension-assets": "https://www.servicesaustralia.gov.au/assets-test-for-age-pension?context=22526",
    "pension-income": "https://www.servicesaustralia.gov.au/income-test-for-age-pension?context=22526",
    "deeming": "https://www.servicesaustralia.gov.au/deeming?context=22526",
    "super-release": "https://www.ato.gov.au/individuals-and-families/super-for-individuals-and-families/super/withdrawing-and-using-your-super/early-access-to-super/conditions-of-release",
    "lito-current": "https://www.ato.gov.au/tax-rates-and-codes/tax-offsets/low-income-tax-offset",
    "sg": "https://www.ato.gov.au/tax-rates-and-codes/key-superannuation-rates-and-thresholds/super-guarantee",
    "contribution-caps": "https://www.ato.gov.au/tax-rates-and-codes/key-superannuation-rates-and-thresholds/contributions-caps",
    "div293-current": "https://www.ato.gov.au/individuals-and-families/super-for-individuals-and-families/growing-and-keeping-track-of-your-super/caps-limits-and-tax-on-super-contributions/division-293-tax-on-concessional-contributions-by-high-income-earners",
    "dss-history": "https://guides.dss.gov.au/social-security-guide/4/10/3",
    "dss-deeming": "https://guides.dss.gov.au/social-security-guide/4/4/1/10",
    "sapto-law": "https://www.legislation.gov.au/F2025L01060/asmade/2025-09-09/text/original/epub/OEBPS/document_1/document_1.html",
    "deeming-law": "https://www.legislation.gov.au/F2026L01083/asmade/2026-08-21/text/original/epub/OEBPS/document_1/document_1.html",
}

class Visible(HTMLParser):
    def __init__(self):
        super().__init__(); self.skip = 0; self.parts = []
    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"): self.skip += 1
    def handle_endtag(self, tag):
        if tag in ("script", "style"): self.skip = max(0, self.skip - 1)
    def handle_data(self, data):
        if not self.skip and data.strip(): self.parts.append(data.strip())

def fetch(item):
    key, url = item
    try:
        with urllib.request.urlopen(url, timeout=35) as response:
            raw = response.read(); final_url = response.url; status = response.status
        parser = Visible(); parser.feed(raw.decode("utf-8", errors="replace"))
        text = "\n".join(parser.parts)
        # Full visible text is retained locally for review; source hash makes capture identifiable.
        (pathlib.Path('/tmp') / f'ffa-audit-{key}.txt').write_text(text)
        return {"id": key, "url": url, "finalUrl": final_url, "httpStatus": status,
                "contentStatus": "unavailable-page" if "ATO website currently unavailable" in text else "retrieved-not-legally-certified",
                "sha256Html": hashlib.sha256(raw).hexdigest(), "visibleCharacters": len(text),
                "title": parser.parts[0] if parser.parts else "", "retrievedOn": "2026-11-13"}
    except Exception as error:
        return {"id": key, "url": url, "retrievedOn": "2026-11-13", "error": str(error)}

if __name__ == '__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(fetch, SOURCES.items()))
    pathlib.Path(__file__).with_name('source-capture.json').write_text(json.dumps(results, indent=2) + '\n')
    print(json.dumps(results, indent=2))
