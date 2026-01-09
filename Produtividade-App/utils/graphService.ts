
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
        storeAuthStateInCookie: true,
    }
};

let msalInstance: msal.PublicClientApplication | null = null;

export async function getMsal() {
    if (!msalInstance) {
        msalInstance = new msal.PublicClientApplication(msalConfig);
        await msalInstance.initialize();
        await msalInstance.handleRedirectPromise();
    }
    return msalInstance;
}

const SITE_PATHS = {
    POWERAPPS: { host: "vialacteoscombr.sharepoint.com", path: "/sites/Powerapps" },
    PERSONAL: { host: "vialacteoscombr-my.sharepoint.com", path: "/personal/matheus_henrique_viagroup_com_br" }
};

export const LISTS = {
    CARGAS: { id: "0cf9a45c-db41-40b0-9f04-fd1a867fca77", siteRef: "POWERAPPS" },
    USUARIOS: { id: "bb6b7559-4d05-4036-ad5a-ab5b136ff2a5", siteRef: "POWERAPPS" },
    PLANTAS: { id: "6034003e-d0a9-4d22-a250-b36de06dfba1", siteRef: "PERSONAL" },
    CAMINHOES: { id: "6d0e876c-4d6c-4617-b8ec-de8d64f6c508", siteRef: "PERSONAL" },
    MOTORISTAS: { id: "a8b55455-02df-4aa9-a231-567c3ac27f7c", siteRef: "PERSONAL" }
};

export class GraphService {
    private client: Client;
    private siteIds: Record<string, string> = {};

    constructor(token: string) {
        this.client = Client.init({
            authProvider: (done) => done(null, token)
        });
    }

    async resolveSites() {
        console.log("Iniciando resolução de sites...");
        for (const [key, config] of Object.entries(SITE_PATHS)) {
            try {
                // Tenta resolver pelo path absoluto
                const site = await this.client.api(`/sites/${config.host}:${config.path}`).get();
                this.siteIds[key] = site.id;
                console.log(`Site ${key} ok: ${site.id}`);
            } catch (error: any) {
                console.warn(`Erro ao resolver site ${key}:`, error.message);
                // Se falhar o personal, o app ainda pode funcionar para o Admin
                if (key === 'POWERAPPS') throw error;
            }
        }
    }

    static async hasActiveAccount() {
        const msalApp = await getMsal();
        const accounts = msalApp.getAllAccounts();
        return accounts.length > 0;
    }

    static async getAccessToken() {
        const msalApp = await getMsal();
        const accounts = msalApp.getAllAccounts();
        const scopes = ["Sites.ReadWrite.All", "User.Read"];

        if (accounts.length === 0) {
            const loginResponse = await msalApp.loginPopup({ scopes, prompt: "select_account" });
            return loginResponse.accessToken;
        }

        try {
            const tokenResponse = await msalApp.acquireTokenSilent({ scopes, account: accounts[0] });
            return tokenResponse.accessToken;
        } catch (error) {
            console.log("Silent token fail, using popup...");
            const loginResponse = await msalApp.acquireTokenPopup({ scopes, account: accounts[0] });
            return loginResponse.accessToken;
        }
    }

    async getListItems(listConfig: { id: string, siteRef: string }) {
        const siteId = this.siteIds[listConfig.siteRef];
        if (!siteId) {
            console.error(`Site ID ausente para ${listConfig.siteRef}`);
            return [];
        }

        try {
            const response = await this.client
                .api(`/sites/${siteId}/lists/${listConfig.id}/items`)
                .expand("fields")
                .get();
            
            return response.value.map((item: any) => ({
                id: item.id,
                ...item.fields
            }));
        } catch (error: any) {
            console.error(`Erro ao ler lista ${listConfig.id}:`, error.message);
            return [];
        }
    }

    async createItem(listConfig: { id: string, siteRef: string }, fields: any) {
        const siteId = this.siteIds[listConfig.siteRef];
        return await this.client
            .api(`/sites/${siteId}/lists/${listConfig.id}/items`)
            .post({ fields });
    }

    async updateItem(listConfig: { id: string, siteRef: string }, itemId: string, fields: any) {
        const siteId = this.siteIds[listConfig.siteRef];
        return await this.client
            .api(`/sites/${siteId}/lists/${listConfig.id}/items/${itemId}/fields`)
            .patch(fields);
    }
}
