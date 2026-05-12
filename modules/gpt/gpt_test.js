const path = require("path")
const GptModule = require(path.join(__dirname, "gpt.js"))

const gpt = new GptModule()

console.log(gpt.send_background_request)
gpt.send_background_request("Herobrin2v", "Ам.. тут кто-то есть?", "03:05 Интересно, можно ли тут гриферить?")
// gpt.send_request("Herobrin2v", "Я Кира. А тебя как зовут?").then(answ => gpt.send_request("Herobrin2v", "Помнишь, как меня зовут? Назови моё имя"))
