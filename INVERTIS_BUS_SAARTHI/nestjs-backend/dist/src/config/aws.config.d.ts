declare const _default: (() => {
    accessKeyId: string | undefined;
    secretAccessKey: string | undefined;
    region: string;
    s3Bucket: string | undefined;
    rekognitionCollection: string | undefined;
    confidenceThreshold: number;
    minSharpness: number;
    minBrightness: number;
    minFaceConfidence: number;
}) & import("@nestjs/config").ConfigFactoryKeyHost<{
    accessKeyId: string | undefined;
    secretAccessKey: string | undefined;
    region: string;
    s3Bucket: string | undefined;
    rekognitionCollection: string | undefined;
    confidenceThreshold: number;
    minSharpness: number;
    minBrightness: number;
    minFaceConfidence: number;
}>;
export default _default;
