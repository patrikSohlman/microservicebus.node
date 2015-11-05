
var fs = require('fs');
var MicroServiceBusHost = require("./microServiceBusHost.js");

// Load settings
try {
    var data = fs.readFileSync('./settings.json');
    var settings = JSON.parse(data);
}
catch (err) {
    console.log('Invalid settings file.'.red);
    process.abort();
}

var microServiceBusHost = new MicroServiceBusHost(settings);

microServiceBusHost.OnStarted(function (loadedCount, exceptionCount) {
	
});

microServiceBusHost.Start();