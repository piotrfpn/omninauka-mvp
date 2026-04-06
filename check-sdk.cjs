const fs = require('fs');
const dts = fs.readFileSync('node_modules/ai/dist/index.d.ts', 'utf8');
const st = dts.indexOf('class DefaultChatTransport');
fs.writeFileSync('transport.txt', dts.slice(st, st+1500));
