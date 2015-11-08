var test = require('unit.js');
var fs = require('fs');

console.log("organizationId: " + process.env.organizationId)


//var MicroServiceBusHost = require("../microServiceBusHost.js");

//try {
//    var data = fs.readFileSync(__dirname + '/../settings.json'); 
//    var settings = JSON.parse(data);
//}
//catch (err) {
//    console.log('Invalid settings file.' + err.message);
//    test.ok(false, "node did not start corrrectly. " + err.message);
//}
//var microServiceBusHost = new MicroServiceBusHost(settings);

//microServiceBusHost.OnStarted(function (loadedCount, exceptionCount) {
//    test.ok(false, "node started");
//});

//microServiceBusHost.Start();

// just for example of tested value
var example = "22";
// assert that example variable is a string
test.string(example);
//// or with Must.js
//test.must(example).be.a.string();
//// or with assert
//test.assert(typeof example === 'string');
