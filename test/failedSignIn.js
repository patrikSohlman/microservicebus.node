
var MicroService = require('../Services/microService.js');
var microService = new MicroService();
var varaiables = [
    { Variable: 'kid1', Type: 'String', Value: "Linus" },
    { Variable: 'kid2', Type: 'String', Value: "Ponus" },
    { Variable: 'kid3', Type: 'String', Value: "Matilda" }
];

var context = {
    "ContentType" : 'application/json',
    "Variables" : varaiables
}
var payload = {
    "place": "okq8",
    "date": "21-02-2016",
    "time": "17.43",
    "filename": "okq8_21-02-2016_17.43"
};
var str = "okq8_[date]_[time]_{kid1}_{kid2}_{kid3}.json";
microService.ParseString(str, payload, context);


