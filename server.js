const express = require('express');
const path = require('path');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const app = express();

app.use(express.json());
app.use(express.static('public'));

// Sample data structure
let tanks = [
    { id: 'AST001', type: 'Acid Storage Tank', deliveryDate: '2024-12-01', status: 'new' },
    { id: 'MST001', type: 'Milk Storage Tank', deliveryDate: '2024-11-15', status: 'ongoing' },
    { id: 'HMST001', type: 'HMST', deliveryDate: '2024-10-30', status: 'new' }
];

const processFlow = {
    'Acid Storage Tank': [
        { task: 'Inner Shell Cutting', duration: 5, manpower: 4 },
        { task: 'Inner Shell Welding', duration: 7, manpower: 6 },
        { task: 'Outer Shell Assembly', duration: 6, manpower: 5 },
        { task: 'Quality Check', duration: 2, manpower: 2 }
    ],
    'Milk Storage Tank': [
        { task: 'Inner Shell Cutting', duration: 4, manpower: 3 },
        { task: 'Inner Shell Welding', duration: 6, manpower: 5 },
        { task: 'Outer Shell Assembly', duration: 5, manpower: 4 },
        { task: 'Quality Check', duration: 2, manpower: 2 }
    ]
};

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/tanks', (req, res) => {
    res.json(tanks);
});

app.post('/api/tanks', (req, res) => {
    const newTank = req.body;
    tanks.push(newTank);
    res.json(newTank);
});

app.put('/api/tanks/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const tank = tanks.find(t => t.id === id);
    if (tank) {
        tank.status = status;
        res.json(tank);
    } else {
        res.status(404).json({ error: 'Tank not found' });
    }
});

app.get('/api/report', (req, res) => {
    const doc = new PDFDocument();
    const filename = 'tank_report.pdf';

    res.setHeader('Content-disposition', 'attachment; filename="' + filename + '"');
    res.setHeader('Content-type', 'application/pdf');

    doc.pipe(res);

    // Add content to PDF
    doc.fontSize(20).text('Tank Manufacturing Status Report', { align: 'center' });
    doc.moveDown();

    // Not Started
    doc.fontSize(16).text('Not Started', { underline: true });
    tanks.filter(t => t.status === 'new').forEach(tank => {
        doc.fontSize(12).text(`${tank.id} - ${tank.type} (Delivery: ${tank.deliveryDate})`);
    });
    doc.moveDown();

    // Ongoing
    doc.fontSize(16).text('Ongoing', { underline: true });
    tanks.filter(t => t.status === 'ongoing').forEach(tank => {
        doc.fontSize(12).text(`${tank.id} - ${tank.type} (Delivery: ${tank.deliveryDate})`);
    });
    doc.moveDown();

    // Completed
    doc.fontSize(16).text('Completed', { underline: true });
    tanks.filter(t => t.status === 'completed').forEach(tank => {
        doc.fontSize(12).text(`${tank.id} - ${tank.type} (Delivery: ${tank.deliveryDate})`);
    });

    doc.end();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));