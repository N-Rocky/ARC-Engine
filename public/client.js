// Scene/Game Window, WebGL Context, Logic, and Frame Render method
let canvas; let gl; let logic; let frame;

async function init() { // Initialize graphics and logic

    // Canvas and GL
    canvas = document.getElementById("canvas");
    gl = canvas.getContext('webgl2');
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    canvas.oncontextmenu = (event) => { event.preventDefault(); }

    // Logic and project data
    logic = new Logic();
    
    // Generate shaders and frame method
    frame = CreateShaders(canvas, gl);
    RenderScreen(); // Begin render loop

    // Load the project
    await logic.LoadProject();
    await logic.LoadAssets();
    ListEntities();
}

function Playmode() { // Enter playtest mode
    canvas.classList.toggle('game');
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    
    logic.Playtest(); // Play or Quit game in 
    logic.selected = null; ListEntities();
}

function RenderScreen(timestamp) { // Render loop
    logic.Update(timestamp);
    frame(logic.camera, logic.entities, logic.selected);
    requestAnimationFrame(RenderScreen);
}

// Uploading assets to the server
document.getElementById("fileSelect").onchange = async function(event) {
    const formData = new FormData();
    formData.append('file', event.target.files[0]);

    let projectID = window.location.href.split("/");
    projectID = projectID[projectID.length - 1];

    await fetch(`/project/${projectID}/upload`, {
        method: "POST",
        body: formData
    });

    logic.LoadAssets();
}

function ListEntities() { // List the entity hierarchy
    const inspector = document.getElementById("inspector");
    while (inspector.lastElementChild.id != "inspectorHeader") {
        inspector.removeChild(inspector.lastElementChild);
    }

    for (let entity of logic.entities) {
        const item = document.createElement("div");
        item.classList.add("entity");
        item.textContent = entity.name;
        item.onclick = () => {
            logic.selected = entity;
            entity.Inspect();
        }
        inspector.appendChild(item);
    }

    logic.selected = null;
}

// Viewing all entities in the scene
document.getElementById("inspectorHeader").onclick = ListEntities;

// Creating new entities
document.getElementById("plusIcon").onclick = () => {
    logic.CreateEntity(logic.camera.position.add(logic.camera.rotation.forward.multiply(5)),
        new Vector3(0, 0, 0), new Vector3(1, 1, 1),
        "file/Models/Cube.json", "file/Images/Square.png");
    ListEntities();
}

// Duplicates the selected entity
document.getElementById("duplicateIcon").onclick = () => {
    if (logic.selected) {
        logic.entities.push(logic.selected.Clone());
        ListEntities();
    }
}

// Saving the current state of the scene
document.getElementById("saveIcon").onclick = () => {
    if (confirm("Save the project in its current state?")) {
        logic.SaveProject();
    }
}

// Discard all of the changes since last save
document.getElementById("discardIcon").onclick = async function() {
    if (confirm("Discard all changes since last save?")) {
        await logic.LoadProject();
        ListEntities();
    }
}

