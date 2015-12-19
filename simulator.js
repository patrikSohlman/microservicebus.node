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
require('colors');
var MicroServiceBusHost = require("./microServiceBusHost.js");
var fs = require('fs');

var settigs = getSettings();


settigs.nodeName = "nodeJs-00004";
var microServiceBusHost1 = new MicroServiceBusHost(settigs);
microServiceBusHost1.OnStarted(function (loadedCount, exceptionCount) { });
microServiceBusHost1.Start();

settigs.nodeName = "nodeJs-00005";
var microServiceBusHost2 = new MicroServiceBusHost(settigs);
microServiceBusHost2.OnStarted(function (loadedCount, exceptionCount) { });
microServiceBusHost2.Start();


function getSettings() {
    try {
        var data = fs.readFileSync('./settings.json');
        var settings = JSON.parse(data);
        return settings;
    }
    catch (err) {
        console.log('Invalid settings file.'.red);
        process.abort();
    }
}
