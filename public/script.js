let drake;

document.addEventListener('DOMContentLoaded', () => {
    initializeDragula();
    loadTanks();
});

function initializeDragula() {
    const containers = Array.from(document.querySelectorAll('.task-list'));
    drake = dragula(containers);
    
    drake.on('drop', (el, target, source) => {
        const tankId = el.dataset.tankId;
        const newStatus = target.parentElement.id;
        updateTankStatus(tankId, newStatus);
    });
}

async function loadTanks() {
    try {
        const response = await fetch('/api/tanks');
        const tanks = await response.json();
        displayTanks(tanks);
    } catch (error) {
        console.error('Error loading tanks:', error);
    }
}

function displayTanks(tanks) {
    const columns = {
        'new': document.querySelector('#not-started .task-list'),
        'ongoing': document.querySelector('#ongoing .task-list'),
        'completed': document.querySelector('#completed .task-list'),
        'qc-done': document.querySelector('#qc-done .task-list')
    };

    // Clear existing tasks
    Object.values(columns).forEach(column => column.innerHTML = '');

    // Distribute tanks to appropriate columns
    tanks.forEach(tank => {
        const tankCard = createTankCard(tank);
        columns[tank.status].appendChild(tankCard);
    });
}

function createTankCard(tank) {
    const div = document.createElement('div');
    div.className = 'task-card';
    div.dataset.tankId = tank.id;
    div.innerHTML = `
        <h4>${tank.type}</h4>
        <p>ID: ${tank.id}</p>
        <p>Delivery: ${tank.deliveryDate}</p>
    `;
    return div;
}

async function addNewTank() {
    const type = document.getElementById('tank-type').value;
    const deliveryDate = document.getElementById('delivery-date').value;
    
    if (!type || !deliveryDate) {
        alert('Please fill in all fields');
        return;
    }

    const newTank = {
        id: generateTankId(type),
        type,
        deliveryDate,
        status: 'new'
    };

    try {
        const response = await fetch('/api/tanks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(newTank)
        });

        if (response.ok) {
            loadTanks();
        }
    } catch (error) {
        console.error('Error adding tank:', error);
    }
}

function generateTankId(type) {
    const prefix = type.split(' ').map(word => word[0]).join('');
    return `${prefix}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
}

async function updateTankStatus(tankId, newStatus) {
    try {
        const response = await fetch(`/api/tanks/${tankId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });

        if (!response.ok) {
            throw new Error('Failed to update tank status');
        }
    } catch (error) {
        console.error('Error updating tank status:', error);
    }
}

function generateReport() {
    window.open('/api/report', '_blank');
}