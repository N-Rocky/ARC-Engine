// WebGL Application
let posAttrib; let texCoordAttrib; let normalAttrib;
function CreateShaders(canvas, gl) {
    // Create the shader program to link the vertex and fragment shaders together
    const shaderProgram = CreateProgram(gl, vertexShaderSourceCode, fragmentShaderSourceCode);

    // Uniform values from vertex shader
    const matWorldUniform = gl.getUniformLocation(shaderProgram, 'matWorld');
    const matViewProjUniform = gl.getUniformLocation(shaderProgram, 'matViewProj');

    // Lighting and Material information
    gl.useProgram(shaderProgram);
    const colorUniformLocation = gl.getUniformLocation(shaderProgram, 'colorTint');
    const lightingUniformLocation = gl.getUniformLocation(shaderProgram, 'lighting');
    gl.uniform3f(colorUniformLocation, 1.0, 1.0, 1.0);
    gl.uniform1i(lightingUniformLocation, 1);

    // Camera View + Projection
    const matView = glMatrix.mat4.create();
    const matProj = glMatrix.mat4.create();

    // Get attribute locations
    posAttrib = gl.getAttribLocation(shaderProgram, 'vertexPosition');
    texCoordAttrib = gl.getAttribLocation(shaderProgram, 'vertexTexCoord');
    normalAttrib = gl.getAttribLocation(shaderProgram, 'vertexNormal');
    if (posAttrib < 0 || texCoordAttrib < 0 || normalAttrib < 0) {
        console.error("Failed to find attribute location"); return;
    }

    const frame = function (camera, entities, selected) {
        
        // Reference the camera and target
        const pos = camera.position;
        const rot = camera.rotation;

        const rotX = new Vector2(Math.cos(glMatrix.glMatrix.toRadian(rot.x)), Math.sin(glMatrix.glMatrix.toRadian(rot.x)));
        const rotY = new Vector2(Math.cos(glMatrix.glMatrix.toRadian(rot.y)), Math.sin(glMatrix.glMatrix.toRadian(rot.y)));
        const rotZ = new Vector2(Math.cos(glMatrix.glMatrix.toRadian(rot.z)), Math.sin(glMatrix.glMatrix.toRadian(rot.z)));

        const target = pos.add(rot.forward);

        // Arg 1 = position, Arg 2 = look at, Arg 3 = up
        glMatrix.mat4.lookAt(matView, glMatrix.vec3.fromValues(pos.x, pos.y, pos.z),
            glMatrix.vec3.fromValues(target.x, target.y, target.z),
            glMatrix.vec3.fromValues(rot.up.x, rot.up.y, rot.up.z));
            //glMatrix.vec3.fromValues(-rotZ.y * rotY.x, rotX.x * rotZ.x, -rotX.y * rotY.x * rotZ.y));

        // Arg 1 = field of view, Arg 2 = aspect ratio, Arg 3 = near clipping, Arg 4 = far clipping
        glMatrix.mat4.perspective(matProj, glMatrix.glMatrix.toRadian(camera.fieldOfView), canvas.width / canvas.height, 0.001, 100);

        const matViewProj = glMatrix.mat4.create();
        // Essentially: matViewProj = matProj * matView
        glMatrix.mat4.multiply(matViewProj, matProj, matView);

        canvas.width = canvas.clientWidth * devicePixelRatio;
        canvas.height = canvas.clientHeight * devicePixelRatio;
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK); // gl.cullFace(gl.FRONT);

        gl.viewport(0, 0, canvas.width, canvas.height);

        gl.useProgram(shaderProgram);

        gl.uniformMatrix4fv(matViewProjUniform, false, matViewProj);

        for (let entity of entities) {
            if (entity.renderer) { entity.renderer.Render(gl, shaderProgram); }
        }
        if (selected != null) { selected.renderer.Render(gl, shaderProgram, true); }
    }
    return frame;
}

// Loads all relevant assets and creates a renderer for an entity to use
function CreateRenderer(entity) {
    LoadJSONResource(window.location.href + "/" + entity.model, function (modelError, model) {
        if (modelError) { console.error(modelError); }
        else {
            // Create buffers (all vertex data to be uploaded to the GPU)
            const vertices = CreateStaticVertexBuffer(gl, new Float32Array(model.meshes[0].vertices));
            const texCoords = CreateStaticVertexBuffer(gl, new Float32Array(model.meshes[0].texturecoords[0]));
            const indices = CreateStaticIndexBuffer(gl, new Uint16Array([].concat.apply([], model.meshes[0].faces)));
            const normals = CreateStaticVertexBuffer(gl, new Float32Array(model.meshes[0].normals));
            const indexCount = [].concat.apply([], model.meshes[0].faces).length;
            const vao = Create3DInterleavedBufferVao(gl, vertices, indices, texCoords, normals, posAttrib, texCoordAttrib, normalAttrib);
            LoadImage(window.location.href + "/" + entity.texture, function (imageError, image) {
                if (imageError) { console.error(imageError); }
                else {
                    const textureSize = image.width * image.height * 4; // R, G, B, a
                    let pixels = new Uint8Array(textureSize);
                    gl.readPixels(0, 0, image.width, image.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
                    for (let index = 0; index < textureSize; index += 4) {
                        pixels[index] = 0;
                    }

                    const texture = gl.createTexture();
                    gl.bindTexture(gl.TEXTURE_2D, texture);
                    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); // S = U
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); // T = V
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                    gl.bindTexture(gl.TEXTURE_2D, null);
                    entity.renderer = new Renderer(entity, texture, vao, indexCount);
                }
            });
        }
    });
}

