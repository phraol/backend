const http = require('http');
const fs = require('fs');
const url = require('url');

// File to store tasks
const TASKS_FILE = 'tasks.json';

// Load tasks from file, create file if it doesn’t exist
function loadTasks() {
  if (!fs.existsSync(TASKS_FILE)) {
    fs.writeFileSync(TASKS_FILE, '[]');
  }
  try {
    return JSON.parse(fs.readFileSync(TASKS_FILE));
  } catch (error) {
    console.error('Error parsing tasks.json:', error);
    return [];
  }
}

// Save tasks to file
function saveTasks(tasks) {
  fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
}

// Create the HTTP server
const server = http.createServer((req, res) => {
  const method = req.method;
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;

  // Set response headers
  res.setHeader('Content-Type', 'application/json');

  // GET /api/tasks: Return all tasks
  if (method === 'GET' && path === '/api/tasks') {
    const tasks = loadTasks();
    res.writeHead(200);
    res.end(JSON.stringify(tasks));
  }

  // POST /api/tasks: Add a new task
  else if (method === 'POST' && path === '/api/tasks') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const newTask = JSON.parse(body);
        if (!newTask.description || typeof newTask.description !== 'string') {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Description is required' }));
          return;
        }
        const tasks = loadTasks();
        const newId = tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1;
        const task = { id: newId, description: newTask.description, completed: false };
        tasks.push(task);
        saveTasks(tasks);
        res.writeHead(201);
        res.end(JSON.stringify(task));
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  }

  // PUT /api/tasks/:id: Mark task as completed
  else if (method === 'PUT' && path.startsWith('/api/tasks/')) {
    const id = parseInt(path.split('/')[3], 10);
    if (isNaN(id)) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Invalid task ID' }));
      return;
    }
    const tasks = loadTasks();
    const taskIndex = tasks.findIndex(t => t.id === id);
    if (taskIndex === -1) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Task not found' }));
      return;
    }
    tasks[taskIndex].completed = true;
    saveTasks(tasks);
    res.writeHead(200);
    res.end(JSON.stringify(tasks[taskIndex]));
  }

  // DELETE /api/tasks/:id: Delete a task
  else if (method === 'DELETE' && path.startsWith('/api/tasks/')) {
    const id = parseInt(path.split('/')[3], 10);
    if (isNaN(id)) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Invalid task ID' }));
      return;
    }
    const tasks = loadTasks();
    const taskIndex = tasks.findIndex(t => t.id === id);
    if (taskIndex === -1) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Task not found' }));
      return;
    }
    tasks.splice(taskIndex, 1);
    saveTasks(tasks);
    res.writeHead(204);
    res.end();
  }

  // Handle unknown endpoints
  else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

// Start the server on port 3000
server.listen(3000, () => {
  console.log('Server running on port 3000');
});
