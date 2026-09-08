declare module 'sib-api-v3-sdk' {
  export class ApiClient {
    static instance: ApiClient;
    authentications: {
      'api-key': {
        apiKey: string;
      };
    };
  }

  export class TransactionalEmailsApi {
    sendTransacEmail(
      emailPayload: {
        to: Array<{ email: string }>;
        sender: {
          name: string;
          email: string;
        };
        subject: string;
        htmlContent: string;
      }
    ): Promise<any>;
  }

  const SibApiV3Sdk: {
    ApiClient: typeof ApiClient;
    TransactionalEmailsApi: typeof TransactionalEmailsApi;
  };

  export default SibApiV3Sdk;
}