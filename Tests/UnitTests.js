var mocha = require('mocha')
var util = require('../Utils.js');
var test = require('unit.js');
var fs = require('fs');
var assert = require('assert');
var MicroServiceBusHost = require("../microServiceBusHost.js");

var settings;
var loggedInComplete = false;
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
            "hubUri": "wss://microservicebus.com",
            "nodeName": "TestNode1",
            "organizationId" : process.env.organizationid
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
            loggedInComplete = true;
        });

        microServiceBusHost.Start();
        while (loggedInComplete == false) {
            try {
                require('deasync').runLoopOnce();
            }
            catch (errr) {
                console.log();
            }
        }
    });
});




