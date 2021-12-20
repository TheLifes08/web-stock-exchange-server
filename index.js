const expressServer = require("./express-server");
const socketServer = require("./socket-server");
const settings = require("./settings");

expressServer.listen(settings.express.port, settings.express.ip);
socketServer.listen(settings.socket.port);

socketServer.startExchangeInterval();
socketServer.endExchangeInterval();
