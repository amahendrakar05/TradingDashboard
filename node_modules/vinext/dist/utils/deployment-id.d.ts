//#region src/utils/deployment-id.d.ts
declare const NEXT_DEPLOYMENT_ID_HEADER = "x-deployment-id";
declare function getDeploymentId(): string | undefined;
declare function appendDeploymentIdQuery(value: string, deploymentId?: string | undefined): string;
declare function appendAssetDeploymentIdQuery(value: string, deploymentId?: string | undefined): string;
declare function applyDeploymentIdHeader(headers: Headers, deploymentId?: string | undefined): void;
//#endregion
export { NEXT_DEPLOYMENT_ID_HEADER, appendAssetDeploymentIdQuery, appendDeploymentIdQuery, applyDeploymentIdHeader, getDeploymentId };