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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createShakaArgs = exports.createPackage = exports.uploadPackage = exports.download = exports.cleanup = exports.prepare = exports.doPackage = void 0;
const node_path_1 = __importStar(require("node:path"));
const node_child_process_1 = require("node:child_process");
const node_fs_1 = require("node:fs");
const promises_1 = require("node:fs/promises");
const util_1 = require("./util");
const mv_1 = __importDefault(require("mv"));
const DEFAULT_STAGING_DIR = '/tmp/data';
function validateOptions(opts) {
    if (opts?.packageFormatOptions?.hlsOnly &&
        opts?.packageFormatOptions?.dashOnly) {
        throw new Error('Cannot disable both hls and dash');
    }
    if (opts?.packageFormatOptions?.segmentSingleFileTemplate &&
        opts?.packageFormatOptions?.segmentSingleFileTemplate.indexOf('$KEY$') ===
            -1) {
        throw new Error('segmentSingleFileTemplate must contain $KEY$');
    }
}
async function doPackage(opts) {
    validateOptions(opts);
    const stagingDir = await prepare(opts.stagingDir);
    await createPackage({ ...opts, stagingDir });
    if ((0, util_1.toUrl)(opts.dest).protocol === 's3:') {
        // We don't want to upload source files to S3
        await removeDownloadedFiles(opts.inputs, stagingDir);
    }
    await uploadPackage((0, util_1.toUrl)(opts.dest), stagingDir, opts.s3EndpointUrl);
    await cleanup(stagingDir);
}
exports.doPackage = doPackage;
async function prepare(stagingDir = DEFAULT_STAGING_DIR) {
    const jobId = Math.random().toString(36).substring(7);
    const jobDir = (0, node_path_1.join)(stagingDir, jobId);
    if (!(0, node_fs_1.existsSync)(jobDir)) {
        (0, node_fs_1.mkdirSync)(jobDir, { recursive: true });
    }
    return jobDir;
}
exports.prepare = prepare;
async function cleanup(stagingDir) {
    console.log(`Cleaning up staging directory: ${stagingDir}`);
    await (0, node_fs_1.rmSync)(stagingDir, { recursive: true, force: true });
}
exports.cleanup = cleanup;
async function download(input, source, stagingDir, serviceAccessToken, endpointUrl) {
    let sourceURL;
    let inputFileURL;
    if (input.filename.includes('://')) {
        console.log('input.filename has an absolute URL:', input.filename);
        inputFileURL = (0, util_1.toUrlOrUndefined)(input.filename);
    }
    if (inputFileURL) {
        sourceURL = inputFileURL;
    }
    else if (source) {
        sourceURL = source;
    }
    else {
        return input.filename;
    }
    if (!sourceURL.protocol || sourceURL.protocol === 'file:') {
        return node_path_1.default.resolve(sourceURL.pathname || '.', input.filename);
    }
    if (!stagingDir) {
        throw new Error('Staging directory required for remote download');
    }
    if (sourceURL.protocol === 's3:') {
        let sourceFileS3URL;
        if (inputFileURL) {
            sourceFileS3URL = inputFileURL;
        }
        else {
            sourceFileS3URL = new URL((0, node_path_1.join)(sourceURL.pathname, input.filename), sourceURL);
        }
        const localFilename = (0, node_path_1.join)(stagingDir, inputFileURL ? node_path_1.default.basename(input.filename) : input.filename);
        const args = (0, util_1.createS3cmdArgs)(['cp', sourceFileS3URL.toString(), localFilename], endpointUrl);
        const { status, stderr } = (0, node_child_process_1.spawnSync)('aws', args);
        if (status !== 0) {
            if (stderr) {
                console.log(stderr.toString());
            }
            throw new Error('Download failed');
        }
        console.log(`Downloaded ${input.filename} to ${localFilename}`);
        return localFilename;
    }
    else if (sourceURL.protocol === 'http:' ||
        sourceURL.protocol === 'https:') {
        let sourceFileURL;
        if (inputFileURL) {
            sourceFileURL = inputFileURL;
        }
        else {
            const baseUrl = sourceURL.href.endsWith('/')
                ? sourceURL.href
                : sourceURL.href + '/';
            const filePath = input.filename.startsWith('/')
                ? input.filename.substring(1)
                : input.filename;
            sourceFileURL = new URL(filePath, baseUrl);
        }
        const localFilename = (0, node_path_1.join)(stagingDir, node_path_1.default.basename(input.filename));
        const auth = [];
        if (serviceAccessToken) {
            auth.push('-H');
            auth.push(`x-jwt: Bearer ${serviceAccessToken}`);
        }
        const { status, stderr, error } = (0, node_child_process_1.spawnSync)('curl', auth.concat(['-o', localFilename, sourceFileURL.toString()]));
        if (status !== 0) {
            if (error) {
                console.error(`Download failed: ${error.message}`);
            }
            else {
                console.error(`Download failed with exit code ${status}`);
                console.log(stderr.toString());
            }
            throw new Error('Download failed');
        }
        console.log(`Downloaded ${input.filename} to ${localFilename}`);
        return localFilename;
    }
    else {
        const protocol = sourceURL.protocol;
        throw new Error(`Unsupported protocol for download: ${protocol}`);
    }
}
exports.download = download;
async function removeDownloadedFiles(inputs, stagingDir) {
    console.log(`Removing downloaded files from ${stagingDir}`);
    for (const input of inputs) {
        let inputFileURL;
        if (input.filename.includes('://')) {
            inputFileURL = (0, util_1.toUrlOrUndefined)(input.filename);
        }
        const localFilename = (0, node_path_1.join)(stagingDir, inputFileURL ? node_path_1.default.basename(input.filename) : input.filename);
        console.log(`Removing ${localFilename}`);
        if ((0, node_fs_1.existsSync)(localFilename)) {
            (0, node_fs_1.unlinkSync)(localFilename);
        }
        else {
            console.log(`File not found: ${localFilename}`);
        }
    }
}
async function moveFile(src, dest) {
    return new Promise((resolve, reject) => {
        (0, mv_1.default)(src, dest, (err) => (err ? reject(err) : resolve(dest)));
    });
}
async function uploadPackage(dest, stagingDir, s3EndpointUrl) {
    if (!dest.protocol || dest.protocol === 'file:') {
        await (0, promises_1.mkdir)(dest.pathname, { recursive: true });
        const files = await (0, promises_1.readdir)(stagingDir);
        await Promise.all(files.map((file) => moveFile((0, node_path_1.join)(stagingDir, file), (0, node_path_1.join)(dest.pathname, file))));
        return;
    }
    if (dest.protocol === 's3:') {
        console.log(`Uploading package to ${dest.toString()}`);
        const args = (0, util_1.createS3cmdArgs)(['cp', '--recursive', stagingDir, dest.toString()], s3EndpointUrl);
        const { status, error } = (0, node_child_process_1.spawnSync)('aws', args, {
            stdio: 'ignore'
        });
        if (status !== 0) {
            if (error) {
                console.error(`Upload failed: ${error.message}`);
            }
            else {
                console.error(`Upload failed with exit code ${status}`);
            }
            throw new Error('Upload failed');
        }
        console.log(`Uploaded package to ${dest.toString()}`);
    }
    else {
        throw new Error(`Unsupported protocol for upload: ${dest.protocol}`);
    }
}
exports.uploadPackage = uploadPackage;
async function createPackage(opts) {
    const { inputs, source, stagingDir, noImplicitAudio, serviceAccessToken, s3EndpointUrl } = opts;
    const sourceUrl = (0, util_1.toUrlOrUndefined)(source);
    const downloadedInputs = await Promise.all(inputs.map(async (input) => {
        const filename = await download(input, sourceUrl, stagingDir, serviceAccessToken, s3EndpointUrl);
        return {
            ...input,
            filename
        };
    }));
    const args = createShakaArgs(downloadedInputs, noImplicitAudio === true, opts.packageFormatOptions);
    console.log(args);
    const shaka = opts.shakaExecutable || 'packager';
    const { status, stderr, error } = (0, node_child_process_1.spawnSync)(shaka, args, {
        cwd: stagingDir
    });
    if (status !== 0) {
        if (error) {
            console.error(`Packager failed: ${error.message}`);
        }
        else {
            console.error(`Packager failed with exit code ${status}`);
            console.error(stderr.toString());
        }
        throw new Error('Packager failed');
    }
}
exports.createPackage = createPackage;
/**
 * Create shaka commandline arguments
 *
 * @param inputs List of inputs, filename needs to be a local path
 * @param noImplicitAudio Should we use first video file as audio source if no audio input is provided
 * @param packageFormatOptions Options for package format
 */
