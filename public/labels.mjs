// Presentation labels only; stored transaction types and categories remain compatible.
export function financialLabel(value){return String(value??'').replace(/\b(pendapatan|pemasukan|pengeluaran|expense)\b/gi,word=>{const label=/^(pendapatan|pemasukan)$/i.test(word)?'Revenue':'Expenses';return word===word.toUpperCase()?label.toUpperCase():label;});}
