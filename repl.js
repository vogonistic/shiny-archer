var fs = require('fs');
var os = require('os');
var path = require('path');
var repl = require('repl');

module.exports = function(mineflayer) {
  return function(bot) {
    var history_file = path.join(os.tmpDir(), 'bot_repl_history.json')
    var r = repl.start('> ');
    r.context.bot = bot;
    r.context.mineflayer = mineflayer;
    r.on('exit', function () {
      console.log('Got "exit" event from repl!');
  
      fs.writeFile(history_file, JSON.stringify(r.rli.history), function(err) {
        process.exit();
      })
    });

    fs.readFile(history_file, function (err, data) {
      if (data) {
        r.rli.history = JSON.parse(data);
      }
    });
    
    return bot;
  }
}
