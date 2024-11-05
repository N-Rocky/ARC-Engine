// Scene/Game Window, WebGL Context, Logic, and Frame Render method
let canvas; let gl; let logic; let frame;

async function init() { // Initialize scene canvas, game canvas, and logic

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

        logic.Quit(); // Quit game in logic
    }
}

function RenderScreen(timestamp) {
    if (logic.running) { // Game view
        logic.Update(timestamp);
        frame(logic.camera, logic.entities);
    }
    else { // Scene view
        frame(logic.viewport, logic.entities);
    }
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

function ComponentSetup() {
    let components = document.querySelectorAll('.component > .componentHeader');
    for (let item of components) {
        item.nextElementSibling.style.gridTemplateRows = '0fr';
        item.addEventListener('mouseup', function (event) {
            let body = event.target.nextElementSibling
            let value = (body.style.gridTemplateRows != '0fr') ? '0fr' : '1fr';
            body.style.gridTemplateRows = value;
            for (let component of components) {
                if (component != event.target) {
                    component.nextElementSibling.style.gridTemplateRows = '0fr';
                }
            }
        });
    }
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
        if (inputs.lArrow) { logic.viewport.position.x += shiftAmmount; }
        if (inputs.rArrow) { logic.viewport.position.x -= shiftAmmount; }
        if (inputs.uArrow) { logic.viewport.position.y += shiftAmmount; }
        if (inputs.dArrow) { logic.viewport.position.y -= shiftAmmount; }
        if (inputs.lArrow || inputs.rArrow || inputs.uArrow || inputs.dArrow) {
            setTimeout(function () { shifting = false; ShiftViewport(); }, 0);
        }
        else { shifting = false; }
    }
}
window.addEventListener("keyup", function (event) { // Key up
    if (event.code == "ArrowLeft") { inputs.lArrow = false; }
    if (event.code == "ArrowRight") { inputs.rArrow = false; }
    if (event.code == "ArrowUp") { inputs.uArrow = false; }
    if (event.code == "ArrowDown") { inputs.dArrow = false; }
});
window.onmousemove = (event) => {
    if (logic && logic.running) { logic.UpdateMouse(event.clientX, event.clientY); }
    else if (logic) { logic.UpdateMouse(event.clientX, event.clientY); }
}
document.getElementById("canvas").onmouseup = (event) => { // Left click release on scene view
    logic.UpdateMouse(event.clientX, event.clientY);
    logic.HandleClick();

    if (logic.selectedEntity != -1) {
        for (let element of document.getElementById("inspector").getElementsByClassName("component")) {
            element.style.opacity = "100%";
            element.style.width = "100%";
            element.style.flexGrow = "1";
        }

        let entity = logic.entities[logic.selectedEntity];
        document.getElementById("xPos").value = Math.floor(entity.position.x);
        document.getElementById("yPos").value = Math.floor(entity.position.y);
        document.getElementById("zPos").value = Math.floor(entity.position.z);
        document.getElementById("xRot").value = Math.floor(entity.rotation.x);
        document.getElementById("yRot").value = Math.floor(entity.rotation.y);
        document.getElementById("zRot").value = Math.floor(entity.rotation.z);
        document.getElementById("xScale").value = Math.floor(entity.scale.x);
        document.getElementById("yScale").value = Math.floor(entity.scale.y);
        document.getElementById("zScale").value = Math.floor(entity.scale.z);

        document.getElementById("rSlider").value = Math.floor(entity.color[0]);
        document.getElementById("gSlider").value = Math.floor(entity.color[1]);
        document.getElementById("bSlider").value = Math.floor(entity.color[2]);
        document.getElementById("massInput").value = Math.floor(entity.mass);
        document.getElementById("massSlider").value = Math.floor(entity.mass);
        document.getElementById("kinematicInput").checked = entity.kinematic;
        document.getElementById("staticInput").checked = entity.static;
        document.getElementById("gravityInput").checked = entity.gravity;
        document.getElementById("nameInput").value = entity.name;
        document.getElementById("tagInput").value = entity.tag;
    }
    else {
        for (let element of document.getElementById("inspector").getElementsByClassName("component")) {
            element.style.opacity = "0%";
            element.style.width = "0%";
            element.style.flexGrow = "0";
        }
    }
}
document.getElementById("canvas").oncontextmenu = (event) => { // Right click
    event.preventDefault();
    logic.CreateEntity(new Vector3(logic.mouseX / 100, logic.mouseY / 100, 2), new Vector3(120, 180, 0), new Vector3(1, 1, 1), "file/Models/Monkey.json", "file/Images/Debug.png");
}
document.getElementById("canvas").addEventListener("wheel", event => { // Scroll wheel
    const delta = Math.sign(event.deltaY);
    //ScaleViewport(delta);
});

