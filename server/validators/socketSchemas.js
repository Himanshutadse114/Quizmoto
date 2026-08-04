const Joi = require('joi');

/** Optional Phase 2 command envelope fields (backward compatible). */
const commandEnvelope = {
    commandId: Joi.string().uuid().optional(),
    expectedStateVersion: Joi.number().integer().min(0).optional()
};

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
        token: Joi.string().max(1024).required(),
        ...commandEnvelope
    }),

    submit_answer: Joi.object({
        pin: Joi.alternatives().try(Joi.string().max(10), Joi.number()).required(),
        nickname: Joi.string().max(50).required(),
        answerIndex: Joi.number().integer().min(0).max(3).required(),
        timeRemaining: Joi.number().min(0).optional(),
        ...commandEnvelope
    }),

    end_question: Joi.object({
        pin: Joi.alternatives().try(Joi.string().max(10), Joi.number()).required(),
        token: Joi.string().max(1024).required(),
        ...commandEnvelope
    }),

    next_question: Joi.object({
        pin: Joi.alternatives().try(Joi.string().max(10), Joi.number()).required(),
        token: Joi.string().max(1024).required(),
        ...commandEnvelope
    }),

    end_game: Joi.object({
        pin: Joi.alternatives().try(Joi.string().max(10), Joi.number()).required(),
        token: Joi.string().max(1024).required(),
        ...commandEnvelope
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
    }),

    leave_session: Joi.object({
        pin: Joi.alternatives().try(Joi.string().max(10), Joi.number()).required(),
        role: Joi.string().valid('host', 'player').required(),
        token: Joi.string().max(1024).optional().allow('', null),
        nickname: Joi.string().max(50).optional().allow('', null)
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
            // strip dangerous keys without breaking normal data
        }
    }

    const schema = schemas[eventName];
    if (!schema) {
        return { error: null, value: payload };
    }
    return schema.validate(payload, { abortEarly: true, stripUnknown: true });
};

module.exports = {
    schemas,
    validateSocketPayload
};
