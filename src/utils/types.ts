import { AxiosError, AxiosResponse } from "axios";
import { AuthorizeServerConfig } from "../commands/api/authorize.js";

export interface DailyData {
  [key: string]: object[];
}

export interface ApiHandler {
  isReady: () => boolean;
  getApiName: () => string;
  getApiBaseUrl: () => string;
  getApiAuthHeaders: () => Promise<{ [key: string]: string }>;
  endpointsPrimary: (EpHistoric | EpSnapshot)[];
  endpointsSecondary: EpSecondary[];
  getAuthorizeConfig?: () => AuthorizeServerConfig;
}

export interface EpSnapshot {
  isHistoric: () => false;
  getDirName: () => string;
  getEndpoint: () => string;
  getDelay: () => number;
  getMethod?: () => "get" | "post";
  getParams?: () => object;
  getRequestData?: () => object;
  getNextCallParams?: (response: AxiosResponse, params?: object) => object;
  transformResponseData?: (
    response: AxiosResponse,
    existingData?: [] | object
  ) => [] | object;
  parseDayFromEntity?: (entity: object) => string;
  handleApiError?: (response: AxiosError) => void;
}

export interface EpHistoric
  extends Omit<EpSnapshot, "isHistoric" | "parseDayFromEntity"> {
  isHistoric: () => true;
  parseDayFromEntity: (entity: object) => string;
  getHistoricParams: (currentParams?: object, didReturnData?: boolean) => object;
  getHistoricDelay: (continuation?: boolean) => number;
  transformPrimary?: (entity: object | []) => unknown[];
  shouldHistoricContinue?: (responseData: object | [], params: object) => boolean;
}

export interface EpSecondary {
  getDirName: (entity?: object) => string;
  getEndpoint: (entity: object) => string;
  getPrimary: () => string;
  getIdentifier: (entity: object) => string;
  getParams?: () => object;
  getMethod?: () => string;
  getRequestData?: () => object;
  transformResponseData?: (
    response: AxiosResponse,
    existingData?: [] | object
  ) => [] | object;
}

export interface EndpointRecord {
  endpoint: string;
  params: object;
}

export interface ImportHandler {
  importFiles: ImportFileHandler[];
}

export interface ImportFileHandler {
  getDirName: () => string;
  parsingStrategy: () => "csv" | "json" | "vcf";
  getImportPath?: () => string;
  parseDayFromEntity?: (entity: object | []) => string;
  transformEntity?: (entity: object | []) => object | null;
  transformFileContents?: (content: string) => string;
  transformParsedData?: (data: object | []) => (object | string[])[];
  handleEntityFiles?: (entity: object, importPath: string) => void;
}
