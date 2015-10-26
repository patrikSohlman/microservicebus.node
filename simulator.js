require('colors');
var MicroServiceBusHost = require("./microServiceBusHost.js");
var fs = require('fs');

var settigs = getSettings();

settigs.hostName = "nodeJs-00005";
new MicroServiceBusHost(settigs).Start();
settigs.hostName = "nodeJs-00004";
new MicroServiceBusHost(settigs).Start();


function getSettings() {
    try {
        var data = fs.readFileSync('./settings.json');
        var settings = JSON.parse(data);
        return settings;
    }
    catch (err) {
        console.log('Invalid settings file.'.red);
        process.abort();
    }
}
