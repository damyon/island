var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const accessorSizes = {
    'SCALAR': 1,
    'VEC2': 2,
    'VEC3': 3,
    'VEC4': 4,
    'MAT2': 4,
    'MAT3': 9,
    'MAT4': 16
};
var BufferType;
(function (BufferType) {
    BufferType[BufferType["Float"] = 5126] = "Float";
    BufferType[BufferType["Short"] = 5123] = "Short";
})(BufferType || (BufferType = {}));
const getBuffer = (path, buffer) => __awaiter(void 0, void 0, void 0, function* () {
    const dir = path.split('/').slice(0, -1).join('/');
    const response = yield fetch(`${dir}/${buffer}`);
    return yield response.arrayBuffer();
});
const getTexture = (gl, uri) => __awaiter(void 0, void 0, void 0, function* () {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
            const texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            const ext = gl.getExtension('EXT_texture_filter_anisotropic');
            if (ext) {
                const max = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
                gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, max);
            }
            gl.generateMipmap(gl.TEXTURE_2D);
            resolve(texture);
        };
        img.src = uri;
    });
});
const readBufferFromFile = (gltf, buffers, accessor) => {
    const bufferView = gltf.bufferViews[accessor.bufferView];
    const size = accessorSizes[accessor.type];
    const componentType = accessor.componentType;
    const type = accessor.type;
    const data = componentType == BufferType.Float
        ? new Float32Array(buffers[bufferView.buffer], (accessor.byteOffset || 0) + (bufferView.byteOffset || 0), accessor.count * size)
        : new Int16Array(buffers[bufferView.buffer], (accessor.byteOffset || 0) + (bufferView.byteOffset || 0), accessor.count * size);
    return {
        size,
        data,
        type,
        componentType,
    };
};
const getAccessor = (gltf, mesh, attributeName) => {
    const attribute = mesh.primitives[0].attributes[attributeName];
    return gltf.accessors[attribute];
};
const getBufferFromName = (gl, gltf, buffers, mesh, name) => {
    if (mesh.primitives[0].attributes[name] === undefined) {
        return null;
    }
    const accessor = getAccessor(gltf, mesh, name);
    const bufferData = readBufferFromFile(gltf, buffers, accessor);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, bufferData.data, gl.STATIC_DRAW);
    return {
        buffer,
        size: bufferData.size,
        type: bufferData.componentType,
        length: bufferData.data.length,
    };
};
const loadNodes = (index, node) => {
    const transform = mat4.create();
    if (node.translation !== undefined)
        mat4.translate(transform, transform, node.translation);
    if (node.rotation !== undefined)
        applyRotationFromQuat(transform, node.rotation);
    if (node.scale !== undefined)
        mat4.scale(transform, transform, node.scale);
    if (node.matrix !== undefined)
        createMat4FromArray(node.matrix);
    return {
        id: index,
        name: node.name,
        children: node.children || [],
        localBindTransform: transform,
        animatedTransform: mat4.create(),
        skin: node.skin,
        mesh: node.mesh
    };
};
const loadAnimation = (gltf, animation, buffers) => {
    const channels = animation.channels.map(c => {
        const sampler = animation.samplers[c.sampler];
        const time = readBufferFromFile(gltf, buffers, gltf.accessors[sampler.input]);
        const buffer = readBufferFromFile(gltf, buffers, gltf.accessors[sampler.output]);
        return {
            node: c.target.node,
            type: c.target.path,
            time,
            buffer,
            interpolation: sampler.interpolation ? sampler.interpolation : 'LINEAR',
        };
    });
    const c = {};
    channels.forEach((channel) => {
        if (c[channel.node] === undefined) {
            c[channel.node] = {
                translation: [],
                rotation: [],
                scale: [],
            };
        }
        for (let i = 0; i < channel.time.data.length; i++) {
            const size = channel.interpolation === 'CUBICSPLINE' ? channel.buffer.size * 3 : channel.buffer.size;
            const offset = channel.interpolation === 'CUBICSPLINE' ? channel.buffer.size : 0;
            const transform = channel.type === 'rotation'
                ? quat.fromValues(channel.buffer.data[i * size + offset], channel.buffer.data[i * size + offset + 1], channel.buffer.data[i * size + offset + 2], channel.buffer.data[i * size + offset + 3])
                : vec3.fromValues(channel.buffer.data[i * size + offset], channel.buffer.data[i * size + offset + 1], channel.buffer.data[i * size + offset + 2]);
            c[channel.node][channel.type].push({
                time: channel.time.data[i],
                transform: transform,
                type: channel.type,
            });
        }
    });
    return c;
};
const loadMesh = (gl, gltf, mesh, buffers) => {
    let indices = null;
    let elementCount = 0;
    if (mesh.primitives[0].indices !== undefined) {
        const indexAccessor = gltf.accessors[mesh.primitives[0].indices];
        const indexBuffer = readBufferFromFile(gltf, buffers, indexAccessor);
        indices = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexBuffer.data, gl.STATIC_DRAW);
        elementCount = indexBuffer.data.length;
    }
    else {
        const accessor = getAccessor(gltf, mesh, 'POSITION');
        elementCount = accessor.count;
    }
    return {
        indices,
        elementCount,
        positions: getBufferFromName(gl, gltf, buffers, mesh, 'POSITION'),
        normals: getBufferFromName(gl, gltf, buffers, mesh, 'NORMAL'),
        tangents: getBufferFromName(gl, gltf, buffers, mesh, 'TANGENT'),
        texCoord: getBufferFromName(gl, gltf, buffers, mesh, 'TEXCOORD_0'),
        joints: getBufferFromName(gl, gltf, buffers, mesh, 'JOINTS_0'),
        weights: getBufferFromName(gl, gltf, buffers, mesh, 'WEIGHTS_0'),
        material: mesh.primitives[0].material,
    };
};
const loadMaterial = (gl, material, path, images) => __awaiter(void 0, void 0, void 0, function* () {
    const dir = path.split('/').slice(0, -1).join('/');
    let baseColorTexture = null;
    let metallicRoughnessTexture = null;
    let emissiveTexture = null;
    let normalTexture = null;
    let occlusionTexture = null;
    let baseColorFactor = vec4.fromValues(1.0, 1.0, 1.0, 1.0);
    let roughnessFactor = 0.0;
    let metallicFactor = 1.0;
    let emissiveFactor = vec3.fromValues(1.0, 1.0, 1.0);
    const pbr = material.pbrMetallicRoughness;
    if (pbr) {
        if (pbr.baseColorTexture) {
            const uri = images[pbr.baseColorTexture.index].uri;
            baseColorTexture = yield getTexture(gl, `${dir}/${uri}`);
        }
        if (pbr.baseColorFactor) {
            baseColorFactor = vec4.fromValues(pbr.baseColorFactor[0], pbr.baseColorFactor[1], pbr.baseColorFactor[2], pbr.baseColorFactor[3]);
        }
        if (pbr.metallicRoughnessTexture) {
            const uri = images[pbr.metallicRoughnessTexture.index].uri;
            metallicRoughnessTexture = yield getTexture(gl, `${dir}/${uri}`);
        }
        metallicFactor = pbr.metallicFactor !== undefined ? pbr.metallicFactor : 1.0;
        roughnessFactor = pbr.roughnessFactor !== undefined ? pbr.roughnessFactor : 1.0;
    }
    if (material.emissiveTexture) {
        const uri = images[material.emissiveTexture.index].uri;
        emissiveTexture = yield getTexture(gl, `${dir}/${uri}`);
    }
    if (material.normalTexture) {
        const uri = images[material.normalTexture.index].uri;
        normalTexture = yield getTexture(gl, `${dir}/${uri}`);
    }
    if (material.occlusionTexture) {
        const uri = images[material.occlusionTexture.index].uri;
        occlusionTexture = yield getTexture(gl, `${dir}/${uri}`);
    }
    if (material.emissiveFactor) {
        emissiveFactor = vec3.fromValues(material.emissiveFactor[0], material.emissiveFactor[1], material.emissiveFactor[2]);
    }
    return {
        baseColorTexture,
        baseColorFactor,
        metallicRoughnessTexture,
        metallicFactor,
        roughnessFactor,
        emissiveTexture,
        emissiveFactor,
        normalTexture,
        occlusionTexture,
    };
});
/**
 * Loads a GLTF model and its assets
 * @param gl Web GL context
 * @param uri URI to model
 */
