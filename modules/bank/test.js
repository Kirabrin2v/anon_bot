bank = require("./bank_processing")
bank.update_count_TCA(5)
bank.update_count_survings(100000);
console.log(bank.authorization("Herobrin2v", "счёт", "пароль1"))
console.log(bank.bank_processing("Herobrin2v", ["пополнить", 123, "surv"]))