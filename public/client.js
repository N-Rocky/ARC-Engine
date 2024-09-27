// Scene Window, Game Window, and Logic
let scene; let game; let logic; const resolution = 2;

async function init() { // Initialize scene canvas and logic

    let sceneCanvas = document.getElementById("scene");
    sceneCanvas.width = sceneCanvas.clientWidth;
    sceneCanvas.height = sceneCanvas.clientHeight;
    scene = new PIXI.Application();
    await scene.init({
        view: sceneCanvas,
        width: sceneCanvas.width,
        height: sceneCanvas.height,
        background: '#ffff',
        resolution: resolution
    });
    scene.ticker.start();

    let gameCanvas = document.getElementById("game");
    gameCanvas.width = document.body.clientWidth;
    gameCanvas.height = document.body.clientHeight;
    game = new PIXI.Application();
    await game.init({
        view: gameCanvas,
        width: gameCanvas.width,
        height: gameCanvas.height,
        background: '#ffff',
        resolution: resolution
    });
    game.ticker.stop();

    logic = new Logic();
    logic.LoadProject();
    logic.LoadAssets();

    RenderScreen(); // Begin render loop
}

function Playmode() { // Enter playtest mode
    if (!logic.running) { // Run game
        document.getElementById("game").style.width = "100dvw";
        document.getElementById("game").style.height = "100dvh";

        // PIXI Tickers
        scene.ticker.stop();
        game.ticker.start();

        logic.Playtest(); // Play game in logic
    }
    else { // Close game
        document.getElementById("game").style.width = "0dvw";
        document.getElementById("game").style.height = "0dvh";

        // PIXI Tickers
        game.ticker.stop();
        scene.ticker.start();

        logic.Quit(); // Quit game in logic
    }
}

function RenderScreen(timestamp) {
    if (logic.running) { // Game view
        logic.Update(timestamp);
        game.stage.pivot.x = logic.camera.position.x;
        game.stage.pivot.y = logic.camera.position.y;
        game.stage.position.x = game.canvas.width / resolution / 2;
        game.stage.position.y = game.canvas.height / resolution / 2;
        for (let entity of logic.gameEntities) {
            try {
                entity.renderer.position.x = entity.position.x;
                entity.renderer.position.y = entity.position.y;

                entity.renderer.anchor.set(0.5);

                entity.renderer.width = entity.width;
                entity.renderer.height = entity.height;
                entity.renderer.rotation = entity.rotation * Math.PI / 180;
                entity.renderer.zIndex = entity.zIndex;
                entity.renderer.tint = [entity.color[0] / 255, entity.color[1] / 255, entity.color[2] / 255];
            }
            catch { }
        }
    }
    else { // Scene view
        scene.stage.pivot.x = logic.viewport.position.x;
        scene.stage.pivot.y = logic.viewport.position.y;
        scene.stage.position.x = scene.canvas.width / resolution / 2;
        scene.stage.position.y = scene.canvas.height / resolution / 2;
        for (let entity of logic.sceneEntities) {
            try {
                entity.renderer.position.x = entity.position.x;
                entity.renderer.position.y = entity.position.y;

                entity.renderer.anchor.set(0.5);

                entity.renderer.width = entity.width;
                entity.renderer.height = entity.height;
                entity.renderer.rotation = entity.rotation * Math.PI / 180;
                entity.renderer.zIndex = entity.zIndex;
                entity.renderer.tint = [entity.color[0] / 255, entity.color[1] / 255, entity.color[2] / 255];
                if (logic.sceneEntities.indexOf(entity) == logic.selectedEntity) {
                    
                }
            }
            catch { }
        }
    }
    requestAnimationFrame(RenderScreen);
}

function Random(min, max) { // Inclusive, exclusive
    return Math.floor(Math.random() * (max - min) + min);
}

