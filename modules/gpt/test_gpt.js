const path = require("path")
const gpt = require(path.join(__dirname, "gpt.js"))

gpt.send_request("Herobrin2v", "Я Кира. А тебя как зовут?").then(answ => gpt.send_request("Herobrin2v", "Помнишь, как меня зовут? Назови моё имя"))
