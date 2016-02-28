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

var iothub = require('azure-iothub');
var crypto = require('crypto');
var httpRequest = require('request');
var storage = require('node-persist');
var util = require('../Utils.js');
var guid = require('uuid');

function AZUREIOT(nodeName, sbSettings) {
    var storageIsEnabled = true;
    
    // Setup hub
    //var registry = iothub.Registry.fromConnectionString(sbSettings.connectionString);
    var receiverToken = decodeURIComponent(sbSettings.receiverToken);

    // Setup tracking
    var baseAddress = "https://" + sbSettings.sbNamespace;
    if (!baseAddress.match(/\/$/)) {
        baseAddress += '/';
    }
    var restTrackingToken = create_sas_token(baseAddress, sbSettings.trackingKeyName, sbSettings.trackingKey);

    AZUREIOT.prototype.Start = function () {
        stop = false;
    };
    AZUREIOT.prototype.Stop = function () {
        stop = true;
    };
    AZUREIOT.prototype.Submit = function (message, node, service) {
       
    };
    AZUREIOT.prototype.Track = function (trackingMessage) {
        try {
            if (stop) {         
                if (storageIsEnabled)
                    storage.setItem("_tracking_" + trackingMessage.InterchangeId, trackingMessage);
                
                return;
            }
            
            var trackUri = baseAddress + sbSettings.trackingHubName + "/messages" + "?timeout=60";
            
            httpRequest({
                headers: {
                    "Authorization": restTrackingToken, 
                    "Content-Type" : "application/json",
                },
                uri: trackUri,
                json: trackingMessage,
                method: 'POST'
            }, 
            function (err, res, body) {
                if (err != null) {
                    onQueueErrorSubmitCallback("Unable to send message. " + err.code + " - " + err.message)
                    console.log("Unable to send message. " + err.code + " - " + err.message);
                    if (storageIsEnabled)
                        storage.setItem("_tracking_" + trackingMessage.InterchangeId, trackingMessage);
                }
                else if (res.statusCode >= 200 && res.statusCode < 300) {
                }
                else if (res.statusCode == 401) {
                    console.log("Invalid token. Updating token...")
                    restTrackingToken = create_sas_token(baseAddress, sbSettings.trackingKeyName, sbSettings.trackingKey);
                    this.Track(trackingMessage)
                    return;
                }
                else {
                    console.log("Unable to send message. " + res.statusCode + " - " + res.statusMessage);

                }
            });

        }
        catch (err) {
            console.log();
        }
    };

    function create_sas_token(uri, key_name, key) {
        // Token expires in 24 hours
        var expiry = Math.floor(new Date().getTime() / 1000 + 3600 * 24);
        var string_to_sign = encodeURIComponent(uri) + '\n' + expiry;
        var hmac = crypto.createHmac('sha256', key);
        hmac.update(string_to_sign);
        var signature = hmac.digest('base64');
        var token = 'SharedAccessSignature sr=' + encodeURIComponent(uri) + '&sig=' + encodeURIComponent(signature) + '&se=' + expiry + '&skn=' + key_name;
        return token;
    }
}
module.exports = AZUREIOT;