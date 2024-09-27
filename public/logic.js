class Logic {
    #sceneEntities = []; #gameEntities = [];
    #selectedEntity = -1;

    // Game State
    #timestep = 16; #lastUpdate = 0; #running = false;

    // Mouse interaction
    #mouseX; #mouseY;

    // Cameras
    #viewport; #camera;

    // Physics
    #gravity = 0.5;

    // Scripting
    #transpiler = false;
    #currentKey = "";

    constructor() { // Set camera properties
        this.#viewport = new Camera([0, 0], [scene.canvas.width, scene.canvas.height]);
        this.#camera = new Camera([0, 0], [game.canvas.width, game.canvas.height]);
    }

    Update(timestamp) {
        if (timestamp - this.#lastUpdate < this.#timestep || !this.#running) { return; } // Early exit
        this.#lastUpdate = timestamp;

        for (let entity of this.#gameEntities) {
            if (!this.#transpiler) { // Using vailla Javascript
                if (entity.behavior.includes("function Update()")) { // Uses Update function
                    eval(entity.behavior + "\nUpdate()");
                }
                if (entity.behavior.includes("function KeyPress(") && this.#currentKey != "") { // Uses KeyPress function
                    eval(entity.behavior + "KeyPress('" + this.#currentKey + "')");
                }
            }
            else { // Using transpiler
                TranspileUpdate(entity);
            }
            if (entity.gravity) { entity.velocity.y += this.#gravity; }
            entity.Relocate(); // Update position of entity
            this.CheckCollision(entity);
        }

        // Reset user input
        this.#currentKey = "";
    }

    CheckCollision(entity) {
        for (let other of this.#gameEntities) {
            if (!entity.kinematic && !entity.static && !other.static && other != entity) { // Entity can collide
                let xOverlap = entity.position.x + entity.width / 2 >= other.position.x - other.width / 2 && entity.position.x - entity.width / 2 <= other.position.x + other.width / 2;
                let yOverlap = entity.position.y + entity.height / 2 >= other.position.y - other.height / 2 && entity.position.y - entity.height / 2 <= other.position.y + other.height / 2;
                let xCollision = false; let yCollision = false;

                while (xOverlap && yOverlap) {
                    let xDistance; let yDistance;
                    if (entity.position.x - entity.width / 2 < other.position.x && entity.position.x + entity.width / 2 > other.position.x) { xDistance = 0; }
                    else if (entity.position.x - entity.width / 2 < other.position.x) { xDistance = Math.abs(entity.position.x + entity.width / 2 - other.position.x) / other.width; }
                    else if (entity.position.x + entity.width / 2 > other.position.x) { xDistance = Math.abs(entity.position.x - entity.width / 2 - other.position.x) / other.width; }
                    if (entity.position.y - entity.height / 2 < other.position.y && entity.position.y + entity.height / 2 > other.position.y) { yDistance = 0; }
                    else if (entity.position.y - entity.height / 2 < other.position.y) { yDistance = Math.abs(entity.position.y + entity.height / 2 - other.position.y) / other.height; }
                    else if (entity.position.y + entity.height / 2 > other.position.y) { yDistance = Math.abs(entity.position.y - entity.height / 2 - other.position.y) / other.height; }

                    if (xDistance > yDistance) {
                        if (entity.position.x < other.position.x) { entity.position.x -= 1; }
                        else { entity.position.x += 1; }
                        xCollision = true;
                    }
                    else {
                        if (entity.position.y < other.position.y) { entity.position.y -= 1; }
                        else { entity.position.y += 1; }
                        yCollision = true;
                    }

                    xOverlap = entity.position.x + entity.width / 2 >= other.position.x - other.width / 2 && entity.position.x - entity.width / 2 <= other.position.x + other.width / 2;
                    yOverlap = entity.position.y + entity.height / 2 >= other.position.y - other.height / 2 && entity.position.y - entity.height / 2 <= other.position.y + other.height / 2;
                }

                if (xCollision) { entity.velocity.x *= -1 * entity.elasticity; }
                if (yCollision) { entity.velocity.y *= -1 * entity.elasticity; }
                if (Math.abs(entity.velocity.x) < 0.2) { entity.velocity.x = 0; }
                if (Math.abs(entity.velocity.y) < 0.2) { entity.velocity.y = 0; }

                if (xCollision || yCollision) {
                    if (!this.#transpiler) { // Using vailla Javascript
                        if (entity.behavior.includes("function Collide(")) { // Uses Update function
                            eval(entity.behavior + "\nCollide(other)");
                        }
                    }
                    else { // Using transpiler
                        TranspileUpdate(entity);
                    }
                }
            }
        }
    }

    UpdateMouse(x, y) { // Mouse movement
        this.#mouseX = x;
        this.#mouseY = y;
        if (!this.#running) { // Scene view
            // Shift in relation to the scene camera
            this.#mouseX -= (-this.#viewport.position.x + this.#viewport.resolution.x / resolution / 2);
            this.#mouseY -= (-this.#viewport.position.y + this.#viewport.resolution.y / resolution / 2);
        }
        else {
            // Shift in relation to the game camera
            this.#mouseX -= (-this.#camera.position.x + this.#camera.resolution.x / 2);
            this.#mouseY -= (-this.#camera.position.y + this.#camera.resolution.y / 2);
        }
    }

    HandleClick() { // Called every time the user clicks
        if (!this.#running) { // Scene click
            const currentSelection = this.#selectedEntity;
            let newSelection = false;
            for (let entity of this.#sceneEntities) { // Check for click on an entity
                let xCondition = (this.#mouseX >= entity.position.x - entity.width / 2 && this.#mouseX <= entity.position.x + entity.width / 2);
                let yCondition = (this.#mouseY >= entity.position.y - entity.height / 2 && this.#mouseY <= entity.position.y + entity.height / 2);
                if (xCondition && yCondition && this.#selectedEntity != this.#sceneEntities.indexOf(entity) && currentSelection != this.#sceneEntities.indexOf(entity)) {
                    if (newSelection && entity.zIndex > this.#sceneEntities[this.#selectedEntity].zIndex) {
                        this.#selectedEntity = this.#sceneEntities.indexOf(entity);
                    }
                    else if (!newSelection) {
                        newSelection = true;
                        this.#selectedEntity = this.#sceneEntities.indexOf(entity);
                    }
                }
            }
            if (!newSelection) { this.#selectedEntity = -1; }
        }
    }

    Playtest() {
        for (let entity of this.#sceneEntities) { // Cloned instances
            const clone = entity.Clone();
            this.#gameEntities.push(clone);
        }
        this.#camera.position = new Vector2(0, 0);
        this.#running = true;
        for (let index = 0; index < this.#gameEntities.length; index++) {

            let entity = this.#gameEntities[index];

            // Start Method
            if (!this.#transpiler) { // Using vanilla Javascript
                if (entity.behavior.includes("function Start()")) {
                    eval(entity.behavior + "\nStart()");
                } else { eval(entity.behavior); }
            }
            else { // Using transpiler
                TranspileStart(entity);
            }
        }
    }

    Quit() {
        this.#running = false;
        this.#gameEntities = [];
        try { while (scene.stage.children[0]) { scene.stage.removeChild(scene.stage.children[0]); }
        } catch { }
        try { while (game.stage.children[0]) { game.stage.removeChild(game.stage.children[0]); }
        } catch { }
        for (let entity of this.#sceneEntities) {
            entity.LoadRenderer();
        }
    }

    CreateEntity(position, width, height, source) {
        if (this.#running) { return; }
        const entity = new Entity(position, width, height, source, "Object" + (this.#sceneEntities.length + 1));
        this.#sceneEntities.push(entity);
    }

    async SaveProject() {
        let projectID = window.location.href.split("/");
        projectID = projectID[projectID.length - 1];
    
        let data = {};
        let entityData = [];
        for (let entity of this.#sceneEntities) {
            entityData.push(entity.toJSON());
        }
        data["entities"] = entityData;

        await fetch("/save", {
            method: "POST", headers: { "Content-type": "application/json" },
            body: JSON.stringify({
                project: data,
                projectID: projectID
            })
        });
    }
    
    async LoadProject() {
        let projectID = window.location.href.split("/");
        projectID = projectID[projectID.length - 1];
    
        let data;
    
        await fetch("/load", {
            method: "POST", headers: { "Content-type": "application/json" },
            body: JSON.stringify({
                projectID: projectID
            })
        }).then((res) => res.json()).then((res) => data = res);

        try { // Clear the screen and current entities
            while (scene.stage.children[0]) { scene.stage.removeChild(scene.stage.children[0]); }
        } catch { }

        this.#sceneEntities = [];
        for (let entityData of data.entities) {
            this.#sceneEntities.push(Entity.fromJSON(entityData));
        }
    }

    async LoadAssets() {
        let projectID = window.location.href.split("/");
        projectID = projectID[projectID.length - 1];

        let data;

        await fetch("/files", {
            method: "POST", headers: { "Content-type": "application/json" },
            body: JSON.stringify({
                projectID: projectID
            })
        }).then((res) => res.json()).then((res) => data = res);

        const files = document.getElementById("files");
        while (files.firstChild) {
            files.removeChild(files.lastChild);
        }
        for (let file of data.files) {
            let element = document.createElement("a");
            element.classList.add("file");

            element.style.backgroundImage = `url('${projectID}/file/${file}')`;
            element.addEventListener("click", () => {
                if (this.#selectedEntity != -1) {
                    let entity = this.#sceneEntities[this.#selectedEntity]
                    entity.source = file;
                    scene.stage.removeChild(entity.renderer);
                    entity.LoadRenderer();
                }
            });

            files.appendChild(element);
        }
    }

    set currentKey(value) { this.#currentKey = value; }
    get sceneEntities() { return this.#sceneEntities; }
    get gameEntities() { return this.#gameEntities; }
    get selectedEntity() { return this.#selectedEntity; }
    get running() { return this.#running; }
    get mouseX() { return this.#mouseX; }
    get mouseY() { return this.#mouseY; }
    get viewport() { return this.#viewport; }
    get camera() { return this.#camera; }
    get transpiler() { return this.#transpiler; }
}

class Vector2 { // 2D Vectors
    x; y;
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }
    add(vector) {
        return new Vector2(this.x + vector.x, this.y + vector.y);
    }
    subtract(vector) {
        return new Vector2(this.x - vector.x, this.y - vector.y);
    }
    multiply(factor) {
        return new Vector2(this.x * factor, this.y * factor);
    }
    get magnitude() { return Math.sqrt(this.x ** 2 + this.y ** 2); }
    get normalized() {
        return new Vector2(-this.y, this.x).unit();
    }
    get unit() {
        if (this.magnitude == 0) { return new Vector2(); }
        return new Vector2(this.x / this.magnitude, this.y / this.magnitude);
    }
    static dot(vector1, vector2) {
        return vector1.x * vector2.x + vector1.y * vector2.y;
    }
}

// Basis for the game and viewport cameras
class Camera {
    position;
    resolution;

    constructor(position, resolution) {
        this.position = new Vector2(position[0], position[1]);
        this.resolution = new Vector2(resolution[0], resolution[1]);
    }
}

class Entity { // Basis of every game object
    constructor(position, width, height, source, name) {
        // Identity and transform
        this.position = position;
        this.width = width;
        this.height = height;
        this.source = source;
        this.name = name;

        // Default values
        this.rotation = 0;
        this.kinematic = false;
        this.static = false;
        this.gravity = false;
        this.mass = 2;
        this.elasticity = 0.6;
        this.velocity = new Vector2();
        this.acceleration = new Vector2();
        this.tag = "Default";
        this.zIndex = 0;
        this.color = [Random(0, 255), Random(0, 255), Random(0, 255)];
        if (logic.transpiler) { this.behavior = "def Start():\n\n\ndef Update():\n\n\ndef KeyPress(key):\n\n\ndef Collide(other):\n\n"; }
        else { this.behavior = "function Start() {\n\n}\n\nfunction Update() {\n\n}\n\nfunction KeyPress(key) {\n\n}\n\nfunction Collide(other) {\n\n}"; }

        // Render to the canvas
        this.LoadRenderer();
    }

    Clone() { // Returns a deep copy
        let clone = new Entity(this.position, this.width, this.height, this.source, this.name);
        clone.rotation = this.rotation;
        clone.kinematic = this.kinematic;
        clone.static = this.static;
        clone.gravity = this.gravity;
        clone.mass = this.mass;
        clone.elasticity = this.elasticity;
        clone.velocity = this.velocity;
        clone.acceleration = this.acceleration;
        clone.tag = this.tag;
        clone.zIndex = this.zIndex;
        clone.color = this.color;
        clone.behavior = this.behavior;
        return clone;
    }

    toJSON() {
        let data = {};
        data.position = this.position;
        data.width = this.width;
        data.height = this.height;
        data.rotation = this.rotation;
        data.source = this.source;
        data.name = this.name;
        data.kinematic = this.kinematic;
        data.static = this.static;
        data.gravity = this.gravity;
        data.mass = this.mass;
        data.elasticity = this.elasticity;
        data.velocity = this.velocity;
        data.acceleration = this.acceleration;
        data.tag = this.tag;
        data.zIndex = this.zIndex;
        data.color = this.color;
        data.behavior = this.behavior;
        return data;
    }

    static fromJSON(data) {
        let entity = new Entity(new Vector2(data.position.x, data.position.y), data.width, data.height, data.source, data.name);
        entity.rotation = data.rotation;
        entity.kinematic = data.kinematic;
        entity.static = data.static;
        entity.gravity = data.gravity;
        entity.mass = data.mass;
        entity.elasticity = data.elasticity;
        entity.velocity = new Vector2(data.velocity.x, data.velocity.y);
        entity.acceleration = new Vector2(data.acceleration.x, data.acceleration.y);
        entity.tag = data.tag;
        entity.zIndex = data.zIndex;
        entity.color = data.color;
        entity.behavior = data.behavior;
        return entity;
    }

    async LoadRenderer() {
        await PIXI.Assets.load("file/" + this.source);
        this.renderer = PIXI.Sprite.from("file/" + this.source);
        this.renderer.width = this.width;
        this.renderer.height = this.height;
        this.renderer.x = this.position.x;
        this.renderer.y = this.position.y;
        this.renderer.anchor.set(0.5);
        this.renderer.rotation = this.rotation;
        this.renderer.zIndex = this.zIndex;
        this.renderer.tint = [this.color[0] / 255, this.color[1] / 255, this.color[2] / 255];
        if (!logic.running) {
            scene.stage.addChild(this.renderer);
        }
        else {
            game.stage.addChild(this.renderer);
        }
    }

    Relocate() { // Move the entity based on its current acceleration and velocity
        this.acceleration = this.acceleration.unit;
        this.velocity = this.velocity.add(this.acceleration);
        this.position = this.position.add(this.velocity);
    }

    Delete() {
        if (logic.running) {
            logic.gameEntities.splice(logic.gameEntities.indexOf(this), 1);
            game.stage.removeChild(this.renderer);
        }
        else {
            logic.sceneEntities.splice(logic.sceneEntities.indexOf(this), 1);
            scene.stage.removeChild(this.renderer);
        }
    }
}