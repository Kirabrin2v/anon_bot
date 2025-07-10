const path = require("path")

const cooldown = require(path.join(__dirname, "test.js"))


console.log(cooldown.check_cooldown("цитата", "add", "Herobrin2v"))
console.log(cooldown.check_cooldown("цитата", "add", "Herobrin2v"))