const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const routes = require("./routes");

let app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser())
app.use(cors({
    credentials: true,
    origin: "*",
    methods: "GET, HEAD, PUT, PATCH, POST, DELETE",
    allowedHeaders: "Authorization, X-Requested-With, X-HTTP-Method-Override, Content-Type, Cache-Control, Accept",
}));
app.use("/storage", routes);

module.exports = app;