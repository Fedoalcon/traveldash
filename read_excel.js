import XLSX from 'xlsx';
import fs from 'fs';

try {
  const filePath = 'C:\\Users\\Falcon\\Downloads\\Estefi Viaje 2026.xlsx';
  const workbook = XLSX.readFile(filePath);
  
  const sheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('resumen')) || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  const data = XLSX.utils.sheet_to_json(sheet, { raw: false, dateNF: 'yyyy-mm-dd hh:mm:ss' });
  
  fs.writeFileSync('C:\\Users\\Falcon\\Documents\\repo\\Viaje2026\\raw_itinerary_utf8.json', JSON.stringify(data, null, 2), 'utf8');
} catch (e) {
  console.error(e.message);
}
