import {existsSync} from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
export function extractPdfText(file){
 if(process.env.FFS_PYTHON_EXECUTABLE)return execFileSync(process.env.FFS_PYTHON_EXECUTABLE,['-c','import sys; from pypdf import PdfReader; print("\\n".join(page.extract_text() or "" for page in PdfReader(sys.argv[1]).pages))',file],{encoding:'utf8'});
 return execFileSync('pdftotext',['-layout',file,'-'],{encoding:'utf8'});
}
export function browserExecutable(){
 const candidates=[process.env.FFS_BROWSER_EXECUTABLE,
  ...(process.platform==='win32'?[path.join(process.env.ProgramFiles||'','Microsoft/Edge/Application/msedge.exe'),path.join(process.env['ProgramFiles(x86)']||'','Microsoft/Edge/Application/msedge.exe'),path.join(process.env.ProgramFiles||'','Google/Chrome/Application/chrome.exe')]:['/usr/bin/chromium','/usr/bin/google-chrome','/usr/bin/chromium-browser'])];
 const executable=candidates.find(p=>p&&existsSync(p));
 if(!executable)throw new Error('Browser tests require an installed Edge, Chrome or Chromium browser.');
 return executable;
}
