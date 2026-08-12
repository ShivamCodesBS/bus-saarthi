"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("@nestjs/config");
exports.default = (0, config_1.registerAs)('database', () => ({
    postgres: {
        url: process.env.DATABASE_URL,
        directUrl: process.env.DIRECT_URL,
        synchronize: process.env.NODE_ENV !== 'production',
    },
}));
//# sourceMappingURL=database.config.js.map