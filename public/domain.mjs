export const plates=['B 9322 UOM','B 9794 TM','B 9286 JG','T 9186 DC','B 9628 SYL','E 9318 B','B 9635 JV','B 9275 TZ'];
export const incomeCategories=['Pendapatan angkutan','Sewa armada','Pendapatan lain'];
export const expenseCategories=['Solar / BBM','Tol & parkir','Uang jalan','Servis & sparepart','Ban','Oli','Garasi','Administrasi','Biaya lain','Perlu cek'];
export const months=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
export const categoriesFor=type=>type==='Pemasukan'?incomeCategories:expenseCategories;
export const categoryLabel=c=>c==='Pendapatan'?'Pendapatan angkutan':c==='Solar'?'Solar / BBM':c;
export const clientKey=v=>String(v||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('id-ID');
export function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function monthLabel(k){if(!/^\d{4}-\d{2}$/.test(k))return k;return `${months[Number(k.slice(5))-1]} ${k.slice(0,4)}`;}
export function periodKey(period){const p=String(period||'').trim();const i=months.findIndex(m=>new RegExp('^'+m+' \\d{4}$','i').test(p));return i<0?null:p.slice(-4)+'-'+String(i+1).padStart(2,'0');}
export function monthKey(t){return t.date?t.date.slice(0,7):periodKey(t.period);}
export const dateIssue=t=>Boolean(t.date&&(t.date>today()||(periodKey(t.period)&&periodKey(t.period)!==t.date.slice(0,7))));
export function defaultReportMonth(state){return availableMonths(state).filter(k=>k<=today().slice(0,7)).at(-1)||today().slice(0,7);}
export function previousMonth(k){const d=new Date(k+'-01T00:00:00Z');d.setUTCMonth(d.getUTCMonth()-1);return d.toISOString().slice(0,7);}
export function totals(rows){return rows.reduce((a,t)=>({income:a.income+(t.income??0),expense:a.expense+(t.expense??0),rit:a.rit+(t.rit||0),count:a.count+1,missing:a.missing+Number(t.income===null||t.expense===null)}),{income:0,expense:0,rit:0,count:0,missing:0});}
export const issues=t=>dateIssue(t)||!t.date||t.income===null||t.expense===null||t.category==='Perlu cek'||(t.type==='Pemasukan'&&!clientKey(t.customer));
export function selectRows(state,{month='all',plate='all',client='all'}={}){return state.transactions.filter(t=>(month==='all'||month==='unassigned'&&!monthKey(t)||monthKey(t)===month)&&(plate==='all'||t.plate===plate)&&(client==='all'||clientKey(t.customer)===client));}
export function availableMonths(state){return [...new Set(state.transactions.map(monthKey).filter(Boolean))].sort();}
export function clientSummary(rows,masters=[]){const map=new Map();for(const c of masters)map.set(clientKey(c.name),{key:clientKey(c.name),name:c.name,rows:[],plates:new Set()});for(const t of rows){if(!clientKey(t.customer))continue;const key=clientKey(t.customer);if(!map.has(key))map.set(key,{key,name:t.customer.trim(),rows:[],plates:new Set()});const c=map.get(key);c.rows.push(t);c.plates.add(t.plate);}return [...map.values()].map(c=>({...c,...totals(c.rows),plates:[...c.plates],incomeRows:c.rows.filter(t=>t.type==='Pemasukan').length})).sort((a,b)=>b.income-a.income||a.name.localeCompare(b.name));}
export function weeklyRows(state,week){const end=new Date(week+'T00:00:00Z');end.setUTCDate(end.getUTCDate()+7);return state.transactions.filter(t=>t.date&&t.date>=week&&t.date<end.toISOString().slice(0,10));}
export function empty(){return {version:1,revision:0,transactions:[],trips:[],reports:[],clients:[],monthlyReports:[],fleet:plates.map(plate=>({plate,status:'Belum diperbarui',driver:'',serviceDue:'',documentDue:''})),audit:[]};}
export function normalize(s){return {...s,clients:s.clients||[],monthlyReports:s.monthlyReports||[],audit:s.audit||[]};}
function str(v,n=200){return typeof v==='string'&&v.length<=n;}
function date(v){return str(v,10)&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;}
function money(v){return Number.isSafeInteger(v)&&v>=0&&v<=1e13;}
export function validate(s){
 if(!s||s.version!==1||!Number.isSafeInteger(s.revision)||s.revision<0||!['transactions','trips','reports','fleet'].every(k=>Array.isArray(s[k])&&s[k].length<=15000))throw Error('Format data tidak valid.');
 const ids=new Set();const take=id=>{if(!str(id,100)||!id||ids.has(id))throw Error('ID kosong atau duplikat.');ids.add(id);};
 for(const t of s.transactions){take(t.id);if(!plates.includes(t.plate)||!(t.date===null||date(t.date))||!str(t.period,50)||!str(t.description,500)||!['Pemasukan','Pengeluaran'].includes(t.type)||!categoriesFor(t.type).includes(categoryLabel(t.category))||!str(t.customer)||!Number.isSafeInteger(t.rit)||t.rit<0||t.rit>100000||!(t.income===null||money(t.income))||!(t.expense===null||money(t.expense))||(t.type==='Pemasukan'&&t.expense!==0)||(t.type==='Pengeluaran'&&t.income!==0))throw Error('Transaksi tidak valid. Pastikan kategori sesuai jenis dan nominal tidak negatif.');}
 for(const t of s.trips){take(t.id);if(!plates.includes(t.plate)||!date(t.date)||!str(t.customer)||!str(t.driver)||!str(t.origin)||!str(t.destination)||!['Terjadwal','Dalam perjalanan','Selesai','Dibatalkan'].includes(t.status))throw Error('Data trip tidak valid.');}
 for(const r of s.reports){take(r.id);if(!date(r.week)||!str(r.notes,3000)||!['Draft','Ditinjau'].includes(r.status))throw Error('Laporan mingguan tidak valid.');}
 if(s.fleet.length!==plates.length||new Set(s.fleet.map(f=>f.plate)).size!==plates.length)throw Error('Daftar armada tidak valid.');
 for(const f of s.fleet)if(!plates.includes(f.plate)||!['Belum diperbarui','Siap jalan','Beroperasi','Servis','Idle'].includes(f.status)||!str(f.driver)||!(f.serviceDue===''||date(f.serviceDue))||!(f.documentDue===''||date(f.documentDue)))throw Error('Detail armada tidak valid.');
 if(s.clients!==undefined){if(!Array.isArray(s.clients)||s.clients.length>1000)throw Error('Daftar klien tidak valid.');const keys=new Set();for(const c of s.clients){take(c.id);const key=clientKey(c.name);if(!key||keys.has(key)||!str(c.name)||!str(c.contact)||!str(c.notes,2000))throw Error('Klien tidak valid atau nama duplikat.');keys.add(key);}}
 if(s.monthlyReports!==undefined){if(!Array.isArray(s.monthlyReports)||s.monthlyReports.length>1200)throw Error('Laporan bulanan tidak valid.');const keys=new Set();for(const r of s.monthlyReports){take(r.id);if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(r.month)||keys.has(r.month)||!str(r.notes,3000)||!str(r.preparedBy)||!['Draft','Ditinjau'].includes(r.status))throw Error('Laporan bulanan tidak valid.');keys.add(r.month);}}
 return s;
}
