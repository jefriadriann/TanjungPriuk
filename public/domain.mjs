export const plates=['B 9322 UOM','B 9794 TM','B 9286 JG','T 9186 DC','B 9628 SYL','E 9318 B','B 9635 JV','B 9275 TZ'];
export const incomeCategories=['Bagi Hasil','Pendapatan angkutan','Sewa armada','Pendapatan lain'];
export const expenseCategories=['Uang jalan','Biaya Koordinasi','Servis & sparepart','Ban','Oli','Garasi','Administrasi','Biaya lain','Langganan','Gaji pegawai','Operasional'];
export const legacyExpenseCategories=['Bagi Hasil','Solar / BBM','Tol & parkir','Perlu cek'];
export const transactionCategories=(type,current='')=>{const values=categoriesFor(type);return type==='Pengeluaran'&&legacyExpenseCategories.includes(categoryLabel(current))?[categoryLabel(current),...values]:values;};
export const months=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
export const categoriesFor=type=>type==='Pemasukan'?incomeCategories:expenseCategories;
export const categoryLabel=c=>c==='Pemasukan'?'Pendapatan angkutan':c==='Bagi hasil'?'Bagi Hasil':c==='Uang Jalan'?'Uang jalan':c==='Service & Sparepart'?'Servis & sparepart':c==='Lainnya'?'Biaya lain':c==='Pendapatan'?'Pendapatan angkutan':c==='Solar'?'Solar / BBM':c;
export const clientKey=v=>{const key=String(v||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('id-ID');return ['sinergi','pt. sinergi bahtera mitra','pt sinergi bahtera mitra','sinergi bahtera mitra'].includes(key)?'sinergi':['giant','giant transporter','giant transporter indonesia','pt giant transporter indonesia','pt. giant transporter indonesia'].includes(key)?'giant transporter indonesia':key;};
export const clientName=v=>clientKey(v)==='sinergi'?'PT. Sinergi Bahtera Mitra':clientKey(v)==='giant transporter indonesia'?'Giant Transporter Indonesia':String(v||'').trim();
export function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function monthLabel(k){if(!/^\d{4}-\d{2}$/.test(k))return k;return `${months[Number(k.slice(5))-1]} ${k.slice(0,4)}`;}
export function periodKey(period){const p=String(period||'').trim();const i=months.findIndex(m=>new RegExp('^'+m+' \\d{4}$','i').test(p));return i<0?null:p.slice(-4)+'-'+String(i+1).padStart(2,'0');}
export function monthKey(t){return t.date?t.date.slice(0,7):periodKey(t.period);}
export const dateIssue=t=>Boolean(t.date&&(t.date>today()||(periodKey(t.period)&&periodKey(t.period)!==t.date.slice(0,7))));
export function defaultReportMonth(state){return availableMonths(state).filter(k=>k<=today().slice(0,7)).at(-1)||today().slice(0,7);}
export function previousMonth(k){const d=new Date(k+'-01T00:00:00Z');d.setUTCMonth(d.getUTCMonth()-1);return d.toISOString().slice(0,7);}
export function totals(rows){return rows.reduce((a,t)=>({income:a.income+(t.income??0),expense:a.expense+(t.expense??0),rit:a.rit+(t.type==='Pemasukan'?(t.rit||0):0),count:a.count+1,missing:a.missing+Number(t.income===null||t.expense===null)}),{income:0,expense:0,rit:0,count:0,missing:0});}
export const issues=t=>dateIssue(t)||!t.date||t.income===null||t.expense===null||t.category==='Perlu cek'||(t.type==='Pemasukan'&&!clientKey(t.customer));
export function selectRows(state,{month='all',plate='all',client='all'}={}){return state.transactions.filter(t=>(month==='all'||month==='unassigned'&&!monthKey(t)||monthKey(t)===month)&&(plate==='all'||!isSharedTransaction(t)&&t.plate===plate)&&(client==='all'||clientKey(t.customer)===client));}
// Business revenue is global even when older imports retained a vehicle identifier.
export function selectBookRows(state,{month='all',plate='all',client='all'}={}){return selectRows(state,{month,client}).filter(t=>plate==='all'||(!isSharedTransaction(t)&&t.plate===plate));}
export const isSharedTransaction=t=>!t.allocationSourceId&&(t.type==='Pemasukan'&&categoryLabel(t.category)!=='Bagi Hasil'||t.type==='Pengeluaran'&&['Operasional','Gaji pegawai'].includes(categoryLabel(t.category)));
export const isFleetTransaction=t=>(isProfitShare(t)||t.type==='Pengeluaran')&&!isSharedTransaction(t)&&categoryLabel(t.category)!=='Uang jalan';
export function fleetLedgerRows(rows){return rows.filter(isFleetTransaction).map(t=>isProfitShare(t)&&t.type==='Pengeluaran'?{...t,type:'Pemasukan',income:t.expense,expense:0}:{...t,rit:0});}
export function availableMonths(state){return [...new Set(state.transactions.map(monthKey).filter(Boolean))].sort();}
export function clientSummary(rows,masters=[]){const map=new Map();for(const c of masters)map.set(clientKey(c.name),{key:clientKey(c.name),name:clientName(c.name),rows:[],plates:new Set()});for(const t of rows){if(!clientKey(t.customer))continue;const key=clientKey(t.customer);if(!map.has(key))map.set(key,{key,name:clientName(t.customer),rows:[],plates:new Set()});const c=map.get(key);c.rows.push(t);if(t.plate&&!isSharedTransaction(t))c.plates.add(t.plate);}return [...map.values()].map(c=>({...c,...totals(c.rows),plates:[...c.plates],incomeRows:c.rows.filter(t=>t.type==='Pemasukan').length})).sort((a,b)=>b.income-a.income||a.name.localeCompare(b.name));}
export function weeklyRows(state,week){const end=new Date(week+'T00:00:00Z');end.setUTCDate(end.getUTCDate()+7);return state.transactions.filter(t=>t.date&&t.date>=week&&t.date<end.toISOString().slice(0,10));}
export function empty(){return {version:1,revision:0,transactions:[],trips:[],reports:[],clients:[],monthlyReports:[],fleet:plates.map(plate=>({plate,status:'Belum diperbarui',driver:'',serviceDue:'',documentDue:''})),audit:[]};}
export const monthlyReportKey=r=>r.month+'|'+(r.plate||'all');
export const isCoordinationExpense=t=>t.type==='Pengeluaran'&&/\btap\s*75\b/i.test(String(t.description||''));
export const canonicalPlate=p=>p==='B 9186 JG'?'B 9286 JG':p;
export const displayPlate=p=>!p||p==='all'?'Semua armada':p==='B 9286 JG'?'B 9186 JG':p;
export const isProfitShare=t=>['Pemasukan','Pengeluaran'].includes(t.type)&&categoryLabel(t.category)==='Bagi Hasil';
export const isTravelCash=t=>t.type==='Pengeluaran'&&categoryLabel(t.category)==='Uang jalan'&&t.expense>0;
export const recordedRit=rows=>rows.filter(isProfitShare).reduce((n,t)=>n+(t.rit||0),0);
export function fleetTotals(rows){const shares=rows.filter(isProfitShare),costs=rows.filter(t=>isFleetTransaction(t)&&!isProfitShare(t));return {income:shares.reduce((n,t)=>n+((t.type==='Pemasukan'?t.income:t.expense)||0),0),expense:totals(costs).expense,rit:recordedRit(rows)};}
export function normalize(s){return {...s,transactions:Array.isArray(s.transactions)?s.transactions.map(t=>isCoordinationExpense(t)&&t.category==='Perlu cek'?{...t,category:'Biaya Koordinasi'}:t):s.transactions,clients:s.clients||[],monthlyReports:s.monthlyReports||[],audit:s.audit||[]};}
function str(v,n=200){return typeof v==='string'&&v.length<=n;}
function date(v){return str(v,10)&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;}
function money(v){return Number.isSafeInteger(v)&&v>=0&&v<=1e13;}
export const fleetPlates=s=>Array.isArray(s?.fleet)?s.fleet.map(f=>f.plate):[...plates];
export function normalizePlate(value){const raw=String(value||'').toUpperCase().trim().replace(/\s+/g,'');const m=raw.match(/^([A-Z]{1,2})([0-9]{1,4})([A-Z]{1,3})$/);return m?canonicalPlate(m[1]+' '+m[2]+' '+m[3]):'';}
export const validPlate=p=>typeof p==='string'&&p.length<=15&&normalizePlate(p)===p&&p!=='';
export function addFleetVehicle(state,value,status='Belum diperbarui'){const plate=normalizePlate(value);if(!plate)throw Error('Isi plat nomor yang valid. Contoh: B 1234 ABC.');if(fleetPlates(state).includes(plate))throw Error('Armada dengan plat nomor ini sudah terdaftar.');const next=structuredClone(state);next.fleet.push({plate,status,driver:'',serviceDue:'',documentDue:''});validate(next);return next;}
export function validate(s){
 if(!s||s.version!==1||!Number.isSafeInteger(s.revision)||s.revision<0||!['transactions','trips','reports','fleet'].every(k=>Array.isArray(s[k])&&s[k].length<=15000))throw Error('Format data tidak valid.');
 const vehiclePlates=fleetPlates(s);if(!vehiclePlates.length||vehiclePlates.length>1000||vehiclePlates.some(p=>!validPlate(p))||new Set(vehiclePlates).size!==vehiclePlates.length)throw Error('Daftar armada tidak valid.');
 const ids=new Set();const take=id=>{if(!str(id,100)||!id||ids.has(id))throw Error('ID kosong atau duplikat.');ids.add(id);};
 for(const t of s.transactions){take(t.id);if(!(vehiclePlates.includes(t.plate)||isSharedTransaction(t)&&['','all'].includes(t.plate))||!(t.date===null||date(t.date))||!str(t.period,50)||!str(t.description,500)||!['Pemasukan','Pengeluaran'].includes(t.type)||![...categoriesFor(t.type),...(t.type==='Pengeluaran'?legacyExpenseCategories:[])].includes(categoryLabel(t.category))||!str(t.customer)||!Number.isSafeInteger(t.rit)||t.rit<0||t.rit>100000||!(t.income===null||money(t.income))||!(t.expense===null||money(t.expense))||(t.type==='Pemasukan'&&t.expense!==0)||(t.type==='Pengeluaran'&&t.income!==0))throw Error('Transaksi tidak valid. Pastikan kategori sesuai jenis dan nominal tidak negatif.');}
 for(const t of s.trips){take(t.id);if(!vehiclePlates.includes(t.plate)||!date(t.date)||!str(t.customer)||!str(t.driver)||!str(t.origin)||!str(t.destination)||!['Terjadwal','Dalam perjalanan','Selesai','Dibatalkan'].includes(t.status))throw Error('Data trip tidak valid.');}
 for(const r of s.reports){take(r.id);if(!date(r.week)||!str(r.notes,3000)||!['Draft','Ditinjau'].includes(r.status))throw Error('Laporan mingguan tidak valid.');}
 for(const f of s.fleet)if(!vehiclePlates.includes(f.plate)||!['Belum diperbarui','Siap jalan','Beroperasi','Servis','Idle'].includes(f.status)||!str(f.driver)||!(f.serviceDue===''||date(f.serviceDue))||!(f.documentDue===''||date(f.documentDue)))throw Error('Detail armada tidak valid.');
 if(s.clients!==undefined){if(!Array.isArray(s.clients)||s.clients.length>1000)throw Error('Daftar klien tidak valid.');const keys=new Set();for(const c of s.clients){take(c.id);const key=clientKey(c.name);if(!key||keys.has(key)||!str(c.name)||!str(c.contact)||!str(c.notes,2000))throw Error('Klien tidak valid atau nama duplikat.');keys.add(key);}}
 if(s.monthlyReports!==undefined){if(!Array.isArray(s.monthlyReports)||s.monthlyReports.length>1200)throw Error('Laporan bulanan tidak valid.');const keys=new Set();for(const r of s.monthlyReports){take(r.id);if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(r.month)||keys.has(monthlyReportKey(r))||!(r.plate===undefined||r.plate==='all'||vehiclePlates.includes(r.plate))||!str(r.notes,3000)||!str(r.preparedBy)||!['Draft','Ditinjau'].includes(r.status))throw Error('Laporan bulanan tidak valid.');keys.add(monthlyReportKey(r));}}
 return s;
}
