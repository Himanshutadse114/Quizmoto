const Joi = require('joi');

const schemas = {
    join_room: Joi.object({
        pin: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
        nickname: Joi.string().allow('', null).optional(),
        role: Joi.string().valid('host', 'player', 'player_check').required(),
        avatar: Joi.string().optional().allow('', null),
        token: Joi.string().optional().allow('', null),
        teamName: Joi.string().optional().allow('', null),
        playerProfileToken: Joi.string().optional().allow('', null)
    }),

    start_question: Joi.object({
        pin: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
        token: Joi.string().required()
    }),

    submit_answer: Joi.object({
        pin: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
        nickname: Joi.string().required(),
        answerIndex: Joi.number().integer().min(0).max(3).required(),
        timeRemaining: Joi.number().min(0).optional()
    }),

    end_question: Joi.object({
        pin: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
        token: Joi.string().required()
    }),

    next_question: Joi.object({
        pin: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
        token: Joi.string().required()
    }),

    end_game: Joi.object({
        pin: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
        token: Joi.string().required()
    }),

    host_kick_player: Joi.object({
        pin: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
        token: Joi.string().required(),
        playerId: Joi.number().integer().required()
    }),
    
    change_mode: Joi.object({
        pin: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
        token: Joi.string().required(),
        mode: Joi.string().valid('classic', 'team').required()
    }),

    send_reaction: Joi.object({
        pin: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
        emoji: Joi.string().required()
    })
};

/**
 * Validates a payload against a Joi schema.
 * @param {string} eventName - The name of the event (used to find the schema)
 * @param {Object} payload - The data received from the client
 * @returns {Object} { error, value } - If error exists, validation failed.
 */
const validateSocketPayload = (eventName, payload) => {
    const schema = schemas[eventName];
    if (!schema) {
        // If there's no schema, we pass it by default (or we could enforce strict mode)
        return { value: payload };
    }
    return schema.validate(payload, { stripUnknown: true });
};

module.exports = {
    schemas,
    validateSocketPayload
};
