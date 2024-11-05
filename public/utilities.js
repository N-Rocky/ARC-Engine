// Creating a vertex buffer using vertex data
function CreateStaticVertexBuffer(gl, data) {
    const buffer = gl.createBuffer();
    if (!buffer) { console.error("Failed Buffer"); return null; }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return buffer;
}

// Creating an index buffer using index data
function CreateStaticIndexBuffer(gl, data) {
    const buffer = gl.createBuffer();
    if (!buffer) { console.error("Failed Buffer"); return null; }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    return buffer;
}

// Creating Vertex Array Objects
function CreateTwoBufferVao(gl, positionBuffer, colorBuffer, positionAttribLocation, colorAttribLoction) {
    const vao = gl.createVertexArray();
    if (!vao) { console.error("Failed VAO allocation"); return null; }
    gl.bindVertexArray(vao);
    gl.enableVertexAttribArray(positionAttribLocation);
    gl.enableVertexAttribArray(colorAttribLoction);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionAttribLocation, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.vertexAttribPointer(colorAttribLoction, 3, gl.UNSIGNED_BYTE, true, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindVertexArray(null);
    return vao;
}

// Creating VAOs Using Interleaved Format
function CreateInterleavedBufferVao(gl, interleavedBuffer, positionAttribLocation, colorAttribLoction) {
    const vao = gl.createVertexArray();
    if (!vao) { console.error("Failed VAO allocation"); return null; }
    gl.bindVertexArray(vao);
    gl.enableVertexAttribArray(positionAttribLocation);
    gl.enableVertexAttribArray(colorAttribLoction);
    gl.bindBuffer(gl.ARRAY_BUFFER, interleavedBuffer);
    gl.vertexAttribPointer(positionAttribLocation, 2, gl.FLOAT, false, 5 * Float32Array.BYTES_PER_ELEMENT, 0);
    gl.vertexAttribPointer(colorAttribLoction, 3, gl.FLOAT, true, 5 * Float32Array.BYTES_PER_ELEMENT, 2 * Float32Array.BYTES_PER_ELEMENT);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindVertexArray(null);
    return vao;
}

// Creating 3D VAOs Using Interleaved Format With Models
function Create3DInterleavedBufferVao(gl, vertexBuffer, indexBuffer, texCoordBuffer, normalBuffer, positionAttrib, texCoordAttrib, normalAttrib) {
    const vao = gl.createVertexArray();
    if (!vao) { console.error("Failed VAO allocation"); return null; }
    gl.bindVertexArray(vao);

    // Interleaved format: (x, y, z, u, v) All Float32
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.vertexAttribPointer(positionAttrib, 3, gl.FLOAT, false, 3 * Float32Array.BYTES_PER_ELEMENT, 0);
    gl.enableVertexAttribArray(positionAttrib);

    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.vertexAttribPointer(texCoordAttrib, 2, gl.FLOAT, false, 2 * Float32Array.BYTES_PER_ELEMENT, 0);
    gl.enableVertexAttribArray(texCoordAttrib);

    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.vertexAttribPointer(normalAttrib, 3, gl.FLOAT, true, 3 * Float32Array.BYTES_PER_ELEMENT, 0);
    gl.enableVertexAttribArray(normalAttrib);

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    return vao;
}

// Creating 3D VAOs Using Interleaved Format With Primitives (geometry.js file)
function CreatePrimitiveInterleavedBufferVao(gl, vertexBuffer, indexBuffer, positionAttribLocation, texCoordAttribLocation) {
    const vao = gl.createVertexArray();
    if (!vao) { console.error("Failed VAO allocation"); return null; }
    gl.bindVertexArray(vao);

    // Interleaved format: (x, y, z, u, v) All Float32
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.vertexAttribPointer(positionAttribLocation, 3, gl.FLOAT, false, 5 * Float32Array.BYTES_PER_ELEMENT, 0);
    gl.enableVertexAttribArray(positionAttribLocation);

    gl.vertexAttribPointer(texCoordAttribLocation, 2, gl.FLOAT, false, 5 * Float32Array.BYTES_PER_ELEMENT, 3 * Float32Array.BYTES_PER_ELEMENT);
    gl.enableVertexAttribArray(texCoordAttribLocation);

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    return vao;
}

// Creating the shader program to link vertex and fragment shaders together
function CreateProgram(gl, vertexShaderSource, fragmentShaderSource) {
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        const compileError = gl.getShaderInfoLog(vertexShader);
        console.error(compileError); return;
    }

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        const compileError = gl.getShaderInfoLog(fragmentShader);
        console.error(compileError); return;
    }

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const linkError = gl.getProgramInfoLog(program);
        console.error(linkError); return;
    }

    return program;
}

function LoadTextResource(url, callback) {
    let request = new XMLHttpRequest();
    request.open('GET', url + "?cache=" + Math.random(), true);
    request.onload = function () {
        if (request.status < 200 || request.status > 299) {
            callback(request.status);
        }
        else {
            callback(null, request.responseText);
        }
    };
    request.send();
}

function LoadImage(url, callback) {
    let image = new Image();
    image.onload = function () {
        callback(null, image);
    };
    image.src = url;
}

function LoadJSONResource(url, callback) {
    LoadTextResource(url, function (err, result) {
        if (err) {
            callback(err);
        }
        else {
            try {
                callback(null, JSON.parse(result));
            }
            catch (exception) {
                callback(exception);
            }
        }
    });
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