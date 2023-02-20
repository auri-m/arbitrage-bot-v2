const {
    logError,
    logInfo
} = require('./log-service')

try
{   
    const express = require('express');
    const cors = require('cors');
    const config = require('../config.json');

    const application = express();
    const port = config.Port

    application.listen(port);
    application.use(cors({ credentials: true, origin: '*' }))

    logInfo({
        type: "host-start",
        port
    })

} catch(error) {
    console.log("Host process error caught")
    console.log(error)
    logError(error);
}


