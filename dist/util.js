"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createS3cmdArgs = exports.toUrl = exports.toUrlOrUndefined = void 0;
const node_path_1 = __importDefault(require("node:path"));
function toUrlOrUndefined(url) {
    if (!url) {
        return undefined;
    }
    return toUrl(url);
}
exports.toUrlOrUndefined = toUrlOrUndefined;
function toUrl(url) {
    return url.match(/^[a-z0-9]+:.*/)
        ? new URL(url)
        : new URL(`file://${node_path_1.default.resolve(url)}`);
}
exports.toUrl = toUrl;
function createS3cmdArgs(cmdArgs, s3EndpointUrl) {
    const args = ['s3'];
    if (s3EndpointUrl) {
        args.push(`--endpoint-url=${s3EndpointUrl}`);
    }
    return args.concat(cmdArgs);
}
exports.createS3cmdArgs = createS3cmdArgs;
//# sourceMappingURL=util.js.map