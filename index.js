const express = require('express');

//Import a body parser module to be able to access the request body as json
const bodyParser = require('body-parser');

//Use cors to avoid issues with testing on localhost
const cors = require('cors');

const app = express();

//Port environment variable already set up to run on Heroku
var port = process.env.PORT || 3000;

//Tell express to use the body parser module
app.use(bodyParser.json());

//Tell express to use cors -- enables CORS for this backend
app.use(cors());  

var boards = new Map([
    [ "0", { id: '0', name: "Planned", description: "Everything that's on the todo list.", tasks: new Set(["0","1","2"]) } ],
    [ "1", { id: '1', name: "Ongoing", description: "Currently in progress.", tasks: new Set([]) } ],
    [ "3", { id: '3', name: "Done", description: "Completed tasks.", tasks: new Set(["3"]) } ]
]);

var tasks = new Map([
    [ "0", { id: '0', boardId: '0', taskName: "Another task", dateCreated: new Date(Date.UTC(2021, 00, 21, 15, 48)), archived: false } ],
    [ "1", { id: '1', boardId: '0', taskName: "Prepare exam draft", dateCreated: new Date(Date.UTC(2021, 00, 21, 16, 48)), archived: false } ],
    [ "2", { id: '2', boardId: '0', taskName: "Discuss exam organisation", dateCreated: new Date(Date.UTC(2021, 00, 21, 14, 48)), archived: false } ],
    [ "3", { id: '3', boardId: '3', taskName: "Prepare assignment 2", dateCreated: new Date(Date.UTC(2021, 00, 10, 16, 00)), archived: true } ]
]);

var curBoardId = 4;
var curTaskId = 4;

// Returns true if all tasks of a board are archived
function allArchived(bId) {
    for(const tId of boards.get(bId).tasks) {
        if(!tasks.get(tId).archived) return false;
    }
    return true;
}

// Returns a tasks data (converts dateCreated to milliseconds since epoch)
function taskData(tId) {
    let task = {...tasks.get(tId)};
    task.dateCreated = task.dateCreated.getTime();
    return task;
}

// Returns a boards data (converts tasks Set to array and if withTasks is true then converts the task id's in that array to task data)
function boardData(bId, withTasks=false) {
    let board = {...boards.get(bId)};
    board.tasks = Array.from(board.tasks);
    if(withTasks) {
        board.tasks = board.tasks.map(tId=>taskData(tId));
    }
    return board;
}


// Read all boards
app.get("/api/v1/boards", (req, res) => {
    res.status(200).json(
        Array.from(boards.values()).map((board) => {
            let {tasks, ...b} = board;
            return b;
        })
    );
});

// Read individual board
app.get("/api/v1/boards/:boardId", (req, res) => {
    if(boards.has(req.params.boardId)) {
        // Board exists
        res.status(200).json(boardData(req.params.boardId));
    } else {
        // Board doesn't exist
        res.status(404).json({'message': "Board with id " + req.params.boardId + " does not exist."});
    }
});

// Create new board
app.post("/api/v1/boards", (req, res) => {
    if(req.body === undefined || req.body.name === undefined || req.body.description === undefined) {
        // The name and description fields not provided in the body
        res.status(400).json({'message': "The name and description fields are required in the request body."});
    } else if(typeof req.body.name !== "string") {
        // The name field is not a string
        res.status(400).json({'message': "The name field must be a string."});
    } else if(typeof req.body.description !== "string") {
        // The description field is not a string
        res.status(400).json({'message': "The description field must be a string."});
    } else if(req.body.name === "") {
        // The 
        res.status(400).json({'message': "The name field cannot be empty."});
    } else {
        boards.set(curBoardId.toString(), {
            id: curBoardId.toString(),
            name: req.body.name,
            description: req.body.description,
            tasks: new Set()
        });
        res.status(201).json(boardData(curBoardId.toString()));
        curBoardId++;
    }
});

// Update a boards
app.put("/api/v1/boards/:boardId", (req, res) => {
    if(!boards.has(req.params.boardId)) {
        res.status(404).json({'message': "Board with id " + req.params.boardId + " does not exist."});
    } else if(req.body === undefined || req.body.name === undefined || req.body.description === undefined) {
        res.status(400).json({'message': "The name and description fields are required in the request body."});
    } else if(typeof req.body.name !== "string") {
        res.status(400).json({'message': "The name field must be a string."});
    } else if(typeof req.body.description !== "string") {
        res.status(400).json({'message': "The description field must be a string."});
    } else if(req.body.name === "") {
        res.status(400).json({'message': "The name field cannot be empty."});
    } else if(!allArchived(req.params.boardId)) {
        res.status(400).json({'message': "Board with id " + req.params.boardId + " has unarchived tasks."});
    } else {
        boards.get(req.params.boardId).name = req.body.name;
        boards.get(req.params.boardId).description = req.body.description;
        res.status(200).json(boardData(req.params.boardId));
    }
});

// Delete a board
app.delete("/api/v1/boards/:boardId", (req, res) => {
    if(!boards.has(req.params.boardId)) {
        res.status(404).json({'message': "Board with id " + req.params.boardId + " does not exist."});
    } else if(!allArchived(req.params.boardId)) {
        res.status(400).json({'message': "Board with id " + req.params.boardId + " has unarchived tasks."});
    } else {
        res.status(200).json(boardData(req.params.boardId));
        boards.delete(req.params.boardId);
    }
});

