
class FishTail extends ProjectedModel {

  constructor() {
    super();
    this.size = 3.5;
    this.LOD = 12;
    this.fat = 0.4;
    this.clipLimit = 150;
    this.clampLimit = 0;
    //this.vertexCount = 6 * (this.LOD * this.LOD) * 2;
  }

  /**
   * initBuffers
   *
   * Initialize the buffers we'll need.
   */
  initBuffers(gl) {
    // Call the parent.
    ProjectedModel.prototype.initBuffers.call(this, gl);
    // Load the texture.
    this.loadTexture(gl, 'script/models/dhufish/members/fishtail/texture.png');

    this.loadShape(gl, 'script/models/dhufish/members/fishtail/volume.png');
    
    return this.buffers;
  }
  
  /**
   * draw
   * Draw the terrain.
   * @param gl
   * @param programInfo
   * @param deltaTime
   * @param absTime
   * @param matrices
   */
  draw(gl, camera, shadow, deltaTime, absTime) {
    // Call the parent.
    ProjectedModel.prototype.draw.call(this, gl, camera, shadow, deltaTime, absTime);

    this.setWaveRotation(gl, absTime);
  }
}

