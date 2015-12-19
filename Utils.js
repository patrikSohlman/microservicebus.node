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

var exports = module.exports = {};
var fs = require('fs');
var npm = require('npm');
var path = require("path");
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
    fileName = "./settings.json";
    
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

exports.encrypt = function (payload, certificate) {
    var ursa;
    this.addNpmPackage('ursa', function (err) {
        if (err == null || err == "") {
            ursa = require('ursa');
        }
        else {
            console.log('Unable to install ursa npm package'.red);
            console.log('Make sure OpenSSL (normal, not light) in the same bitness as your Node.js installation'.red);
            console.log('You can download OpenSSL from http://slproweb.com/products/Win32OpenSSL.html');

            throw 'Unable to install ursa npm package';
        }
    });

    var crt = ursa.createPublicKey(fs.readFileSync(certificate));
    encryptedPayload = crt.encrypt(payload, 'utf8', 'base64');
    return encryptedPayload;
};

exports.decrypt = function (encryptedPayload, certificate) {
    var ursa;
    this.addNpmPackage('ursa', function (err) {
        if (err == null || err == "") {
            ursa = require('ursa');
        }
        else {
            console.log('Unable to install ursa npm package'.red);
            console.log('Make sure OpenSSL (normal, not light) in the same bitness as your Node.js installation'.red);
            console.log('You can download OpenSSL from http://slproweb.com/products/Win32OpenSSL.html');
            
            throw 'Unable to install ursa npm package';
        }
    });
    
    var key = ursa.createPrivateKey(fs.readFileSync(certificate));
    payload = key.decrypt(encryptedPayload, 'base64', 'utf8');
    return payload;
};

exports.addNpmPackage = function (npmPackage, callback) {
    var ret;
    var me = this;
    npm.load({ loaded: true }, function (err) {
        var packageFolder = path.resolve(npm.dir, npmPackage)
        fs.stat(packageFolder, function (er, s) {
            if (er || !s.isDirectory()) {
                npm.commands.install([npmPackage], function (er, data) {
                    ret = er;
                });
            }
            else {
                ret = null;
            }
        });
    });
    while (ret === undefined) {
        try {
            require('deasync').runLoopOnce();
        }
            catch (errr) {
            console.log("Unable to install anpm package");
        }
    }
    callback(ret);
};