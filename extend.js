module.exports = init;

function init(mineflayer) {
  return function injectBot(bot) {
    return inject(mineflayer, bot);
  }
}

function inject(mineflayer, bot) {
  var Vec3 = mineflayer.vec3.Vec3;
  Vec3.prototype.minPoint = vecMinPoint;
  Vec3.prototype.multiply = vecMultiply;
  Vec3.prototype.divide = vecDivide;

  var Entity = mineflayer.Entity;
  Entity.prototype.lookVector = entityLookVector;
  Entity.prototype.eyePosition = entityEyePosition;
  Entity.prototype.looksAt = entityLooksAt;
  
  return bot;

  // ----------------------------------------------------------------
  // Vec3 extensions
  // ----------------------------------------------------------------

  function vecMinPoint(vec) {
    var minValue = Math.min(this.x, this.y, this.z);
    switch(minValue) {
      case this.x: return 'x';
      case this.y: return 'y';
      case this.z: return 'z';
    }
  }
  
  function vecMultiply(other) {
    return new Vec3(this.x * other.x, this.y * other.y, this.z * other.z);
  }
  
  function vecDivide(other) {
    return new Vec3(this.x / other.x, this.y / other.y, this.z / other.z);
  }

  // ----------------------------------------------------------------
  // Entity extensions
  // ----------------------------------------------------------------

  function entityLookVector() {
    return mineflayer.vec3(
      -Math.cos(this.pitch) * Math.sin(this.yaw),
      Math.sin(this.pitch),
      -Math.cos(this.pitch) * Math.cos(this.yaw)
    );
  }

  function entityEyePosition() {
    return this.position.offset(0, this.height, 0);
  }

  function entityLooksAt() {
    var lookVec = this.lookVector();
    var start = this.eyePosition();
    
    var length = 0.0;
    var block = bot.blockAt(start);

    // Used to determine the position of the next block in lookVec
    var vecOffset = mineflayer.vec3(
      (lookVec.x > 0 ? 1 : 0),
      (lookVec.y > 0 ? 1 : 0),
      (lookVec.z > 0 ? 1 : 0)
    )

    // Created to speed up calculation later.
    var invertedVec = new Vec3(
      1.0 / Math.abs(lookVec.x),
      1.0 / Math.abs(lookVec.y),
      1.0 / Math.abs(lookVec.z)
    );    
    
    // early declaration of variables apparently help
    var lastPos = start;
    var normVec = null;
    var dir = 'x';
    var face = -1;
    
    var tests = 0;
    while (block.boundingBox == 'empty' && (++tests) < 100) {
      // calculate the distance to the next block for x, y and z
      edgeDistanceVec = new Vec3(
        Math.abs(Math.floor(lastPos.x + vecOffset.x) - lastPos.x) * invertedVec.x,
        Math.abs(Math.floor(lastPos.y + vecOffset.y) - lastPos.y) * invertedVec.y,
        Math.abs(Math.floor(lastPos.z + vecOffset.z) - lastPos.z) * invertedVec.z
      )
      
      // the smallest value is the direction we will be crossing next
      dir = edgeDistanceVec.minPoint();
      // ensure that we cross with the smallest margin possible
      length += edgeDistanceVec[dir] + 0.001;
      // calculate the actual position inside the new block
      lastPos = start.plus(lookVec.scaled(length));
      block = bot.blockAt(lastPos);
      
      // inverted faces since we want the face coming in
      face = -1;
      switch(dir) {
        case 'y': face = (lookVec.y < 0 ? 1 : 0); break;
        case 'z': face = (lookVec.z < 0 ? 3 : 2); break;
        case 'x': face = (lookVec.x < 0 ? 5 : 4); break;
      }
    }
    
    return {
      'position':lastPos,
      'block':block,
      'face':face
    };
  };
}
