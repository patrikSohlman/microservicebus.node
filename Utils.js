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
var exports = module.exports = {};
var fs = require('fs');
var npm = require('npm');
var path = require("path");
var crypto = require('crypto');
var algorithm = 'aes-256-ctr';
require('colors');

exports.padLeft = function (nr, n, str) {
    if (nr.length > n)
        nr = nr.substring(0, n);

	return Array(n - String(nr).length + 1).join(str || '0') + nr;
};

exports.padRight = function (nr, n, str) {
    if (nr != undefined && nr.length > n)
        nr = nr.substring(0, n);
    
    return nr + Array(n - String(nr).length + 1).join(str || '0');
};

exports.saveSettings = function (settings) {
    var fileName = "./settings.json";
    
    fs.writeFile(fileName, JSON.stringify(settings, null, 4), function (err) {
        if (err) {
            console.log(err);
        }
    });
};

fs.mkdirRecursive = function (dirPath, mode, callback) {
    //Call the standard fs.mkdir
    fs.mkdir(dirPath, mode, function (error) {
        // When it fail in this way, do the custom steps
        if (error && error.errno === 34) {
            //Create all the parents recursively
            fs.mkdirParent(path.dirname(dirPath), mode, callback);
            //And then the directory
            fs.mkdirParent(dirPath, mode, callback);
        }
        //Manually run the callback since we used our own callback to do all these 
        callback && callback(error); // jshint ignore:line
    });
};

exports.mkdir = function (dir, callback) {
    fs.mkdirParent(dir, null, callback);
};

exports.encrypt = function (buffer, password) {
    password = password == undefined ? process.env["NODESECRET"] : password;
    if (password == undefined) {
        throw "Node is configured to use encryption, but no secret has been configured. Add an environment variable called 'NODESECRET and set the value to your secret.".bgRed;
    }
    
    var cipher = crypto.createCipher(algorithm, password)
    var crypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    return crypted;
}

exports.decrypt = function (buffer, password) {
    password = password == undefined ? process.env["NODESECRET"] : password;
    if (password == undefined) {
        throw "Node is configured to use encryption, but no secret has been configured. Add an environment variable called 'NODESECRET and set the value to your secret.".bgRed;
    }
    var algorithm = 'aes-256-ctr';
    var decipher = crypto.createDecipher(algorithm, password)
    var dec = Buffer.concat([decipher.update(buffer) , decipher.final()]);
    return dec;
}

exports.addNpmPackage = function (npmPackage, callback) {
    var ret;
    var me = this;
    npm.load({ loaded: true }, function (err) {
        var packageFolder = path.resolve(npm.dir, npmPackage)
        fs.stat(packageFolder, function (er, s) {
            if (er || !s.isDirectory()) {
                npm.commands.install([npmPackage], function (er, data) {
                    callback(er);
                });
            }
            else {
                callback(null);
            }
        });
    });
};

exports.compareVersion = function (a, b) {
    var i;
    var len;
    
    if (typeof a + typeof b !== 'stringstring') {
        return false;
    }
    
    a = a.split('.');
    b = b.split('.');
    i = 0;
    len = Math.max(a.length, b.length);
    
    for (; i < len; i++) {
        if ((a[i] && !b[i] && parseInt(a[i]) > 0) || (parseInt(a[i]) > parseInt(b[i]))) {
            return 1;
        } else if ((b[i] && !a[i] && parseInt(b[i]) > 0) || (parseInt(a[i]) < parseInt(b[i]))) {
            return -1;
        }
    }
    
    return 0;
};

