const crypto = require("crypto");

var handlerStorage = [];
var customMidWareIndex = {};
var globalFontWareIndex = {};
var globalBackWareIndex = {};

var executesMidWareIndex = {};

module.exports = {
    addMiddleware,
    runFontWare,
    runBackWare
};

function addMiddleware(name, handle, isGlobal, inFont) {
    var index = indexOfHandle(name);
    if (index == -1) {
        handlerStorage.push(handle);
        index = handlerStorage.length - 1;
    }
    if (isGlobal) {
        if (inFont) globalFontWareIndex[index] = name;
        else globalBackWareIndex[index] = name;
    } else customMidWareIndex[name] = index;
}

function indexOfHandle(name) {
    var keyIndex;

    var fontWareKeys = Object.keys(globalFontWareIndex);
    for (var i = 0; i < fontWareKeys.length; i++) {
        keyIndex = fontWareKeys[i];
        var val = globalFontWareIndex[keyIndex];
        if (val == name) return keyIndex;
    }

    if ((keyIndex = customMidWareIndex[name]) != null) {
        return keyIndex;
    }

    var backWareKeys = Object.keys(globalBackWareIndex);
    for (var i = 0; i < backWareKeys.length; i++) {
        keyIndex = backWareKeys[i];
        var val = globalBackWareIndex[keyIndex];
        if (val == name) return keyIndex;
    }

    return -1;
}

function runMiddleware(
    eventName,
    reqMidWare,
    thisArgs,
    args,
    onComplete,
    inFont,
){
    var handlersIndex = prepareHandler(reqMidWare, eventName, inFont);

    var i = -1;

    function runFunc(func) {
        var result = func.apply(thisArgs, args);
        if (result instanceof Promise) {
            result
                .then(data => {
                    args[2] = data;
                    runNextMiddleware();
                })
                .catch(err => {
                    onComplete(err);
                });
        } else {
            args[2] = result;
            runNextMiddleware();
        }
    }

    function runNextMiddleware() {
        var indexInStorage = handlersIndex[++i];
        if(args[1].finished!=true){
            if (indexInStorage != null) {
                var execute = handlerStorage[indexInStorage];
                runFunc(execute);
            } else {
                onComplete(args[2]);
            }
        }
    }

    runNextMiddleware();

}

function runFontWare(
    eventName,
    reqMidWare,
    thisArgs,
    args,
    onComplete
) {
    runMiddleware(eventName, reqMidWare, thisArgs, args, onComplete, true);
}

function runBackWare(
    eventName,
    reqMidWare,
    thisArgs,
    args,
    onComplete
) {
    runMiddleware(eventName, reqMidWare, thisArgs, args, onComplete, false);
}

function prepareHandler(reqMidWare, eventName, inFont) {
    eventName = reqMidWare + (inFont ? "font" : "back");
    var handlersIndex = executesMidWareIndex[eventName];
    if (handlersIndex != null) return handlersIndex;

    var indexList = [];
    var disableList = [];
    var enableList = [];
    var disableAll = false;

    for (var i in reqMidWare) {
        var middleware = reqMidWare[i];
        if (typeof middleware == "string") {
            // prepare disable global middleware by name
            if (middleware.charAt(0) == "!") {
                if (middleware.substr(1) == "*") disableAll = true;
                else disableList.push(middleware.substr(1));
            }
            // prepare enable middleware by name
            else enableList.push(middleware);
            // support embed middle handle in config
        } else if (typeof middleware == "function") {
            var newMiddlewareName = crypto
                .createHash("sha1")
                .digest(middleware)
                .toString("hex");
            addMiddleware(newMiddlewareName, middleware, false, inFont);
            enableList.push(newMiddlewareName);
        }
    }

    // add all global middleware
    if (!disableAll) {
        if (inFont) indexList = Object.keys(globalFontWareIndex);
        else indexList = Object.keys(globalBackWareIndex);
    }

    // disable global some of middleware by config
    for (var i in disableList) {
        var disableMidWareIndex = disableList[i];
        indexList.splice(indexList.indexOf(disableMidWareIndex));
    }

    // enable some of middleware by config
    for (var i in enableList) {
        var enableMidWareName = enableList[i];
        indexList.push(customMidWareIndex[enableMidWareName]);
    }

    return inFont ? indexList : indexList.reverse();
}
