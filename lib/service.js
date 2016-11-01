

process.chdir(__dirname);
const serviceName = "microServiceBus.node";
var fs = require("fs");
var service = require("os-service");
var microServiceBusHost;

init();

function usage() {
    console.log("usage: node service --uninstall [code] [name] [username] [password]");
    console.log("       node service --remove <name>");
    console.log("       node service --run");
    process.exit(-1);
}
function run(callback) {
    // Prevent the service from being started more than once
    if (microServiceBusHost) {       
        return;
    }
    console.log("1");
    microServiceBusHost = 1;

    var data = fs.readFileSync(__dirname + '/settings.json');
    console.log("2");

    settings = JSON.parse(data);
    settings.log = "microServiceBus.log"
    var fileName = __dirname + "/settings.json";
    console.log("3");
    
    fs.writeFile(fileName, JSON.stringify(settings, null, 4), function (err) {
        if (err)
            console.log(err);
        else {
            console.log("Service Starting");
            var MicroServiceBusHost = require("./microServiceBusHost.js");
            microServiceBusHost = new MicroServiceBusHost(settings);
            microServiceBusHost.OnStarted(function (loadedCount, exceptionCount) {
               
            });
            microServiceBusHost.OnStopped(function () {

            });
            microServiceBusHost.OnUpdatedItineraryComplete(function () {

            });
            microServiceBusHost.Start();
            console.log("done");
        }
    });
    callback("done");
};
function init() {
    if ((process.argv[2] == "--install" || process.argv[2] == "--i") && process.argv.length >= 3) {
        require('colors');
        var utils = require("./Utils.js");

        var options = {
            programArgs: ["--run"]
        };

        if (process.argv.length > 4)
            options.username = process.argv[4];

        if (process.argv.length > 5)
            options.password = process.argv[5];
        

        utils.addNpmPackage("os-service", function (err) {
            if (err) {
                console.log('Unable to install service'.bgRed.white);
                console.log(err.bgRed.white);
                process.exit(-1);
            }
            else {
                service.add(serviceName, options, function (error) {
                    if (error)
                        console.log(error.toString().red);
                    else
                        console.log("Service installed successfully".green);
                });
            }
        });
    }
    else if ((process.argv[2] == "--uninstall" || process.argv[2] == "--u") && process.argv.length >= 3) {
        require('colors');
        service.remove(serviceName, function (error) {
            if (error)
                console.log(error.toString().red);
            else 
                console.log("Service uninstalled successfully".green);
            
        });
    }
    else if (process.argv[2] == "--run") {
        var logStream = fs.createWriteStream(serviceName + ".log");
        service.run(logStream, function () {
            microServiceBusHost.Stop(function () {
                console.log('stopping service');
                service.stop(0);
            });
        });
        setInterval(function () {
            run(function (message) {
                console.log('started');
            });
        }, 1000);
    }
    else {
        usage();
    }
}

