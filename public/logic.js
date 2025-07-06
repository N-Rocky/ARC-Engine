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
            if (entity.gravity && !entity.kinematic && !entity.static) { entity.velocity.y += this.#gravity; }
            entity.Relocate(); // Update position of entity by applying acceleration and velocity forces
            if (!entity.static) { // Participates in the physics simulation
                for (let splice = index + 1; splice < this.#gameEntities.length; splice++) {
                    const other = this.#gameEntities[splice];
                    if (other.static || ((entity.kinematic || entity.mass == 0) && (other.kinematic || other.mass == 0))) { continue; } // Can't collide
                    if (!this.Collide(entity, other)) { continue; } // No collision
                    console.log("COLLIDED")
                    if (!this.#transpiler) { // Using vanilla Javascript
                        if (entity.behavior.includes("function Collide(")) { eval(entity.behavior + "\nCollide(other)"); }
                        if (other.behavior.includes("function Collide(")) { eval(other.behavior + "\nCollide(entity)"); }
                    }
                    else { // Using transpiler
                        TranspileCollide(entity, other);
                        TranspileCollide(other, entity);
                    }
                }
            }
        }

        // Reset user input
        this.#currentKey = null;
    }

    Collide(entity, other) { // Check for collision between two entities
        let collision = this.SAT3D(entity, other);

        // Collision resolution
        if (collision) { this.ResolveCollision(entity, other, collision.normal, collision.penetration, collision.contact); }

        return collision;
    }

    SAT3D(entity, other) {
        let col1 = entity.collider; let col2 = other.collider;

        if (col1.type == "sphere" && col2.type == "sphere") {
            const axis = other.position.subtract(entity.position);
            const distance = axis.magnitude;
            const penetration = Math.max(col1.width / 2, col1.height / 2, col1.length / 2) + Math.max(col2.width / 2, col2.height / 2, col2.length / 2) - distance;
            if (penetration > 0) { return { normal: axis.unit, penetration, contact: entity.position.add(axis.unit.multiply(Math.max(col1.width / 2, col1.height / 2, col1.length / 2))) }; }
            return false;
        }

        if (col1.type == "sphere" || col2.type == "sphere") {
            if (col1.type != "sphere") { [entity, other] = [other, entity]; [col1, col2] = [col2, col1]; }
            let closest = this.Vertices(other).reduce((prev, curr) =>
                entity.position.subtract(curr).magnitude < entity.position.subtract(prev).magnitude ? curr : prev
            );
            const axis = closest.subtract(entity.position);
            const distance = axis.magnitude;
            const penetration = Math.max(col1.width / 2, col1.height / 2, col1.length / 2) - distance;
            if (penetration > 0) return { normal: axis.unit, penetration, contact: closest };
            return false;
        }

        const entityVertices = this.Vertices(entity); const otherVertices = this.Vertices(other);
        const axes = this.GetAxes(entity, other);
        let minOverlap = Infinity;
        let smallestAxis = null;

        for (let axis of axes) {
            if (!this.AxisOverlap(axis, entityVertices, otherVertices)) { return false; }
            let projA = this.ProjectVertices(axis, entityVertices);
            let projB = this.ProjectVertices(axis, otherVertices);
            let overlap = Math.min(projA.max, projB.max) - Math.max(projA.min, projB.min);
            if (overlap < minOverlap) {
                minOverlap = overlap;
                smallestAxis = axis;
            }
        }
        if (other.position.subtract(entity.position).dot(smallestAxis) < 0) {
            smallestAxis = smallestAxis.multiply(-1);
        }

        // Approximate contact point as midpoint between centers
        const contact = entity.position.add(other.position).multiply(0.5);
        return { normal: smallestAxis.unit, penetration: minOverlap, contact };
    }

    Vertices(entity) {
        const collider = entity.collider;
        const axes = entity.rotation;
        if (collider.type == "sphere") {
            return [entity.position];
        }
        else if (collider.type == "box") {
            const vertices = [];
            for (let dx of [-1, 1]) {
                for (let dy of [-1, 1]) {
                    for (let dz of [-1, 1]) {
                        vertices.push(
                            entity.position
                                .add(axes.right.multiply(dx * collider.width / 2))
                                .add(axes.up.multiply(dy * collider.height / 2))
                                .add(axes.forward.multiply(dz * collider.length / 2))
                        );
                    }
                }
            }
            return vertices;
        }
    }

    GetAxes(entity, other) {
        const entityEdges = [entity.rotation.right, entity.rotation.up, entity.rotation.forward];
        const otherEdges = [other.rotation.right, other.rotation.up, other.rotation.forward];
        let axes = entityEdges.concat(otherEdges);
        for (let e1 of entityEdges) {
            for (let e2 of otherEdges) {
                let axis = e1.cross(e2);
                if (axis.magnitude > 1e-6) { axes.push(axis.unit); }
            }
        }
        return axes;
    }

    ProjectVertices(axis, vertices) {
        let min = axis.dot(vertices[0]); let max = min;
        for (let vertex of vertices) {
            const point = axis.dot(vertex);
            if (point < min) { min = point; }
            if (point > max) { max = point; }
        }
        return { min, max };
    }

    AxisOverlap(axis, entityVertices, otherVertices) {
        const entityProjection = this.ProjectVertices(axis, entityVertices);
        const otherProjection = this.ProjectVertices(axis, otherVertices);
        //console.log(entityProjection, otherProjection)
        return !(entityProjection.max < otherProjection.min || otherProjection.max < entityProjection.min);
    }

    ResolveCollision(entity, other, normal, penetration, contact) {
        // Penetration resolution
        let invMass1 = 0; if (entity.mass != 0 && !entity.kinematic) { invMass1 = 1 / entity.mass; }
        let invMass2 = 0; if (other.mass != 0 && !other.kinematic) { invMass2 = 1 / other.mass; }
        const resolution = normal.multiply(penetration / (invMass1 + invMass2));
        entity.position = entity.position.add(resolution.multiply(-invMass1));
        other.position = other.position.add(resolution.multiply(invMass2));

        // Normal impulse using linear velocities
        const velAlongNormal = other.velocity.subtract(entity.velocity).dot(normal);
        if (velAlongNormal > 0) return; // Moving apart

        // Calculate impulse scalar
        const e = Math.max(entity.elasticity, other.elasticity);
        const j = -(1 + e) * velAlongNormal / (invMass1 + invMass2);
        const impulse = normal.multiply(j);

        // Apply linear impulses
        entity.velocity = entity.velocity.subtract(impulse.multiply(invMass1));
        other.velocity = other.velocity.add(impulse.multiply(invMass2));

        // Rolling friction approximation
        const ra = contact.subtract(entity.position);
        const rb = contact.subtract(other.position);
        const vaAtContact = entity.velocity.add(entity.angularVelocity.cross(ra));
        const vbAtContact = other.velocity.add(other.angularVelocity.cross(rb));
        const relativeVelocity = vbAtContact.subtract(vaAtContact);

        // Friction impulse (simplified Coulomb friction)
        const tangent = relativeVelocity.subtract(normal.multiply(relativeVelocity.dot(normal))).unit;
        const jt = -relativeVelocity.dot(tangent) / (invMass1 + invMass2);
        const mu = (entity.friction + other.friction) / 2; // friction coefficient
        const frictionImpulse = tangent.multiply(Math.max(-(j * mu), Math.min(jt, j * mu)));

        entity.velocity = entity.velocity.subtract(frictionImpulse.multiply(invMass1));
        other.velocity = other.velocity.add(frictionImpulse.multiply(invMass2));

        /*
        // Apply torques from friction impulses
        const torque1 = ra.cross(impulse.multiply(-1)).add(ra.cross(frictionImpulse.multiply(-1)));
        const torque2 = rb.cross(impulse).add(rb.cross(frictionImpulse));

        const entityInertia = this.InertiaTensor(entity);
        const angularChange1 = new Vector3(torque1.x * entityInertia.x, torque1.y * entityInertia.y, torque1.z * entityInertia.z);
        const otherInertia = this.InertiaTensor(other);
        const angularChange2 = new Vector3(torque2.x * otherInertia.x, torque2.y * otherInertia.y, torque2.z * otherInertia.z);

        entity.angularVelocity = entity.angularVelocity.add(angularChange1);
        other.angularVelocity = other.angularVelocity.add(angularChange2);
        */

        // Apply torques from friction impulses
        const globalTorque1 = ra.cross(impulse.multiply(-1)).add(ra.cross(frictionImpulse.multiply(-1))).multiply(0.1);
        const globalTorque2 = rb.cross(impulse).add(rb.cross(frictionImpulse)).multiply(0.1);

        const entityInertia = this.InertiaTensor(entity);
        const entityR = entity.rotation.matrix; const entityRT = this.TransposeMatrix(entityR);
        const localTorque1 = this.ApplyMatrix(entityRT, globalTorque1);
        const localAngular1 = new Vector3(localTorque1.x * entityInertia.x, localTorque1.y * entityInertia.y, localTorque1.z * entityInertia.z);
        const globalAngular1 = this.ApplyMatrix(entityR, localAngular1);

        const otherInertia = this.InertiaTensor(other);
        const otherR = other.rotation.matrix; const otherRT = this.TransposeMatrix(otherR);
        const localTorque2 = this.ApplyMatrix(otherRT, globalTorque2);
        const localAngular2 = new Vector3(localTorque2.x * otherInertia.x, localTorque2.y * otherInertia.y, localTorque2.z * otherInertia.z);
        const globalAngular2 = this.ApplyMatrix(otherR, localAngular2);

        entity.angularVelocity = entity.angularVelocity.add(globalAngular1);
        other.angularVelocity = other.angularVelocity.add(globalAngular2);
    }

    InertiaTensor(entity) {
        const col = entity.collider;
        if (entity.kinematic) { return new Vector3(); }
        if (col.type == "sphere") {
            const inertia = (2/5) * entity.mass * (Math.max(col.width / 2, col.height / 2, col.length / 2)**2);
            const inverse = inertia != 0 ? 0.3 / inertia : 0;
            return new Vector3(inverse, inverse, inverse);
        }
        if (col.type == "box") {
            const w = col.width;
            const h = col.height;
            const d = col.length;
            const mass = entity.mass;
            const ix = (1/12) * mass * (h*h + d*d);
            const iy = (1/12) * mass * (w*w + d*d);
            const iz = (1/12) * mass * (w*w + h*h);
            return  new Vector3(
                ix === 0 ? 0 : 1/ix,
                iy === 0 ? 0 : 1/iy,
                iz === 0 ? 0 : 1/iz
            );
        }
    }

    TransposeMatrix(m) {
        return [
            [ m[0][0], m[1][0], m[2][0] ],
            [ m[0][1], m[1][1], m[2][1] ],
            [ m[0][2], m[1][2], m[2][2] ],
        ];
    }

    ApplyMatrix(m, v) {
        return new Vector3(
            m[0][0]*v.x + m[0][1]*v.y + m[0][2]*v.z,
            m[1][0]*v.x + m[1][1]*v.y + m[1][2]*v.z,
            m[2][0]*v.x + m[2][1]*v.y + m[2][2]*v.z
        );
    }

    ClosestPoint(start, end, point) { // Finds the closest point on a line segment to another point
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
    project(vector) { return vector.unit.multiply(this.dot(vector.unit)); }
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

    get pitch() { const cos = Math.cos(this.x * Math.PI / 180); const sin = Math.sin(this.x * Math.PI / 180); return [[1, 0, 0], [0, cos, -sin], [0, sin, cos]]; }
    get yaw() { const cos = Math.cos(this.y * Math.PI / 180); const sin = Math.sin(this.y * Math.PI / 180); return [[cos, 0, sin], [0, 1, 0], [-sin, 0, cos]]; }
    get roll() { const cos = Math.cos(this.z * Math.PI / 180); const sin = Math.sin(this.z * Math.PI / 180); return [[cos, -sin, 0], [sin, cos, 0], [0, 0, 1]]; }

    get matrix() {
        function multiply(a, b) {
            const result = [];
            for (let i = 0; i < 3; i++) {
                result[i] = [];
                for (let j = 0; j < 3; j++) {
                    result[i][j] = a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j];
                }
            } return result;
        }
        return multiply(multiply(this.yaw, this.pitch), this.roll);
    }

    get forward() { const matrix = this.matrix; return new Vector3(matrix[0][2], matrix[1][2], matrix[2][2]); }
    get up() { const matrix = this.matrix; return new Vector3(matrix[0][1], matrix[1][1], matrix[2][1]); }
    get right() { const matrix = this.matrix; return new Vector3(matrix[0][0], matrix[1][0], matrix[2][0]).multiply(-1); }
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
        this.angularVelocity = new Vector3(); this.friction = 0.3;
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
        clone.angularVelocity = this.angularVelocity.clone; clone.friction = this.friction;
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
        entity.mass = data.mass; entity.elasticity = data.elasticity; entity.friction = data.friction;
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
                for (let attribute of ["width", "height", "length"]) {
                    const input = document.createElement("INPUT"); input.classList.add("componentItem");
                    input.type = "number"; input.name = attribute; input.value = this.collider[attribute];
                    const label = document.createElement("Label"); label.classList.add("componentItem");
                    label.htmlFor = attribute; label.textContent = `${attribute}:`;
                    input.oninput = () => { this.collider[attribute] = parseInt(input.value); }
                    content.appendChild(label); content.appendChild(input);
                }
                for (let attribute of ["mass", "elasticity", "friction"]) {
                    const input = document.createElement("INPUT"); input.classList.add("componentItem");
                    input.type = "number"; input.step = 0.1;
                    input.name = attribute; input.value = this[attribute];
                    const label = document.createElement("Label"); label.classList.add("componentItem");
                    label.htmlFor = attribute; label.textContent = `${attribute}:`;
                    input.oninput = () => { this[attribute] = parseFloat(input.value); }
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
        //this.angularVelocity = this.angularVelocity.multiply(0.8);
        this.rotation = this.rotation.add(this.angularVelocity.multiply(180 / Math.PI));
    }

    Delete() { // Remove from current entities list
        logic.entities.splice(logic.entities.indexOf(this), 1);
    }
}

class Collider {
    constructor(type = "sphere", width = 1, height = 1, length = 1) {
        this.type = type;
        this.width = width;
        this.height = height;
        this.length = length;
    }

    get clone() { return new Collider(this.type, this.width, this.height, this.length); }
}