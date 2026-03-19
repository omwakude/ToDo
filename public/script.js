document.addEventListener('DOMContentLoaded', () => {
    const todoForm = document.getElementById('todo-form');
    const todoInput = document.getElementById('todo-input');
    const todoList = document.getElementById('todo-list');
    const kanbanBoard = document.getElementById('kanban-board');
    const mainContainer = document.getElementById('main-container');
    const focusToggle = document.getElementById('focus-toggle');
    const viewToggle = document.getElementById('view-toggle');
    const themeToggle = document.getElementById('theme-toggle');
    const streakCounter = document.getElementById('streak-counter');
    
    // Goals Elements
    const goalForm = document.getElementById('goal-form');
    const goalInput = document.getElementById('goal-input');
    const goalList = document.getElementById('goal-list');

    // Timer Elements
    const settingsBtn = document.getElementById('timer-settings-btn');
    const settingsPanel = document.getElementById('timer-settings-panel');
    const startBtn = document.getElementById('start-btn');
    const widget = document.getElementById('pomodoro-widget');

    let currentTodos = [];
    let currentGoals = [];
    let isKanbanMode = false;
    
    let timerInterval;
    let timeRemaining = 25 * 60; 
    let isTimerRunning = false;
    let isBreakMode = false;

    // Initialize Theme
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-theme');
    }

    // Request Notification Permission on load
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }

    fetchTodos();
    fetchGoals();

    // Setup Listeners
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        localStorage.setItem('theme', document.body.classList.contains('light-theme') ? 'light' : 'dark');
    });

    todoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = todoInput.value.trim();
        if (!text) return;

        await fetch('/api/todos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, priority: document.getElementById('todo-priority').value, tag: document.getElementById('todo-tag').value })
        });
        todoInput.value = '';
        fetchTodos();
    });

    goalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = goalInput.value.trim();
        if (!text) return;

        await fetch('/api/goals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        goalInput.value = '';
        fetchGoals();
    });

    focusToggle.addEventListener('click', toggleFocusMode);
    viewToggle.addEventListener('click', toggleViewMode);

    document.addEventListener('keydown', (e) => {
        if (e.altKey && e.key.toLowerCase() === 'n') { e.preventDefault(); todoInput.focus(); }
        if (e.altKey && e.key.toLowerCase() === 'f') { e.preventDefault(); toggleFocusMode(); }
        if (e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); toggleViewMode(); }
    });

    settingsBtn.addEventListener('click', () => {
        settingsPanel.classList.toggle('hidden');
    });

    document.getElementById('work-min').addEventListener('input', (e) => {
        if(!isTimerRunning && !isBreakMode) {
            const val = e.target.value || 25;
            document.getElementById('pomodoro-timer').innerText = `${val}:00`;
            timeRemaining = val * 60;
        }
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

    async function fetchGoals() {
        const response = await fetch('/api/goals');
        currentGoals = await response.json();
        renderGoals();
    }

    function sendNotification(title, body) {
        if ("Notification" in window && Notification.permission === "granted") {
            new Notification(title, { body });
        }
    }

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

    function playAlertSound() {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        oscillator.connect(audioCtx.destination);
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(400, audioCtx.currentTime);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.5);
    }

    function renderGoals() {
        goalList.innerHTML = '';
        currentGoals.forEach(goal => {
            const li = document.createElement('li');
            li.className = goal.completed ? 'completed' : '';
            li.innerHTML = `
                <div class="task-info">
                    <input type="checkbox" ${goal.completed ? 'checked' : ''} onchange="toggleGoal(${goal.id}, this.checked)">
                    <span class="goal-text">${goal.text}</span>
                </div>
                <button class="delete-btn" onclick="deleteGoal(${goal.id})">X</button>
            `;
            goalList.appendChild(li);
        });
    }

    function renderData() {
        if (isKanbanMode) renderKanban();
        else renderList(currentTodos, todoList);
    }

    function renderList(todosToRender, container) {
        container.innerHTML = '';
        todosToRender.forEach(todo => {
            const li = document.createElement('li');
            li.className = `priority-${todo.priority} ${todo.completed ? 'completed' : ''}`;
            li.setAttribute('draggable', 'true');
            li.dataset.id = todo.id;
            li.innerHTML = createCardHTML(todo);
            
            li.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', todo.id);
                setTimeout(() => li.style.opacity = '0.5', 0);
            });
            
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

    document.querySelectorAll('.drop-zone').forEach(zone => {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('drag-over');
        });
        zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
        zone.addEventListener('drop', async (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            const taskId = e.dataTransfer.getData('text/plain');
            const newPriority = zone.dataset.priority;
            
            const taskIndex = currentTodos.findIndex(t => t.id == taskId);
            if (taskIndex !== -1 && currentTodos[taskIndex].priority !== newPriority) {
                currentTodos[taskIndex].priority = newPriority;
                renderData();
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

    function calculateStreak() {
        const completedDates = currentTodos
            .filter(t => t.completedAt)
            .map(t => t.completedAt.split('T')[0]);
        
        const uniqueDates = [...new Set(completedDates)].sort((a,b) => new Date(b) - new Date(a));
        let streak = 0;
        let today = new Date();
        today.setHours(0,0,0,0);

        for (let i = 0; i < uniqueDates.length; i++) {
            let d = new Date(uniqueDates[i]);
            d.setHours(0,0,0,0);
            const diffDays = Math.round(Math.abs(today - d) / (1000 * 60 * 60 * 24));

            if (diffDays === 0) { 
                if (streak === 0) streak = 1;
            } else if (diffDays === 1) { 
                if (streak === 0) streak = 1; 
                else streak++; 
                today = d; 
            } else {
                break; 
            }
        }
        return streak;
    }

    function updateStreak() {
        const todayStr = new Date().toISOString().split('T')[0];
        const crushedToday = currentTodos.filter(t => t.completedAt && t.completedAt.split('T')[0] === todayStr).length;
        const streakDays = calculateStreak();
        streakCounter.innerText = `🔥 Daily Streak: ${streakDays} | Tasks Crushed Today: ${crushedToday}`;
    }

    window.startTimer = () => {
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }

        const timerDisplay = document.getElementById('pomodoro-timer');
        const statusDisplay = document.getElementById('timer-status');
        const workMin = parseInt(document.getElementById('work-min').value) || 25;
        const breakMin = parseInt(document.getElementById('break-min').value) || 5;

        if (isTimerRunning) { 
            clearInterval(timerInterval); 
            isTimerRunning = false; 
            startBtn.innerHTML = '▶ Resume';
            startBtn.style.background = '#ffb142'; 
            widget.classList.remove('timer-running', 'timer-break');
            statusDisplay.innerText = "Paused";
            return; 
        }

        isTimerRunning = true;
        startBtn.innerHTML = '⏸ Pause';
        startBtn.style.background = '#4CAF50'; 
        
        if (isBreakMode) {
            widget.classList.add('timer-break');
            statusDisplay.innerText = "Break Time ☕";
        } else {
            widget.classList.add('timer-running');
            statusDisplay.innerText = "Deep Work 🧠";
        }

        timerInterval = setInterval(() => {
            timeRemaining--;
            let m = Math.floor(timeRemaining / 60);
            let s = timeRemaining % 60;
            timerDisplay.innerText = `${m}:${s < 10 ? '0' : ''}${s}`;

            if (timeRemaining <= 0) {
                clearInterval(timerInterval);
                isTimerRunning = false;
                startBtn.innerHTML = '▶ Play';
                widget.classList.remove('timer-running', 'timer-break');
                playAlertSound();
                
                if (!isBreakMode) {
                    sendNotification("Session Complete", "Great job! Time for a short break.");
                    isBreakMode = true;
                    timeRemaining = breakMin * 60;
                    timerDisplay.innerText = `${breakMin}:00`;
                    statusDisplay.innerText = "Ready for Break";
                } else {
                    sendNotification("Break Over", "Time to get back to execution!");
                    isBreakMode = false;
                    timeRemaining = workMin * 60;
                    timerDisplay.innerText = `${workMin}:00`;
                    statusDisplay.innerText = "Ready to Focus";
                }
            }
        }, 1000);
    };

    window.resetTimer = () => {
        clearInterval(timerInterval);
        isTimerRunning = false;
        isBreakMode = false;
        const workMin = parseInt(document.getElementById('work-min').value) || 25;
        timeRemaining = workMin * 60;
        
        document.getElementById('pomodoro-timer').innerText = `${workMin}:00`;
        document.getElementById('timer-status').innerText = "Ready to Focus";
        startBtn.innerHTML = '▶ Play';
        startBtn.style.background = '#4CAF50';
        widget.classList.remove('timer-running', 'timer-break');
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
        if (newStatus === true) playSuccessSound();
        await fetch(`/api/todos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed: newStatus })
        });
        fetchTodos(); 
    };

    window.deleteTodo = async (id) => {
        await fetch(`/api/todos/${id}`, { method: 'DELETE' });
        fetchTodos();
    };

    // Goals Functions
    window.toggleGoal = async (id, newStatus) => {
        if (newStatus === true) playSuccessSound();
        await fetch(`/api/goals/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed: newStatus })
        });
        fetchGoals();
    };

    window.deleteGoal = async (id) => {
        await fetch(`/api/goals/${id}`, { method: 'DELETE' });
        fetchGoals();
    };
});