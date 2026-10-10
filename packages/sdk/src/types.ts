export type ExtensionKind='generation-provider'|'media-provider'|'effect'|'analyzer'|'exporter'|'qc-rule';
export type ExtensionPermission='network'|'read-project-assets'|'write-staging'|'gpu'|'model-runtime'|'credential-handle';
export interface ExtensionManifest{id:string;name:string;version:string;apiVersion:1;kinds:ExtensionKind[];entry:string;permissions:ExtensionPermission[];capabilities:Record<string,unknown>}
export interface ExtensionGrant{extensionId:string;permissions:ExtensionPermission[]}
export interface ExtensionInvocationContext{grant:ExtensionGrant;projectId:string;stagingRoot?:string;credentialHandles?:string[];signal:AbortSignal}
