cls

$currentFolder = split-path -parent $Script:MyInvocation.MyCommand.Path

$currentFolder

set-location $currentFolder

npm install

cls

$currentFolder = get-location

write-host `n

write-host $currentFolder

write-host `n

node bot.js