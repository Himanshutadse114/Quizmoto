const Joi = require('joi');

const schemas = {
    join_room: Joi.object({
        pin: Joi.alternatives().try(Joi.string().max(10), Joi.number()).required(),
        nickname: Joi.string().max(50).allow('', null).optional(),
        role: Joi.string().valid('host', 'player', 'player_check').required(),
        avatar: Joi.string().max(255).optional().allow('', null),
        token: Joi.string().max(1024).optional().allow('', null),
        teamName: Joi.string().max(50).optional().allow('', null),
        playerProfileToken: Joi.string().max(1024).optional().allow('', null)
    }),

    start_question: Joi.object({
        pin: Joi.alternatives().try(Joi.string().max(10), Joi.number()).required(),
        token: Joi.string().max(1024).required()
    }),

    submit_answer: Joi.object({
        pin: Joi.alternatives().try(Joi.string().max(10), Joi.number()).required(),
        nickname: Joi.string().max(50).required(),
        answerIndex: Joi.number().integer().min(0).max(3).required(),
        timeRemaining: Joi.number().min(0).optional()
    }),

    end_question: Joi.object({
        pin: Joi.alternatives().try(Joi.string().max(10), Joi.number()).required(),
        token: Joi.string().max(1024).required()
    }),

    next_question: Joi.object({
        pin: Joi.alternatives().try(Joi.string().max(10), Joi.number()).required(),
        token: Joi.string().max(1024).required()
    }),

    end_game: Joi.object({
        pin: Joi.alternatives().try(Joi.string().max(10), Joi.number()).required(),
        token: Joi.string().max(1024).required()
    }),

    host_kick_player: Joi.object({
        pin: Joi.alternatives().try(Joi.string().max(10), Joi.number()).required(),
        token: Joi.string().max(1024).required(),
        playerId: Joi.number().integer().required()
    }),
    
    change_mode: Joi.object({
        pin: Joi.alternatives().try(Joi.string().max(10), Joi.number()).required(),
        token: Joi.string().max(1024).required(),
        mode: Joi.string().valid('classic', 'team').required()
    }),

    send_reaction: Joi.object({
        pin: Joi.alternatives().try(Joi.string().max(10), Joi.number()).required(),
        emoji: Joi.string().valid('👍', '❤️', '😂', '🎉', '🔥', '🤔', '😢', '👏').required()
    })
};

/**
 * Validates a payload against a Joi schema.
 * @param {string} eventName - The name of the event (used to find the schema)
 * @param {Object} payload - The data received from the client
 * @returns {Object} { error, value } - If error exists, validation failed.
 */
const validateSocketPayload = (eventName, payload) => {
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        if (Object.prototype.hasOwnProperty.call(payload, '__proto__')) {
            delete payload.__proto__;
        }
        if (Object.prototype.hasOwnProperty.call(payload, 'constructor')) {
            delete payload.constructor;
        }
    }

    const schema = schemas[eventName];
    if (!schema) {
        return { value: payload };
    }
    return schema.validate(payload, { stripUnknown: true });
};

module.exports = {
    schemas,
    validateSocketPayload
};
