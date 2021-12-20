const fs = require("fs");
const path = require("path");
const sockets = require("socket.io");
const settings = require("../settings");

const server = new sockets.Server({
    cors: {
        origin: "*"
    }
});

let startTimeout = null;
let endTimeout = null;
let priceUpdateInterval = null;
let data = loadData();

server.sockets.on("connection", (socket) =>{
    console.log("Пользователь присоеденился.");

    socket.on("start", (endInterval, endDate) => {
        clearInterval(priceUpdateInterval);
        clearTimeout(startTimeout);
        clearTimeout(endTimeout);

        server.emit("start");
        data.settings.interval = parseInt(endInterval);
        data.settings.datetimeStart = new Date().toISOString().substr(0, 19);
        data.settings.datetimeEnd = endDate;
        saveData(data);

        startExchangeInterval();
        endExchangeInterval();

        console.log("Администратор запустил торги:", endDate + "; интервал:", endInterval);
    });

    socket.on("end", () => {
        clearInterval(priceUpdateInterval);
        clearTimeout(startTimeout);
        clearTimeout(endTimeout);

        server.emit("end")
        data.settings.state = "after";
        data.settings.datetimeEnd = new Date().toISOString().substr(0, 19);
        saveData(data);

        console.log("Администратор завершил торги.");
    });

    socket.on("disconnect", () => {
        console.log("Пользователь отключился.");
    });

    socket.on("sell", (requestData) => {
        let sellInfo = requestData.sellInfo;

        if (sellInfo.count <= data.brokers[sellInfo.seller_id].stocks[sellInfo.stock_id].count) {
            data.brokers[sellInfo.seller_id].selling_stocks[sellInfo.stock_id].count += sellInfo.count;
            data.brokers[sellInfo.seller_id].stocks[sellInfo.stock_id].count -= sellInfo.count;
            saveData(data);

            server.emit("sell", {sellInfo: sellInfo});
            console.log("Продажа акций, данные:", sellInfo);
        } else {
            console.log("Ошибка при продажи акций.");
        }
    });

    socket.on("notsell", (requestData) => {
        let cancelSellInfo = requestData.notsellInfo;

        if (cancelSellInfo.count <= data.brokers[cancelSellInfo.seller_id].selling_stocks[cancelSellInfo.stock_id].count) {
            data.brokers[cancelSellInfo.seller_id].selling_stocks[cancelSellInfo.stock_id].count -= cancelSellInfo.count;
            data.brokers[cancelSellInfo.seller_id].stocks[cancelSellInfo.stock_id].count += cancelSellInfo.count;
            saveData(data);

            server.emit("notsell", { notsellInfo: cancelSellInfo });
            console.log("Отмена продажи акций, данные:", cancelSellInfo);
        } else {
            console.log("Ошибка при отмене продажи акций.");
        }
    })

    socket.on("buy", (requestData) => {
        if (data.settings.state !== "in") {
            console.log("Ошибка при покупке акций. Торги не начались.");
            return;
        }

        let transaction = requestData.transaction;

        if (((transaction.seller_id >= 0 && transaction.count <= data.brokers[transaction.seller_id].selling_stocks[transaction.stock_id].count) || (transaction.seller_id < 0 && transaction.count <= data.stocks[transaction.stock_id].count))
            && data.brokers[transaction.buyer_id].balance >= transaction.count * transaction.price)
        {
            data.brokers[transaction.buyer_id].stocks[transaction.stock_id].count += transaction.count;
            data.brokers[transaction.buyer_id].balance -= transaction.price * transaction.count;
            data.brokers[transaction.buyer_id].waste += transaction.price * transaction.count;

            if (transaction.seller_id >= 0) {
                data.brokers[transaction.seller_id].selling_stocks[transaction.stock_id].count -= transaction.count;
                data.brokers[transaction.seller_id].balance += transaction.count * transaction.price;
                data.brokers[transaction.seller_id].earn += transaction.count * transaction.price;
            } else if (transaction.seller_id < 0) {
                data.stocks[transaction.stock_id].count -= transaction.count;
            }

            saveData(data);

            server.emit("buy", { transaction: transaction });
            console.log("Покупка акций, транзакция:", transaction);
        } else {
            console.log("Ошибка при покупке акций.");
        }
    });

    socket.on("setChange", (requestData) => {
        console.log("Изменение закона изменения цена для акций: " + ((requestData.type === 0)? "Равномерный" : "Нормальный"));

        for (let stock of data.stocks) {
            stock.changeType = requestData.type;
        }

        saveData(data);
    })
})

function startUpdatePriceInterval() {
    clearInterval(priceUpdateInterval);

    priceUpdateInterval = setInterval(() => {
        console.log("Пересчет цен акций...")

        for (let stock of data.stocks) {
            generatePrice(stock);
        }

        server.emit("change", { stocks: data.stocks });
        saveData(data);
    }, data.settings.interval * 1000);
}

function startExchangeInterval() {
    console.log(`Начало торгов: ${data.settings.datetimeStart}, конец торгов: ${data.settings.datetimeEnd}, время до конца торгов: ${new Date(data.settings.datetimeEnd) - new Date()}`);

    data.settings.state = "before";
    saveData(data);

    clearTimeout(startTimeout);

    startTimeout = setTimeout(() => {
        console.log("Запуск торгов");

        data.settings.state = "in";
        saveData(data);
        server.emit("start");

        startUpdatePriceInterval();
    }, new Date(data.settings.datetimeStart) - new Date());
}

function endExchangeInterval() {
    clearTimeout(endTimeout);

    endTimeout = setTimeout(() => {
        console.log("Конец торгов");

        data.settings.state = "after";
        saveData(data);
        server.emit("end");

        clearInterval(priceUpdateInterval);
    }, new Date(data.settings.datetimeEnd) - new Date());
}

function generatePrice(stock) {
    let deltaCost;

    if (stock.changeType === 0) {
        deltaCost = Math.round(Math.random() * (stock.maxStep * 2) - stock.maxStep);
    } else {
        deltaCost = Math.round(random_normal() * (stock.maxStep * 2) - stock.maxStep);
    }

    stock.startingPrice += deltaCost;

    if (stock.startingPrice < 0) {
        stock.startingPrice = 0;
    }
}

function random_normal() {
    let r = Math.random(), u = Math.random();
    if (r === 0) r = 1;
    if (u === 0) u = 1;

    let z = Math.sqrt(-2.0 * Math.log(r)) * Math.cos(2.0 * Math.PI * u);
    z = z / 10.0 + 0.5;

    if (z > 1 || z < 0) return random_normal();
    return z;
}

function saveData(data) {
    fs.writeFileSync(path.resolve(__dirname + "/.." + settings.storagePath), JSON.stringify(data, null, 2));
}

function loadData() {
    return JSON.parse(fs.readFileSync(path.resolve(__dirname + "/.." + settings.storagePath), "utf-8"));
}

server.startExchangeInterval = startExchangeInterval;
server.endExchangeInterval = endExchangeInterval;

module.exports = server;