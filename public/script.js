// Main application logic
let drake;

document.addEventListener('DOMContentLoaded', function() {
    initializeDragula();
    initializeEventListeners();
});

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

function initializeEventListeners() {
    document.getElementById('tankForm').addEventListener('submit', handleTankSubmission);
}

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
        renderProcessCards(data.processes);
        showSuccessMessage('Tank added successfully');
    } catch (error) {
        showErrorMessage('Failed to add tank: ' + error.message);
    }
}

function renderProcessCards(processes) {
    const openColumn = document.getElementById('openColumn');
    
    processes.forEach(process => {
        const card = createProcessCard(process);
        openColumn.appendChild(card);
    });
}

function createProcessCard(process) {
    const card = document.createElement('div');
    card.className = 'process-card';
    card.setAttribute('data-process-id', process.id);
    card.setAttribute('data-tank-id', process.tankId);

    card.innerHTML = `
        <h4>${process.tankName} - ${process.processName}</h4>
        <p>Serial: ${process.serialNo}</p>
        <p>Workers: ${process.workers}</p>
        <p>Time: ${process.timeToComplete} days</p>
        <p>Added: ${new Date(process.addedAt).toLocaleString()}</p>
    `;

    return card;
}

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
    } catch (error) {
        showErrorMessage('Failed to update process status: ' + error.message);
    }
}

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

function showFinalQCDialog(tankId) {
    if (confirm('All processes are complete. Would you like to book final QC?')) {
        bookFinalQC(tankId);
    }
}

async function bookFinalQC(tankId) {
    try {
        const response = await fetch(`/api/tanks/${tankId}/final-qc`, {
            method: 'POST'
        });

        if (!response.ok) throw new Error('Failed to book final QC');

        removeCompletedProcessCards(tankId);
        showSuccessMessage('Final QC booked successfully');
    } catch (error) {
        showErrorMessage('Failed to book final QC: ' + error.message);
    }
}

function showSuccessMessage(message) {
    alert(message);  // You can improve this UI if needed
    document.body.style.backgroundColor = "lightblue";  // Change background to light blue
}

function showErrorMessage(message) {
    alert(message);  // You can improve this UI if needed
}
