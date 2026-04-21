const path = require("path")

const cooldowns = require('./cooldowns');
const { BaseModule } = require(path.join(__dirname, "..", "base.js"))

const MODULE_NAME = "cooldown"


class CooldownModule extends BaseModule {
	constructor () {
		super(MODULE_NAME)

		// Объект для хранения времени последнего использования команды с аргументами для каждого пользователя
	    this.userCooldowns = {};
	}

	check_cooldown(sender, cmd, args) {
	    const cmdCooldowns = cooldowns[cmd]
	    if (!cmdCooldowns) {
	        return { is_ok: true }; // Если команда не найдена в настройках, кулдауна нет
	    }
	 	let cooldownTime, userCooldownKey;
	    if (args.length === 0) {
	    	userCooldownKey = `${cmd}_${cmd}`;
	    	cooldownTime = cmdCooldowns[cmd]
	    	if (!cooldownTime) {
	    		cooldownTime = 0;
	    	}

	    } else {
		    let lastArgWithCooldown = null;

		    if (args.length === 0) {
		    	lastArgWithCooldown = cmd
		    } 
		    
		    for (let i=0; i < args.length; i++) {
		    	if (cmdCooldowns[args[i]] !== undefined) {
		            lastArgWithCooldown = args[i];
		            break;
		        }
		    }

		    if (!lastArgWithCooldown) {
		        // Если ни у одного аргумента нет кулдауна
		        return {
		            type: "answ",
		            content: {
			            message: `Возникла ошибка определения кулдауна команды`,
			            recipient: sender
		            }
		        } 
		    }

		    cooldownTime = cmdCooldowns[lastArgWithCooldown];
		    //console.log(cooldownTime)
		    if (cooldownTime[0] === "*") {
		    	lastArgWithCooldown = cooldownTime.replace("*", "");
		    	cooldownTime = cmdCooldowns[lastArgWithCooldown];
		    	//console.log(cooldownTime)
		    }
		    userCooldownKey = `${cmd}_${lastArgWithCooldown}`;


	    }
	    // Инициализируем объект для пользователя, если его ещё нет
	    if (!this.userCooldowns[sender]) {
	        this.userCooldowns[sender] = {};
	    }

	    const lastUsedTime = this.userCooldowns[sender][userCooldownKey] || 0;

	    const currentTime = Math.floor(Date.now() / 1000);
	    if (currentTime - lastUsedTime < cooldownTime) {
	        const remainingTime = cooldownTime - (currentTime - lastUsedTime);
	        return {
	            type: "answ",
	            content: {
		            message: `До возможности использования этой команды осталось ${remainingTime} секунд.`,
		            recipient: sender
	            }
	        }
	    }

	    // Обновляем время последнего использования для пользователя
	    this.userCooldowns[sender][userCooldownKey] = currentTime;
	    return { is_ok: true };
	}
}


module.exports = CooldownModule

