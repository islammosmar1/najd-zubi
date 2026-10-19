import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const js=ts.transpileModule(fs.readFileSync('lib/export-safety.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {spreadsheetCell}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
for(const text of ['=1+1','+SUM(1,1)','@SUM(1,1)','-1+1','\t=1+1','\r\n+1','  =HYPERLINK("https://example.com")'])assert.equal(spreadsheetCell(text),"'"+text);
for(const value of ['شنطة','safe name',25,-10,null])assert.equal(spreadsheetCell(value),value);
console.log('PASS spreadsheet formula injection including whitespace/control prefixes; exact data preserved.');
