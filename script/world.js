var cubeRotation = 0.0;

main();

//
// Start here
//
function main() {
  const canvas = document.querySelector('#glcanvas');
  const gl = canvas.getContext('webgl');

  // If we don't have a GL context, give up now

  if (!gl) {
    alert('Unable to initialize WebGL. Your browser or machine may not support it.');
    return;
  }


  gl.enable(gl.DEPTH_TEST);

  const controls = new Controls(canvas);
  const camera = new Camera();

  /**
   * Section 2 - Shaders
   */

  camera.buildShaders(gl);
  camera.useCameraShader(gl);
  
  let terrain = new Terrain();
  let rocks = terrain.createRocks();
  let bushes = terrain.createBushes();
  let trees = terrain.createTrees();
  let leaves = terrain.createLeaves();
  let cloud1 = new Cloud();
  let cloud2 = new Cloud();
  let cloud3 = new Cloud();
  let cloud4 = new Cloud();
  let shark = new Shark();
  let throttleLOD = 10.0;
  let targetFPS = 15;
  let i = 0;
  let lastLOD = [];

  for (i = 0; i < 10; i++) {
    lastLOD[i] = 0;
  }

  let drawables = [
    terrain,
    new Sea(1000, 0, 1),
    cloud1,
    cloud2,
    cloud3,
    cloud4,
  ];
  
  drawables = drawables.concat(rocks);
  drawables = drawables.concat(bushes);
  drawables = drawables.concat(trees);
  drawables = drawables.concat(leaves);

  for (model of drawables) {
    model.initBuffers(gl);
  }
  
  cloud1.setPosition(gl, 100, 400, -480);
  cloud2.setPosition(gl, -100, 400, 480);
  cloud3.setPosition(gl, -480, 400, 100);
  cloud4.setPosition(gl, 480, 400, -100);
  
  // Move the rock.
  terrain.afterHeightsLoaded(function(gl, terrain, rocks) {
    terrain.setRockPositions(gl, rocks);
    terrain.setBushPositions(gl, bushes);
    terrain.setTreePositions(gl, trees);
    terrain.setLeafPositions(gl, leaves);
  }.bind(this, gl, terrain, rocks))

  /**
   * Camera shader setup
   */

  /**
   * Light shader setup
   */

  camera.useLightShader(gl);

  camera.createShadowDepthTexture(gl);

  // We create an orthographic projection and view matrix from which our light
  // will view the scene
  camera.createLightViewMatrices(gl);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  /**
   * Scene uniforms
   */
  camera.bindCameraUniforms(gl);

  // Draw our model onto the shadow map
  function drawShadowMap(sceneCamera, sceneControls, sceneDrawables, deltaTime, absTime) {

    sceneCamera.prepareShadowFrame(gl, sceneControls);

    var modelViewMatrix = mat4.create();
    mat4.multiply(modelViewMatrix, sceneCamera.lightModelViewMatrix, modelViewMatrix);
    gl.uniformMatrix4fv(sceneCamera.shadowModelViewMatrix, false, modelViewMatrix);
    
    for (model of sceneDrawables) {
      model.draw(gl, sceneCamera, false, deltaTime, absTime);
    }

    sceneCamera.finishShadowFrame(gl);
  }

  // Draw our model and floor onto the scene
  function drawModels(sceneCamera, sceneControls, sceneDrawables, deltaTime, absTime, sceneLastLOD) {
    sceneCamera.prepareCameraFrame(gl, sceneControls);

    var modelViewMatrix = mat4.create();
    mat4.multiply(modelViewMatrix, sceneCamera.cameraMatrix, modelViewMatrix);
    gl.uniformMatrix4fv(sceneCamera.uMVMatrix, false, modelViewMatrix);

    gl.uniform3fv(sceneCamera.uColor, [1.0, 1.0, 0.8]);
    let modelIndex = 0;
    let updateIndex = -1;
    for (model of sceneDrawables) {
      modelIndex = ((modelIndex + 1) % 10);

      if (((absTime + modelIndex) - sceneLastLOD[modelIndex]) / 10 > throttleLOD) {
      
        model.evaluateLOD(gl, sceneControls.x, sceneControls.y, sceneControls.z);
        updateIndex = modelIndex;
      }
    }
    if (updateIndex > 0) {
      sceneLastLOD[updateIndex] = absTime;
    }

    for (model of sceneDrawables) {
      model.predraw(gl);
      model.draw(gl, sceneCamera, true, deltaTime, absTime);
      model.postdraw(gl);
    }

    sceneCamera.finishCameraFrame(gl);
  }

  var then = 0;
  var absTime = 0;

  function resize() {
    // Lookup the size the browser is displaying the canvas.
    var displayWidth  = canvas.clientWidth;
    var displayHeight = canvas.clientHeight;
   
    // Check if the canvas is not the same size.
    if (canvas.width  != displayWidth ||
        canvas.height != displayHeight) {
   
      // Make the canvas the same size
      canvas.width  = displayWidth;
      canvas.height = displayHeight;

      camera.width = displayWidth;
      camera.height = displayHeight;
    }
  }

  var server = new Server(gl, drawables, controls, draw.bind(this, camera, controls, drawables, lastLOD, 0));

  
  // Draw our shadow map and light map every request animation frame
  function draw(sceneCamera, sceneControls, sceneDrawables, drawLastLOD, now) {
    now *= 0.01;  // convert to seconds
    const deltaTime = now - then;
    then = now;

    resize();
   
    sceneCamera.setRock(-(Math.sin((now / 10) - 0.2) / 6));
    sceneControls.processKeys(terrain, 4, 8);

    // START EMIT

    server.updateBoatPositionRotation(-sceneControls.x, (Math.sin(now / 10) / 10) + -1, -sceneControls.z, sceneControls.boatY + Math.PI);
    
    let targetRotate = Math.PI/4;
    if (sceneControls.actionCast) {
      targetRotate = Math.PI/3;
    }
    let rotateDelta = (targetRotate - sceneControls.rodRotate) / 10;
    sceneControls.rodRotate += rotateDelta;
    sceneControls.rodRotate = Math.PI/3;

    // We have an angle - and we need an X and Z offset.
    let angle = sceneControls.yRotation + (Math.PI*0.94);
    let hookDistance = 9;
    let XHookDelta = -Math.sin(angle) * hookDistance;
    let ZHookDelta = Math.cos(angle) * hookDistance;
    let lineDistance = 0;
    let XLineDelta = -Math.sin(angle) * lineDistance;
    let ZLineDelta = Math.cos(angle) * lineDistance;

    let lineLength = hookDistance * 25; // 10 is the scale multiplier between line and hook.

    if (!controls.actionCast) {
      server.updateHookPositionRotation(-sceneControls.x + XHookDelta, 1.5 - 3*sceneControls.rodRotate, -sceneControls.z + ZHookDelta, sceneControls.yRotation + (Math.PI*0.94), 0);
    }
    server.updateRodPositionRotation(-sceneControls.x, (Math.sin(now / 10) / 10) + 2.6, -sceneControls.z, sceneControls.yRotation + (Math.PI*0.9), sceneControls.rodRotate);
    server.updateLegPositionRotation(-sceneControls.x, (Math.sin(now / 10) / 10) + 1, -sceneControls.z, sceneControls.yRotation);
    server.updateShirtPositionRotation(-sceneControls.x, (Math.sin(now / 10) / 10) + 2.6, -sceneControls.z, sceneControls.yRotation);
    server.updateHeadPositionRotation(-sceneControls.x, (Math.sin(now / 10) / 10) + 3.1, -sceneControls.z, sceneControls.yRotation);
    server.updateEyesPositionRotation(-sceneControls.x, (Math.sin(now / 10) / 10) + 3.1, -sceneControls.z, sceneControls.yRotation);
    
    // END EMIT

    drawShadowMap(sceneCamera, sceneControls, sceneDrawables, deltaTime, absTime);
    drawModels(sceneCamera, sceneControls, sceneDrawables, deltaTime, absTime, drawLastLOD);

    absTime += deltaTime;

    // We don't want full throttle.
    let delay = 1000 / targetFPS;
    window.setTimeout(function() {
      window.requestAnimationFrame(draw.bind(this, sceneCamera, sceneControls, sceneDrawables, lastLOD));
    }, delay);
  }
  
}
