"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const typeorm_1 = require("typeorm");
const bcrypt = __importStar(require("bcrypt"));
const dotenv = __importStar(require("dotenv"));
const user_entity_1 = require("../src/users/entities/user.entity");
dotenv.config();
const pgUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
const pgDataSource = new typeorm_1.DataSource({
    type: 'postgres',
    url: pgUrl,
    entities: [__dirname + '/../src/**/*.entity{.ts,.js}'],
    synchronize: false,
});
async function checkAndCreateAdmin() {
    await pgDataSource.initialize();
    const userRepository = pgDataSource.getRepository(user_entity_1.User);
    const users = await userRepository.find({ take: 5 });
    console.log('Existing users in DB:');
    for (const u of users) {
        console.log(`- Login ID: ${u.loginId}, Role: ${u.role}, Name: ${u.name}`);
    }
    const adminExists = await userRepository.findOne({ where: { role: user_entity_1.UserRole.ADMIN } });
    if (!adminExists) {
        console.log('\nNo Admin found. Creating default admin...');
        const hashedPassword = await bcrypt.hash('admin123', 10);
        const defaultAdmin = userRepository.create({
            loginId: 'admin',
            name: 'System Admin',
            password: hashedPassword,
            role: user_entity_1.UserRole.ADMIN,
            feeStatus: user_entity_1.FeeStatus.PAID,
        });
        await userRepository.save(defaultAdmin);
        console.log('Default admin created:');
        console.log('Login ID: admin');
        console.log('Password: admin123');
    }
    else {
        console.log('\nAn admin user already exists. If you forgot the password, we can reset it.');
    }
    await pgDataSource.destroy();
}
checkAndCreateAdmin().catch(console.error);
//# sourceMappingURL=create-admin.js.map