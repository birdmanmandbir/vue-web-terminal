import historyStore from "./HistoryStore.js";

const instance = new TerminalObj()

function TerminalObj() {
    let pool = {}
    let options = {}

    let setOptions = function (ops) {
        options = ops
    }

    let getOptions = function () {
        return options
    }

    let register = function (name, listener) {
        if (pool[name] != null) {
            throw Error("Unable to register a listener with the same name: " + name)
        }
        pool[name] = listener
    }

    let unregister = function (name) {
        delete pool[name]
    }

    let post = function (name = 'terminal', event, options) {
        let listener = pool[name]
        if (listener != null) {
            listener(event, options)
        }
    }

    let pushMessage = function (name, options) {
        post(name, 'pushMessage', options)
    }

    let updateContext = function (name, context) {
        post(name, 'updateContext', context)
    }

    let getHistory = function () {
        return historyStore
    }

    let fullscreen = function (name) {
        post(name, "fullscreen")
    }

    return {
        setOptions: setOptions,
        getOptions: getOptions,
        post: post,
        register: register,
        unregister: unregister,
        pushMessage: pushMessage,
        updateContext: updateContext,
        getHistory: getHistory,
        fullscreen: fullscreen
    }
}

export default instance
