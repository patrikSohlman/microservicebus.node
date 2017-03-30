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

var extend = require('extend');
var fs = require('fs');

function Settings(settingsFile) {
    var self = this;
    var _file = settingsFile;

    function settingsFilePath() {
        return _file;
    }
    this.load = function () {
        var filePath = settingsFilePath();
        if (fs.existsSync(settingsFile)) {
            try {
                var data = fs.readFileSync(filePath);
                var s = JSON.parse(data);
                extend(this, s);
            }
            catch (e) {
                throw "Unable to load settings file";
            }
        }
        else {
            throw "Settings file was not found";
        }
    };
    this.save = function (done) {
        var filePath = settingsFilePath();
        var json = JSON.stringify(this, null, 4);
        fs.writeFile(filePath, json, function (err) {
            if (err) {
                throw "Unable to save settings"
            }
            if (done)
                done();
        });
    };
}
module.exports = Settings;