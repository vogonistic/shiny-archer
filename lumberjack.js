var util = require('util')
var EventEmitter = require('events').EventEmitter;

module.exports = init;
var mineflayer = undefined;
var vec3 = undefined;

function init(mineflayer_inject) {
  mineflayer = mineflayer_inject;

  vec3 = mineflayer.vec3;
  vec3.west  = vec3(-1, 0, 0);
  vec3.east  = vec3( 1, 0, 0);
  vec3.up    = vec3( 0, 1, 0);
  vec3.down  = vec3( 0,-1, 0);
  vec3.north = vec3( 0, 0,-1);
  vec3.south = vec3( 0, 0, 1);

  return inject;
}

function filterBlockProperty(prop, value) {
  return function(b) {
    return b[prop] == value;
  }
}

function splitVeins(unchecked) {
  var currentGroup = [unchecked[0]];
  var limbo = [unchecked.shift()];
  // var unchecked = blockList.slice(1);
  
  while(limbo.length > 0) {
    var current = limbo.shift();
    // console.log('root: '+util.inspect(current.position)+' limbo.length: '+limbo.length);
    
    for (var i=0; i<unchecked.length; i++) {
      var other = unchecked[i];
      var distance = current.position.minus(other.position).abs();
      var absDistance = distance.x + distance.y + distance.z;
      // console.log(' - '+i+': '+util.inspect(other.position)+' ('+absDistance+')');
      if (absDistance == 1) {
        currentGroup.push(other);
        limbo.push(other);
        unchecked.splice(i, 1);
        // console.log(' - - adding '+i+' (g: '+currentGroup.length+', l:'+limbo.length+')');
        i--;
      }
    }
  }
  
  // console.log('---')
  // console.log('group.length: '+currentGroup.length);
  // console.log('unchecked.length: '+unchecked.length)
  return currentGroup;
}

