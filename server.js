const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.json());
// Replace 'public' with wherever your HTML/CSS/JS are stored if necessary
app.use(express.static(path.join(__dirname, 'public'))); 

const dataFile = path.join(__dirname, 'data.json');
const goalsFile = path.join(__dirname, 'goals.json');

const readData = (file) => {
    try { 
        if (!fs.existsSync(file)) return [];
        return JSON.parse(fs.readFileSync(file, 'utf8')); 
    } 
    catch (err) { return []; }
};

const writeData = (file, data) => {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
};

// Ensure JSON files exist
if (!fs.existsSync(dataFile)) writeData(dataFile, []);
if (!fs.existsSync(goalsFile)) writeData(goalsFile, []);

// ====== TODOS ENDPOINTS ======
app.get('/api/todos', (req, res) => res.json(readData(dataFile)));

app.post('/api/todos', (req, res) => {
    const todos = readData(dataFile);
    const newTodo = {
        id: Date.now(),
        text: req.body.text,
        completed: false,
        priority: req.body.priority || 'Medium',
        tag: req.body.tag || 'Life',
        notes: '',
        completedAt: null 
    };
    todos.push(newTodo);
    writeData(dataFile, todos);
    res.status(201).json(newTodo);
});

app.put('/api/todos/:id', (req, res) => {
    const todos = readData(dataFile);
    const id = parseInt(req.params.id);
    const index = todos.findIndex(t => t.id === id);
    
    if (index !== -1) {
        const oldStatus = todos[index].completed;
        todos[index] = { ...todos[index], ...req.body };
        
        if (req.body.completed === true && !oldStatus) {
            todos[index].completedAt = new Date().toISOString();
        } else if (req.body.completed === false) {
            todos[index].completedAt = null;
        }

        writeData(dataFile, todos);
        res.json(todos[index]);
    } else {
        res.status(404).json({ message: 'Task not found' });
    }
});

app.delete('/api/todos/:id', (req, res) => {
    let todos = readData(dataFile);
    todos = todos.filter(t => t.id !== parseInt(req.params.id));
    writeData(dataFile, todos);
    res.status(204).send();
});

// ====== GOALS ENDPOINTS ======
app.get('/api/goals', (req, res) => res.json(readData(goalsFile)));

app.post('/api/goals', (req, res) => {
    const goals = readData(goalsFile);
    const newGoal = {
        id: Date.now(),
        text: req.body.text,
        completed: false
    };
    goals.push(newGoal);
    writeData(goalsFile, goals);
    res.status(201).json(newGoal);
});

app.put('/api/goals/:id', (req, res) => {
    const goals = readData(goalsFile);
    const id = parseInt(req.params.id);
    const index = goals.findIndex(g => g.id === id);
    
    if (index !== -1) {
        goals[index] = { ...goals[index], ...req.body };
        writeData(goalsFile, goals);
        res.json(goals[index]);
    } else {
        res.status(404).json({ message: 'Goal not found' });
    }
});

app.delete('/api/goals/:id', (req, res) => {
    let goals = readData(goalsFile);
    goals = goals.filter(g => g.id !== parseInt(req.params.id));
    writeData(goalsFile, goals);
    res.status(204).send();
});

app.get('/api/export', (req, res) => {
    res.download(dataFile, `execution_backup_${Date.now()}.json`);
});

app.listen(PORT, () => console.log(`Server dominating on http://localhost:${PORT}`));