export interface ClientSessionUser {
  readonly id: string;
  readonly email?: string;
  readonly name?: string;
  readonly image?: string;
  readonly emailVerified?: boolean;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

export interface Session {
  readonly user: ClientSessionUser;
  readonly roles: readonly string[];
}

export interface ExchangeAuthMethod {
  readonly id: number;
  readonly exchange: string;
  readonly authType: string;
  readonly credentialMasked: string;
  readonly metaData?: Record<string, unknown>;
  readonly isActive: boolean;
  readonly updatedAt: string;
}

export interface AuthMethodInput {
  readonly exchange: string;
  readonly authType: string;
  readonly credential: string;
  readonly metaData?: Record<string, unknown>;
}

export interface AuthMethodsResponse {
  readonly methods: readonly ExchangeAuthMethod[] | null;
}
