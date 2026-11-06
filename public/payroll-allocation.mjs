import {fleetPlates,isFleetTransaction,isProfitShare,categoryLabel,monthKey,selectRows} from './domain.mjs';
// Compute full-month pre-payroll profits first, then filter the derived report.
// Integer remainder allocation conserves every rupiah without rounding drift.
export function allocatePayroll(state){
 const units=fleetPlates(state),base=state.transactions.filter(t=>isFleetTransaction(t)&&!t.allocationSourceId),allocated=[],pending=[],basis=new Map();
 const salaries=state.transactions.filter(t=>t.type==='Pengeluaran'&&categoryLabel(t.category)==='Gaji pegawai');
 for(const salary of salaries){const period=monthKey(salary);if(!period){pending.push({sourceId:salary.id,amount:salary.expense,period:null,reason:'Periode gaji belum jelas'});continue;}
  if(!basis.has(period)){
   const profits=new Map(units.map(p=>[p,0n]));let incomplete=false;
   for(const row of base.filter(t=>monthKey(t)===period)){if(!profits.has(row.plate))continue;const amount=row.type==='Pemasukan'?row.income:row.expense;if(amount===null){incomplete=true;continue;}profits.set(row.plate,profits.get(row.plate)+(isProfitShare(row)?1n:-1n)*BigInt(amount));}
   const weights=units.map(plate=>({plate,profit:profits.get(plate)>0n?profits.get(plate):0n}));basis.set(period,{weights,total:weights.reduce((n,w)=>n+w.profit,0n),incomplete});
  }
  const {weights,total,incomplete}=basis.get(period);if(salary.expense===null||incomplete||total===0n){pending.push({sourceId:salary.id,amount:salary.expense,period,reason:salary.expense===null?'Nominal gaji belum diisi':incomplete?'Nominal biaya atau bagi hasil belum lengkap':'Belum ada mobil berlaba pada bulan ini'});continue;}
  const amount=BigInt(salary.expense),shares=weights.filter(w=>w.profit>0n).map(w=>({...w,amount:amount*w.profit/total,remainder:amount*w.profit%total}));let remainder=amount-shares.reduce((n,s)=>n+s.amount,0n);
  shares.sort((a,b)=>a.remainder===b.remainder?a.plate.localeCompare(b.plate):a.remainder>b.remainder?-1:1);for(const share of shares){if(remainder>0n){share.amount++;remainder--;}}
  for(const share of shares){if(!share.amount)continue;const fraction=Number(share.profit)/Number(total),percent=(fraction*100).toLocaleString('id-ID',{maximumFractionDigits:4});allocated.push({...salary,id:'payroll:'+salary.id+':'+share.plate,allocationSourceId:salary.id,plate:share.plate,income:0,expense:Number(share.amount),rit:0,description:salary.description+' · Alokasi gaji '+percent+'%',salaryAllocation:{period,fraction,profitBeforeSalary:Number(share.profit),totalPositiveProfit:Number(total)}});}
 }
 return {allocated,pending};
}
export function buildFleetReport(state,{month='all',plate='all'}={}){const {allocated,pending}=allocatePayroll(state);const source=selectRows(state,{month,plate}).filter(isFleetTransaction),payroll=selectRows({transactions:allocated},{month,plate});return {rows:[...source,...payroll],pending:pending.filter(p=>month==='all'||month==='unassigned'&&!p.period||p.period===month)};}