// Updating behavior
document.getElementById("scriptText").oninput = function () {
    if (logic.selectedEntity != -1) {
        logic.entities[logic.selectedEntity].behavior = document.getElementById("scriptText").value;
    }
}

// Transform values
document.getElementById("xPos").oninput = function () { UpdateComponents(); };
document.getElementById("yPos").oninput = function () { UpdateComponents(); };
document.getElementById("zPos").oninput = function () { UpdateComponents(); };
document.getElementById("xRot").oninput = function () { UpdateComponents(); };
document.getElementById("yRot").oninput = function () { UpdateComponents(); };
document.getElementById("zRot").oninput = function () { UpdateComponents(); };
document.getElementById("xScale").oninput = function () { UpdateComponents(); };
document.getElementById("yScale").oninput = function () { UpdateComponents(); };
document.getElementById("zScale").oninput = function () { UpdateComponents(); };

document.getElementById("rSlider").oninput = function () { UpdateComponents(); };
document.getElementById("gSlider").oninput = function () { UpdateComponents(); };
document.getElementById("bSlider").oninput = function () { UpdateComponents(); };
document.getElementById("massInput").oninput = function () { UpdateComponents(); };
document.getElementById("kinematicInput").oninput = function () { UpdateComponents(); };
document.getElementById("staticInput").oninput = function () { UpdateComponents(); };
document.getElementById("gravityInput").oninput = function () { UpdateComponents(); };
document.getElementById("nameInput").oninput = function () { UpdateComponents(); };
document.getElementById("tagInput").oninput = function () { UpdateComponents(); };

function UpdateComponents() { // Updates the entities attributes to the component values
    logic.entities[logic.selectedEntity].position = new Vector3(parseInt(document.getElementById("xPos").value), parseInt(document.getElementById("yPos").value), parseInt(document.getElementById("zPos").value));
    logic.entities[logic.selectedEntity].rotation = new Vector3(parseInt(document.getElementById("xRot").value), parseInt(document.getElementById("yRot").value), parseInt(document.getElementById("zRot").value));
    logic.entities[logic.selectedEntity].scale = new Vector3(parseInt(document.getElementById("xScale").value), parseInt(document.getElementById("yScale").value), parseInt(document.getElementById("zScale").value));

    logic.entities[logic.selectedEntity].color[0] = parseInt(document.getElementById("rSlider").value);
    logic.entities[logic.selectedEntity].color[1] = parseInt(document.getElementById("gSlider").value);
    logic.entities[logic.selectedEntity].color[2] = parseInt(document.getElementById("bSlider").value);
    logic.entities[logic.selectedEntity].mass = parseInt(document.getElementById("massInput").value);
    logic.entities[logic.selectedEntity].kinematic = document.getElementById("kinematicInput").checked;
    logic.entities[logic.selectedEntity].static = document.getElementById("staticInput").checked;
    logic.entities[logic.selectedEntity].gravity = document.getElementById("gravityInput").checked;

    logic.entities[logic.selectedEntity].name = document.getElementById("nameInput").value;
    logic.entities[logic.selectedEntity].tag = document.getElementById("tagInput").value;
}

window.onload = function () {
    init(); brython();
    ComponentSetup();
}