/*
The MIT License (MIT)

Copyright (c) 2014 microServiceBus.com

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

'use strict';
var util = require('./Utils.js');
var exports = module.exports = {};

function Applicationinsights() {
    var appInsights = null;
    var me = this;
    var _isInitialized = false;
    Applicationinsights.prototype.trackEvent = function (type, event) {
        type = type === undefined ? "UNDEFINED" : type;
        if (_isInitialized)
            appInsights.client.trackEvent(type, event);
    };
    Applicationinsights.prototype.trackException = function (error) {
        try {
            if (_isInitialized)
                appInsights.client.trackException(new Error(error.FaultDescription), error);
        }
        catch (ex) {
            console.log(ex);
        }
    };
    Applicationinsights.prototype.init = function (instrumentationKey, node) {
        return new Promise(function (resolve, reject) {

            if (instrumentationKey === null || instrumentationKey === undefined) {
                resolve(false);
                return;
            }
            util.addNpmPackage("applicationinsights", function (err) {
                if (err) {
                    reject(Error(err));
                }
                else {
                    appInsights = require("applicationinsights");

                    appInsights.setup(instrumentationKey)
                        .setAutoCollectRequests(false)
                        .setAutoCollectPerformance(false)
                        .setAutoCollectExceptions(false)
                        .start();

                    appInsights.client.commonProperties = {
                        node: node
                    };

                    appInsights.enableVerboseLogging(true);
                    
                    _isInitialized = true;
                    resolve(true);
                }
            });
        });

    };
    
}
module.exports = Applicationinsights;