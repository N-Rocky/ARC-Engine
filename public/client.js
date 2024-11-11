// Scene/Game Window, WebGL Context, Logic, and Frame Render method
let canvas; let gl; let logic; let frame;

async function init() { // Initialize graphics and logic

    // Canvas and GL
    canvas = document.getElementById("canvas");
    gl = canvas.getContext('webgl2');
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    // Logic and project data
    logic = new Logic();
    logic.LoadProject();
    logic.LoadAssets();

    // Generate shaders and frame method
    frame = CreateShaders(canvas, gl);
    RenderScreen(); // Begin render loop
}

function Playmode() { // Enter playtest mode
    if (!logic.running) { // Run game

        canvas.classList.remove('scene');
        canvas.classList.add('game');
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        
        logic.Playtest(); // Play game in logic
    }
    else { // Close game

        canvas.classList.remove('game');
        canvas.classList.add('scene');
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;

        logic.Playtest(); // Quit game in logic
    }
}

function RenderScreen(timestamp) { // Render loop
    logic.Update(timestamp);
    frame(logic.camera, logic.entities);
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

// Viewport traversal inputs
let inputs = {}; let shifting = false;
window.addEventListener("keydown", function (event) { // Key down
    if (event.ctrlKey && event.code === "KeyS") { // Saving the project
        event.preventDefault();
        logic.SaveProject();
    }

    if (event.ctrlKey && event.code === "KeyL") { // Loading the project
        event.preventDefault();
        logic.LoadProject();
    }

    if (event.code == "Tab") { // Terminal window
        event.preventDefault();
        if (document.getElementById("terminal").style.display == "flex") {
            document.getElementById("terminal").style.display = "none";
            document.getElementById("scriptText").value = "";
        }
        else {
            document.getElementById("terminal").style.display = "flex";
            if (logic.selectedEntity != -1) {
                document.getElementById("scriptText").value = logic.entities[logic.selectedEntity].behavior;
            }
        }
    }
    if (document.getElementById("terminal").style.display == "flex") { return; } // Ignore input when scripting

    // Pass to logic and all objects that access keyboard input
    logic.currentKey = event.key;

    switch (event.code) {
        case "KeyP":
            Playmode(); break;
        case "Delete":
            if (logic.selectedEntity != -1) {
                logic.entities[logic.selectedEntity].Delete();
            }
            break;
        case "KeyT":
            console.log("Entities:"); console.log(logic.entities); break;
        default:
            break;
    }

    if (event.code == "ArrowLeft" && !inputs.lArrow) { inputs.lArrow = true; ShiftViewport(); }
    if (event.code == "ArrowRight" && !inputs.rArrow) { inputs.rArrow = true; ShiftViewport(); }
    if (event.code == "ArrowUp" && !inputs.uArrow) { inputs.uArrow = true; ShiftViewport(); }
    if (event.code == "ArrowDown" && !inputs.dArrow) { inputs.dArrow = true; ShiftViewport(); }
});
function ShiftViewport() {
    if (!shifting) {
        shifting = true;
        const shiftAmmount = 0.025;
        if (inputs.lArrow) { logic.camera.position.x += shiftAmmount; }
        if (inputs.rArrow) { logic.camera.position.x -= shiftAmmount; }
        if (inputs.uArrow) { logic.camera.position.y += shiftAmmount; }
        if (inputs.dArrow) { logic.camera.position.y -= shiftAmmount; }
        if (inputs.lArrow || inputs.rArrow || inputs.uArrow || inputs.dArrow) {
            setTimeout(function () { shifting = false; ShiftViewport(); }, 0);
        }
        else { shifting = false; }
    }
}

// Key release
window.addEventListener("keyup", function (event) { // Key up
    if (event.code == "ArrowLeft") { inputs.lArrow = false; }
    if (event.code == "ArrowRight") { inputs.rArrow = false; }
    if (event.code == "ArrowUp") { inputs.uArrow = false; }
    if (event.code == "ArrowDown") { inputs.dArrow = false; }
});

// Mouse movement
window.onmousemove = (event) => {
    if (logic) { logic.UpdateMouse(event.clientX, event.clientY); }
}

// Left click release on scene view
document.getElementById("canvas").onmouseup = (event) => {
    logic.HandleClick(event.clientX, event.clientY);
}

// Right click
document.getElementById("canvas").oncontextmenu = (event) => {
    event.preventDefault();
    logic.CreateEntity(new Vector3(logic.mouseX * 0, logic.mouseY * 0, 2), new Vector3(0, 0, 0), new Vector3(1, 1, 1), "file/Models/Monkey.json", "file/Images/Debug.png");
}

// Scroll wheel
document.getElementById("canvas").addEventListener("wheel", event => {
    const delta = Math.sign(event.deltaY);
    //ScaleViewport(delta);
});

// Updating behavior
document.getElementById("scriptText").oninput = function () {
    if (logic.selectedEntity != -1) {
        logic.entities[logic.selectedEntity].behavior = document.getElementById("scriptText").value;
    }
}

window.onload = function () {
    init(); brython();
}