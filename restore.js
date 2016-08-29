/*
The MIT License (MIT)

Copyright (c) 2014 microServiceBus.com

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
var fs = require('fs');
var util = require('./Utils.js');
var pjson = require('./package.json');
require('colors');

// Delete all services
var files = fs.readdirSync('./services');
files.forEach(function (file) {
    if(file != 'microService.js' && file != 'sqlCommand.js')
        fs.unlinkSync('./services/' + file);
});
console.log("Services removed".green);

// Delete folders
deleteFolderRecursive('./microServiceBus.BizTalk');
deleteFolderRecursive('./data');
deleteFolderRecursive('./output');
deleteFolderRecursive('./persist');
console.log("Deleted".green);

//if (fs.existsSync('./settings.json'))
//    fs.unlinkSync('./settings.json');
// Update settings
settings = {
    "hubUri": "wss://microservicebus.com",
    "trackMemoryUsage": 0,
    "enableKeyPress" : true
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
