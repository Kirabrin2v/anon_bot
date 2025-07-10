const path = require("path")

const cooldown = require(path.join(__dirname, "cooldown.js"))


console.log(cooldown.check_cooldown("Herobrin2v", "цитата", ["id", 234234234]))
setTimeout(() => {

console.log(cooldown.check_cooldown("Herobrin2v", "цитата", []))
}, 5000)