const config = 
    require('../config.json')
const bot_name = 
    `${config.Chain}_${config.Dex_1.Name}_${config.Dex_2.Name}_${config.MainToken.Name}_${config.InterimToken.Name}_${config.Port}`
const entry_file = 
    process.argv[1];

global.global_bot_name 
    = bot_name
global.global_entry_file 
    = entry_file
