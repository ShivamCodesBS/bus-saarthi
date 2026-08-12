declare const _default: (() => {
    postgres: {
        url: string | undefined;
        directUrl: string | undefined;
        synchronize: boolean;
    };
}) & import("@nestjs/config").ConfigFactoryKeyHost<{
    postgres: {
        url: string | undefined;
        directUrl: string | undefined;
        synchronize: boolean;
    };
}>;
export default _default;
