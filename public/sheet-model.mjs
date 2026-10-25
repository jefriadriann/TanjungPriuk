import {categoriesFor,categoryLabel,normalize,validate,monthLabel} from './domain.mjs';
export const sheetFields=['date','description','income','expense'];
export function draftRows(state){return state.transactions.map(t=>({...structuredClone(t),date:t.date||'',category:categoryLabel(t.category),income:t.type==='Pemasukan'?(t.income===null?'':String(t.income)):'',expense:t.type==='Pengeluaran'?(t.expense===null?'':String(t.expense)):''}));}
export function sheetPeriod(row){return row.period|| (row.date&&/^\d{4}-\d{2}-\d{2}$/.test(row.date)?monthLabel(row.date.slice(0,7)):'Periode belum diisi');}
export function rowType(row){return String(row.income).trim()!==''?'Pemasukan':String(row.expense).trim()!==''?'Pengeluaran':row.type||'Pengeluaran';}
export function parseMoney(value){const raw=String(value??'').trim().replace(/^Rp\s*/i,'').replace(/\s/g,'');if(!raw)return null;let digits=raw;if(/^\d{1,3}(\.\d{3})+$/.test(raw))digits=raw.replaceAll('.','');else if(/^\d{1,3}(,\d{3})+$/.test(raw))digits=raw.replaceAll(',','');if(!/^\d+$/.test(digits)||!Number.isSafeInteger(Number(digits))||Number(digits)>1e13)throw Error('Isi rupiah bulat, tanpa minus. Contoh: 150000 atau 150.000.');return Number(digits);}
export function parseSheetDate(raw){const value=String(raw||'').trim();if(!value)return null;let iso=value;const match=value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);if(match)iso=match[3]+'-'+match[2].padStart(2,'0')+'-'+match[1].padStart(2,'0');if(!/^\d{4}-\d{2}-\d{2}$/.test(iso)||isNaN(Date.parse(iso))||new Date(iso).toISOString().slice(0,10)!==iso)throw Error('Tanggal tidak valid. Gunakan DD/MM/YYYY atau YYYY-MM-DD.');return iso;}
export function displaySheetDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value)?value.slice(8)+'/'+value.slice(5,7)+'/'+value.slice(0,4):value;}
export function blankRow(plate,period,id){return {id,plate,date:'',period,description:'',income:'',expense:'',type:'Pengeluaran',category:'Perlu cek',customer:'',rit:0,isNew:true};}
export function rowUnused(row){return row.isNew&&!row.date.trim()&&!row.description.trim()&&!String(row.income).trim()&&!String(row.expense).trim()&&!row.customer.trim()&&!Number(row.rit);}
export function compileSheet(state,rows,baseRevision){
 if(state.revision!==baseRevision)return {errors:[{message:'Data berubah sejak lembar dibuka. Salin perubahanmu dulu, lalu batalkan draft dan buka ulang.'}]};
 const errors=[],transactions=[];
 for(const row of rows){if(rowUnused(row))continue;const problem=(field,message)=>errors.push({id:row.id,plate:row.plate,field,message});let income=null,expense=null,date=null;
  try{income=parseMoney(row.income);}catch(e){problem('income',e.message);}try{expense=parseMoney(row.expense);}catch(e){problem('expense',e.message);}try{date=parseSheetDate(row.date);}catch(e){problem('date',e.message);}
  if(income!==null&&expense!==null)problem('income','Isi Masuk atau Keluar pada satu baris, jangan keduanya. Pisahkan menjadi dua baris.');
  if(row.isNew&&income===null&&expense===null)problem('expense','Isi nominal Masuk atau Keluar.');
  if(!row.description.trim())problem('description','Keterangan wajib diisi.');
  const type=rowType(row),category=categoryLabel(row.category);
  if(!categoriesFor(type).includes(category))problem('category','Pilih kategori yang sesuai pemasukan/pengeluaran di detail baris.');
  if(row.isNew&&type==='Pemasukan'&&!row.customer.trim())problem('customer','Isi klien untuk pemasukan baru di detail baris.');
  const rit=Number(row.rit);if(!Number.isSafeInteger(rit)||rit<0||rit>100000)problem('rit','Rit harus bilangan bulat 0–100000.');
  if(!row.period.trim()||row.period.length>50)problem('period','Isi periode di detail baris, maksimal 50 karakter.');
  const {isNew,...stored}=row;
  transactions.push({...stored,date,description:row.description.trim(),type,category,customer:row.customer.trim(),rit,income:type==='Pemasukan'?income:0,expense:type==='Pengeluaran'?expense:0});
 }
 if(errors.length)return {errors};
 const next=normalize({...structuredClone(state),transactions});
 try{validate(next);}catch(e){return {errors:[{message:e.message}]};}
 return {state:next,errors:[]};
}
export function pasteCells(rows,startId,startField,text,plate,period,makeId){
 const normalized=text.replace(/\r\n?/g,'\n').replace(/\n$/,'');const matrix=normalized.split('\n').map(line=>line.split('\t'));
 if(matrix.length>500||matrix.some(line=>line.length>5))throw Error('Tempel maksimal 500 baris dan 5 kolom sekaligus.');
 const output=structuredClone(rows),visible=output.filter(r=>r.plate===plate&&sheetPeriod(r)===period);const start=visible.findIndex(r=>r.id===startId);if(start<0)throw Error('Baris tujuan tidak ditemukan.');
 const firstCol=sheetFields.indexOf(startField);if(firstCol<0)throw Error('Pilih sel Tanggal, Keterangan, Masuk, atau Keluar.');
 for(let i=0;i<matrix.length;i++){
  let cells=matrix[i];let col=firstCol;
  // A full five-column Excel row includes the computed No column; ignore its value.
  if(firstCol===0&&cells.length===5)cells=cells.slice(1);
  if(col+cells.length>sheetFields.length)throw Error('Data melewati kolom Keluar. Mulai tempel dari kolom yang sesuai.');
  let row=visible[start+i];if(!row){row=blankRow(plate,period,makeId());output.push(row);visible.push(row);}
  for(const value of cells){row[sheetFields[col]]=value;col++;}
  const type=rowType(row);if(type==='Pengeluaran'&&row.type==='Pemasukan')row.rit=0;row.type=type;if(!categoriesFor(type).includes(row.category))row.category=type==='Pemasukan'?'Pendapatan angkutan':'Perlu cek';
 }
 return output;
}
