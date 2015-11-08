var util = require('../Utils.js');
var test = require('unit.js');
var fs = require('fs');

var assert = require('assert');
var MicroServiceBusHost = require("../microServiceBusHost.js");
var settings;

process.env.organizationid = "65b22e1f-a17e-432f-b9f2-b7057423a786";

describe('SignIn', function () {
    it('ENV organizationId should be set', function () {
        var orgId = process.env.organizationId;
        if (orgId == undefined)
            throw "organizationId is not set as an environment variable";
    });

    it('Save settings should work', function () {
        
        settings = {
            "debug": true,
            "huburi": "wss://microservicebus.com",
            "nodename": "testnode1",
            "organizationid" : process.env.organizationid
        }
        util.saveSettings(settings);
    });

    it('Sign in should work', function () {
        var microServiceBusHost = new MicroServiceBusHost(settings);
        microServiceBusHost.OnStarted(function (loadedCount, exceptionCount) {
            describe('PostLogin', function () {
                describe('#ServicesExists', function () {
                    it('Should start without errors', function () {
                        exceptionCount.should.equal(0);
                    });
                    it('microservice.js should exist after login', function () {
                        fs.statSync(__dirname + "/../Services/simulatorTemperatureSensor.js");
                    });
                    it('microservice.js should exist after login', function () {
                        fs.statSync(__dirname + "/../Services/nullOutboundService.js");
                    });
                });
            });
        });

        microServiceBusHost.Start();
    });
});





//util.saveSettings(settings);

//var microServiceBusHost = new MicroServiceBusHost(settings);

//microServiceBusHost.OnStarted(function (loadedCount, exceptionCount) {
//    test.ok(false, "node started");
//});

//microServiceBusHost.Start();

// just for example of tested value
//var example = "22";
// assert that example variable is a string
//test.string(example);
//// or with Must.js
//test.must(example).be.a.string();
//// or with assert
//test.assert(typeof example === 'string');
