'use strict'; /* global describe, it */
var mocha = require('mocha')
var util = require('../Utils.js');
var test = require('unit.js');
var fs = require('fs');
var assert = require('assert');
var request = require('supertest');
var express = require('express');
var MicroServiceBusHost = require("../microServiceBusHost.js");

var settings;
var loggedInComplete1 = false;
var microServiceBusHost;
process.env.organizationid = "65b22e1f-a17e-432f-b9f2-b7057423a786";

describe('SignIn', function () {
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
        microServiceBusHost.OnStarted(function (loadedCount, exceptionCount) {
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
                it('stopping the node', function (done) {
                        microServiceBusHost.Stop();
                        done();
                    });
               
            });
            loggedInComplete1 = true;
        });

        microServiceBusHost.Start(true);
        while (loggedInComplete1 == false) {
            try {
                require('deasync').runLoopOnce();
            }
            catch (errr) {console.log();}
        }
    });

});
