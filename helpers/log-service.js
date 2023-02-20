require("dotenv").config()

const { Logtail } = require("@logtail/node");
const _logtail = new Logtail(process.env.LOGTAIL_KEY);
const _message = global_bot_name; // message is always the bot name from global variables

const logError = async (error) => {
    await _logtail.error(_message, {error});
    await _logtail.flush();
}

const logInfo = async (json) => {
    await _logtail.info(_message, json);
    await _logtail.flush();
}

module.exports = {
    logError,
    logInfo
}