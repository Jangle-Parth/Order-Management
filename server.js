const express = require('express');
const multer = require('multer');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs').promises;
const app = express();

// Data file paths
const DATA_FILE = path.join(__dirname, 'data.json');
const TASK_REQUIREMENTS_FILE = path.join(__dirname, 'time-required.json');

// Helper function to read data
async function readData() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return { tanks: [], processes: [] };
    }
}

// Helper function to read task requirements
async function readTaskRequirements() {
    try {
        const data = await fs.readFile(TASK_REQUIREMENTS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading task requirements:', error);
        return { tasks: [] };
    }
}

// Helper function to write data
async function writeData(data) {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

// Helper function to get task requirements
function getTaskRequirements(sfgCode, taskRequirements) {
    console.log("Inside the function. SFG Code:", sfgCode);
    console.log("Task Requirements:", taskRequirements.tasks);
    const normalizedSfgCode = sfgCode.toLowerCase();
    const matchedvalues = taskRequirements.tasks.filter(task =>
        normalizedSfgCode === task.sfg_code.toLowerCase()
    );
    console.log("Filtered Task:", matchedvalues);
        return {
            workers_required: matchedvalues[0].workers_required,  // Corrected access to matchedvalues
            time_required_hrs: matchedvalues[0].time_required_hrs
        };
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
            // Store headers
            headers = row.values.slice(1); // slice(1) because first cell is empty
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

        const data = await readData();
        const taskRequirements = await readTaskRequirements();
        console.log("Task Requirements:", taskRequirements);


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
        console.log("BOM Data:", bomData);
        const processes = [];
        const sfgEntries = bomData.map(item => item['No.']).filter(code => code && code.toString().toLowerCase().startsWith('sfg'));
        let serialNo = 1;
        
        console.log("SFG: "+sfgEntries)

        for (const item of sfgEntries) {
            const requirements = getTaskRequirements(item, taskRequirements);
            console.log("Requirements:"+requirements.workers_required)
            console.log("SFG Code:", item, "Workers:", requirements.workers_required, "Time to Complete:", requirements.time_required_hrs);

        
            // Check if requirements indicate a valid task
            if (requirements) {
                const process = {
                    id: `${Date.now()}-${serialNo}`,
                    tankId: tank.id,
                    tankName: `${tank.tankType} - ${tank.capacity}KL`,
                    processName: item.Description || item,
                    serialNo: `${serialNo}.${processes.length + 1}`,
                    sfgCode: item,
                    workers: requirements.workers,
                    timeToComplete: requirements.timeToComplete,
                    status: 'open',
                    addedAt: new Date()
                };
        
                data.processes.push(process);
                processes.push(process);
            }
            else {
                console.warn(`No task found for SFG Code: ${item}`);
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
app.patch('/api/processes/:id/status', async (req, res) => {
    try {
        const data = await readData();
        const process = data.processes.find(p => p.id === req.params.id);

        if (!process) {
            return res.status(404).json({ error: 'Process not found' });
        }

        // Update the status with the new status from the request body
        process.status = req.body.status;
        await writeData(data);

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating process status:', error);
        res.status(500).json({ error: 'Failed to update process status' });
    }
});

// Verify process state based on tankId and serialNo
app.get('/api/processes/check/:tankId/:serialNo', async (req, res) => {
    try {
        const data = await readData();
        const process = data.processes.find(p => 
            p.tankId === req.params.tankId && 
            p.serialNo === req.params.serialNo
        );

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
        const data = await readData();
        res.json({ processes: data.processes });
    } catch (error) {
        console.error('Error fetching processes:', error);
        res.status(500).json({ error: 'Failed to fetch processes' });
    }
});

// Update process progress
app.patch('/api/processes/:id/progress', async (req, res) => {
    try {
        const data = await readData();
        const process = data.processes.find(p => p.id === req.params.id);

        if (!process) {
            return res.status(404).json({ error: 'Process not found' });
        }

        process.progress = req.body.progress;
        await writeData(data);

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating progress:', error);
        res.status(500).json({ error: 'Failed to update progress' });
    }
});

// Generate reports
app.get('/api/reports/:type', async (req, res) => {
    try {
        const data = await readData();
        const type = req.params.type;

        let filteredProcesses;
        switch (type) {
            case 'open':
                filteredProcesses = data.processes.filter(p => p.status === 'open');
                break;
            case 'ongoing':
                filteredProcesses = data.processes.filter(p => p.status === 'ongoing');
                break;
            case 'completed':
                filteredProcesses = data.processes.filter(p => p.status === 'completed');
                break;
            case 'qc-pending':
                filteredProcesses = data.processes.filter(p =>
                    p.status === 'completed' && !p.qcCompleted
                );
                break;
            case 'final-qc':
                filteredProcesses = data.processes.filter(p =>
                    p.status === 'completed' && p.qcCompleted && !p.finalQcCompleted
                );
                break;
            default:
                return res.status(400).json({ error: 'Invalid report type' });
        }

        res.json({ processes: filteredProcesses });
    } catch (error) {
        console.error('Error generating report:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Data will be stored in: ${DATA_FILE}`);
});
