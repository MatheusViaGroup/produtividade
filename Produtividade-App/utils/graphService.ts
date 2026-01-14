
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

const SITE_CONFIG = {
    host: "vialacteoscombr.sharepoint.com",
    path: "/sites/Powerapps"
};

export const LISTS = {
    CARGAS: { id: "0cf9a45c-db41-40b0-9f04-fd1a867fca77" },
    USUARIOS: { id: "955d46da-c8d9-432e-9047-faf2beaadf8b" },
    PLANTAS: { id: "2422eb52-73b9-414f-aff9-7e00084a7e5f" },
    CAMINHOES: { id: "4f02e028-69f7-4964-a5e9-f39835f46321" },
    MOTORISTAS: { id: "da434e30-60f5-43a5-8a30-698247a25f9a" }
};

export class GraphService {
    private client: Client;
    private siteId: string = "";

    constructor(token: string) {
        this.client = Client.init({
            authProvider: (done) => done(null, token)
        });
    }

    async resolveSites() {
        try {
            const site = await this.client.api(`/sites/${SITE_CONFIG.host}:${SITE_CONFIG.path}`).get();
            this.siteId = site.id;
            console.log("✅ Conectado ao SharePoint:", SITE_CONFIG.path);
        } catch (e: any) {
            console.error("❌ Erro ao conectar ao site:", e.message);
            throw new Error(`Acesso negado ao site Powerapps. Verifique as permissões do Azure.`);
        }
    }

    static async hasActiveAccount() {
        const msalApp = await getMsal();
        return msalApp.getAllAccounts().length > 0;
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
            return (await msalApp.acquireTokenSilent({ scopes, account: accounts[0] })).accessToken;
        } catch (error) {
            return (await msalApp.acquireTokenPopup({ scopes, account: accounts[0] })).accessToken;
        }
    }

    async getListItems(listId: string) {
        if (!this.siteId) return [];
        try {
            const response = await this.client
                .api(`/sites/${this.siteId}/lists/${listId}/items`)
                .expand("fields")
                .top(5000)
                .get();
            
            return response.value.map((item: any) => ({
                id: item.id,
                ...item.fields
            }));
        } catch (error: any) {
            console.error(`Erro ao ler lista ${listId}:`, error.message);
            return [];
        }
    }

    async createItem(listId: string, fields: any) {
        return await this.client
            .api(`/sites/${this.siteId}/lists/${listId}/items`)
            .post({ fields });
    }

    async updateItem(listId: string, itemId: string, fields: any) {
        return await this.client
            .api(`/sites/${this.siteId}/lists/${listId}/items/${itemId}/fields`)
            .patch(fields);
    }

    async deleteItem(listId: string, itemId: string) {
        return await this.client
            .api(`/sites/${this.siteId}/lists/${listId}/items/${itemId}`)
            .delete();
    }
}