function AudioSource(source) { // Create and add an audio element
    audio = document.createElement("AUDIO");
    audio.src = "Assets/Audio/" + source;
    audio.type = 'audio/mpeg';
    audio.loop = false;
    audio.volume = 1;
    audio.autoplay = true;
    document.body.appendChild(audio);
    setTimeout(function (element) {
        if (!audio.paused) { // Still playing, so wait until it is done
            setTimeout(function (element) { element.remove(); }, element.duration * 1000, element);
        }
        else { element.remove(); }
    }, 1000, audio); // Wait one second before checking if it finished playing (Due to load times)
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
                document.getElementById("scriptText").value = logic.sceneEntities[logic.selectedEntity].behavior;
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
                logic.sceneEntities[logic.selectedEntity].Delete();
            }
            break;
        case "KeyT":
            console.log("Entities:"); console.log(logic.gameEntities); break;
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
        if (inputs.lArrow) { logic.viewport.position.x -= 5; }
        if (inputs.rArrow) { logic.viewport.position.x += 5; }
        if (inputs.uArrow) { logic.viewport.position.y -= 5; }
        if (inputs.dArrow) { logic.viewport.position.y += 5; }
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
document.getElementById("scene").onmouseup = (event) => { // Left click release on scene view
    logic.UpdateMouse(event.clientX, event.clientY);
    logic.HandleClick();

    if (logic.selectedEntity != -1) {
        for (let element of document.getElementById("inspector").getElementsByClassName("component")) {
            element.style.opacity = "100%";
            element.style.width = "100%";
            element.style.flexGrow = "1";
        }

        let entity = logic.sceneEntities[logic.selectedEntity];
        document.getElementById("xInput").value = Math.floor(entity.position.x);
        document.getElementById("xSlider").value = Math.floor(entity.position.x);
        document.getElementById("yInput").value = Math.floor(entity.position.y);
        document.getElementById("ySlider").value = Math.floor(entity.position.y);
        document.getElementById("widthInput").value = Math.floor(entity.width);
        document.getElementById("widthSlider").value = Math.floor(entity.width);
        document.getElementById("heightInput").value = Math.floor(entity.height);
        document.getElementById("heightSlider").value = Math.floor(entity.height);
        document.getElementById("rotationSlider").value = Math.floor(entity.rotation);
        document.getElementById("zInput").value = entity.zIndex;
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
document.getElementById("scene").oncontextmenu = (event) => { // Right click
    event.preventDefault();
    logic.CreateEntity(new Vector2(logic.mouseX, logic.mouseY), 50, 50, "Square.png");
}
document.getElementById("scene").addEventListener("wheel", event => { // Scroll wheel
    const delta = Math.sign(event.deltaY);
    ScaleViewport(delta);
});

// Updating behavior
document.getElementById("scriptText").oninput = function () {
    if (logic.selectedEntity != -1) {
        logic.sceneEntities[logic.selectedEntity].behavior = document.getElementById("scriptText").value;
    }
}

// Transform values
document.getElementById("xInput").oninput = function () { document.getElementById("xSlider").value = document.getElementById("xInput").value; UpdateComponents(); };
document.getElementById("yInput").oninput = function () { document.getElementById("ySlider").value = document.getElementById("yInput").value; UpdateComponents(); };
document.getElementById("widthInput").oninput = function () { document.getElementById("widthSlider").value = document.getElementById("widthInput").value; UpdateComponents(); };
document.getElementById("heightInput").oninput = function () { document.getElementById("heightSlider").value = document.getElementById("heightInput").value; UpdateComponents(); };
document.getElementById("rotationSlider").oninput = function () { UpdateComponents(); };
document.getElementById("zInput").oninput = function () { UpdateComponents(); };
document.getElementById("rSlider").oninput = function () { UpdateComponents(); };
document.getElementById("gSlider").oninput = function () { UpdateComponents(); };
document.getElementById("bSlider").oninput = function () { UpdateComponents(); };
document.getElementById("massInput").oninput = function () { document.getElementById("massSlider").value = document.getElementById("massInput").value; UpdateComponents(); };
document.getElementById("xSlider").oninput = function () { document.getElementById("xInput").value = document.getElementById("xSlider").value; UpdateComponents(); };
document.getElementById("ySlider").oninput = function () { document.getElementById("yInput").value = document.getElementById("ySlider").value; UpdateComponents(); };
document.getElementById("widthSlider").oninput = function () { document.getElementById("widthInput").value = document.getElementById("widthSlider").value; UpdateComponents(); };
document.getElementById("heightSlider").oninput = function () { document.getElementById("heightInput").value = document.getElementById("heightSlider").value; UpdateComponents(); };
document.getElementById("massSlider").oninput = function () { document.getElementById("massInput").value = document.getElementById("massSlider").value; UpdateComponents(); };
document.getElementById("kinematicInput").oninput = function () { UpdateComponents(); };
document.getElementById("staticInput").oninput = function () { UpdateComponents(); };
document.getElementById("gravityInput").oninput = function () { UpdateComponents(); };
document.getElementById("nameInput").oninput = function () { UpdateComponents(); };
document.getElementById("tagInput").oninput = function () { UpdateComponents(); };
function UpdateComponents() { // Updates the entities attributes to the component values
    logic.sceneEntities[logic.selectedEntity].position = new Vector2(parseInt(document.getElementById("xInput").value), parseInt(document.getElementById("yInput").value));
    logic.sceneEntities[logic.selectedEntity].width = parseInt(document.getElementById("widthInput").value);
    logic.sceneEntities[logic.selectedEntity].height = parseInt(document.getElementById("heightInput").value);
    logic.sceneEntities[logic.selectedEntity].rotation = parseInt(document.getElementById("rotationSlider").value);
    logic.sceneEntities[logic.selectedEntity].zIndex = parseInt(document.getElementById("zInput").value);
    logic.sceneEntities[logic.selectedEntity].color[0] = parseInt(document.getElementById("rSlider").value);
    logic.sceneEntities[logic.selectedEntity].color[1] = parseInt(document.getElementById("gSlider").value);
    logic.sceneEntities[logic.selectedEntity].color[2] = parseInt(document.getElementById("bSlider").value);
    logic.sceneEntities[logic.selectedEntity].mass = parseInt(document.getElementById("massInput").value);
    logic.sceneEntities[logic.selectedEntity].kinematic = document.getElementById("kinematicInput").checked;
    logic.sceneEntities[logic.selectedEntity].static = document.getElementById("staticInput").checked;
    logic.sceneEntities[logic.selectedEntity].gravity = document.getElementById("gravityInput").checked;

    logic.sceneEntities[logic.selectedEntity].name = document.getElementById("nameInput").value;
    logic.sceneEntities[logic.selectedEntity].tag = document.getElementById("tagInput").value;
}

window.onload = function () {
    init(); brython();
    ComponentSetup();
}