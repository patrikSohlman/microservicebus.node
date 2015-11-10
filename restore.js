var fs = require('fs');
var util = require('./Utils.js');
var pjson = require('./package.json');
require('colors');

// Delete all services
var files = fs.readdirSync('./Services');
files.forEach(function (file) {
    if(file != 'microService.js' && file != 'sqlCommand.js')
        fs.unlinkSync('./Services/' + file);
});
console.log("Services removed".green);

// Update settings
settings = {
    "debug": false,
    "hubUri": "wss://microservicebus.com",
    "port" : 80
}
util.saveSettings(settings);
console.log("Settings updated".green);
console.log();

console.log("UPDATE VERSION!".red + " Current package version: " + pjson.version.green);



