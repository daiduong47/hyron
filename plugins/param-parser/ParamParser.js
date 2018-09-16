const argumentParser = require("./lib/argumentParser");
const Checker = require("./Checker");
const queryParser = require("../../lib/queryParser");
const ModuleManager = require("../../core/moduleManager");
const multiPartParser = require("./lib/multipartParser");

var argsStorage = {};

module.exports = function(req) {
    return new Promise((resolve, reject) => {
        var executer = this.$executer;
        Checker.registerChecker(this.$eventName, executer);
        var argList = prepareArgList(this.$eventName, executer);
        getDataFromRequest(argList, req, (data, err) => {
            if (err != null) reject(err);
            err = Checker.checkData(this.$eventName, data);
            if (err != null) reject(err);
            var standardInput = resortDataIndex(data, argList);
            resolve(standardInput);
        });
    });
};

function prepareArgList(name, func) {
    var res = argsStorage[name];
    if (res == null) {
        res = argumentParser(func.toString());
        argsStorage[name] = res;
    }
    return res;
}

function getDataFromRequest(argList, req, onComplete) {
    var method = req.method;
    if (req.isREST == true) {
        getRestData(req, argList, onComplete);
    } else if (isQueryParamType(method)) {
        getQueryData(req, onComplete);
    } else if (isBodyParamType(method)) {
        getBodyData(req, argList, onComplete);
    }
}

function getQueryData(req, onComplete) {
    var data = queryParser.getQuery(req.url);
    onComplete(data);
}

function getBodyData(req, argList, onComplete) {
    var reqBodyType = req.headers["content-type"];
    if (reqBodyType == null) {
        onComplete(null);
    } else if (reqBodyType == "application/x-www-form-urlencoded") {
        req.on("data", chunk => {
            var data = queryParser.getQuery("?" + chunk.toString());
            onComplete(data);
        });
    } else if (reqBodyType.startsWith("multipart/form-data")) {
        multiPartParser(req, onComplete);
    } else {
        var buf = [];
        req.on("data", chunk => {
            buf.push(chunk);
        });
        req.on("end", () => {
            var output = {};
            output[argList[0]] = Buffer.concat(buf);
            onComplete(output);
        });
        req.on("error", err => {
            onComplete(null, err);
        });
    }
}

function getRestData(req, argList, onComplete) {
    var url = req.url;
    var param = url.substr(url.lastIndexOf("/")+1);
    var output = {};
    output[argList[0]] = param;
    var method = req.method;
    var customOnComplete = data => {
        Object.assign(output, data);
        onComplete(output);
    };
    if (isBodyParamType(method)) {
        getBodyData(req, [argList[1]], customOnComplete);
    } else if (isQueryParamType(method)) {
        getQueryData(req, customOnComplete);
    }
}

function isBodyParamType(method){
    return (method == "POST") | (method == "PUT");
}

function isQueryParamType(method){
    return (method == "GET") | (method == "DELETE") | (method == "HEAD")
}

function resortDataIndex(data, argList) {
    if (data == null) return data;
    var resortInput = [];
    argList.forEach(key => {
        resortInput.push(data[key]);
    });

    return resortInput;
}
