"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("@nestjs/config");
exports.default = (0, config_1.registerAs)('app', () => ({
    port: parseInt(process.env.PORT || '5000', 10),
    webhookSecret: process.env.WEBHOOK_SECRET || 'invertis_hardware_secret_2026',
}));
//# sourceMappingURL=app.config.js.map