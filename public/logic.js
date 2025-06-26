class Logic {
    #sceneEntities = [];
    #gameEntities = [];
    #selected = null;

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

        for (let index = 0; index < this.#gameEntities.length; index++) {
            // Execute entity code
            const entity = this.#gameEntities[index];
            if (!this.#transpiler) { // Using vailla Javascript
                if (entity.behavior.includes("function Update()")) { // Uses Update function
                    eval(entity.behavior + "\nUpdate()");
                }
                if (entity.behavior.includes("function KeyPress(") && this.#currentKey != null) { // Uses KeyPress function
                    eval(entity.behavior + "KeyPress('" + this.#currentKey + "')");
                }
            }
            else { TranspileUpdate(entity); } // Using transpiler

            // Simulate physics
            if (entity.gravity && !entity.kinematic) { entity.velocity.y += this.#gravity; }
            entity.Relocate(); // Update position of entity by applying acceleration and velocity forces
            if (!entity.static) { // Participates in the physics simulation
                for (let splice = index + 1; splice < this.#gameEntities.length; splice++) {
                    const other = this.#gameEntities[splice];
                    if (other.static || !this.Collide(entity, other)) { continue; } // Static or no collision
                    console.log("COLLIDED!");
                }
            }
        }

        // Reset user input
        this.#currentKey = null;
    }

    Collide(entity, other) { // Check for collision between two entities
        let collided = false;
        if (entity.collider.type == other.collider.type && entity.collider.type == "sphere") { // Sphere + Sphere collision
            collided = this.SphereCollision(entity, other);
        }
        else if (entity.collider.type == "sphere" && other.collider.type == "line") { // Sphere + Line collision
            collided = this.SphereLineCollision(entity, other);
        }
        else if (entity.collider.type == "line" && other.collider.type == "sphere") { // Line + Sphere collision
            collided = this.SphereLineCollision(other, entity);
        }
        else if (entity.collider.type == other.collider.type && entity.collider.type == "capsule") { // Capsule + Capsule collision
            collided = this.CapsuleCollision(entity, other);
        }

        if (collided) {
            if (!this.#transpiler) { // Using vailla Javascript
                if (entity.behavior.includes("function Collide(")) { eval(entity.behavior + "\nCollide(other)"); }
                if (other.behavior.includes("function Collide(")) { eval(other.behavior + "\nCollide(entity)"); }
            }
            else { // Using transpiler
                TranspileCollide(entity, other);
                TranspileCollide(other, entity);
            }
        }

        return collided;
    }

    ClosestPoint(start, end, point) {
        const startDist = start.subtract(point);
        const endDist = point.subtract(end);
        if (end.subtract(start).unit.dot(startDist) > 0) {
            return start;
        }
        else if (end.subtract(start).unit.dot(endDist) > 0) {
            return end;
        }
        const closestDist = end.subtract(start).unit.dot(startDist);
        const closestVec = end.subtract(start).unit.multiply(closestDist);
        return start.subtract(closestVec);
    }

    SphereCollision(entity, other) { // Sphere + Sphere collision
        const col1 = entity.collider; const col2 = other.collider;
        const radius1 = Math.max(col1.width, col1.height); const radius2 = Math.max(col2.width, col2.height);
        if (radius1 + radius2 >= other.position.subtract(entity.position).magnitude) {
            let invMass1 = 0; if (entity.mass != 0 && !entity.kinematic) { invMass1 = 1 / entity.mass; }
            let invMass2 = 0; if (other.mass != 0 && !other.kinematic) { invMass2 = 1 / other.mass; }
            const dist = entity.position.subtract(other.position);
            const pen_depth = radius1 + radius2 - dist.magnitude;
            const pen_res = dist.unit.multiply(pen_depth / (invMass1 + invMass2));
            entity.position = entity.position.add(pen_res.multiply(invMass1));
            other.position = other.position.add(pen_res.multiply(-invMass2));

            const normal = entity.position.subtract(other.position).unit;
            const relVel = entity.velocity.subtract(other.velocity);
            const sepVel = relVel.dot(normal);
            const newSepVel = -sepVel * Math.max(entity.elasticity, other.elasticity);

            const vsepDiff = newSepVel - sepVel;
            const impulse = vsepDiff / (invMass1 + invMass2);
            const impulseVec = normal.multiply(impulse);

            entity.velocity = entity.velocity.add(impulseVec.multiply(invMass1));
            other.velocity = other.velocity.add(impulseVec.multiply(-invMass2));

            return true;
        }
        return false;
    }

    SphereLineCollision(entity, other) { // Sphere + Line collision
        const col1 = entity.collider; const col2 = other.collider;
        const lineStart = other.position.subtract(other.rotation.forward.multiply(other.collider.width / 2));
        const lineEnd = other.position.add(other.rotation.forward.multiply(other.collider.width / 2));
        const closestPoint = this.ClosestPoint(lineStart, lineEnd, entity.position);
        if (closestPoint.subtract(entity.position).magnitude <= col1.width) {
            const penVec = entity.position.subtract(closestPoint);
            entity.position = entity.position.add(penVec.unit.multiply(col1.width - penVec.magnitude));
            const normal = entity.position.subtract(closestPoint).unit;
            const sepVel = entity.velocity.dot(normal);
            const newSepVel = -sepVel * entity.elasticity;
            const vsepDiff = sepVel - newSepVel;
            entity.velocity = entity.velocity.add(normal.multiply(-vsepDiff));
            return true;
        }
        return false;
    }

    CapsuleCollision(entity, other) {
        const col1 = entity.collider; const col2 = other.collider;
        const entityStart = entity.position.subtract(entity.rotation.forward.multiply(col1.height / 2));
        const entityEnd = entity.position.add(entity.rotation.forward.multiply(col1.height / 2));
        const otherStart = other.position.subtract(other.rotation.forward.multiply(col2.height / 2));
        const otherEnd = other.position.add(other.rotation.forward.multiply(col2.height / 2));
        let shortestDist = this.ClosestPoint(otherStart, otherEnd, entityStart).subtract(entityStart).magnitude;
        let closestPoints = [entityStart, this.ClosestPoint(otherStart, otherEnd, entityStart)];
        if (this.ClosestPoint(otherStart, otherEnd, entityEnd).subtract(entityEnd).magnitude < shortestDist) {
            shortestDist = this.ClosestPoint(otherStart, otherEnd, entityEnd).subtract(entityEnd).magnitude;
            closestPoints = [entityEnd, this.ClosestPoint(otherStart, otherEnd, entityEnd)];
        }
        if (this.ClosestPoint(entityStart, entityEnd, otherStart).subtract(otherStart).magnitude < shortestDist) {
            shortestDist = this.ClosestPoint(entityStart, entityEnd, otherStart).subtract(otherStart).magnitude;
            closestPoints = [this.ClosestPoint(entityStart, entityEnd, otherStart), otherStart];
        }
        if (this.ClosestPoint(entityStart, entityEnd, otherEnd).subtract(otherEnd).magnitude < shortestDist) {
            shortestDist = this.ClosestPoint(entityStart, entityEnd, otherEnd).subtract(otherEnd).magnitude;
            closestPoints = [this.ClosestPoint(entityStart, entityEnd, otherEnd), otherEnd];
        }

        if (col1.width + col2.width >= closestPoints[0].subtract(closestPoints[1]).magnitude) {
            let invMass1 = 0; if (entity.mass != 0 && !entity.kinematic) { invMass1 = 1 / entity.mass; }
            let invMass2 = 0; if (other.mass != 0 && !other.kinematic) { invMass2 = 1 / other.mass; }
            const dist = closestPoints[0].subtract(closestPoints[1]);
            const pen_depth = col1.width + col2.width - dist.magnitude;
            const pen_res = dist.unit.multiply(pen_depth / (invMass1 + invMass2));
            entity.position = entity.position.add(pen_res.multiply(invMass1));
            other.position = other.position.add(pen_res.multiply(-invMass2));

            const normal = closestPoints[0].subtract(closestPoints[1]).unit;
            const relVel = entity.velocity.subtract(other.velocity);
            const sepVel = relVel.dot(normal);
            const newSepVel = -sepVel * Math.max(entity.elasticity, other.elasticity);

            const vsepDiff = newSepVel - sepVel;
            const impulse = vsepDiff / (invMass1 + invMass2);
            const impulseVec = normal.multiply(impulse);

            entity.velocity = entity.velocity.add(impulseVec.multiply(invMass1));
            other.velocity = other.velocity.add(impulseVec.multiply(-invMass2));
            return true;
        }
        return false;
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
                const clone = entity.clone();
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

    CreateEntity(position, rotation, scale, model, texture) { // Creates a new entity object and assigns it to the correct list of entities
        let entities = this.#running ? this.#gameEntities : this.#sceneEntities;
        const entity = new Entity(position, rotation, scale, model, texture, "Object" + (entities.length + 1));
        entities.push(entity);
        return entity;
    }

    async SaveProject() { // Saves the current state of the project (Saves entities as json and screenshots the viewport)
        let projectID = window.location.href.split("/");
        projectID = projectID[projectID.length - 1];
    
        // Data to be saved
        const data = {};
        
        // Saving the entities in the scene
        const entityData = [];
        for (let entity of this.#sceneEntities) {
            entityData.push(entity.toJSON());
        }
        data["entities"] = entityData;

        // Saving the cover image
        const screenshot = canvas.toDataURL('png');

        await fetch("/save", {
            method: "POST", headers: { "Content-type": "application/json" },
            body: JSON.stringify({
                project: data,
                cover: screenshot,
                projectID: projectID
            })
        });
    }
    
    async LoadProject() { // Loads the most recent save of the project (Scene entities and their data)
        let projectID = window.location.href.split("/");
        projectID = projectID[projectID.length - 1];
    
        // Data to be loaded
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

        // Assets to be loaded
        let data;

        await fetch("/files", {
            method: "POST", headers: { "Content-type": "application/json" },
            body: JSON.stringify({
                projectID: projectID
            })
        }).then((res) => res.json()).then((res) => data = res.files);

        const taskbar = document.getElementById("taskbar");
        while (taskbar.firstChild) {
            taskbar.removeChild(taskbar.lastChild);
        }

        let currentFolder = null;
        for (let folder of Object.keys(data)) { // Load each asset collection
            let displayFolder = document.createElement("a"); displayFolder.classList.add("folder");
            displayFolder.textContent = folder;
            displayFolder.addEventListener("click", () => {
                const displayFiles = document.getElementById("files");
                if (currentFolder == folder) {
                    displayFiles.classList.remove("openFiles");
                    currentFolder = null;
                    return;
                }
                currentFolder = folder;
                displayFiles.classList.add("openFiles");
                while (displayFiles.firstChild) {
                    displayFiles.removeChild(displayFiles.lastChild);
                }
                for (let file of data[folder]) {

                    let fileURL = `file/${folder}/${file}`;

                    let displayFile = document.createElement("a"); displayFile.classList.add("file");
                    if (folder == "Images") { // Image file
                        displayFile.style.backgroundImage = `url('${projectID}/${fileURL}')`;
                        displayFile.addEventListener("click", () => {
                            if (this.#selected != null) {
                                this.#selected.texture = fileURL;
                                CreateRenderer(this.#selected);
                            }
                        });
                    }
                    else if (folder == "Audio") { // Audio file type
                        displayFile.style.backgroundImage = `url('/Resources/AudioIcon.png')`;
                        // Implement Audio Behavior
                    }
                    else if (folder == "Models") {
                        displayFile.style.backgroundImage = `url('/Resources/FIleIcon.png')`;
                        displayFile.addEventListener("click", () => {
                            if (this.#selected != null) {
                                this.#selected.model = fileURL;
                                CreateRenderer(this.#selected);
                            }
                        });
                    }
                    else { // Misc. file type
                        displayFile.style.backgroundImage = `url('/Resources/FileIcon.png')`;
                        // Implement Default Behavior
                    }
                    
                    displayFiles.appendChild(displayFile);
                }
            });
            taskbar.appendChild(displayFolder);
        }
    }

    set currentKey(value) { this.#currentKey = value; }
    get entities() { return this.#running ? this.#gameEntities : this.#sceneEntities; }
    get selected() { return this.#selected; }
    set selected(value) { this.#selected = value; }
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

    add(vector) { return new Vector2(this.x + vector.x, this.y + vector.y); }

    subtract(vector) { return new Vector2(this.x - vector.x, this.y - vector.y); }

    multiply(factor) { return new Vector2(this.x * factor, this.y * factor); }

    dot(vector) { return this.x * vector.x + this.y * vector.y; }

    cross(vector){ return this.x * vector.y - this.y * vector.x; }

    get magnitude() { return Math.sqrt(this.x ** 2 + this.y ** 2); }
    get normalized() { return new Vector2(-this.y, this.x).unit; }
    get unit() {
        if (this.magnitude == 0) { return new Vector2(); }
        return new Vector2(this.x / this.magnitude, this.y / this.magnitude);
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
    get abs() { return new Vector3(Math.abs(this.x), Math.abs(this.y), Math.abs(this.z)); }
    get unit() {
        if (this.magnitude == 0) { return new Vector3(); }
        return new Vector3(this.x / this.magnitude, this.y / this.magnitude, this.z / this.magnitude);
    }

    get clone() { return new Vector3(this.x, this.y, this.z); }

    get r() { return this.x; } set r(value) { this.x = value; }
    get g() { return this.y; } set g(value) { this.y = value; }
    get b() { return this.z; } set b(value) { this.z = value; }

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

class Matrix {
    constructor(rows, cols) {
        this.rows = rows;
        this.cols = cols;
        this.data = [];

        for (let y = 0; index < this.rows; y++) {
            this.data[y] = [];
            for (let x = 0; x < this.cols; x++) {
                this.data[y][x] = 0;
            }
        }
    }

    multiply(vector) {
        let result = new Vector3();
        
    }
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
        this.collider = new Collider(); this.mass = 2; this.elasticity = 0.6;
        this.velocity = new Vector3(); this.acceleration = new Vector3();
        this.angularVelocity = new Vector3();
        this.tag = "Default";
        this.color = new Vector3(200, 200, 200);
        if (logic.transpiler) { this.behavior = "def Start():\n\t\n\ndef Update():\n\t\n\ndef KeyPress(key):\n\t\n\ndef Collide(other):\n\t\n"; }
        else { this.behavior = "function Start() {\n\t\n}\n\nfunction Update() {\n\t\n}\n\nfunction KeyPress(key) {\n\t\n}\n\nfunction Collide(other) {\n\t\n}"; }

        // Initialize the entity's WebGL renderer
        CreateRenderer(this);
    }

    clone() { // Returns a deep copy
        let clone = new Entity(this.position.clone, this.rotation.clone, this.scale.clone, this.model, this.texture, this.name);
        clone.kinematic = this.kinematic; clone.static = this.static; clone.gravity = this.gravity;
        clone.collider = this.collider.clone; clone.mass = this.mass; clone.elasticity = this.elasticity;
        clone.velocity = this.velocity.clone; clone.acceleration = this.acceleration.clone;
        clone.angularVelocity = this.angularVelocity.clone;
        clone.tag = this.tag;
        clone.color = this.color.clone;
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
        entity.collider = new Collider(data.collider.type, data.collider.width, data.collider.height);
        entity.mass = data.mass; entity.elasticity = data.elasticity;
        entity.velocity = new Vector3(data.velocity.x, data.velocity.y, data.velocity.z);
        entity.acceleration = new Vector3(data.acceleration.x, data.acceleration.y, data.acceleration.z);
        entity.angularVelocity = new Vector3(data.angularVelocity.x, data.angularVelocity.y, data.angularVelocity.z);
        entity.tag = data.tag;
        entity.color = new Vector3(data.color.x, data.color.y, data.color.z);
        entity.behavior = data.behavior;
        return entity;
    }

    Inspect(terminal) { // Loads the entities attributes into the inspector for manipulation
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
                        input.type = "number"; input.step = 0.1;
                        input.name = attribute + axis; input.value = this[attribute][axis];
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
                const type = document.createElement("INPUT"); type.classList.add("componentItem");
                type.type = "text"; type.name = "type"; type.value = this.collider.type;
                const label = document.createElement("Label"); label.classList.add("componentItem");
                label.htmlFor = "type"; label.textContent = "type:";
                type.oninput = () => { this.collider.type = type.value; }
                content.appendChild(label); content.appendChild(type);
                for (let attribute of ["width", "height"]) {
                    const input = document.createElement("INPUT"); input.classList.add("componentItem");
                    input.type = "number"; input.name = attribute; input.value = this.collider[attribute];
                    const label = document.createElement("Label"); label.classList.add("componentItem");
                    label.htmlFor = attribute; label.textContent = `${attribute}:`;
                    input.oninput = () => { this.collider[attribute] = parseInt(input.value); }
                    content.appendChild(label); content.appendChild(input);
                }
                for (let attribute of ["mass", "elasticity"]) {
                    const input = document.createElement("INPUT"); input.classList.add("componentItem");
                    input.type = "number"; input.name = attribute; input.value = this[attribute];
                    const label = document.createElement("Label"); label.classList.add("componentItem");
                    label.htmlFor = attribute; label.textContent = `${attribute}:`;
                    input.oninput = () => { this[attribute] = parseInt(input.value); }
                    content.appendChild(label); content.appendChild(input);
                }
                for (let attribute of ["kinematic", "static", "gravity"]) {
                    const input = document.createElement("INPUT"); input.classList.add("componentItem");
                    input.type = "checkbox"; input.name = attribute; input.checked = this[attribute];
                    const label = document.createElement("Label"); label.classList.add("componentItem");
                    label.htmlFor = attribute; label.textContent = `${attribute}:`;
                    input.oninput = () => { this[attribute] = input.checked; }
                    content.appendChild(label); content.appendChild(input);
                }
            }
            else if (type == "Behavior") {
                header.onclick = () => {
                    terminal.classList.toggle("terminalDisplay");
                    document.getElementById("scriptText").value = this.behavior;
                }
            }

            inspector.appendChild(component);
        }
    }

    Relocate() { // Move the entity based on its current acceleration and velocity
        this.acceleration = this.acceleration.unit;
        this.velocity = this.velocity.add(this.acceleration);
        this.position = this.position.add(this.velocity);
        this.rotation = this.rotation.add(this.angularVelocity);
    }

    Delete() { // Remove from current entities list
        logic.entities.splice(logic.entities.indexOf(this), 1);
    }
}

class Collider {
    constructor(type = "sphere", width = 1, height = 1) {
        this.type = type;
        this.width = width;
        this.height = height;
    }

    get clone() { return new Collider(this.type, this.width, this.height); }
}