'use strict'; /* global describe, it */
var mocha = require('mocha')
var util = require('../Utils.js');
var test = require('unit.js');
var fs = require('fs');
var assert = require('assert');
var request = require('supertest');
var express = require('express');
var MicroServiceBusHost = require("../microServiceBusHost.js");
var _started = false;
var settings;
var loggedInComplete1 = false;
var loggedInComplete2 = false;
var step1Complete = false;
var microServiceBusHost;
var microServiceBusHost2;

process.env.organizationid = "65b22e1f-a17e-432f-b9f2-b7057423a786";

describe('SignIn', function () {
    
    var check = function (done) {
        if (loggedInComplete1) done();
        else setTimeout(function () { check(done) }, 1000);
    }
    
    it('ENV organizationId should be set', function (done) {
        var orgId = process.env.organizationId;
        if (orgId == undefined)
            throw "organizationId is not set as an environment variable";
        done();
    });
    
    it('Save settings should work', function (done) {
        
        settings = {
            "debug": false,
            "hubUri": "wss://microservicebus.com",
            "nodeName": "TestNode1",
            "organizationId" : process.env.organizationid,
            "port" : 9090
        }
        util.saveSettings(settings);
        done();
    });
    
    it('Sign in should work', function () {
        this.timeout(10000);
        loggedInComplete1 = false;
        microServiceBusHost = new MicroServiceBusHost(settings);
        microServiceBusHost.OnUpdatedItineraryComplete(function () { });
        microServiceBusHost.OnStarted(function (loadedCount, exceptionCount) {
            if (_started)
                return;
            _started = true;
            
            describe('PostLogin', function () {
                
                it('Should start without errors', function (done) {
                    exceptionCount.should.equal(0);
                    done();
                });
                it('azureApiAppInboundService.js should exist after login', function (done) {
                    var ret = fs.statSync(__dirname + "/../Services/azureApiAppInboundService.js");
                    ret.should.be.type('object');
                    done();
                });
                it('javascriptaction.js should exist after login', function (done) {
                    var ret = fs.statSync(__dirname + "/../Services/javascriptaction.js");
                    ret.should.be.type('object');
                    done();
                });
                it('calling test should work', function (done) {
                    this.timeout(5000);
                    var url = 'http://localhost:9090';
                    
                    request(url)
		                .get('/api/data/azureApiAppInboundService1/test')
		                .expect('Content-Type', /json/)
		                .expect(200)//Status code
		                .end(function (err, res) {
                        if (err) {
                            throw err;
                        }
                        res.body.should.have.property('result');
                        res.body.result.should.equal(true);
                        done();
                    });
                });
                it('ping should work', function (done) {
                    var pingResponse = microServiceBusHost.TestOnPing("");
                    pingResponse.should.equal(true);
                    done();
                });
                it('change debug state should work', function (done) {
                    var TestOnChangeDebugResponse = microServiceBusHost.TestOnChangeDebug(false);
                    TestOnChangeDebugResponse.should.equal(true);
                    done();
                });
                it('update itinerary should work', function (done) {
                    //console.log("????????????????????????????????????????");
                    this.timeout(10000);
                    var testData = require('./testData.js');
                    var updatedItinerary = testData.updateItinerary();
                    microServiceBusHost.OnUpdatedItineraryComplete(function () {
                        done();
                    });
                    var TestOnUpdateItineraryResponse = microServiceBusHost.TestOnUpdateItinerary(updatedItinerary);
                });
                it('stopping the node', function (done) {
                    step1Complete = true;
                    microServiceBusHost.Stop();
                    done();
                    
                });
                
            });
            loggedInComplete1 = true;
        });
        microServiceBusHost.OnStopped(function () {
            describe('Post stopped', function () {
                it('Save settings should work', function (done) {
                    settings = {
                        "debug": false,
                        "hubUri": "wss://microservicebus.com",
                        "nodeName": "WRONGHOST",
                        "organizationId" : process.env.organizationid,
                        "port" : 9090
                    }
                    util.saveSettings(settings);
                    done();
                });
                
                //it('Sign in with wrong node should not work', function () {
                //    console.log("ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄ");
                    
                //    microServiceBusHost.Start(true);
                //    while (loggedInComplete2 == false) {
                //        try {
                //            require('deasync').runLoopOnce();
                //        }
                //    catch (errr) { console.log(); }
                //    }
                //});
            
            });
        });
        microServiceBusHost.Start(true);
        while (loggedInComplete1 == false) {
            try {
                require('deasync').runLoopOnce();
                
            }
            catch (errr) { console.log(); }
        }
        
    });

    //it('Save settings should work', function (done) {
    //    settings = {
    //        "debug": false,
    //        "hubUri": "wss://microservicebus.com",
    //        "nodeName": "WRONGHOST",
    //        "organizationId" : process.env.organizationid,
    //        "port" : 9090
    //    }
    //    util.saveSettings(settings);
    //    done();
    //});
    
    //it('Sign in with wrong node should not work', function () {
    //    console.log("ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄ");
    //    this.timeout(10000);
    //    loggedInComplete2 = false;
    //    microServiceBusHost2 = new MicroServiceBusHost(settings);
    //    microServiceBusHost2.OnUpdatedItineraryComplete(function () { });
    //    microServiceBusHost2.OnStarted(function (loadedCount, exceptionCount) {
    //        describe('Sign in with wrong node', function () {
                
    //            it('Should complete with errors', function (done) {
    //                exceptionCount.should.equal(1);
    //                done();
    //            });
                
    //        });
    //        loggedInComplete2 = true;
    //    });
        
    //    microServiceBusHost2.Start(true);
    //    while (loggedInComplete2 == false) {
    //        try {
    //            require('deasync').runLoopOnce();
    //        }
    //        catch (errr) { console.log(); }
    //    }
    //});

    //it('Save settings should work', function (done) {
        
    //    settings = {
    //        "debug": false,
    //        "hubUri": "wss://microservicebus.com",
    //        "nodeName": "TestNode1",
    //        "organizationId" : "65b22e1f-a17e-432f-b9f2-b7057423a782",
    //        "port" : 9090
    //    }
    //    util.saveSettings(settings);
    //    done();
    //});
    
    //it('Sign in with wrong org should not work', function () {
    //    this.timeout(10000);
    //    loggedInComplete1 = false;
    //    microServiceBusHost = new MicroServiceBusHost(settings);
    //    microServiceBusHost.OnStarted(function (loadedCount, exceptionCount) {
    //        describe('Sign in with wrong organization', function () {
                
    //            it('Should complete with errors', function (done) {
    //                exceptionCount.should.equal(1);
    //                done();
    //            });
                
    //        });
    //        loggedInComplete1 = true;
    //    });
        
    //    microServiceBusHost.Start(true);
    //    while (loggedInComplete1 == false) {
    //        try {
    //            require('deasync').runLoopOnce();
    //        }
    //        catch (errr) { console.log(); }
    //    }
    //});

});