function createShakaArgs(inputs, noImplicitAudio, packageFormatOptions) {
    const cmdInputs = [];
    inputs.forEach((input) => {
        if (input.type === 'video') {
            const playlistName = `video-${input.key}`;
            const playlist = `${playlistName}.m3u8`;
            const streamOptions = [
                `in=${input.filename}`,
                'stream=video',
                `playlist_name=${playlist}`
            ];
            if (packageFormatOptions?.segmentSingleFile) {
                const segmentName = packageFormatOptions.segmentSingleFileTemplate?.replace('$KEY$', input.key) || `${playlistName}.mp4`;
                streamOptions.push(`out=${segmentName}`);
            }
            else {
                if (packageFormatOptions?.tsOutput) {
                    const segmentTemplate = (0, node_path_1.join)(playlistName, '$Number$.ts');
                    streamOptions.push(`segment_template=${segmentTemplate}`);
                }
                else {
                    const initSegment = (0, node_path_1.join)(playlistName, 'init.mp4');
                    const segmentTemplate = (0, node_path_1.join)(playlistName, '$Number$.m4s');
                    streamOptions.push(`init_segment=${initSegment}`, `segment_template=${segmentTemplate}`);
                }
            }
            if (packageFormatOptions?.videoStreamDescriptors) {
                for (const [key, value] of Object.entries(packageFormatOptions.videoStreamDescriptors)) {
                    streamOptions.push(`${key}=${value}`);
                }
            }
            cmdInputs.push(streamOptions.join(','));
        }
        if (input.type === 'text') {
            const playlistName = `text-${input.key}`;
            const playlist = `${playlistName}.m3u8`;
            const segmentTemplate = (0, node_path_1.join)(playlistName, '$Number$.vtt');
            const streamOptions = [
                `in=${input.filename}`,
                'stream=text',
                `segment_template=${segmentTemplate}`,
                `playlist_name=${playlist}`,
                'hls_group_id=text',
                ...(input.hlsName ? [`hls_name=${input.hlsName}`] : [])
            ];
            cmdInputs.push(streamOptions.join(','));
        }
    });
    const inputForAudio = getInputForAudio(inputs, noImplicitAudio);
    if (inputForAudio) {
        const playlistName = `audio`;
        const playlist = `${playlistName}.m3u8`;
        const fileForAudio = inputForAudio.filename;
        const streamOptions = [
            `in=${fileForAudio}`,
            'stream=audio',
            `playlist_name=${playlist}`,
            'hls_group_id=audio',
            `hls_name=${inputForAudio.hlsName || 'defaultaudio'}`
        ];
        if (packageFormatOptions?.segmentSingleFile) {
            // Ensure non-duplicate key, to ensure unique segment file name
            const key = inputs.find((input) => input.type === 'video' && input.key == inputForAudio.key)
                ? `audio-${inputForAudio.key}`
                : inputForAudio?.key;
            const segmentName = packageFormatOptions.segmentSingleFileTemplate?.replace('$KEY$', key) ||
                `${playlistName}.mp4`;
            streamOptions.push(`out=${segmentName}`);
        }
        else {
            const segmentTemplate = packageFormatOptions?.tsOutput
                ? 'audio/$Number$.aac'
                : 'audio/$Number$.m4s';
            if (packageFormatOptions?.tsOutput) {
                streamOptions.push(`segment_template=${segmentTemplate}`);
            }
            else {
                streamOptions.push(`init_segment=${playlistName}/init.mp4`, `segment_template=${segmentTemplate}`);
            }
        }
        if (packageFormatOptions?.audioStreamDescriptors) {
            for (const [key, value] of Object.entries(packageFormatOptions.audioStreamDescriptors)) {
                streamOptions.push(`${key}=${value}`);
            }
        }
        cmdInputs.push(streamOptions.join(','));
    }
    else {
        console.log('No audio input found');
    }
    if (packageFormatOptions?.dashOnly !== true) {
        cmdInputs.push('--hls_master_playlist_output', packageFormatOptions?.hlsManifestName || 'index.m3u8');
    }
    if (packageFormatOptions?.hlsOnly !== true) {
        cmdInputs.push('--generate_static_live_mpd', '--mpd_output', packageFormatOptions?.dashManifestName || 'manifest.mpd');
    }
    if (packageFormatOptions?.segmentDuration) {
        cmdInputs.push('--segment_duration', packageFormatOptions.segmentDuration.toString());
    }
    return cmdInputs;
}
exports.createShakaArgs = createShakaArgs;
function getInputForAudio(inputs, noImplicitAudio) {
    if (noImplicitAudio) {
        return inputs.find((input) => input.type === 'audio');
    }
    return (inputs.find((input) => input.type === 'audio') ||
        inputs.find((input) => input.type === 'video'));
}
//# sourceMappingURL=packager.js.map