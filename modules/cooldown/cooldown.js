const module_name = "cooldown"

const cooldowns = require('./cooldowns');

// Объект для хранения времени последнего использования команды с аргументами для каждого пользователя
const userCooldowns = {};

function check_cooldown(sender, cmd, args) {
	try {

	    const cmdCooldowns = cooldowns[cmd]
	    if (!cmdCooldowns) {
	        return { is_ok: true }; // Если команда не найдена в настройках, кулдауна нет
	    }
	 	var cooldownTime, lastUsedTime, userCooldownKey;
	    if (args.length == 0) {
	    	userCooldownKey = `${cmd}_${cmd}`;
	    	cooldownTime = cmdCooldowns[cmd]
	    	if (!cooldownTime) {
	    		cooldownTime = 0;
	    	}

	    } else {
		    let lastArgWithCooldown = null;

		    if (args.length == 0) {
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
		    if (cooldownTime[0] == "*") {
		    	lastArgWithCooldown = cooldownTime.replace("*", "");
		    	cooldownTime = cmdCooldowns[lastArgWithCooldown];
		    	//console.log(cooldownTime)
		    }
		    userCooldownKey = `${cmd}_${lastArgWithCooldown}`;


	    }
	    // Инициализируем объект для пользователя, если его ещё нет
	    if (!userCooldowns[sender]) {
	        userCooldowns[sender] = {};
	    }

	    lastUsedTime = userCooldowns[sender][userCooldownKey] || 0;

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
	    userCooldowns[sender][userCooldownKey] = currentTime;
	    return { is_ok: true };
	} catch (error) {
		return {"type": "error", "content": {"date_time": new Date(), "module_name": module_name, "error": error, "args": [cmd, args]}}
	}
}

module.exports = {module_name, check_cooldown}

