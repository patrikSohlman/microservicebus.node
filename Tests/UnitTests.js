var test = require('unit.js');

//var sleep = require('sleep');
//require('colors');
//console.log('**** TESTING ***'.yellow);

//var loadedItineraries = 0;
//var loadedExceptions = 0;
//var isLoaded = false;
//var isTimeout = false;
//var MicroServiceBusHost = require("../microServiceBusHost.js");
//var microServiceBusHost = new MicroServiceBusHost();

//microServiceBusHost.OnStarted(function (loadedCount, exceptionCount) {
//    loadedItineraries = loadedCount;
//    loadedExceptions = exceptionCount;
//    isLoaded = true;
//    console.log("Host is started.".green);
//});

//microServiceBusHost.Start(true);

//setTimeout(function () {
//    console.log("timeout...")
//    if (!isLoaded) {
//        microServiceBusHost.Stop();
//        delete microServiceBusHost;
//    }
//    isLoaded = true;
//    isTimeout = true;
//}, 20000);

//while (!isLoaded) {
//    require('deasync').runLoopOnce();
//}

//if (!isTimeout) {
//    microServiceBusHost.Stop();
//    delete microServiceBusHost;
//}

//logReason(!isTimeout, "The host did not start up in time (20 seconds)");
//test.must(!isTimeout).be.true();

//logReason(!isTimeout, "One or more services didn't start");
//test.must(loadedExceptions == 0).be.true();

//function logReason(succeeded, reason) { 
//    if (!succeeded)
//        console.log(reason.red);
//}
 

// just for example of tested value
var example = "22";
// assert that example variable is a string
test.string(example);
//// or with Must.js
//test.must(example).be.a.string();
//// or with assert
//test.assert(typeof example === 'string');
