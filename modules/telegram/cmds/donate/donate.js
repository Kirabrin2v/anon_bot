const path = require("path")

const BaseCmd = require(path.join(__dirname, "..", "base.js"))


const CMD_NAME = "donate"
const STRUCTURE = {
  _description: "Безвозмездное пожертвование",
};


class DonateCmd extends BaseCmd {
    constructor(module_obj) {
        super(module_obj, CMD_NAME, STRUCTURE)

        this.module_obj.tg.on("callback_query", async (query) => {
            console.log("Зашло в колбек", query)
            const chatId = query.message.chat.id;
              const starsMap = {
                stars_1:   1, 
                stars_50:  50,
                stars_100: 100,
                stars_250: 250,
                stars_500: 500,
              };

              const amount = starsMap[query.data];
              if (!amount) {return;}

              await this.module_obj.tg.answerCallbackQuery(query.id);

              // sendInvoice для Stars: currency = 'XTR', provider_token = ''
              await this.module_obj.tg.sendInvoice(
                chatId,
                'Донат автору',
                `Спасибо за поддержку ${amount} Stars!`,
                `donate_${amount}_${query.from.id}`,
                '',          // provider_token — пустой для Stars
                'XTR',       // currency — Stars
                [{ label: 'Донат', amount }]
              );
        })
        this.module_obj.tg.on('pre_checkout_query', (query) => {
          this.module_obj.tg.answerPreCheckoutQuery(query.id, true);
        });
        this.module_obj.tg.on('successful_payment', (msg) => {
          const payment = msg.successful_payment;
          const stars = payment.total_amount;

          console.log(`Донат: ${stars} Stars от @${msg.from.username} (${msg.from.id})`);
          console.log(`Payload: ${payment.invoice_payload}`);

          this.module_obj.tg.sendMessage(msg.chat.id,
            `Большое спасибо за ${stars} ⭐!`
          );
        });
    }

    _process(sender, args) {
        let answ;
        return "В разработке"
        if (args.length === 0) {
            console.log("Зашло")
            const keyboard = {
                inline_keyboard: [
                [
                  { text: '⭐ 1 Star', callback_data: 'stars_1' }
                ],
                [
                  { text: '⭐ 50 Stars',  callback_data: 'stars_50'  },
                  { text: '⭐ 100 Stars', callback_data: 'stars_100' },
                ],
                [
                  { text: '⭐ 250 Stars', callback_data: 'stars_250' },
                  { text: '⭐ 500 Stars', callback_data: 'stars_500' },
                ],
              ]
            }
            return {
                message: "⭐ Выберите сумму доната:",
                keyboard
            }
        }
    }
}


module.exports = DonateCmd
