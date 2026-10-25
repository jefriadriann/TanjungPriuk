// Presentation labels only; stored transaction types and categories remain compatible.
export function financialLabel(value){return String(value??'').replace(/^Pendapatan(?=\s|$)/,'Revenue').replace(/^Pemasukan(?=\s|$)/,'Revenue');}