const loadModel = (gl, uri) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const response = yield fetch(uri);
    const gltf = yield response.json();
    if (gltf.accessors === undefined || gltf.accessors.length === 0) {
        throw new Error('GLTF File is missing accessors');
    }
    const buffers = yield Promise.all(gltf.buffers.map((b) => __awaiter(void 0, void 0, void 0, function* () { return yield getBuffer(uri, b.uri); })));
    const scene = gltf.scenes[gltf.scene || 0];
    const meshes = gltf.meshes.map(m => loadMesh(gl, gltf, m, buffers));
    const materials = gltf.materials ? yield Promise.all(gltf.materials.map((m) => __awaiter(void 0, void 0, void 0, function* () { return yield loadMaterial(gl, m, uri, gltf.images); }))) : [];
    const rootNode = scene.nodes[0];
    const nodes = gltf.nodes.map((n, i) => loadNodes(i, n));
    const animations = {};
    (_a = gltf.animations) === null || _a === void 0 ? void 0 : _a.forEach(anim => animations[anim.name] = loadAnimation(gltf, anim, buffers));
    const skins = gltf.skins ? gltf.skins.map(x => {
        const bindTransforms = readBufferFromFile(gltf, buffers, gltf.accessors[x.inverseBindMatrices]);
        const inverseBindTransforms = x.joints.map((_, i) => createMat4FromArray(bindTransforms.data.slice(i * 16, i * 16 + 16)));
        return {
            joints: x.joints,
            inverseBindTransforms,
        };
    }) : [];
    const name = uri.split('/').slice(-1)[0];
    return {
        name,
        meshes,
        nodes,
        rootNode,
        animations,
        skins,
        materials,
    };
});
/**
 * Deletes GL buffers and textures
 * @param gl Web GL context
 * @param model Model to dispose
 */
