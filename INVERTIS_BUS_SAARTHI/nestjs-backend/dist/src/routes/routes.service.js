"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoutesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const route_entity_1 = require("./entities/route.entity");
const user_entity_1 = require("../users/entities/user.entity");
let RoutesService = class RoutesService {
    routesRepository;
    usersRepository;
    constructor(routesRepository, usersRepository) {
        this.routesRepository = routesRepository;
        this.usersRepository = usersRepository;
    }
    async findAll() {
        return this.routesRepository.find();
    }
    async findOne(routeId) {
        const route = await this.routesRepository.findOne({ where: { routeId } });
        if (!route) {
            throw new common_1.NotFoundException(`Route ${routeId} not found`);
        }
        let driver = null;
        if (route.driverId) {
            driver = await this.usersRepository.findOne({
                where: { loginId: route.driverId },
                select: { id: true, loginId: true, name: true, phone: true }
            });
        }
        return {
            ...route,
            driver
        };
    }
    async create(body) {
        const existing = await this.routesRepository.findOne({ where: { routeId: body.route_id } });
        if (existing)
            throw new common_1.ConflictException(`Route ${body.route_id} already exists`);
        const route = this.routesRepository.create({
            routeId: body.route_id,
            routeName: body.route_name,
            busNumber: body.bus_number,
            driverId: body.driver_id,
            stops: typeof body.stops === 'string' ? body.stops : JSON.stringify(body.stops || []),
            city: body.city || 'Bareilly',
            vehicleModel: body.vehicleModel,
            registrationNumber: body.registrationNumber,
            seatingCapacity: body.seatingCapacity ? parseInt(body.seatingCapacity, 10) : null,
            insuranceExpiry: body.insuranceExpiry ? new Date(body.insuranceExpiry) : null,
        });
        await this.routesRepository.save(route);
        return { status: 'success', message: 'Route created', route };
    }
    async update(routeId, body) {
        const route = await this.routesRepository.findOne({ where: { routeId } });
        if (!route)
            throw new common_1.NotFoundException(`Route ${routeId} not found`);
        if (body.route_name !== undefined)
            route.routeName = body.route_name;
        if (body.bus_number !== undefined)
            route.busNumber = body.bus_number;
        if (body.driver_id !== undefined)
            route.driverId = body.driver_id;
        if (body.stops !== undefined)
            route.stops = typeof body.stops === 'string' ? body.stops : JSON.stringify(body.stops);
        if (body.city !== undefined)
            route.city = body.city;
        if (body.vehicleModel !== undefined)
            route.vehicleModel = body.vehicleModel;
        if (body.registrationNumber !== undefined)
            route.registrationNumber = body.registrationNumber;
        if (body.seatingCapacity !== undefined)
            route.seatingCapacity = parseInt(body.seatingCapacity, 10);
        if (body.insuranceExpiry !== undefined)
            route.insuranceExpiry = body.insuranceExpiry ? new Date(body.insuranceExpiry) : null;
        await this.routesRepository.save(route);
        return { status: 'success', message: 'Route updated', route };
    }
    async remove(routeId) {
        const route = await this.routesRepository.findOne({ where: { routeId } });
        if (!route)
            throw new common_1.NotFoundException(`Route ${routeId} not found`);
        await this.routesRepository.remove(route);
        return { status: 'success', message: 'Route deleted' };
    }
};
exports.RoutesService = RoutesService;
exports.RoutesService = RoutesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(route_entity_1.Route)),
    __param(1, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], RoutesService);
//# sourceMappingURL=routes.service.js.map