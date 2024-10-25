// Main application logic
let drake;

document.addEventListener('DOMContentLoaded', function() {
    const tankForm = document.getElementById('tankForm');
    if (tankForm) {
        initializeDragula();
        initializeEventListeners();
        loadExistingProcesses();
    } else {
        console.error('Tank form not found in the DOM');
    }
});

// Initialize Dragula
// Initialize Dragula
function initializeDragula() {
    const columns = [
        document.getElementById('openColumn'),
        document.getElementById('ongoingColumn'),
        document.getElementById('completedColumn'),
        document.getElementById('qcColumn')
    ];

    if (!columns.every(column => column)) {
        console.error('One or more columns not found in the DOM');
        return;
    }

    drake = dragula(columns);
    
    drake.on('drop', async function(el, target, source) {
        const processId = el.getAttribute('data-process-id');
        const tankId = el.getAttribute('data-tank-id');
        const serialNo = el.getAttribute('data-serial-no');
        console.log('Serial No:', serialNo);
        if (!serialNo) {
            console.error('Serial number is missing');
            return;
        }
        try {
            const checkResponse = await fetch(`/api/processes/check/${tankId}/${serialNo}`);
            if (!checkResponse.ok) {
                throw new Error('Failed to verify process state');
            }
        } catch (error) {
            console.error('Error during drag and drop:', error);
        }
        

        
        // Map column IDs to status values
        const statusMap = {
            'openColumn': 'open',
            'ongoingColumn': 'ongoing',
            'completedColumn': 'completed',
            'qcColumn': 'qc'
        };

        const newStatus = statusMap[target.id];
        
        if (!newStatus) {
            console.error('Invalid target column');
            source.appendChild(el);
            return;
        }

        try {
            // Show loading state
            el.style.opacity = '0.5';
            
            // First, try to fetch the current process state
            const checkResponse = await fetch(`/api/processes/check/${tankId}/${serialNo}`);
            if (!checkResponse.ok) {
                throw new Error('Failed to verify process state');
            }

            
            // Update the process status
            const response = await fetch(`/api/processes/update-status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    tankId: tankId,
                    processId: processId,
                    serialNo: serialNo,
                    newStatus: newStatus
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to update process status');
            }

            const result = await response.json();
            
            if (result.success) {
                // Update was successful
                if (newStatus === 'completed') {
                    await checkTankCompletion(tankId);
                }
                showSuccessMessage(`Process updated to ${newStatus}`);
            } else {
                throw new Error(result.message || 'Update failed');
            }

        } catch (error) {
            console.error('Error during drag and drop:', error);
            showErrorMessage(`Failed to update process: ${error.message}`);
            source.appendChild(el);
        } finally {
            el.style.opacity = '1';
        }
    });
}

// Helper function to check tank completion
async function checkTankCompletion(tankId) {
    try {
        const response = await fetch(`/api/tanks/${tankId}/completion-status`);
        
        if (!response.ok) {
            throw new Error('Failed to check tank completion');
        }

        const data = await response.json();
        
        if (data.isComplete) {
            showFinalQCDialog(tankId);
        }
        
    } catch (error) {
        console.error('Error checking tank completion:', error);
    }
}

// Update the createProcessCard function to include the serial number
function createProcessCard(process) {
    const card = document.createElement('div');
    card.className = 'process-card';
    card.setAttribute('data-process-id', process.id);
    card.setAttribute('data-tank-id', process.tankId);
    card.setAttribute('data-serial-no', process.serialNo); // Add this line
    const addedDate = new Date(process.addedAt);
    const dueDate = new Date(addedDate);
    dueDate.setDate(addedDate.getDate() + process.timeToComplete);
    const today = new Date();
    const daysRemaining = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
    let statusClass = '';
    if (daysRemaining < 0) {
        statusClass = 'overdue';
    } else if (daysRemaining <= 2) {
        statusClass = 'due-soon';
    }

    const formattedAddedDate = addedDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });

    const dueString = daysRemaining < 0 
        ? `Overdue by ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) !== 1 ? 's' : ''}`
        : `Due in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`;

    card.innerHTML = `
        <h4>${process.tankName}</h4>
        <p class="process-name">${process.processName}</p>
        <p class="serial">Serial: ${process.serialNo}</p>
        <p class="sfg-code">SFG Code: ${process.sfgCode}</p>
        <p class="workers">Workers Assigned: ${process.workers}</p>
        <p class="time">Time: ${process.timeToComplete} days</p>
        <p class="added-date">Added: ${formattedAddedDate}</p>
        <p class="due-date ${statusClass}">${dueString}</p>
        ${process.status === 'ongoing' ? `
            <div class="progress-update">
                <input type="number" min="0" max="100" value="${process.progress || 0}"
                    class="progress-input" placeholder="Progress %">
                <button onclick="updateProgress('${process.id}')" class="btn btn-small">Update</button>
            </div>
        ` : ''}
    `;

    return card;
}
async function handleFetchResponse(response) {
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'An error occurred');
    }
}
// Initialize event listeners
function initializeEventListeners() {
    const tankForm = document.getElementById('tankForm');
    if (tankForm) {
        tankForm.addEventListener('submit', handleTankSubmission);
    } else {
        console.error('Tank form not found while initializing event listeners');
    }
}

// Handle tank form submission
async function handleTankSubmission(e) {
    e.preventDefault();
    
    const formData = new FormData();
    const tankType = document.getElementById('tankType');
    const capacity = document.getElementById('capacity');
    const deliveryDate = document.getElementById('deliveryDate');
    const clientName = document.getElementById('clientName');
    const bom = document.getElementById('bom');

    console.log('Tank Type:', tankType.value);
    console.log('Capacity:', capacity.value);
    console.log('Delivery Date:', deliveryDate.value);
    console.log('Client Name:', clientName.value);
    console.log('BOM File:', bom.files[0]);
    
    formData.append('tankType', tankType.value);
    formData.append('capacity', capacity.value);
    formData.append('deliveryDate', deliveryDate.value);
    formData.append('clientName', clientName.value);
    formData.append('bom', bom.files[0]);
    if (!tankType || !capacity || !deliveryDate || !clientName || !bom) {
        showErrorMessage('One or more form fields not found');
        return;
    }

    try {
        const response = await fetch('/api/tanks', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to add tank');
        }

        const data = await response.json();
        
        // Clear the form
        document.getElementById('tankForm').reset();
        
        // Reload all processes to show the new ones
        await loadExistingProcesses();
        
        showSuccessMessage('Tank added successfully');
    } catch (error) {
        console.error('Error adding tank:', error);
        showErrorMessage('Failed to add tank: ' + error.message);
    }
}

// Load existing processes from data.json
async function loadExistingProcesses() {
    try {
        const response = await fetch('/api/processes');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Loaded processes:', data); // Debug log
        
        // Clear existing cards
        clearAllColumns();
        
        // Sort processes by addedAt date
        const sortedProcesses = data.processes.sort((a, b) => 
            new Date(a.addedAt) - new Date(b.addedAt)
        );
        
        // Group processes by status
        const processGroups = {
            open: sortedProcesses.filter(p => p.status === 'open'),
            ongoing: sortedProcesses.filter(p => p.status === 'ongoing'),
            completed: sortedProcesses.filter(p => p.status === 'completed'),
            qc: sortedProcesses.filter(p => p.status === 'qc')
        };
        

        console.log('Process groups:', processGroups); 

        // Render processes in their respective columns
        Object.entries(processGroups).forEach(([status, processes]) => {
            const columnId = `${status}Column`;
            const column = document.getElementById(columnId);
            if (column) {
                processes.forEach(process => {
                    console.log('Process data:', process);
                    const card = createProcessCard(process);
                    column.appendChild(card);
                });
            }
        });
    } catch (error) {
        console.error('Error loading processes:', error);
        showErrorMessage('Failed to load processes: ' + error.message);
    }
}

// Clear all columns
function clearAllColumns() {
    const columns = ['openColumn', 'ongoingColumn', 'completedColumn', 'qcColumn'];
    columns.forEach(columnId => {
        const column = document.getElementById(columnId);
        if (column) {
            // Keep the header element and remove all other children
            const header = column.querySelector('.column-header');
            column.innerHTML = '';
            if (header) {
                column.appendChild(header);
            }
        }
    });
}

// Create a process card with improved styling
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
    
    // Set status class only if there's a valid status
    let statusClass = '';
    if (daysRemaining < 0) {
        statusClass = 'overdue';
    } else if (daysRemaining <= 2) {
        statusClass = 'due-soon';
    }

    // Only add status class if it's not empty
    if (statusClass) {
        card.classList.add(statusClass);
    }

    // Format the date strings
    const formattedAddedDate = addedDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });

    const dueString = daysRemaining < 0 
        ? `Overdue by ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) !== 1 ? 's' : ''}`
        : `Due in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`;

    card.innerHTML = `
        <h4>${process.tankName}</h4>
        <p class="process-name">${process.processName}</p>
        <p class="serial">Serial: ${process.serialNo}</p>
        <p class="sfg-code">SFG Code: ${process.sfgCode}</p>
        <p class="workers">Workers Assigned: ${process.workers}</p>
        <p class="time">Time: ${process.timeToComplete} days</p>
        <p class="added-date">Added: ${formattedAddedDate}</p>
        <p class="due-date${statusClass ? ' ' + statusClass : ''}">${dueString}</p>
        ${process.status === 'ongoing' ? `
            <div class="progress-update">
                <input type="number" min="0" max="100" value="${process.progress || 0}"
                    class="progress-input" placeholder="Progress %">
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