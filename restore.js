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

// Delete folders
deleteFolderRecursive('./microServiceBus.BizTalk');
console.log("Deleted".green);

//if (fs.existsSync('./settings.json'))
//    fs.unlinkSync('./settings.json');
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


function deleteFolderRecursive(path) {
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach(function (file, index) {
            var curPath = path + "/" + file;
            if (fs.lstatSync(curPath).isDirectory()) { // recurse
                deleteFolderRecursive(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
};
