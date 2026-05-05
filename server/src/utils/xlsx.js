// Helper to build a registrations Excel workbook
import ExcelJS from 'exceljs';

export async function buildRegistrationsWorkbook(event, registrations) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Registrations');

  ws.columns = [
    { header: 'Full Name', key: 'name', width: 28 },
    { header: 'Email',     key: 'email', width: 30 },
    { header: 'Student ID',key: 'studentId', width: 14 },
    { header: 'Status',    key: 'status', width: 14 },
    { header: 'Registered At', key: 'createdAt', width: 24 }
  ];

  registrations.forEach(r => {
    ws.addRow({
      name: r.name || r.user?.fullName || '',
      email: r.email || r.user?.email || '',
      studentId: r.studentId || r.user?.studentId || '',
      status: r.status,
      createdAt: new Date(r.createdAt).toISOString()
    });
  });

  // simple header style
  ws.getRow(1).font = { bold: true };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
