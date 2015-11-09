var mocha = require('mocha')
var util = require('../Utils.js');
var test = require('unit.js');
var fs = require('fs');
var assert = require('assert');
var request = require('supertest');
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
            "debug": false,
            "hubUri": "wss://microservicebus.com",
            "nodeName": "TestNode1",
            "organizationId" : process.env.organizationid,
            "port" : 9090
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
                    it('simulatorTemperatureSensor.js should exist after login', function () {
                        fs.statSync(__dirname + "/../Services/simulatorTemperatureSensor.js");
                    });
                    it('nullOutboundService.js should exist after login', function () {
                        fs.statSync(__dirname + "/../Services/nullOutboundService.js");
                    });
                    it('calling test should work', function () {
                        var url = 'http://localhost:9090';
                        request(url)
		                    .get('/api/data/azureApiAppInboundService1/test')
		                    .send('')
		                    .expect('Content-Type', /json/)
		                    .expect(200)//Status code
		                    .end(function (err, res) {
                                if (err) {
                                    throw err;
                                }
                            
                                console.log('HELLO');
                                res.body.should.have.property('result');
                                res.body.result.should.equal(false);
                                done();
                            });
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


//describe('Call service', function () {
//    it('calling test should work', function () {
//        var url = 'http://localhost:9090';
//        request(url)
//		.get('/api/data/azureApiAppInboundService1/test')
//		.send('')
//		.expect('Content-Type', /json/)
//		.expect(200)//Status code
//		.end(function (err, res) {
//            if (err) {
//                throw err;
//            }
            
//            console.log('HELLO');
//            res.body.should.have.property('result');
//            res.body.result.should.equal(false);
//            done();
//        });
//    });
//});