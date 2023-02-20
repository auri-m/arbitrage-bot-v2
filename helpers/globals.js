const _config = require('../config.json')
const _bot_name = `${_config.Chain}_${_config.Dex_1.Name}_${_config.Dex_2.Name}_${_config.MainToken.Name}_${_config.InterimToken.Name}_${_config.Port}`
const _entry_file = process.argv[1];

global.global_bot_name = _bot_name
global.global_entry_file = _entry_file
