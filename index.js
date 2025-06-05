const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');


const DATA_FILE = path.join(__dirname, 'tasks.json');


function loadTasks() {
  
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([]), 'utf8');
  }


  const rawData = fs.readFileSync(DATA_FILE, 'utf8');


  try {
    return JSON.parse(rawData);
  } catch (error) {
    console.error('Could not parse tasks.json. Using empty list.', error);
    return [];
  }
}



function saveTasks(tasks) {
  
  const jsonString = JSON.stringify(tasks, null, 2);
  fs.writeFileSync(DATA_FILE, jsonString, 'utf8');
}

// Helper function: getRequestBody(req)
//    Reads the incoming request body (JSON) and returns it as an object.
function getRequestBody(req) {
  return new Promise((resolve, reject) => {
    let bodyData = '';
    
    req.on('data', (chunk) => {
      bodyData += chunk.toString();
    });

   
    req.on('end', () => {
      try {
      
        const parsed = JSON.parse(bodyData || '{}');
        resolve(parsed);
      } catch (err) {
       
        reject(new Error('Invalid JSON'));
      }
    });

    
    req.on('error', (err) => reject(err));
  });
}

 // Create the HTTP server
const server = http.createServer(async (req, res) => {
  // Parse the URL and method
  const parsedUrl = url.parse(req.url, true);
  const method = req.method;
  const pathname = parsedUrl.pathname;

  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');


  if (method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  //ROUTE: GET /api/tasks
  if (method === 'GET' && pathname === '/api/tasks') {
    // 1. Load all tasks from tasks.json
    const tasks = loadTasks();

    // 2. Return JSON with HTTP 200 status
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(tasks));
  }

  // ROUTE: POST /api/tasks 
  if (method === 'POST' && pathname === '/api/tasks') {
    try {
      // 1. Read the JSON body, e.g. { "title": "go to class" }
      const body = await getRequestBody(req);
      const title = (body.title || '').toString().trim();

      // 2. Simple validation: title must not be empty
      if (!title) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Task title is required.' }));
      }

      // 3. Load existing tasks
      const tasks = loadTasks();

      // 4. Decide the new task’s id: take max existing id + 1, or 1 if none exist
      const newId = tasks.length > 0
        ? Math.max(...tasks.map(t => t.id)) + 1
        : 1;

      // 5. Create the new task object
      const newTask = {
        id: newId,
        title: title,
        completed: false
      };

      //  Add to the array and save back into tasks.json
      tasks.push(newTask);
      saveTasks(tasks);

      //  Send back the newly created task with HTTP 201 (Created)
      res.writeHead(201, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(newTask));
    } catch (err) {
      // If something goes wrong (e.g. invalid JSON), return 400
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // ROUTE: PUT /api/tasks/:id
  // Example URL: PUT http://localhost:3000/api/tasks/2
  if (method === 'PUT' && /^\/api\/tasks\/\d+$/.test(pathname)) {
    try {
      // 1. Extract the id from the URL
      const idString = pathname.split('/').pop();
      const id = parseInt(idString, 10);

      // 2. Load existing tasks and find the one with this id
      const tasks = loadTasks();
      const index = tasks.findIndex(t => t.id === id);
      if (index === -1) {
        // If not found, return 404
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Task not found.' }));
      }

      // 3. Optionally allow a JSON body { "completed": true } to set completed.
      //    If no body or no "completed" in body, we simply mark completed = true.
      let completedValue = true;
      if (req.headers['content-type'] === 'application/json') {
        const body = await getRequestBody(req);
        if (body.hasOwnProperty('completed') && typeof body.completed === 'boolean') {
          completedValue = body.completed;
        }
      }

      // 4. Update the task’s completed status
      tasks[index].completed = completedValue;
      saveTasks(tasks);

      // 5. Return the updated task
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(tasks[index]));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // ROUTE: DELETE /api/tasks/:id 
  // Example URL: DELETE http://localhost:3000/api/tasks/2
  if (method === 'DELETE' && /^\/api\/tasks\/\d+$/.test(pathname)) {
    // 1. Extract the id from the URL
    const idString = pathname.split('/').pop();
    const id = parseInt(idString, 10);

    // 2. Load existing tasks and find the one with this id
    const tasks = loadTasks();
    const index = tasks.findIndex(t => t.id === id);
    if (index === -1) {
      // If not found, return 404
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Task not found.' }));
    }

    // 3. Remove that task from the array
    const removedTask = tasks.splice(index, 1)[0];
    saveTasks(tasks);

    // 4. Return the deleted task
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(removedTask));
  }

  // ROUTE: GET / 
  if (method === 'GET' && pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(`
      <h1>Simple Task Manager API</h1>
      <p>Use the following endpoints:</p>
      <ul>
        <li>GET /api/tasks</li>
        <li>POST /api/tasks</li>
        <li>PUT /api/tasks/&lt;id&gt;</li>
        <li>DELETE /api/tasks/&lt;id&gt;</li>
      </ul>
    `);
  }

  // NO MATCH (404)
  // If none of the above routes match, return 404 Not Found
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found.' }));
});

//  Start the server, listening on port 3000
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
