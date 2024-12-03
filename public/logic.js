class Logic {
    #sceneEntities = []; #gameEntities = [];
    #selectedEntity = -1;

    // Game State
    #timestep = 16; #lastUpdate = 0;
    #running = false;

    // Mouse interaction
    #mouseX; #mouseY;

    // Cameras
    #viewport; #camera;

    // Physics
    #gravity = -0.01;

    // Scripting
    #transpiler = false;
    #currentKey = null;

    constructor() { // Set camera properties
        this.#viewport = new Camera([0, 0, 0], [canvas.width, canvas.height]);
        this.#camera = new Camera([0, 0, 0], [canvas.width, canvas.height]);
    }

    Update(timestamp) { // Runs once every frame
        if (timestamp - this.#lastUpdate < this.#timestep || !this.#running) { return; } // Early exit
        this.#lastUpdate = timestamp;

        for (let entity of this.#gameEntities) {
            if (!this.#transpiler) { // Using vailla Javascript
                if (entity.behavior.includes("function Update()")) { // Uses Update function
                    eval(entity.behavior + "\nUpdate()");
                }
                if (entity.behavior.includes("function KeyPress(") && this.#currentKey != null) { // Uses KeyPress function
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
        this.#currentKey = null;
    }

    CheckCollision(entity) {
        for (let other of this.#gameEntities) {
            if (!entity.kinematic && !entity.static && !other.static && other != entity) { // Entity can collide
                let xOverlap = entity.position.x + entity.scale.x / 2 >= other.position.x - other.scale.x / 2 && entity.position.x - entity.scale.x / 2 <= other.position.x + other.scale.x / 2;
                let yOverlap = entity.position.y + entity.scale.y / 2 >= other.position.y - other.scale.y / 2 && entity.position.y - entity.scale.y / 2 <= other.position.y + other.scale.y / 2;
                let zOverlap = entity.position.z + entity.scale.z / 2 >= other.position.z - other.scale.z / 2 && entity.position.z - entity.scale.z / 2 <= other.position.z + other.scale.z / 2;
                let xCollision = false; let yCollision = false; let zCollision = false;

                while (xOverlap && yOverlap && zOverlap) {
                    let xDistance; let yDistance; let zDistance;
                    if (entity.position.x - entity.scale.x / 2 < other.position.x && entity.position.x + entity.scale.x / 2 > other.position.x) { xDistance = 0; }
                    else if (entity.position.x - entity.scale.x / 2 < other.position.x) { xDistance = Math.abs(entity.position.x + entity.scale.x / 2 - other.position.x) / other.scale.x; }
                    else if (entity.position.x + entity.scale.x / 2 > other.position.x) { xDistance = Math.abs(entity.position.x - entity.scale.x / 2 - other.position.x) / other.scale.x; }
                    if (entity.position.y - entity.scale.y / 2 < other.position.y && entity.position.y + entity.scale.y / 2 > other.position.y) { yDistance = 0; }
                    else if (entity.position.y - entity.scale.y / 2 < other.position.y) { yDistance = Math.abs(entity.position.y + entity.scale.y / 2 - other.position.y) / other.scale.y; }
                    else if (entity.position.y + entity.scale.y / 2 > other.position.y) { yDistance = Math.abs(entity.position.y - entity.scale.y / 2 - other.position.y) / other.scale.y; }
                    if (entity.position.z - entity.scale.z / 2 < other.position.z && entity.position.z + entity.scale.z / 2 > other.position.z) { zDistance = 0; }
                    else if (entity.position.z - entity.scale.z / 2 < other.position.z) { zDistance = Math.abs(entity.position.z + entity.scale.z / 2 - other.position.z) / other.scale.z; }
                    else if (entity.position.z + entity.scale.z / 2 > other.position.z) { zDistance = Math.abs(entity.position.z - entity.scale.z / 2 - other.position.z) / other.scale.z; }

                    if (xDistance > yDistance && xDistance > zDistance) {
                        if (entity.position.x < other.position.x) { entity.position.x -= 0.001; }
                        else { entity.position.x += 0.001; }
                        xCollision = true;
                    }
                    else if (yDistance > xDistance && yDistance > zDistance) {
                        if (entity.position.y < other.position.y) { entity.position.y -= 0.001; }
                        else { entity.position.y += 0.001; }
                        yCollision = true;
                    }
                    else {
                        if (entity.position.z < other.position.z) { entity.position.z -= 0.001; }
                        else { entity.position.z += 0.001; }
                        zCollision = true;
                    }

                    xOverlap = entity.position.x + entity.scale.x / 2 >= other.position.x - other.scale.x / 2 && entity.position.x - entity.scale.x / 2 <= other.position.x + other.scale.x / 2;
                    yOverlap = entity.position.y + entity.scale.y / 2 >= other.position.y - other.scale.y / 2 && entity.position.y - entity.scale.y / 2 <= other.position.y + other.scale.y / 2;
                    zOverlap = entity.position.z + entity.scale.z / 2 >= other.position.z - other.scale.z / 2 && entity.position.z - entity.scale.z / 2 <= other.position.z + other.scale.z / 2;
                }

                if (xCollision) { entity.velocity.x *= -1 * entity.elasticity; }
                if (yCollision) { entity.velocity.y *= -1 * entity.elasticity; }
                if (zCollision) { entity.velocity.z *= -1 * entity.elasticity; }
                if (Math.abs(entity.velocity.x) < 0.002) { entity.velocity.x = 0; }
                if (Math.abs(entity.velocity.y) < 0.002) { entity.velocity.y = 0; }
                if (Math.abs(entity.velocity.z) < 0.002) { entity.velocity.z = 0; }

                if (xCollision || yCollision || zCollision) {
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
    }

    HandleClick(x, y) { // Called every time the user clicks
        this.UpdateMouse(x, y);
        // Raycast to find objects clicked
    }

    Playtest() { // Start and stop the game
        if (!this.#running) {
            for (let entity of this.#sceneEntities) { // Cloned instances
                const clone = entity.Clone();
                this.#gameEntities.push(clone);
            }
            this.#camera.position = new Vector3(0, 0, 0);
            this.#running = true;
            for (let entity of this.#gameEntities) {
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
        else {
            this.#running = false;
            this.#gameEntities = [];
        }
    }

    CreateEntity(position, rotation, scale, model, texture) {
        let entities = this.#running ? this.#gameEntities : this.#sceneEntities;
        const entity = new Entity(position, rotation, scale, model, texture, "Object" + (entities.length + 1));
        entities.push(entity);
        return entity;
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

        this.#sceneEntities = [];
        for (let entityData of data.entities) {
            this.#sceneEntities.push(Entity.fromJSON(entityData));
        }
    }

    async LoadAssets() { // Loading all asset files from the datatbase
        let projectID = window.location.href.split("/");
        projectID = projectID[projectID.length - 1];

        let data;

        await fetch("/files", {
            method: "POST", headers: { "Content-type": "application/json" },
            body: JSON.stringify({
                projectID: projectID
            })
        }).then((res) => res.json()).then((res) => data = res.files);

        const displayFiles = document.getElementById("files");
        while (displayFiles.firstChild) {
            displayFiles.removeChild(displayFiles.lastChild);
        }

        for (let folder of Object.keys(data)) { // Load each asset collection
            let displayFolder = document.createElement("a"); displayFolder.classList.add("folder");
            displayFolder.textContent = folder;
            displayFolder.addEventListener("click", () => {
                while (displayFiles.firstChild) {
                    displayFiles.removeChild(displayFiles.lastChild);
                }
                for (let file of data[folder]) {

                    let fileURL = `file/${folder}/${file}`;

                    let displayFile = document.createElement("a"); displayFile.classList.add("file");
                    if (folder == "Images") { // Image file
                        displayFile.style.backgroundImage = `url('${projectID}/${fileURL}')`;
                        displayFile.addEventListener("click", () => {
                            if (this.#selectedEntity != -1) {
                                let entity = this.#sceneEntities[this.#selectedEntity];
                                entity.texture = fileURL;
                                CreateRenderer(entity);
                            }
                        });
                    }
                    else if (folder == "Audio") { // Audio file type
                        displayFile.style.backgroundImage = `url('/Resources/DefaultAudio.png')`;
                        // Implement Audio Behavior
                    }
                    else if (folder == "Models") {
                        displayFile.style.backgroundImage = `url('/Resources/DefaultFile.png')`;
                        displayFile.addEventListener("click", () => {
                            if (this.#selectedEntity != -1) {
                                let entity = this.#sceneEntities[this.#selectedEntity];
                                entity.model = fileURL;
                                CreateRenderer(entity);
                            }
                        });
                    }
                    else { // Misc. file type
                        displayFile.style.backgroundImage = `url('/Resources/DefaultFile.png')`;
                        // Implement Default Behavior
                    }
                    
                    displayFiles.appendChild(displayFile);
                }
            });
            displayFiles.appendChild(displayFolder);
        }
    }

    set currentKey(value) { this.#currentKey = value; }
    get entities() { return this.#running ? this.#gameEntities : this.#sceneEntities; }
    get selectedEntity() { return this.#selectedEntity; }
    set selectedEntity(value) { this.#selectedEntity = value; }
    get running() { return this.#running; }
    get mouseX() { return this.#mouseX; }
    get mouseY() { return this.#mouseY; }
    get viewport() { return this.#viewport; }
    get camera() { return this.#running ? this.#camera : this.#viewport; }
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
    get normalized() { return new Vector2(-this.y, this.x).unit; }
    get unit() {
        if (this.magnitude == 0) { return new Vector2(); }
        return new Vector2(this.x / this.magnitude, this.y / this.magnitude);
    }
    static dot(vector1, vector2) {
        return vector1.x * vector2.x + vector1.y * vector2.y;
    }
}

class Vector3 { // 3D Vectors
    x; y; z;
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
    add(vector) { return new Vector3(this.x + vector.x, this.y + vector.y, this.z + vector.z); }
    subtract(vector) { return new Vector3(this.x - vector.x, this.y - vector.y, this.z - vector.z); }
    multiply(factor) { return new Vector3(this.x * factor, this.y * factor, this.z * factor); }
    dot(vector) { return this.x * vector.x + this.y * vector.y + this.z * vector.z; }
    trigify(angle) { return new Vector2(Math.cos(angle * Math.PI / 180), Math.sin(angle * Math.PI / 180)); }
    cross(vector) {
        const product = new Vector3();
        product.x = (this.y * vector.z) - (this.z * vector.y);
        product.y = -1 * ((this.x * vector.z) - (this.z * vector.x));
        product.z = (this.x * vector.y) - (this.y * vector.x);
        return product;
    }
    get magnitude() { return Math.sqrt(this.x ** 2 + this.y ** 2 + this.z ** 2); }
    get normalized() { return new Vector3(this.z, -this.y, this.x).unit; }
    get unit() {
        if (this.magnitude == 0) { return new Vector3(); }
        return new Vector3(this.x / this.magnitude, this.y / this.magnitude, this.z / this.magnitude);
    }

    get clone() { return new Vector3(this.x, this.y, this.z); }

    get xValues() { return new Vector2(Math.cos(this.x * Math.PI / 180), Math.sin(this.x * Math.PI / 180)); }
    get yValues() { return new Vector2(Math.cos(this.y * Math.PI / 180), Math.sin(this.y * Math.PI / 180)); }
    get zValues() { return new Vector2(Math.cos(this.z * Math.PI / 180), Math.sin(this.z * Math.PI / 180)); }

    get matrix() {
        const ry = [[this.yValues.x, 0, this.yValues.y], [0, 1, 0], [-this.yValues.y, 0, this.yValues.x]];
        const rx = [[1, 0, 0], [0, this.xValues.x, -this.xValues.y], [0, this.xValues.y, this.xValues.x]];
        const rz = [[this.zValues.x, -this.zValues.y, 0], [this.zValues.y, this.zValues.x, 0], [0, 0, 1]];
        const matrix = [[ry[0][0] * rx[0][0] * rz[0][0], ry[0][1] * rx[0][1] * rz[0][1], ry[0][2] * rx[0][2] * rz[0][2]],
            [ry[1][0] * rx[1][0] * rz[1][0], ry[1][1] * rx[1][1] * rz[1][1], ry[1][2] * rx[1][2] * rz[1][2]],
            [ry[2][0] * rx[2][0] * rz[2][0], ry[2][1] * rx[2][1] * rz[2][1], ry[2][2] * rx[2][2] * rz[2][2]]
        ];
        return matrix;
    }

    get forward() { return new Vector3(this.yValues.y * this.xValues.x, -this.xValues.y, this.yValues.x * this.xValues.x); }

    // Fails if X, Y, and Z are rotated
    // I have two values that range from -1 to 1 (inclusive). What math equation gives me a 1 if both values are equal, a 0 if one value is 1 and the other is 0 (or one value is -1 and the other is 0), and a -1 if one value is 1 and the other is -1.
    get up() {
        return new Vector3(this.yValues.y * this.xValues.y, this.xValues.x * this.zValues.x, this.xValues.y * this.yValues.x);
        
        /*return new Vector3(
            Math.max(-this.yValues.x * this.xValues.y) * (this.trigify(this.y - this.z).y),
            this.xValues.x * this.zValues.x,
            -this.xValues.y * this.yValues.x * this.zValues.y
        );*/
    }
    //get up() { return new Vector3(this.xValues.y * this.yValues.y, this.xValues.x, this.xValues.y * this.yValues.x); }
    //get up() { return this.forward.cross(this.right); }
    
    // Fails if Z is rotated
    //get right() { return new Vector3(this.yValues.x, 0, -this.yValues.y).multiply(this.zValues.x).add(new Vector3(-this.yValues.x * this.xValues.y, this.xValues.x, -this.yValues.y * this.xValues.y).multiply(this.zValues.y)); }
    get right() { return new Vector3(-this.yValues.x, 0, this.yValues.y); }
    //get right() { return this.forward.cross(new Vector3(0, 1, 0)); }

}

// Basis for the game and viewport cameras
class Camera {
    position; rotation;
    resolution; fieldOfView;
    constructor(position, resolution) {
        this.position = new Vector3(position[0], position[1], position[2]);
        this.rotation = new Vector3(0, 0, 0);
        this.resolution = new Vector2(resolution[0], resolution[1]);
        this.fieldOfView = 80;
    }
}

class Entity { // Basis of every game object
    constructor(position, rotation, scale, model, texture, name) {
        // Identity and transform
        this.position = position; this.rotation = rotation; this.scale = scale;
        this.model = model; this.texture = texture;
        this.name = name;

        // Default values
        this.kinematic = false; this.static = false; this.gravity = true;
        this.mass = 2; this.elasticity = 0.6;
        this.velocity = new Vector3(); this.acceleration = new Vector3();
        this.tag = "Default";
        this.color = {r: 255, g: 255, b: 255};
        if (logic.transpiler) { this.behavior = "def Start():\n\n\ndef Update():\n\n\ndef KeyPress(key):\n\n\ndef Collide(other):\n\n"; }
        else { this.behavior = "function Start() {\n\n}\n\nfunction Update() {\n\n}\n\nfunction KeyPress(key) {\n\n}\n\nfunction Collide(other) {\n\n}"; }

        // Initialize the entity's WebGL renderer
        CreateRenderer(this);
    }

    Clone() { // Returns a deep copy
        let clone = new Entity(this.position.clone, this.rotation.clone, this.scale.clone, this.model, this.texture, this.name);
        clone.kinematic = this.kinematic; clone.static = this.static; clone.gravity = this.gravity;
        clone.mass = this.mass; clone.elasticity = this.elasticity;
        clone.velocity = this.velocity.clone; clone.acceleration = this.acceleration.clone;
        clone.tag = this.tag;
        clone.color = this.color;
        clone.behavior = this.behavior;
        return clone;
    }

    toJSON() { // Saves the entity as JSON
        let data = {};
        for (let attribute in this) { // Add all attributes
            if (attribute != "renderer") { // Ignore renderer
                data[attribute] = this[attribute];
            }
        }
        return data;
    }

    static fromJSON(data) { // Creates an entity from JSON
        let entity = new Entity(new Vector3(data.position.x, data.position.y, data.position.z),
            new Vector3(data.rotation.x, data.rotation.y, data.rotation.z),
            new Vector3(data.scale.x, data.scale.y, data.scale.z), data.model, data.texture, data.name);

        entity.kinematic = data.kinematic; entity.static = data.static; entity.gravity = data.gravity;
        entity.mass = data.mass; entity.elasticity = data.elasticity;
        entity.velocity = new Vector3(data.velocity.x, data.velocity.y, data.velocity.z);
        entity.acceleration = new Vector3(data.acceleration.x, data.acceleration.y, data.acceleration.z);
        entity.tag = data.tag;
        entity.color = data.color;
        entity.behavior = data.behavior;
        return entity;
    }

    Inspect() {
        const inspector = document.getElementById("inspector");
        while (inspector.lastElementChild.id != "inspectorHeader") {
            inspector.removeChild(inspector.lastElementChild);
        }

        const components = ["Identity", "Transform", "Graphics", "Physics", "Behavior"];
        for (let type of components) {
            const component = document.createElement("div"); component.classList.add("component");
            const header = document.createElement("div"); header.classList.add("componentHeader"); header.textContent = type;
            header.onclick = () => { body.style.gridTemplateRows = (body.style.gridTemplateRows == '1fr') ? '0fr' : '1fr'; }
            const body = document.createElement("div"); body.classList.add("componentBody");
            component.appendChild(header); component.appendChild(body);
            const content = document.createElement("div"); body.appendChild(content);

            if (type == "Identity") {
                for (let attribute of ["name", "tag"]) {
                    const input = document.createElement("INPUT"); input.classList.add("componentItem");
                    input.type = "text"; input.name = attribute; input.value = this[attribute];
                    const label = document.createElement("Label"); label.classList.add("componentItem");
                    label.htmlFor = attribute; label.textContent = `${attribute}:`;
                    input.oninput = () => { this[attribute] = input.value; }
                    content.appendChild(label); content.appendChild(input);
                }
            }
            else if (type == "Transform") {
                for (let attribute of ["position", "rotation", "scale"]) {
                    for (let axis of ["x", "y", "z"]) {
                        const input = document.createElement("INPUT"); input.classList.add("componentItem");
                        input.type = "number"; input.name = attribute + axis; input.value = this[attribute][axis];
                        const label = document.createElement("Label"); label.classList.add("componentItem");
                        label.htmlFor = attribute + axis; label.textContent = `${axis} ${attribute}:`;
                        input.oninput = () => { this[attribute][axis] = parseFloat(input.value); }
                        content.appendChild(label); content.appendChild(input);
                    }
                }
            }
            else if (type == "Graphics") {
                for (let color of ["r", "g", "b"]) {
                    const input = document.createElement("INPUT"); input.classList.add("componentItem");
                    input.type = "number"; input.name = color; input.value = this.color[color];
                    const label = document.createElement("Label"); label.classList.add("componentItem");
                    label.htmlFor = color; label.textContent = `${color}:`;
                    input.oninput = () => { this.color[color] = parseInt(input.value); }
                    content.appendChild(label); content.appendChild(input);
                }
            }
            else if (type == "Physics") {
                
            }
            else if (type == "Behavior") {
                
            }

            inspector.appendChild(component);
        }
    }

    Relocate() { // Move the entity based on its current acceleration and velocity
        this.acceleration = this.acceleration.unit;
        this.velocity = this.velocity.add(this.acceleration);
        this.position = this.position.add(this.velocity);
    }

    Delete() { // Remove from current entities list
        logic.entities.splice(logic.entities.indexOf(this), 1);
    }
}