// Delete all boards
app.delete("/api/v1/boards", (req, res) => {
    res.status(200).json(Array.from(boards.values()).map(board=>boardData(board.id,true)));
    boards = new Map();
    tasks = new Map();
    curBoardId = 0;
    curTaskId = 0;
});

// Read all tasks for a board
app.get("/api/v1/boards/:boardId/tasks", (req, res) => {
    if(!boards.has(req.params.boardId)) {
        res.status(404).json({'message': "Board with id " + req.params.boardId + " does not exist."});
    } else {
        let resp_tasks = Array.from(boards.get(req.params.boardId).tasks.values()).map(tId=>taskData(tId));
        if(req.query.sort !== undefined) {
            const checkSet = new Set(["taskName", "dateCreated", "id"]);
            if(!checkSet.has(req.query.sort)) {
                return res.status(400).json({'message': "Can only sort by taskName, dateCreated, or id. Not " + req.query.sort + "."});
            } else {
                resp_tasks.sort((a,b)=>((a[req.query.sort] < b[req.query.sort]) ? -1 : ((a[req.query.sort] > b[req.query.sort]) ? 1 : 0)));
            }
        }
        res.status(200).json(resp_tasks);
    }
});

// Read an individual task
app.get("/api/v1/boards/:boardId/tasks/:taskId", (req, res) => {
    if(!boards.has(req.params.boardId)) {
        res.status(404).json({'message': "Board with id " + req.params.boardId + " does not exist."});
    } else if (!tasks.has(req.params.taskId)) {
        res.status(404).json({'message': "Task with id " + req.params.taskId + " does not exist."});
    } else if (!boards.get(req.params.boardId).tasks.has(req.params.taskId)) {
        res.status(404).json({'message': "Board with id " + req.params.boardId + " has no task with id " + req.params.taskId + "."});
    } else {
        res.status(200).json(taskData(req.params.taskId));
    }
});

// Create a new task
app.post("/api/v1/boards/:boardId/tasks", (req, res) => {
    if(!boards.has(req.params.boardId)) {
        res.status(404).json({'message': "Board with id " + req.params.boardId + " does not exist."});
    } else if(req.body === undefined || req.body.taskName === undefined) {
        res.status(400).json({'message': "The taskName field is required in the request body."});
    } else if(typeof req.body.taskName !== "string") {
        res.status(400).json({'message': "The taskName field must be a string."});
    } else {
        boards.get(req.params.boardId).tasks.add(curTaskId.toString());
        tasks.set(curTaskId.toString(),{
            id: curTaskId.toString(),
            boardId: req.params.boardId,
            taskName: req.body.taskName,
            dateCreated: new Date(),
            archived: false
        });
        res.status(201).json(taskData(curTaskId.toString()));
        curTaskId++;
    }
});

// Delete a task
app.delete("/api/v1/boards/:boardId/tasks/:taskId", (req, res) => {
    if(!boards.has(req.params.boardId)) {
        res.status(404).json({'message': "Board with id " + req.params.boardId + " does not exist."});
    } else if (!tasks.has(req.params.taskId)) {
        res.status(404).json({'message': "Task with id " + req.params.taskId + " does not exist."});
    } else if (!boards.get(req.params.boardId).tasks.has(req.params.taskId)) {
        res.status(404).json({'message': "Board with id " + req.params.boardId + " has no task with id " + req.params.taskId + "."});
    } else {
        let task = taskData(req.params.taskId);
        tasks.delete(req.params.taskId);
        boards.get(req.params.boardId).tasks.delete(req.params.taskId);
        res.status(200).json(task);
    }
});

// Partially update a task
app.patch("/api/v1/boards/:boardId/tasks/:taskId", (req, res) => {
    if(!boards.has(req.params.boardId)) {
        res.status(404).json({'message': "Board with id " + req.params.boardId + " does not exist."});
    } else if (!tasks.has(req.params.taskId)) {
        res.status(404).json({'message': "Task with id " + req.params.taskId + " does not exist."});
    } else if (!boards.get(req.params.boardId).tasks.has(req.params.taskId)) {
        res.status(404).json({'message': "Board with id " + req.params.boardId + " has no task with id " + req.params.taskId + "."});
    } else if (req.body === undefined || (req.body.taskName === undefined && req.archived === undefined && req.boardId === undefined)){
        res.status(400).json({'message': "At least 1 field must be provided."});
    } else {
        if (req.body.taskName !== undefined) {
            if(typeof req.body.taskName !== "string") {
                return res.status(400).json({'message': "The taskName field must be a string."});
            }
            tasks.get(req.params.taskId).taskName = req.body.taskName;
        }
        if (req.body.archived !== undefined) {
            if(typeof req.body.taskName !== "boolean") {
                return res.status(400).json({'message': "The archived field must be a boolean."});
            }
            tasks.get(req.params.taskId).archived = req.body.archived;
        }
        if (req.body.boardId !== undefined) {
            if(typeof req.body.taskName !== "string") {
                return res.status(400).json({'message': "The boardId field must be a numeric string."});
            } else if(!boards.has(req.body.boardId)) {
                return res.status(404).json({'message': "Board with id " + req.body.boardId + " does not exist."});
            }
            tasks.get(req.params.taskId).boardId = req.body.boardId;
            boards.get(req.params.boardId).tasks.delete(req.params.taskId);
            boards.get(req.body.boardId).tasks.add(req.params.taskId);
        }
        res.status(200).json(taskData(req.params.taskId));
    }
});

//Unsuppoerted endpoints
app.use("*", (req, res) => {
    res.status(405).send("Operation not supported.");
});

app.listen(port, () => {
    console.log("Event app listening...");
});