const dispose = (gl, model) => {
    model.meshes.forEach(m => {
        gl.deleteBuffer(m.indices);
        if (m.joints)
            gl.deleteBuffer(m.joints.buffer);
        if (m.normals)
            gl.deleteBuffer(m.normals.buffer);
        if (m.positions)
            gl.deleteBuffer(m.positions.buffer);
        if (m.tangents)
            gl.deleteBuffer(m.tangents.buffer);
        if (m.texCoord)
            gl.deleteBuffer(m.texCoord.buffer);
        if (m.weights)
            gl.deleteBuffer(m.weights.buffer);
        m.indices = null;
        m.joints = null;
        m.normals = null;
        m.tangents = null;
        m.texCoord = null;
        m.weights = null;
    });
    model.materials.forEach(m => {
        if (m.baseColorTexture)
            gl.deleteTexture(m.baseColorTexture);
        if (m.emissiveTexture)
            gl.deleteTexture(m.emissiveTexture);
        if (m.normalTexture)
            gl.deleteTexture(m.normalTexture);
        if (m.occlusionTexture)
            gl.deleteTexture(m.occlusionTexture);
        if (m.metallicRoughnessTexture)
            gl.deleteTexture(m.metallicRoughnessTexture);
        m.baseColorTexture = null;
        m.emissiveTexture = null;
        m.normalTexture = null;
        m.occlusionTexture = null;
        m.metallicRoughnessTexture = null;
    });
};
