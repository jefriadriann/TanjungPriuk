export const plates=['B 9322 UOM','B 9794 TM','B 9286 JG','T 9186 DC','B 9628 SYL','E 9318 B','B 9635 JV','B 9275 TZ'];
export const categories=['Pendapatan','Solar','Tol & parkir','Uang jalan','Servis & sparepart','Ban','Oli','Garasi','Administrasi','Biaya lain','Perlu cek'];
export function empty(){return {version:1,revision:0,transactions:[],trips:[],reports:[],fleet:plates.map(plate=>({plate,status:'Belum diperbarui',driver:'',serviceDue:'',documentDue:''})),audit:[]};}
function str(v,n=200){return typeof v==='string'&&v.length<=n;}
function date(v){return str(v,10)&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;}
function money(v){return Number.isSafeInteger(v)&&v>=0&&v<=1e13;}
export function validate(s){
 if(!s||s.version!==1||!Number.isSafeInteger(s.revision)||!['transactions','trips','reports','fleet'].every(k=>Array.isArray(s[k])&&s[k].length<=15000))throw Error('Format data tidak valid.');
 const ids=new Set();
 for(const t of s.transactions){if(!str(t.id,100)||ids.has(t.id)||!plates.includes(t.plate)||!(t.date===null||date(t.date))||!str(t.period,50)||!str(t.description,500)||!['Pemasukan','Pengeluaran'].includes(t.type)||!str(t.category,100)||!str(t.customer)||!Number.isSafeInteger(t.rit)||t.rit<0||t.rit>100000||!(t.income===null||money(t.income))||!(t.expense===null||money(t.expense)))throw Error('Transaksi tidak valid atau ID duplikat.');ids.add(t.id);}
 for(const t of s.trips){if(!str(t.id,100)||ids.has(t.id)||!plates.includes(t.plate)||!date(t.date)||!str(t.customer)||!str(t.driver)||!str(t.origin)||!str(t.destination)||!['Terjadwal','Dalam perjalanan','Selesai','Dibatalkan'].includes(t.status))throw Error('Data trip tidak valid.');ids.add(t.id);}
 for(const r of s.reports){if(!str(r.id,100)||ids.has(r.id)||!date(r.week)||!str(r.notes,3000)||!['Draft','Ditinjau'].includes(r.status))throw Error('Laporan mingguan tidak valid.');ids.add(r.id);}
 if(s.fleet.length!==plates.length||new Set(s.fleet.map(f=>f.plate)).size!==plates.length)throw Error('Daftar armada tidak valid.');
 for(const f of s.fleet)if(!plates.includes(f.plate)||!['Belum diperbarui','Siap jalan','Beroperasi','Servis','Idle'].includes(f.status)||!str(f.driver)||!(f.serviceDue===''||date(f.serviceDue))||!(f.documentDue===''||date(f.documentDue)))throw Error('Detail armada tidak valid.');return s;
}
export function totals(rows){return rows.reduce((a,t)=>({income:a.income+(t.income??0),expense:a.expense+(t.expense??0),rit:a.rit+t.rit}),{income:0,expense:0,rit:0});}
export function issues(t){return !t.date||t.income===null||t.expense===null||t.category==='Perlu cek';}
