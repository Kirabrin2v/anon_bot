const mitt = require("mitt");

const emitter = mitt();
const wrappedHandlers = new WeakMap();

const safeEmitter = {
    on(type, handler) {
        const wrapped = (event) => {
            try {
                const result = handler(event);

                if (result && typeof result.catch === "function") {
                    result.catch((error) => {
                        console.error(`[BUS ERROR] ${type}`, error);
                    });
                }
            } catch (error) {
                console.error(`[BUS ERROR] ${type}`, error);
            }
        };

        wrappedHandlers.set(handler, wrapped);
        emitter.on(type, wrapped);
    },

    off(type, handler) {
        try {
            emitter.off(
                type,
                wrappedHandlers.get(handler) || handler
            );

            wrappedHandlers.delete(handler);
        } catch (error) {
            console.error(`[BUS ERROR] ${type}`, error);
        }
    },

    emit(type, event) {
        try {
            emitter.emit(type, event);
        } catch (error) {
            console.error(`[BUS ERROR] ${type}`, error);
        }
    }
};

module.exports = safeEmitter;