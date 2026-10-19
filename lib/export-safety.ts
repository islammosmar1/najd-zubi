/** Neutralize spreadsheet formulas even after whitespace/control characters. */
export function spreadsheetCell(value:unknown):unknown{
 return typeof value==='string'&&/^[\s\u0000-\u001f]*[=+@-]/u.test(value)?"'"+value:value;
}
