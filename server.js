const express = require('express');
const multer = require('multer');
const ExcelJS = require('exceljs');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs').promises;
const app = express();

// Connect to MongoDB Atlas
const mongoURI = 'mongodb+srv://parth:parth2005@taskmanager.chek4.mongodb.net/?retryWrites=true&w=majority&appName=TaskManager'; // Replace with your MongoDB Atlas connection string
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Could not connect to MongoDB:', err));

// Define MongoDB Schemas and Models
const tankSchema = new mongoose.Schema({
    tankType: String,
    capacity: Number,
    deliveryDate: Date,
    clientName: String,
    status: { type: String, default: 'open' },
    createdAt: { type: Date, default: Date.now },
});

const processSchema = new mongoose.Schema({
    tankId: String,
    tankName: String,
    processName: String,
    serialNo: String,
    sfgCode: String,
    workers: Number,
    timeToComplete: Number,
    status: { type: String, default: 'open' },
    addedAt: { type: Date, default: Date.now },
    progress: { type: Number, default: 0 },
    qcCompleted: { type: Boolean, default: false },
    finalQcCompleted: { type: Boolean, default: false },
});

const Tank = mongoose.model('Tank', tankSchema);
const Process = mongoose.model('Process', processSchema);

// Helper function to read task requirements from a JSON file
async function readTaskRequirements() {
    try {
        const data = await fs.readFile(path.join(__dirname, 'time-required.json'), 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading task requirements:', error);
        return { tasks: [] };
    }
}

function getTaskRequirements(sfgCode, taskRequirements) {
    const normalizedSfgCode = sfgCode.toLowerCase();
    const matchedValues = taskRequirements.tasks.filter(task =>
        normalizedSfgCode === task.sfg_code.toLowerCase()
    );
    return matchedValues.length > 0 ? matchedValues[0] : null;
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
    let headers = [];

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) {
            headers = row.values.slice(1); // Headers
        } else {
            const rowData = {};
            row.eachCell((cell, colNumber) => {
                rowData[headers[colNumber - 1]] = cell.value;
            });
            data.push(rowData);
        }
    });

    return data;
}

// Create new tank and processes
app.post('/api/tanks', upload.single('bom'), async (req, res) => {
    try {
        // Validate input
        if (!req.body.tankType || !req.body.capacity || !req.body.deliveryDate || !req.body.clientName) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const taskRequirements = await readTaskRequirements();

        // Create new tank
        const tank = new Tank({
            tankType: req.body.tankType,
            capacity: Number(req.body.capacity),
            deliveryDate: new Date(req.body.deliveryDate),
            clientName: req.body.clientName
        });

        await tank.save();

        // Process BOM file
        const bomData = await readExcelFile(req.file.path);
        const sfgEntries = bomData.map(item => item['No.']).filter(code => code && code.toString().toLowerCase().startsWith('sfg'));
        let serialNo = 1;

        const processes = [];
        for (const item of sfgEntries) {
            const requirements = getTaskRequirements(item, taskRequirements);
            if (requirements) {
                const process = new Process({
                    tankId: tank._id,
                    tankName: `${tank.tankType} - ${tank.capacity}KL`,
                    processName: item.Description || item,
                    serialNo: `${serialNo}.${processes.length + 1}`,
                    sfgCode: item,
                    workers: requirements.workers_required,
                    timeToComplete: requirements.time_required_hrs
                });

                await process.save();
                processes.push(process);
            }
        }

        // Cleanup uploaded file
        await fs.unlink(req.file.path);

        res.json({ tank, processes });
    } catch (error) {
        console.error('Error creating tank:', error);
        res.status(500).json({ error: 'Failed to create tank' });
    }
});

// Update process status
app.patch('/api/processes/:id/status', async (req, res) => {
    try {
        const process = await Process.findById(req.params.id);
        if (!process) {
            return res.status(404).json({ error: 'Process not found' });
        }

        process.status = req.body.status;
        await process.save();

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating process status:', error);
        res.status(500).json({ error: 'Failed to update process status' });
    }
});

// Verify process state based on tankId and serialNo
app.get('/api/processes/check/:tankId/:serialNo', async (req, res) => {
    try {
        const process = await Process.findOne({
            tankId: req.params.tankId,
            serialNo: req.params.serialNo
        });

        if (!process) {
            return res.status(404).json({ message: 'Process not found' });
        }

        res.json({ status: process.status });
    } catch (error) {
        console.error('Error verifying process state:', error);
        res.status(500).json({ message: 'Failed to verify process state' });
    }
});

// Get all processes
app.get('/api/processes', async (req, res) => {
    try {
        const processes = await Process.find();
        res.json({ processes });
    } catch (error) {
        console.error('Error fetching processes:', error);
        res.status(500).json({ error: 'Failed to fetch processes' });
    }
});

// Update process progress
app.patch('/api/processes/:id/progress', async (req, res) => {
    try {
        const process = await Process.findById(req.params.id);
        if (!process) {
            return res.status(404).json({ error: 'Process not found' });
        }

        process.progress = req.body.progress;
        await process.save();

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating progress:', error);
        res.status(500).json({ error: 'Failed to update progress' });
    }
});

// Generate reports
app.get('/api/reports/:type', async (req, res) => {
    try {
        const type = req.params.type;
        let filter = {};

        switch (type) {
            case 'open':
                filter = { status: 'open' };
                break;
            case 'ongoing':
                filter = { status: 'ongoing' };
                break;
            case 'completed':
                filter = { status: 'completed' };
                break;
            case 'qc-pending':
                filter = { status: 'completed', qcCompleted: false };
                break;
            case 'final-qc':
                filter = { status: 'completed', qcCompleted: true, finalQcCompleted: false };
                break;
            default:
                return res.status(400).json({ error: 'Invalid report type' });
        }

        const processes = await Process.find(filter);
        res.json({ processes });
    } catch (error) {
        console.error('Error generating report:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
