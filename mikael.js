'use strict';

var npm = require('npm');
var fs = require('graceful-fs');
var path = require("path");

function AddNpmPackage (npmPackages, logOutput, callback) {
    var ret;
    var me = this;
    npm.load({ loaded: true }, function (err) {
        // All packages
        var packages = npmPackages.split(',');
        var newPackages = [];
        
        for (var i = 0; i < packages.length; i++) {
            var npmPackage = packages[i];
            var packageFolder = path.resolve(npm.dir, npmPackage)
            try {
                var stats = fs.lstatSync(packageFolder);
                if (!stats.isDirectory()) {
                    newPackages.push(npmPackage);
                }
            }
                catch (e) {
                newPackages.push(npmPackage);
            }
        }
        
        if (newPackages.length == 0)
            callback(null);
        else {
            try {
                npm.commands.install(newPackages, function (er, data) {
                    callback(er);
                });
                npm.on("log", function (message) {
                    ret = null;
                });
                npm.on("error", function (error) {
                    ret = null;
                });
            }
                catch (ex) {
                callback(ex);
            }
        }
    });
};

AddNpmPackage('nodemailer', true, function (e) {
    console.log("done " + e);

})