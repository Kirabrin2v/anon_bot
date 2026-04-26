const mitt = require("mitt");

const emitter = mitt();

const safeEmitter = {
    on(type, handler) {
        const wrapped = (event) => {
            try {
                handler(event);
            } catch (e) {
                console.log(`[BUS ERROR] ${type}`, e);
            }
        };

        handler.__wrapped = wrapped;
        emitter.on(type, wrapped);
    },

    off(type, handler) {
        try {
            emitter.off(type, handler.__wrapped || handler);
        } catch (e) {
            console.log(`[BUS ERROR]`, e)
        }
    },

    emit(type, event) {
        try {
            emitter.emit(type, event);
        } catch (e) {
            console.log(`[BUS ERROR]`, e)
        }
    }
};

module.exports = safeEmitter;