// Shaders
const vertexShaderSourceCode = `#version 300 es
    precision mediump float;

    in vec3 vertexPosition;
    in vec2 vertexTexCoord;
    in vec3 vertexNormal;

    out vec2 fragmentTexCoord;
    out vec3 fragmentNormal;

    uniform mat4 matWorld;
    uniform mat4 matViewProj;
    
    void main() {
        fragmentTexCoord = vertexTexCoord;

        fragmentNormal = (matWorld * vec4(vertexNormal, 0.0)).xyz; // Normals in world space
        //fragmentNormal = vertexNormal; // Normals local to model

        gl_Position = matViewProj * matWorld * vec4(vertexPosition, 1.0);
    }`;

const fragmentShaderSourceCode = `#version 300 es
    precision mediump float;

    in vec2 fragmentTexCoord;
    in vec3 fragmentNormal;

    uniform vec3 colorTint;
    uniform int lighting;

    uniform sampler2D sampler;
    out vec4 outputColor;

    void main() {
        //vec3 ambientLightIntensity = vec3(1.0, 1.0, 1.0); // 2D testing only!
        vec3 ambientLightIntensity = vec3(0.1, 0.1, 0.1);
        vec3 sunlightIntensity = vec3(1.0, 1.0, 1.0);
        vec3 sunlightDirection = vec3(0.5, 1.0, -0.8);

        vec3 surfaceNormal = normalize(fragmentNormal);
        vec3 sunlightDirNormal = normalize(sunlightDirection);
        vec4 texel = texture(sampler, fragmentTexCoord);

        vec3 lightIntensity = ambientLightIntensity + sunlightIntensity * max(dot(surfaceNormal, sunlightDirNormal), 0.0);

        switch(lighting) {
            case 0: // No lighting
                outputColor = vec4(texel.rgb * colorTint, texel.a); break;
            case 1: // Phong lighting
                outputColor = vec4(texel.rgb * colorTint * lightIntensity, texel.a); break;
            case 2: // Highlighting
                outputColor = vec4(1.0, 0.6, 0.0, 1.0); break;
            case 3: // Surface normals
                outputColor = vec4(surfaceNormal, 1.0); break;
        }
    }`;

class Renderer {
    #matWorld = glMatrix.mat4.create();
    #scaleVec = glMatrix.vec3.create();
    #rotation = glMatrix.quat.create();
    constructor(entity, texture, vao, numIndices) {
        this.entity = entity;
        this.texture = texture;
        this.vao = vao;
        this.numIndices = numIndices;
    }

    Render(gl, program, outline = false) {
        const position = glMatrix.vec3.fromValues(this.entity.position.x, this.entity.position.y, this.entity.position.z);
        const angle = this.entity.rotation.multiply(Math.PI / 180);

        let rotX = glMatrix.quat.create(); let rotY = glMatrix.quat.create(); let rotZ = glMatrix.quat.create();
        glMatrix.quat.setAxisAngle(rotX, glMatrix.vec3.fromValues(1, 0, 0), angle.x);
        glMatrix.quat.setAxisAngle(rotY, glMatrix.vec3.fromValues(0, 1, 0), angle.y);
        glMatrix.quat.setAxisAngle(rotZ, glMatrix.vec3.fromValues(0, 0, 1), angle.z);
        glMatrix.quat.mul(this.#rotation, rotY, rotX); glMatrix.quat.mul(this.#rotation, this.#rotation, rotZ);
        // Order: rotY, rotX, rotZ -> Y is global, X is local to Y, Z is local to X

        let scale = this.entity.scale; const thickness = 0.05;
        if (outline) { scale = scale.abs.add(new Vector3(thickness, thickness, thickness)); scale.x *= -1; }
        glMatrix.vec3.set(this.#scaleVec, scale.x, scale.y, scale.z);
        glMatrix.mat4.fromRotationTranslationScale(this.#matWorld, this.#rotation, position, this.#scaleVec);

        let colorTint = this.entity.color;
        if (outline) { colorTint = {r: 1000, g: 1000, b: 1000}; }
        const colorUniformLocation = gl.getUniformLocation(program, 'colorTint');
        gl.uniform3f(colorUniformLocation, colorTint.r / 255, colorTint.g / 255, colorTint.b / 255);

        let lighting = 1;
        if (outline) { lighting = 2; }
        const lightingUniformLocation = gl.getUniformLocation(program, 'lighting');
        gl.uniform1i(lightingUniformLocation, lighting);

        gl.uniformMatrix4fv(gl.getUniformLocation(program, 'matWorld'), false, this.#matWorld);
        gl.bindVertexArray(this.vao);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.activeTexture(gl.TEXTURE0);
        gl.drawElements(gl.TRIANGLES, this.numIndices, gl.UNSIGNED_SHORT, 0);
        gl.bindVertexArray(null);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }
}