"""Convert only Query1 to a private application import. Requires openpyxl."""
import sys,json,hashlib,re,datetime,collections
from pathlib import Path
import openpyxl
src,out=map(Path,sys.argv[1:3]);sheet=openpyxl.load_workbook(src,data_only=True)['Query1']
headers=[c.value for c in sheet[1]]
if headers!=['Tanggal','Keterangan','Masuk (Rp)','Keluar (Rp)','Kategori','Plat No','SumberTabel']:raise ValueError('Kolom Query1 tidak sesuai')
plates=['B 9322 UOM','B 9794 TM','B 9286 JG','T 9186 DC','B 9628 SYL','E 9318 B','B 9635 JV','B 9275 TZ']
months=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
categories={'Pemasukan':'Pendapatan angkutan','Service & Sparepart':'Servis & sparepart','Uang Jalan':'Uang jalan','Lainnya':'Biaya lain'}
state={'version':1,'revision':0,'transactions':[],'trips':[],'reports':[],'clients':[],'monthlyReports':[],'fleet':[{'plate':p,'status':'Belum diperbarui','driver':'','serviceDue':'','documentDue':''}for p in plates],'audit':[],'sourceUpdates':{'query1':True,'version':'query1-v1','sha256':hashlib.sha256(src.read_bytes()).hexdigest()}}
seen=collections.Counter()
for n,values in enumerate(sheet.iter_rows(min_row=2,values_only=True),2):
 if all(v is None for v in values):continue
 date,description,income,expense,category,plate,table=values
 if not isinstance(date,(datetime.date,datetime.datetime)):raise ValueError(f'Tanggal Query1 baris {n} tidak valid')
 plate=str(plate).strip();plate='B 9286 JG' if plate=='B 9186 JG' else plate
 if plate not in plates:raise ValueError(f'Armada Query1 baris {n} tidak dikenal')
 def money(v):
  if v is None:return 0
  if not isinstance(v,(int,float)) or v<0 or int(v)!=v:raise ValueError(f'Nominal Query1 baris {n} tidak valid')
  return int(v)
 income,expense=money(income),money(expense)
 if income and expense:raise ValueError(f'Pisahkan Masuk/Keluar baris {n}')
 kind='Pemasukan' if income or category=='Pemasukan' else 'Pengeluaran'
 description=str(description or '').strip();category=categories.get(category,category)
 rit=int(m.group(1)) if (m:=re.search(r'(\d+)\s*rit\b',description,re.I)) else 0
 customer=''
 if kind=='Pemasukan' or category=='Bagi Hasil':
  m=re.search(r'(?:Pemasukan|Bagi\s+Hasil)\s+(.+?)\s+\d+\s*Rit\b',description,re.I)
  if m:customer=m.group(1).strip()
 row={'plate':plate,'date':date.strftime('%Y-%m-%d'),'period':f'{months[date.month-1]} {date.year}','description':description,'type':kind,'category':category,'customer':customer,'rit':rit,'income':income,'expense':expense}
 signature=json.dumps(row,sort_keys=True);seen[signature]+=1
 row['id']='query1-'+hashlib.sha256((signature+'|'+str(seen[signature])).encode()).hexdigest()[:24]
 row['source']={'sheet':'Query1','row':n,'table':table}
 state['transactions'].append(row)
for customer in sorted({t['customer'] for t in state['transactions'] if t['customer']}):state['clients'].append({'id':'client-'+hashlib.sha256(customer.lower().encode()).hexdigest()[:24],'name':customer,'contact':'','notes':''})
out.write_text(json.dumps(state,ensure_ascii=False));out.chmod(0o600)
print(json.dumps({'rows':len(state['transactions']),'income':sum(t['income']for t in state['transactions']),'expense':sum(t['expense']for t in state['transactions']),'categories':dict(collections.Counter(t['category'] for t in state['transactions']))}))
