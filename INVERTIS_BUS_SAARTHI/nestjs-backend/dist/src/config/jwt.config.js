"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("@nestjs/config");
exports.default = (0, config_1.registerAs)('jwt', () => ({
    secret: process.env.JWT_SECRET || 'supersecret_jwt_key_bus_saarthi_2025',
    expiresIn: '24h',
}));
//# sourceMappingURL=jwt.config.js.map