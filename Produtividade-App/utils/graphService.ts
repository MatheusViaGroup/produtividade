
import * as msal from "@azure/msal-browser";
import { Client } from "@microsoft/microsoft-graph-client";

const msalConfig = {
    auth: {
        clientId: "3170544c-21a9-46db-97ab-c4da57a8e7bf", 
        authority: "https://login.microsoftonline.com/7d9754b3-dcdb-4efe-8bb7-c0e5587b86ed",
        redirectUri: window.location.origin,
        navigateToLoginRequestUrl: true
    },
    cache: {
        cacheLocation: "localStorage",
        storeAuthStateInCookie: false,
    }
};

let msalInstance: msal.PublicClientApplication | null = null;

async function getMsal() {
    if (!msalInstance) {
        msalInstance = new msal.PublicClientApplication(msalConfig);
        await msalInstance.initialize();
    }
    return msalInstance;
}

// Mapeamento dos Sites conforme URLs fornecidas
export const SITES = {
    POWERAPPS: "vialacteoscombr.sharepoint.com:/sites/Powerapps",
    PERSONAL: "vialacteoscombr-my.sharepoint.com:/personal/matheus_henrique_viagroup_com_br"
};

// IDs das listas sem os caracteres de escape %7B %7D
export const LISTS = {
    CARGAS: { id: "0cf9a45c-db41-40b0-9f04-fd1a867fca77", site: SITES.POWERAPPS },
    USUARIOS: { id: "bb6b7559-4d05-4036-ad5a-ab5b136ff2a5", site: SITES.POWERAPPS },
    PLANTAS: { id: "6034003e-d0a9-4d22-a250-b36de06dfba1", site: SITES.PERSONAL },
    CAMINHOES: { id: "6d0e876c-4d6c-4617-b8ec-de8d64f6c508", site: SITES.PERSONAL },
    MOTORISTAS: { id: "a8b55455-02df-4aa9-a231-567c3ac27f7c", site: SITES.PERSONAL }
};

export class GraphService {
    private client: Client;

    constructor(token: string) {
        this.client = Client.init({
            authProvider: (done) => done(null, token)
        });
    }

    static async getAccessToken() {
        const msalApp = await getMsal();
        const accounts = msalApp.getAllAccounts();
        
        const scopes = ["Sites.ReadWrite.All", "User.Read"];

        if (accounts.length === 0) {
            const loginResponse = await msalApp.loginPopup({
                scopes,
                prompt: "select_account"
            });
            return loginResponse.accessToken;
        }

        try {
            const tokenResponse = await msalApp.acquireTokenSilent({
                scopes,
                account: accounts[0]
            });
            return tokenResponse.accessToken;
        } catch (error) {
            console.warn("Silent token acquisition failed, retrying with popup", error);
            const loginResponse = await msalApp.acquireTokenPopup({
                scopes,
                account: accounts[0]
            });
            return loginResponse.accessToken;
        }
    }

    async getListItems(listConfig: { id: string, site: string }) {
        const response = await this.client
            .api(`/sites/${listConfig.site}/lists/${listConfig.id}/items`)
            .expand("fields")
            .get();
        return response.value.map((item: any) => ({
            id: item.id,
            ...item.fields
        }));
    }

    async createItem(listConfig: { id: string, site: string }, fields: any) {
        return await this.client
            .api(`/sites/${listConfig.site}/lists/${listConfig.id}/items`)
            .post({ fields });
    }

    async updateItem(listConfig: { id: string, site: string }, itemId: string, fields: any) {
        // SharePoint Graph API patch para fields usa o endpoint de fields do item
        return await this.client
            .api(`/sites/${listConfig.site}/lists/${listConfig.id}/items/${itemId}/fields`)
            .patch(fields);
    }
}
