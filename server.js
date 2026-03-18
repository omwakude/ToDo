const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const dataFile = path.join(__dirname, 'data.json');

const readData = () => {
    try { return JSON.parse(fs.readFileSync(dataFile, 'utf8')); } 
    catch (err) { return []; }
};

const writeData = (data) => {
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
};

app.get('/api/todos', (req, res) => res.json(readData()));

app.get('/api/export', (req, res) => {
    res.download(dataFile, `execution_backup_${Date.now()}.json`);
});

app.post('/api/todos', (req, res) => {
    const todos = readData();
    const newTodo = {
        id: Date.now(),
        text: req.body.text,
        completed: false,
        priority: req.body.priority || 'Medium',
        tag: req.body.tag || 'Life',
        notes: '',
        completedAt: null // Tracks when the task was destroyed
    };
    todos.push(newTodo);
    writeData(todos);
    res.status(201).json(newTodo);
});

app.put('/api/todos/:id', (req, res) => {
    const todos = readData();
    const id = parseInt(req.params.id);
    const index = todos.findIndex(t => t.id === id);
    
    if (index !== -1) {
        const oldStatus = todos[index].completed;
        todos[index] = { ...todos[index], ...req.body };
        
        // If status changed to completed, stamp the time. If unchecked, remove the stamp.
        if (req.body.completed === true && !oldStatus) {
            todos[index].completedAt = new Date().toISOString();
        } else if (req.body.completed === false) {
            todos[index].completedAt = null;
        }

        writeData(todos);
        res.json(todos[index]);
    } else {
        res.status(404).json({ message: 'Task not found' });
    }
});

app.delete('/api/todos/:id', (req, res) => {
    let todos = readData();
    todos = todos.filter(t => t.id !== parseInt(req.params.id));
    writeData(todos);
    res.status(204).send();
});

app.listen(PORT, () => console.log(`Server dominating on http://localhost:${PORT}`));