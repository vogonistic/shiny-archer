var util = require('util');
var mineflayer = require('mineflayer');

var bot = mineflayer.createBot({ username: 'Lumberjack' });

bot.on('chat', function(username, message) {
  // navigate to whoever talks
  // if (username === bot.username) return;
  // var target = bot.players[username].entity;
  console.log(username+' says: '+message)
  // if (message === 'come') {
  //   bot.navigate.to(target.position);
  // } else if (message === 'stop') {
  //   bot.navigate.stop();
  // } else if (message === 'test') {
  //   test();
  // } else if (message === 'desc') {
  //   describe();
  // }
});

bot.on('login', function() {
  console.log("I've logged in.");
});

// install the plugin
require('mineflayer-navigate')(mineflayer)(bot);
bot.navigate.on('pathFound', function (path) {
  console.log('navigate: found path. I can get there in ' + path.length + ' moves.');
});
bot.navigate.on('cannotFind', function () {
  console.log('navigate: unable to find path');
});
bot.navigate.on('arrived', function () {
  console.log('navigate: I have arrived');
});
bot.navigate.on('stop', function() {
  console.log('navigate: stopping');
});


require('./lumberjack.js')(mineflayer)(bot);
require('./repl.js')(mineflayer)(bot);

require('./extend.js')(mineflayer)(bot);


// bot.on('blockUpdate', function(oldBlock, newBlock) {
//   // if (!oldBlock || !newBlock) {
//   //   console.log('newBlock or oldBlock is undefined!')
//   //   console.dir(oldBlock);
//   //   console.dir(newBlock);
//   //   console.trace();
//   // }
//   // 
//   var ignoredNames = ['snow', 'tallgrass', 'grass', 'leaves']
//   var isIgnoredBlockType = ignoredNames.some(function(name) { return name === newBlock.name || name === oldBlock.name });
//   // var isSameType = (oldBlock.type === newBlock.type);
//   // if (!isIgnoredBlockType && !isSameType && newBlock.position.distanceTo(bot.entity.position) < 10) {
//   if (!isIgnoredBlockType) {
//     console.log(newBlock.position+' turned from '+oldBlock.name+' into '+newBlock.name);
//   }
// })