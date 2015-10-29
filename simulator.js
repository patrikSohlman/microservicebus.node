require('colors');
var MicroServiceBusHost = require("./microServiceBusHost.js");
var fs = require('fs');

var settigs = getSettings();


settigs.nodeName = "nodeJs-00004";
var microServiceBusHost1 = new MicroServiceBusHost(settigs);
microServiceBusHost1.OnStarted(function (loadedCount, exceptionCount) { });
microServiceBusHost1.Start();

settigs.nodeName = "nodeJs-00005";
var microServiceBusHost2 = new MicroServiceBusHost(settigs);
microServiceBusHost2.OnStarted(function (loadedCount, exceptionCount) { });
microServiceBusHost2.Start();


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
