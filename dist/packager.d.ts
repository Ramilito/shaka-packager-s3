/// <reference types="node" />
export type Input = {
    type: 'audio' | 'video' | 'text';
    key: string;
    filename: string;
    hlsName?: string;
};
export interface PackageFormatOptions {
    hlsOnly?: boolean;
    dashOnly?: boolean;
    segmentSingleFile?: boolean;
    segmentSingleFileTemplate?: string;
    segmentDuration?: number;
    dashManifestName?: string;
    hlsManifestName?: string;
    tsOutput?: boolean;
    videoStreamDescriptors?: Record<string, string>;
    audioStreamDescriptors?: Record<string, string>;
}
export interface PackageOptions {
    inputs: Input[];
    source?: string;
    dest: string;
    stagingDir?: string;
    noImplicitAudio?: boolean;
    packageFormatOptions?: PackageFormatOptions;
    shakaExecutable?: string;
    serviceAccessToken?: string;
    s3EndpointUrl?: string;
}
export declare function doPackage(opts: PackageOptions): Promise<void>;
export declare function prepare(stagingDir?: string): Promise<string>;
export declare function cleanup(stagingDir: string): Promise<void>;
export declare function download(input: Input, source?: URL, stagingDir?: string, serviceAccessToken?: string, endpointUrl?: string): Promise<string>;
export declare function uploadPackage(dest: URL, stagingDir: string, s3EndpointUrl?: string): Promise<void>;
export declare function createPackage(opts: PackageOptions): Promise<void>;
/**
 * Create shaka commandline arguments
 *
 * @param inputs List of inputs, filename needs to be a local path
 * @param noImplicitAudio Should we use first video file as audio source if no audio input is provided
 * @param packageFormatOptions Options for package format
 */
export declare function createShakaArgs(inputs: Input[], noImplicitAudio: boolean, packageFormatOptions?: PackageFormatOptions): string[];
//# sourceMappingURL=packager.d.ts.map