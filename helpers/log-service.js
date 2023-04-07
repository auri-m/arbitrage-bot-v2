require("dotenv")
    .config()

const config =
    require('../config.json')

const {
    Logtail
} = require("@logtail/node");

const logtail =
    new Logtail(process.env.LOGTAIL_KEY);

const message =
    global_bot_name; // message is always the bot name from global variables

const logError = async (error) => {
    if (config.Constraints.RemoteLoggingEnabled) {
        await logtail.error(message, { error });
        await logtail.flush();
    }
}

const logInfo = async (json) => {
    if (config.Constraints.RemoteLoggingEnabled) {
        await logtail.info(message, json);
        await logtail.flush();
    }
}

module.exports = {
    logError,
    logInfo
}