function inject(bot) {
  bot.lumberjack = new EventEmitter();

  bot.on('login', function() {
    console.log("Lumberjack online.");
  });
  
  function findNearbyTrees(point) {
    var feet = bot.entity.position.floored();
    var radius = 10;
    
    var matches = [];
    
    var todo = [
      new Node(point, vec3.north.plus(vec3.west), 1), // nw
      new Node(point, vec3.north, 1),                 // n
      new Node(point, vec3.north.plus(vec3.east), 1), // ne
      new Node(point, vec3.west, 1),                  // w
      new Node(point, vec3.east, 1),                  // e
      new Node(point, vec3.south.plus(vec3.west), 1), // sw
      new Node(point, vec3.south, 1),                 // s
      new Node(point, vec3.south.plus(vec3.east), 1)  // se    
    ];
    
    function Node(point, vector, distance) {
      if (!(this instanceof Node)) return new Node(point, vector, distance);
      
      function isCorner(v) {
        var c = 0;
        if (v.x != 0) c++;
        if (v.y != 0) c++;
        if (v.z != 0) c++;
        return c != 1;
      }
        
      var self = this;
      self.point = point;
      self.vector = vector;
      self.corner = isCorner(vector);
      self.distance = distance;
      
      self.next = function() {
        var out = [self.vector]

        if (self.corner && self.distance > 1) {
          if (self.vector.x != 0) out.push(mineflayer.vec3(self.vector.x, 0, 0));
          if (self.vector.y != 0) out.push(mineflayer.vec3(0, self.vector.y, 0));
          if (self.vector.z != 0) out.push(mineflayer.vec3(0, 0, self.vector.z));
        }
        
        return out;
      }
    }

    while (todo.length > 0) {
      var startNode = todo.shift();
      var vectors_to_check = startNode.next()

      // console.log(' - checking: '+startNode.point+' -> '+startNode.vector.directionName()+' todo:'+todo.length+', matches:'+matches.length+' vecs:'+vectors_to_check.length);
      
      if (vectors_to_check.length == 2) {
        console.dir(startNode)
        vectors_to_check.forEach(function(v) {
          console.log(' - - '+v)
        })
        bot.quit()
        return
      }
      
      while (vectors_to_check.length > 0) {
        var v = vectors_to_check.shift();
        var p = startNode.point.plus(v);
        
        // console.log(' - - testing '+p+' -> '+v.directionName()+' -- '+p.minus(point))
        
        function bdir(b) { return b.boundingBox == 'block' && b.name != 'log' ? 1 : -1 }
        function b_Solid(b) { return b.boundingBox == 'block' && b.name != 'log' }

        var b = bot.blockAt(p);
        var bn = bot.blockAt(p.offset(0, bdir(b), 0));
        // console.log(' - - '+b.position.y+':'+b.name+(b_Solid(b)?'*':'')+' / '+bn.position.y+':'+bn.name+(b_Solid(bn)?'*':''));
        while (!(!b_Solid(b) && b_Solid(bn))) {
          b = bn;
          bn = bot.blockAt(b.position.offset(0, bdir(b), 0));
          // console.log(' - - '+b.position.y+':'+b.name+(b_Solid(b)?'*':'')+' / '+bn.position.y+':'+bn.name+(b_Solid(bn)?'*':''));
        }

        if (b.name == 'log') {
          // console.log(' - -  match: '+b.name)
          matches.push(b);
        }
        
        // found new match. save it and keep searching
        if (startNode.distance < radius) {
          // console.log(' - # adding '+b.position+' -> '+v.directionName()+' -- '+p.minus(point))
          todo.push(new Node(b.position, v, startNode.distance+1));
        }
      }
    }
    
    return matches;
  }

  function scan() {
    bot.lumberjack.knownTrees = bot.lumberjack.findNearbyTrees(bot.entity.position)
  }
  
  bot.lumberjack.findVein = findVein
  function findVein(start) {
    var todo = [], checked = [], matches = [start];
    var filter = filterBlockProperty('name', start.name);
    
    checked.push(start.position);
    // console.log('marking '+start.position+' as seen')

    // seed the initial todo list
    var start_vectors = [vec3.up, vec3.down];
    for (var i=0; i<start_vectors.length; ++i) {
      todo.push(new Node(start.position, start_vectors[i]));
    }

    // loop over all nodes
    while (todo.length > 0) {
      var startNode = todo.shift();
      // console.log(' - checking: '+startNode.point+' -> '+startNode.vector.directionName()+' todo:'+todo.length+', checked:'+checked.length+', matches:'+matches.length);
      
      var vectors_to_check = startNode.next()

      while (vectors_to_check.length > 0) {
        var v = vectors_to_check.shift();
        var p = startNode.point.plus(v);
        // console.log(' - - testing '+p+' -> '+v.directionName()+' -- '+p.minus(start.position))
        
        // already seen this one.
        if (checked.some(function(old) { return p.equals(old); })) {
          // console.log(' - -  old')
          continue;
        }
        
        checked.push(p);

        var b = bot.blockAt(p);
        if (!filter(b)) {
          // console.log(' - -  wrong type: '+b.name)
          continue;
        }
        
        // found new match. save it and keep searching
        // console.log(' - -  match: '+b.name)
        todo.push(new Node(p, v));
        matches.push(b);
      }
    }
    
    function Node(point, vector) {
      if (!(this instanceof Node)) return new Node(point, vector);
      var self = this;
      self.point = point;
      self.vector = vector;
    
      self.next = function() {
        var new_vectors = [self.vector]
        if (self.vector.x == 0) new_vectors.push(vec3.west, vec3.east)
        if (self.vector.y == 0) new_vectors.push(vec3.up, vec3.down)
        if (self.vector.z == 0) new_vectors.push(vec3.north, vec3.south)
        return new_vectors;
      }
    
      return self;
    }
  
    return matches.sort(function(a, b) { return b.position.y - a.position.y; });
  }
  
  bot.lumberjack.slayTree = slayTree;
  function slayTree(treeBlocks, callback) {
    callback = callback || noop;
    treeBlocks.sort(function(a,b) {return a.position.y-b.position.y;});
    
    onDiggingCompleted(false, undefined)
    
    function onDiggingCompleted(err, block) {
      if (err) {
        console.log('Failed to break block '+block.position);
        callback(true);
        return
      }
      
      if (treeBlocks.length > 0) {
        var nextLog = treeBlocks.shift();
        
        console.log(' - breaking log at '+nextLog.position);
        bot.dig(nextLog, onDiggingCompleted);
      } else {
        callback(false);
      }
    }
  }

  bot.lumberjack.doubleTake = doubleTake;
  function doubleTake(point) {
    bot.lookAt(point);
    var looksAtData = bot.entity.looksAt();
    var block = looksAtData.block;
    console.log('asked for '+point.floored()+' and got '+block.position+' which is '+block.name+' ('+point.floored().equals(block.position)+')')
  }
  
  function breakThatTree() {
    var lookAtData = bot.players.vogonistic.entity.looksAt();
    var block = lookAtData.block;
    
    if (block.name === 'log') {
      var tree = findVein(block);
      tree.sort(function(a,b) {return a.position.y-b.position.y;});

      if (tree[0].position.distanceTo(bot.entity.position) > 1.9) {
        bot.navigate.to(tree[0].position, {endRadius:1.5});
        bot.navigate.on('arrived', onArrived);
      } else {
        onArrived();
      }
      
      function onArrived() {
        console.log('Time to get chopping!');
        bot.navigate.removeListener('arrived', onArrived);

        slayTree(tree);
      }
    } else {
      bot.chat('You\'re not looking at a tree.')
    }
  }
  
  bot.lumberjack.logs = function() {
    bot.lookAt(bot.players.vogonistic.entity.position);
    
    setTimeout(function() {
      bot.inventory.slots.forEach(function(item) {
        if (!item) return;
        if (item.name === 'log') {
          bot.tossStack(item);
        }
      })
    }, 500);
  }

  // ----- //
  // SNOOP //
  // ----- //
  // setTimeout(function() {
  //   var playerUsername = 'vogonistic';
  //   var playerLooksAt = undefined;
  //   setInterval(function() {
  //     if (!bot.players.hasOwnProperty(playerUsername)) {
  //       playerLooksAt = undefined;
  //       return
  //     }
  //   
  //     var entity = bot.players[playerUsername].entity;
  //     var looksAtData = looksAt(entity);
  //     var block = looksAtData.block;
  //     if (!playerLooksAt || !block.position.equals(playerLooksAt.position)) {
  //       playerLooksAt = block;
  //       console.log(playerUsername+' is looking at '+playerLooksAt.name+' '+playerLooksAt.position+' '+faceName[looksAtData.face])
  // 
  //       // var face = bot.lookAt(looksAtData.position);
  //       // console.log(' - I see face '+faceName[face])
  //     }
  //   }, 500);
  // 
  //   var faceName = ['down','up','north','south','west','east']
  // }, 1000);
  
  bot.lumberjack.dig = function() {
    var underMe = bot.blockAt(bot.entity.position.floored().offset(0, -1, 0));
    bot.lumberjack.break(underMe);
  }
  
  bot.lumberjack.break = function(position) {
    // function onDugit(oldBlock, newBlock) {
    //   if (oldBlock.position.equals(position.floored())) {
    //     console.log(' - dug changed block from '+oldBlock.name+' to '+newBlock.name);
    //   }
    // }

    // var underMe = bot.blockAt(bot.entity.position.floored().offset(0, -1, 0));
    // bot.on('blockUpdate:'+underMe, onDugit)
    var block = bot.blockAt(position);
    // bot.on('blockUpdate:'+block.position, onDugit);
    // bot.on('blockUpdate', onDugit);
    
    bot.dig(block, function(error, block) {
      if (error) {
        console.log('Failed to dig');
      } else {
        console.log('Dug it gooood!')
      }
      // 
      // bot.removeListener('blockUpdate:'+position, onDugit);
    })
  }
  
  bot.lumberjack.build = function() {
    bot.equip(0x03, 'hand')
    bot.setControlState('jump', true);
    var targetBlock = bot.blockAt(bot.entity.position.offset(0, -1, 0));
    var jumpY = bot.entity.position.y + 1;
    bot.on('move', placeIfHighEnough);
  
    function placeIfHighEnough() {
      if (bot.entity.position.y > jumpY) {
        bot.placeBlock(targetBlock, vec3(0, 1, 0));
        bot.setControlState('jump', false);
        bot.removeListener('move', placeIfHighEnough);
      }
    }
  }
  
  bot.lumberjack.gatherLooseItems = function() {
    // var itemsToGather = interestingLogs.map(function(entity) {
    //   return {entity:entity, distance:entity.position.distanceTo(bot.entity.position)}
    // }).sort(function(a, b) {
    //   return b.distance - a.distance;
    // }).filter(function(item) {
    //   return (item.distance < 10);
    // });
    // 
    // console.dir(itemsToGather);
    
    function gatherNextItem() {
      var nextItem = interestingLogs.sort(function(a, b) { bot.entity.position.distanceTo(a.position)-bot.entity.position.distanceTo(b.position) })[0];
      if (nextItem.position.distanceTo(bot.entity.position) < 10) {
        bot.navigate.to(nextItem.position, {endRadius:1.5});

        bot.navigate.once('pathFound', function onPathFound(path) {
          // console.log('navigate: found path. I can get there in ' + path.length + ' moves.');
        });
        bot.navigate.once('cannotFind', function onCannotFind() {
          // console.log('navigate: unable to find path');
          console.log('Unable to get to the next log. Stopping.');
        });
        bot.navigate.once('arrived', function onArrived() {
          // console.log('navigate: I have arrived');
          gatherNextItem();
        });
        bot.navigate.once('stop', function onStop() {
          // console.log('navigate: stopping');
        });
      }
    }
  }
  
  var interestingLogs = {};
  bot.on('entitySpawn', function onEntitySpawn(entity) {
    if (entity.type === 'object' && entity.objectType === 'itemStack') {
      // console.log('spawn');
      // console.dir(entity);
      // console.dir(entity.objectData)
      interestingLogs[entity.id] = 0;
    }
  });
  bot.on('entityGone', function onEntityGone(entity) {
    // console.log('gone');
    // console.dir(entity);
    // console.dir(entity.metadata)
    if (interestingLogs.hasOwnProperty(entity.id)) {
      delete interestingLogs[entity.id];
      // console.log('dropped log gone ('+Object.keys(interestingLogs).length+')');
    }
  });
  bot.on('entityUpdate', function onEntityUpdate(entity) {
    if (entity.metadata) {
      for (var i=0; i<entity.metadata.length; ++i) {
        // { key: 10, value: { id: 17, itemCount: 1, itemDamage: 1, nbtData: <Buffer > }, type: 'slot' } ]
        var row = entity.metadata[i];
        if (row.key === 10) {
          if (row.value.id === 17) {
            if ((interestingLogs[entity.id]++) === 0) {
              // console.log('dropped '+row.value.itemCount+' log at '+entity.position+' distance:'+entity.position.distanceTo(bot.entity.position));
            }
          } else {
            delete interestingLogs[entity.id];
          }
        }
      }
    }
  })
  // setTimeout(function() {
  //   var player = bot.players['vogonistic'].entity;
  //   for (i=0; i<100000; i++) {
  //     b = looksAt(player);
  //   }
  //   bot.quit()
  //   process.exit()
  // }, 2000);
  
  function tellMe() {
    // 0 == north, PI/2 == west, PI == south, 3PI/2 == east
    // add a 16th of PI and ensure yaw is within: 0 <= yaw <= 2PI
    var yaw = ((bot.entity.yaw + (Math.PI / 16)) % (Math.PI*2));
    // Split 2PI into 16 pieces
    var piece = Math.floor(yaw * 8 / Math.PI);
    var pieceNames = ['n','nnw','nw','wnw','w','wsw','sw','ssw','s','sse','se','ese','e','ene','ne','nne'];
    console.log('I\'m looking '+pieceNames[piece])
  }
  
  bot.lumberjack.tellMe = tellMe;
  bot.lumberjack.breakThatTree = breakThatTree;
  bot.lumberjack.splitVeins = splitVeins;
  bot.lumberjack.scan = scan;
  bot.lumberjack.findNearbyTrees = findNearbyTrees;

  mineflayer.vec3.Vec3.prototype.directionName = function() {
    var name = []
    if (this.y != 0) name.push(this.y > 0 ? 'up' : 'down')
    if (this.z != 0) name.push(this.z > 0 ? 'south' : 'north')
    if (this.x != 0) name.push(this.x > 0 ? 'east' : 'west')
    return name.join('-');
  }

  return bot;
}

function noop() {}
