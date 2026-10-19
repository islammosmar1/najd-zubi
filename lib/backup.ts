export const backupTables=['products','product_costs','store_settings','orders','customers','coupons','couriers','return_requests','wholesale_accounts','wholesale_prices','reviews','admins','ai_config'] as const;
async function checksum(value:unknown){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)));return Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('')}
export async function makeBackup(tables:Record<string,unknown[]>){for(const table of backupTables)if(!Array.isArray(tables[table]))throw Error('Missing table: '+table);return {format:'najd-backup-v3',created_at:new Date().toISOString(),tables,checksum:await checksum(tables)}}
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
export async function verifyBackup(value:unknown){
 if(!record(value)||value.format!=='najd-backup-v3'||!record(value.tables)||typeof value.checksum!=='string'||typeof value.created_at!=='string')throw Error('نسخة غير مدعومة؛ استخدمي تصدير v3 / Unsupported backup format');
 let count=0;
 for(const table of backupTables){
  const rows=value.tables[table];if(!Array.isArray(rows)||!rows.every(record))throw Error('Invalid table: '+table);
  const ids=rows.map(r=>r.id);if(ids.some(id=>!(typeof id==='string'&&id.length>0)&&!(typeof id==='number'&&Number.isFinite(id)))||new Set(ids).size!==ids.length)throw Error('Invalid or duplicate identifiers: '+table);
  count+=rows.length;
 }
 if(await checksum(value.tables)!==value.checksum)throw Error('الملف تغير أو تالف / Backup checksum mismatch');
 return {tables:backupTables.length,rows:count,created_at:value.created_at};
}
