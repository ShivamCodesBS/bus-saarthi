import { SosService } from './sos.service';
export declare class SosController {
    private readonly sosService;
    constructor(sosService: SosService);
    trigger(req: any): Promise<{
        status: string;
        message: string;
    }>;
    cancel(req: any): Promise<{
        status: string;
        message: string;
    }>;
}
export declare class SosAliasController {
    private readonly sosService;
    constructor(sosService: SosService);
    triggerAlias(req: any): Promise<{
        status: string;
        message: string;
    }>;
}
