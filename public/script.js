document.addEventListener('DOMContentLoaded', () => {
    const todoForm = document.getElementById('todo-form');
    const todoInput = document.getElementById('todo-input');
    const todoList = document.getElementById('todo-list');
    const kanbanBoard = document.getElementById('kanban-board');
    const mainContainer = document.getElementById('main-container');
    const focusToggle = document.getElementById('focus-toggle');
    const viewToggle = document.getElementById('view-toggle');
    const streakCounter = document.getElementById('streak-counter');

    let currentTodos = [];
    let isKanbanMode = false;
    let timerInterval;
    let timeRemaining = 25 * 60; 
    let isTimerRunning = false;

    fetchTodos();

    todoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = todoInput.value.trim();
        if (!text) return;

        await fetch('/api/todos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                text, 
                priority: document.getElementById('todo-priority').value, 
                tag: document.getElementById('todo-tag').value 
            })
        });
        todoInput.value = '';
        fetchTodos();
    });

    focusToggle.addEventListener('click', toggleFocusMode);
    viewToggle.addEventListener('click', toggleViewMode);

    document.addEventListener('keydown', (e) => {
        if (e.altKey && e.key.toLowerCase() === 'n') { e.preventDefault(); todoInput.focus(); }
        if (e.altKey && e.key.toLowerCase() === 'f') { e.preventDefault(); toggleFocusMode(); }
        if (e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); toggleViewMode(); }
    });

    function toggleFocusMode() {
        document.body.classList.toggle('focus-active');
        focusToggle.innerText = document.body.classList.contains('focus-active') ? '👁️ Exit Focus Mode' : '👁️ Enter Focus Mode';
        focusToggle.classList.toggle('active');
    }

    function toggleViewMode() {
        isKanbanMode = !isKanbanMode;
        if (isKanbanMode) {
            viewToggle.innerText = '📋 List View';
            viewToggle.classList.add('active');
            todoList.classList.add('kanban-hidden');
            kanbanBoard.classList.remove('kanban-hidden');
            mainContainer.classList.add('kanban-mode');
        } else {
            viewToggle.innerText = '📊 Kanban View';
            viewToggle.classList.remove('active');
            todoList.classList.remove('kanban-hidden');
            kanbanBoard.classList.add('kanban-hidden');
            mainContainer.classList.remove('kanban-mode');
        }
        renderData();
    }

    async function fetchTodos() {
        const response = await fetch('/api/todos');
        currentTodos = await response.json();
        renderData();
        updateProgress();
        updateStreak();
    }

    // Mathematical Audio Synthesizer (No MP3 files needed)
    function playSuccessSound() {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(800, audioCtx.currentTime); 
        oscillator.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.3);
    }

    function renderData() {
        if (isKanbanMode) {
            renderKanban();
        } else {
            renderList(currentTodos, todoList);
        }
    }

    function renderList(todosToRender, container) {
        container.innerHTML = '';
        todosToRender.forEach(todo => {
            const li = document.createElement('li');
            li.className = `priority-${todo.priority} ${todo.completed ? 'completed' : ''}`;
            li.setAttribute('draggable', 'true');
            li.dataset.id = todo.id; // Store ID for drag-and-drop
            li.innerHTML = createCardHTML(todo);
            
            // Drag Start Event
            li.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', todo.id);
                setTimeout(() => li.style.opacity = '0.5', 0);
            });
            
            // Drag End Event
            li.addEventListener('dragend', () => {
                li.style.opacity = '1';
                document.querySelectorAll('.kanban-column').forEach(col => col.classList.remove('drag-over'));
            });

            container.appendChild(li);
        });
    }

    function renderKanban() {
        const highCol = document.querySelector('#col-high .kanban-list');
        const medCol = document.querySelector('#col-medium .kanban-list');
        const lowCol = document.querySelector('#col-low .kanban-list');

        renderList(currentTodos.filter(t => t.priority === 'High'), highCol);
        renderList(currentTodos.filter(t => t.priority === 'Medium'), medCol);
        renderList(currentTodos.filter(t => t.priority === 'Low'), lowCol);
    }

    // Set up Drag-and-Drop Zones for Kanban Columns
    document.querySelectorAll('.drop-zone').forEach(zone => {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault(); // Required to allow dropping
            zone.classList.add('drag-over');
        });

        zone.addEventListener('dragleave', () => {
            zone.classList.remove('drag-over');
        });

        zone.addEventListener('drop', async (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            const taskId = e.dataTransfer.getData('text/plain');
            const newPriority = zone.dataset.priority;
            
            // Instantly update UI for snappy feel, then sync to server
            const taskIndex = currentTodos.findIndex(t => t.id == taskId);
            if (taskIndex !== -1 && currentTodos[taskIndex].priority !== newPriority) {
                currentTodos[taskIndex].priority = newPriority;
                renderData(); // Re-render instantly
                await fetch(`/api/todos/${taskId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ priority: newPriority })
                });
            }
        });
    });

    function createCardHTML(todo) {
        return `
            <div class="task-main">
                <div class="task-info">
                    <input type="checkbox" ${todo.completed ? 'checked' : ''} onchange="toggleStatus(${todo.id}, this.checked)">
                    <span class="task-text">${todo.text}</span>
                </div>
                <div class="action-buttons">
                    <button class="expand-btn" onclick="toggleDrawer(${todo.id})">✏️</button>
                    <button class="delete-btn" onclick="deleteTodo(${todo.id})">X</button>
                </div>
            </div>
            <div style="margin-top: 5px;">
                <span class="tag-badge">${todo.tag || 'Task'}</span>
            </div>
            <div class="task-drawer" id="drawer-${todo.id}">
                <textarea class="note-input" placeholder="Notes auto-save..." 
                    onkeyup="autoSaveNote(${todo.id}, this)">${todo.notes || ''}</textarea>
            </div>
        `;
    }

    function updateProgress() {
        const pBar = document.getElementById('progress-bar');
        if (currentTodos.length === 0) { pBar.style.width = '0%'; return; }
        const completed = currentTodos.filter(t => t.completed).length;
        pBar.style.width = `${(completed / currentTodos.length) * 100}%`;
    }

    // Calculates how many tasks were completed TODAY
    function updateStreak() {
        const today = new Date().toISOString().split('T')[0];
        const crushedToday = currentTodos.filter(t => {
            if (!t.completedAt) return false;
            return t.completedAt.split('T')[0] === today;
        }).length;
        
        streakCounter.innerText = `🔥 Tasks Crushed Today: ${crushedToday}`;
    }

    window.startTimer = () => {
        const timerDisplay = document.getElementById('pomodoro-timer');
        if (isTimerRunning) { clearInterval(timerInterval); isTimerRunning = false; timerDisplay.style.color = '#ff5252'; return; }
        isTimerRunning = true;
        timerDisplay.style.color = '#4CAF50';
        timerInterval = setInterval(() => {
            timeRemaining--;
            let m = Math.floor(timeRemaining / 60);
            let s = timeRemaining % 60;
            timerDisplay.innerText = `${m}:${s < 10 ? '0' : ''}${s}`;
            if (timeRemaining <= 0) {
                clearInterval(timerInterval);
                isTimerRunning = false;
                alert("Session complete. Execute your break.");
                timeRemaining = 25 * 60;
                timerDisplay.innerText = "25:00";
                timerDisplay.style.color = '#ff5252';
            }
        }, 1000);
    };

    window.toggleDrawer = (id) => document.getElementById(`drawer-${id}`).classList.toggle('open');
    
    let typingTimer;
    window.autoSaveNote = (id, element) => {
        clearTimeout(typingTimer);
        typingTimer = setTimeout(async () => {
            await fetch(`/api/todos/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes: element.value })
            });
            element.classList.add('saved-flash');
            setTimeout(() => element.classList.remove('saved-flash'), 1000);
            const index = currentTodos.findIndex(t => t.id === id);
            if(index !== -1) currentTodos[index].notes = element.value;
        }, 1000); 
    };

    window.toggleStatus = async (id, newStatus) => {
        if (newStatus === true) {
            playSuccessSound(); // Trigger dopamine hit
        }
        await fetch(`/api/todos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed: newStatus })
        });
        fetchTodos(); // Re-fetch to get the new completedAt timestamp
    };

    window.deleteTodo = async (id) => {
        await fetch(`/api/todos/${id}`, { method: 'DELETE' });
        fetchTodos();
    };
});