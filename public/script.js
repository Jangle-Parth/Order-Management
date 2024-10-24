// Main application logic
let drake;

document.addEventListener('DOMContentLoaded', function() {
    initializeDragula();
    initializeEventListeners();
    loadExistingProcesses(); // Add this new function call
});

// Initialize Dragula
function initializeDragula() {
    const columns = [
        document.getElementById('openColumn'),
        document.getElementById('ongoingColumn'),
        document.getElementById('completedColumn'),
        document.getElementById('qcColumn')
    ];

    drake = dragula(columns);
    
    drake.on('drop', function(el, target, source) {
        const processId = el.getAttribute('data-process-id');
        const newStatus = target.id.replace('Column', '');
        
        updateProcessStatus(processId, newStatus);
        checkProcessCompletion(el.getAttribute('data-tank-id'));
    });
}

// Initialize event listeners
function initializeEventListeners() {
    document.getElementById('tankForm').addEventListener('submit', handleTankSubmission);
}

// Load existing processes from data.json
async function loadExistingProcesses() {
    try {
        const response = await fetch('/api/processes');
        const data = await response.json();
        
        // Clear existing cards
        clearAllColumns();
        
        // Sort processes by addedAt date
        const sortedProcesses = data.processes.sort((a, b) => 
            new Date(a.addedAt) - new Date(b.addedAt)
        );
        
        // Render processes in their respective columns
        sortedProcesses.forEach(process => {
            const card = createProcessCard(process);
            const columnId = `${process.status}Column`;
            const column = document.getElementById(columnId);
            if (column) {
                column.appendChild(card);
            }
        });
    } catch (error) {
        showErrorMessage('Failed to load processes: ' + error.message);
    }
}

// Clear all columns
function clearAllColumns() {
    const columns = ['openColumn', 'ongoingColumn', 'completedColumn', 'qcColumn'];
    columns.forEach(columnId => {
        const column = document.getElementById(columnId);
        while (column.children.length > 1) { // Keep the header
            column.removeChild(column.lastChild);
        }
    });
}

// Handle tank form submission
async function handleTankSubmission(e) {
    e.preventDefault();
    
    const formData = new FormData();
    formData.append('tankType', document.getElementById('tankType').value);
    formData.append('capacity', document.getElementById('capacity').value);
    formData.append('deliveryDate', document.getElementById('deliveryDate').value);
    formData.append('clientName', document.getElementById('clientName').value);
    formData.append('bom', document.getElementById('bom').files[0]);

    try {
        const response = await fetch('/api/tanks', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('Failed to add tank');

        const data = await response.json();
        
        // Clear the form
        document.getElementById('tankForm').reset();
        
        // Reload all processes to show the new ones
        await loadExistingProcesses();
        
        showSuccessMessage('Tank added successfully');
    } catch (error) {
        showErrorMessage('Failed to add tank: ' + error.message);
    }
}

// Create a process card
function createProcessCard(process) {
    const card = document.createElement('div');
    card.className = 'process-card';
    card.setAttribute('data-process-id', process.id);
    card.setAttribute('data-tank-id', process.tankId);

    // Calculate days remaining or overdue
    const addedDate = new Date(process.addedAt);
    const dueDate = new Date(addedDate.getTime() + process.timeToComplete * 24 * 60 * 60 * 1000);
    const today = new Date();
    const daysRemaining = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
    
    const statusClass = daysRemaining < 0 ? 'overdue' : 
                       daysRemaining <= 2 ? 'due-soon' : '';

    card.classList.add(statusClass);

    card.innerHTML = `
        <h4>${process.tankName}</h4>
        <p class="process-name">${process.processName}</p>
        <p class="serial">Serial: ${process.serialNo}</p>
        <p class="workers">Workers Assigned: ${process.workers}</p>
        <p class="time">Time: ${process.timeToComplete} days</p>
        <p class="added-date">Added: ${new Date(process.addedAt).toLocaleDateString()}</p>
        <p class="due-date ${statusClass}">
            ${daysRemaining < 0 ? 
                `Overdue by ${Math.abs(daysRemaining)} days` : 
                `Due in ${daysRemaining} days`}
        </p>
        ${process.status === 'ongoing' ? `
            <div class="progress-update">
                <input type="number" min="0" max="100" class="progress-input" placeholder="Progress %">
                <button onclick="updateProgress('${process.id}')" class="btn btn-small">Update</button>
            </div>
        ` : ''}
    `;

    return card;
}

// Update process status
async function updateProcessStatus(processId, newStatus) {
    try {
        const response = await fetch(`/api/processes/${processId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });

        if (!response.ok) throw new Error('Failed to update status');
        
        // Reload processes to reflect the new status
        await loadExistingProcesses();
    } catch (error) {
        showErrorMessage('Failed to update process status: ' + error.message);
    }
}

// Update progress
async function updateProgress(processId) {
    const card = document.querySelector(`[data-process-id="${processId}"]`);
    const progressInput = card.querySelector('.progress-input');
    const progress = parseInt(progressInput.value);

    if (isNaN(progress) || progress < 0 || progress > 100) {
        showErrorMessage('Please enter a valid progress percentage (0-100)');
        return;
    }

    try {
        const response = await fetch(`/api/processes/${processId}/progress`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ progress })
        });

        if (!response.ok) throw new Error('Failed to update progress');
        
        showSuccessMessage('Progress updated successfully');
    } catch (error) {
        showErrorMessage('Failed to update progress: ' + error.message);
    }
}

// Check process completion
async function checkProcessCompletion(tankId) {
    try {
        const response = await fetch(`/api/tanks/${tankId}/check-completion`);
        const data = await response.json();

        if (data.isComplete) {
            showFinalQCDialog(tankId);
        }
    } catch (error) {
        showErrorMessage('Failed to check completion: ' + error.message);
    }
}

// Show final QC dialog
function showFinalQCDialog(tankId) {
    if (confirm('All processes are complete. Would you like to book final QC?')) {
        bookFinalQC(tankId);
    }
}

// Book final QC
async function bookFinalQC(tankId) {
    try {
        const response = await fetch(`/api/tanks/${tankId}/final-qc`, {
            method: 'POST'
        });

        if (!response.ok) throw new Error('Failed to book final QC');

        await loadExistingProcesses(); // Reload to show updated status
        showSuccessMessage('Final QC booked successfully');
    } catch (error) {
        showErrorMessage('Failed to book final QC: ' + error.message);
    }
}

// Generate reports
async function generateReport(type) {
    try {
        const response = await fetch(`/api/reports/${type}`);
        const data = await response.json();
        
        // Create and download CSV file
        const csvContent = convertToCSV(data);
        downloadCSV(csvContent, `${type}-report.csv`);
    } catch (error) {
        showErrorMessage('Failed to generate report: ' + error.message);
    }
}

// Convert data to CSV
function convertToCSV(data) {
    const headers = ['Tank Name', 'Process Name', 'Serial No', 'Workers', 'Time to Complete', 'Status', 'Added Date'];
    const rows = data.map(process => [
        process.tankName,
        process.processName,
        process.serialNo,
        process.workers,
        process.timeToComplete,
        process.status,
        new Date(process.addedAt).toLocaleDateString()
    ]);
    
    return [headers, ...rows]
        .map(row => row.join(','))
        .join('\n');
}

// Download CSV file
function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
}

// Show success message
function showSuccessMessage(message) {
    const toast = document.createElement('div');
    toast.className = 'toast toast-success';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Show error message
function showErrorMessage(message) {
    const toast = document.createElement('div');
    toast.className = 'toast toast-error';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}