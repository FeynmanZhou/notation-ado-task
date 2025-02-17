import * as fs from 'fs';
import * as path from 'path';
import * as taskLib from 'azure-pipelines-task-lib/task';

export async function getVaultCredentials(): Promise<{ [key: string]: string }> {
    let connectedService = taskLib.getInput("azurekvServiceConection", true);
    if (!connectedService) {
        console.log("No Azure Key Vualt service connection endpoint is specified");
        return {};
    }
    var authScheme = taskLib.getEndpointAuthorizationScheme(connectedService, true);
    if (!authScheme) {
        console.log("No authentication scheme is specified");
        return {};
    }

    let envVariables = {};
    switch (authScheme.toLocaleLowerCase()) {
        case "managedserviceidentity":
            // azure key vault plugin will automatially try managed idenitty
            console.log("Use managed idenity to access Azure Key Vault");
            break;
        case "serviceprincipal":
            let authType = taskLib.getEndpointAuthorizationParameter(connectedService, 'authenticationType', true);
            let cliPassword: string | undefined = "";
            var servicePrincipalId = taskLib.getEndpointAuthorizationParameter(connectedService, "serviceprincipalid", false);
            var tenantId = taskLib.getEndpointAuthorizationParameter(connectedService, "tenantid", false);

            if (authType == "spnCertificate") {
                taskLib.debug('certificate based endpoint');
                let certificateContent = taskLib.getEndpointAuthorizationParameter(connectedService, "servicePrincipalCertificate", false);
                let tempDir = taskLib.getVariable('Agent.TempDirectory') || taskLib.getVariable('system.DefaultWorkingDirectory');
                if (!tempDir) {
                    throw new Error('Agent.TempDirectory or system.DefaultWorkingDirectory is not set');
                }
                cliPassword = path.join(tempDir, 'spnCert.pem');
                fs.writeFileSync(cliPassword, certificateContent);
                envVariables = {
                    "AZURE_TENANT_ID": tenantId,
                    "AZURE_CLIENT_ID": servicePrincipalId,
                    "AZURE_CLIENT_CERTIFICATE_PATH": cliPassword,
                }
            }
            else {
                taskLib.debug('key based endpoint');
                cliPassword = taskLib.getEndpointAuthorizationParameter(connectedService, "serviceprincipalkey", false);
                envVariables = {
                    "AZURE_TENANT_ID": tenantId,
                    "AZURE_CLIENT_ID": servicePrincipalId,
                    "AZURE_CLIENT_SECRET": cliPassword,
                }
            }
            break;
        default:
            throw new Error(`Unsupported authentication scheme ${authScheme}`);
    }
    return envVariables;
}
