const express = require('express');
const multer = require('multer');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs').promises;
const app = express();

// Data file path
const DATA_FILE = path.join(__dirname, 'data.json');

// Helper function to read data
async function readData() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // If file doesn't exist, return empty data structure
        return { tanks: [], processes: [] };
    }
}

// Helper function to write data
async function writeData(data) {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async function (req, file, cb) {
        try {
            await fs.mkdir('uploads', { recursive: true });
            cb(null, 'uploads/');
        } catch (error) {
            cb(error);
        }
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only Excel files are allowed.'));
        }
    }
});

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Helper function to read Excel file
async function readExcelFile(filePath) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet(1);
    
    const data = [];
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) { // Skip header row
            const rowData = {};
            row.eachCell((cell, colNumber) => {
                const fieldName = colNumber === 1 ? 'Code' : 'Description';
                rowData[fieldName] = cell.value;
            });
            data.push(rowData);
        }
    });
    
    return data;
}

// API Routes

// Create new tank and processes
app.post('/api/tanks', upload.single('bom'), async (req, res) => {
    try {
        // Validate input
        if (!req.body.tankType || !req.body.capacity || !req.body.deliveryDate || !req.body.clientName) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const data = await readData();
        
        // Create new tank
        const tank = {
            id: Date.now().toString(),
            tankType: req.body.tankType,
            capacity: Number(req.body.capacity),
            deliveryDate: new Date(req.body.deliveryDate),
            clientName: req.body.clientName,
            status: 'open',
            createdAt: new Date()
        };
        
        data.tanks.push(tank);

        // Process BOM file
        const bomData = await readExcelFile(req.file.path);
        const processes = [];
        let serialNo = 1;
        
        for (const item of bomData) {
            if (item.Code?.startsWith('SFG')) {
                const randomWorkers = Math.floor(Math.random() * 5) + 1;  // Random workers between 1 and 5
                const randomDays = Math.floor(Math.random() * 30) + 1;    // Random days between 1 and 30

                const process = {
                    id: `${Date.now()}-${serialNo}`,
                    tankId: tank.id,
                    tankName: `${tank.tankType} - ${tank.capacity}KL`,
                    processName: item.Description || item.Code,
                    serialNo: `${serialNo}.${processes.length + 1}`,
                    sfgCode: item.Code,
                    workers: randomWorkers,
                    timeToComplete: randomDays,  // Random number of days
                    status: 'open',
                    addedAt: new Date()
                };
                
                data.processes.push(process);
                processes.push(process);
            }
        }

        await writeData(data);
        
        // Cleanup uploaded file
        await fs.unlink(req.file.path);
        
        res.json({ tank, processes });
    } catch (error) {
        console.error('Error creating tank:', error);
        res.status(500).json({ error: 'Failed to create tank' });
    }
});

// Other routes (e.g., updating process status, checking completion, etc.) remain unchanged...

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Data will be stored in: ${DATA_FILE}`);
});