// Viewport traversal inputs
let inputs = {}; let shifting = false;
window.addEventListener("keydown", function (event) { // Key down
    if (event.ctrlKey && event.code == "KeyP") { // Playing the game
        event.preventDefault();
        Playmode();
    }

    if (event.ctrlKey && event.code === "KeyS") { // Saving the project
        event.preventDefault();
        if (confirm("Save the project in its current state?")) {
            RenderScreen(0);
            logic.SaveProject();
        }
    }

    if (event.ctrlKey && event.code === "KeyL") { // Loading the project
        event.preventDefault();
        if (confirm("Discard all changes since last save?")) {
            logic.LoadProject();
        }
    }

    if (event.code == "Tab") { // Terminal window
        event.preventDefault();
        if (document.getElementById("terminal").style.display == "flex") {
            document.getElementById("terminal").style.display = "none";
            document.getElementById("scriptText").value = "";
        }
        else {
            document.getElementById("terminal").style.display = "flex";
            if (logic.selected != null) {
                document.getElementById("scriptText").value = logic.selected.behavior;
            }
        }
    }
    if (document.getElementById("terminal").style.display == "flex") { return; } // Ignore input when scripting

    // Pass to logic and all objects that access keyboard input
    logic.currentKey = event.key;

    switch (event.code) {
        case "Delete":
            if (logic.selected != null) {
                logic.selected.Delete();
                ListEntities();
            }
            break;
        case "KeyT":
            console.log("Entities:"); console.log(logic.entities); break;
        default:
            break;
    }

    if (event.code == "KeyW" && !inputs.wKey) { inputs.wKey = true; ShiftViewport(); }
    if (event.code == "KeyA" && !inputs.aKey) { inputs.aKey = true; ShiftViewport(); }
    if (event.code == "KeyS" && !inputs.sKey) { inputs.sKey = true; ShiftViewport(); }
    if (event.code == "KeyD" && !inputs.dKey) { inputs.dKey = true; ShiftViewport(); }
    if (event.code == "KeyQ" && !inputs.qKey) { inputs.qKey = true; ShiftViewport(); }
    if (event.code == "KeyE" && !inputs.eKey) { inputs.eKey = true; ShiftViewport(); }
});
function ShiftViewport() {
    if (!shifting && rightClick) {
        shifting = true;
        const shiftAmmount = 0.01;
        if (inputs.wKey) {
            const forwards = logic.camera.rotation.forward.multiply(shiftAmmount);
            logic.camera.position = logic.camera.position.add(forwards);
        }
        if (inputs.aKey) {
            const leftwards = logic.camera.rotation.right.multiply(-shiftAmmount);
            logic.camera.position = logic.camera.position.add(leftwards);
        }
        if (inputs.sKey) {
            const backwards = logic.camera.rotation.forward.multiply(-shiftAmmount);
            logic.camera.position = logic.camera.position.add(backwards);
        }
        if (inputs.dKey) {
            const rightwards = logic.camera.rotation.right.multiply(shiftAmmount);
            logic.camera.position = logic.camera.position.add(rightwards);
        }
        if (inputs.qKey) {
            const downwards = logic.camera.rotation.up.multiply(-shiftAmmount);
            logic.camera.position = logic.camera.position.add(downwards);
        }
        if (inputs.eKey) {
            const upwards = logic.camera.rotation.up.multiply(shiftAmmount);
            logic.camera.position = logic.camera.position.add(upwards);
        }
        if (inputs.wKey || inputs.aKey || inputs.sKey || inputs.dKey || inputs.qKey || inputs.eKey) {
            setTimeout(function () { shifting = false; ShiftViewport(); }, 0);
        }
        else { shifting = false; }
    }
}

// Key release
window.addEventListener("keyup", function (event) { // Key up
    if (event.code == "KeyW") { inputs.wKey = false; }
    if (event.code == "KeyA") { inputs.aKey = false; }
    if (event.code == "KeyS") { inputs.sKey = false; }
    if (event.code == "KeyD") { inputs.dKey = false; }
    if (event.code == "KeyQ") { inputs.qKey = false; }
    if (event.code == "KeyE") { inputs.eKey = false; }
});

// Mouse clicking on canvas
let leftClick = false; let rightClick = false;
document.getElementById("canvas").onmousedown = (event) => { // Mouse down
    if (event.which == 1) { // Left mouse
        //logic.HandleClick(event.clientX, event.clientY);
        leftClick = true;
        canvas.style.cursor = "grabbing";
    }
    else if (event.which == 2) { // Middle mouse
        leftClick = true;
        rightClick = true;
        canvas.style.cursor = "move";
    }
    else if (event.which == 3) { // Right mouse
        rightClick = true;
        canvas.style.cursor = "crosshair";
    }
}
window.onmouseup = (event) => { // Mouse up
    if (event.which == 1) { // Left mouse
        leftClick = false;
        canvas.style.cursor = "grab";
    }
    else if (event.which == 2) { // Middle mouse
        leftClick = false;
        rightClick = false;
        canvas.style.cursor = "grab";
    }
    else if (event.which == 3) { // Right 
        event.preventDefault();
        rightClick = false;
        canvas.style.cursor = "grab";
    }
}

// Mouse movement
window.onmousemove = (event) => {
    if (logic) { logic.UpdateMouse(event.clientX, event.clientY); }
    if (!logic.running) {
        if (leftClick) {
            logic.camera.position = logic.camera.position.add(logic.camera.rotation.up.multiply(event.movementY / 100));
            logic.camera.position = logic.camera.position.add(logic.camera.rotation.right.multiply(-event.movementX / 100));
        }
        if (rightClick) {
            logic.camera.rotation.y -= event.movementX / 10;
            logic.camera.rotation.x += event.movementY / 10;
        }
    }
}

// Scroll wheel
document.getElementById("canvas").addEventListener("wheel", event => {
    const delta = -Math.sign(event.deltaY);
    if (logic && !logic.running) {
        logic.camera.position = logic.camera.position.add(logic.camera.rotation.forward.multiply(delta));
    }
});

// Updating behavior
document.getElementById("scriptText").oninput = function () {
    if (logic.selected != null) {
        logic.selected.behavior = document.getElementById("scriptText").value;
    }
}

// Initial methods on window load
window.onload = function () {
    init(); brython();
}