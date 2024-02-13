import axios, { AxiosResponse } from "axios";

import { envWrite } from "../../utils/fs.js";
import { ApiEndpoint, ApiEnrichEndpoint } from "../../utils/types.js";

const { 
  WAHOO_AUTHORIZE_CLIENT_ID, 
  WAHOO_AUTHORIZE_CLIENT_SECRET, 
  WAHOO_REFRESH_TOKEN 
} = process.env;

////
/// Types
//

interface WahooWorkoutEntity {
  day: string;
  [key: string]: unknown;
}

////
/// Exports
//

const authorizeEndpoint = "https://api.wahooligan.com/oauth/authorize";
const tokenEndpoint = "https://api.wahooligan.com/oauth/token";

const getApiName = () => "wahoo";
const getApiBaseUrl = () => "https://api.wahooligan.com/v1/";

let accessToken = "";
const getApiAuthHeaders = async () => {
  if (!WAHOO_REFRESH_TOKEN) {
    console.log("❌ No Wahoo refresh token stored. See README for more information.");
    process.exit();
  }

  let tokenResponse: AxiosResponse;
  if (!accessToken) {
    tokenResponse = await axios.post(tokenEndpoint, {
      client_id: WAHOO_AUTHORIZE_CLIENT_ID,
      client_secret: WAHOO_AUTHORIZE_CLIENT_SECRET,
      refresh_token: WAHOO_REFRESH_TOKEN,
      grant_type: "refresh_token",
    });
    accessToken = tokenResponse.data.access_token;
    const newRefreshToken = tokenResponse.data.refresh_token;
    envWrite("WAHOO_REFRESH_TOKEN", WAHOO_REFRESH_TOKEN, newRefreshToken);
  }

  return {
    Authorization: `Bearer ${accessToken}`,
  };
};

const endpointsPrimary: ApiEndpoint[] = [
  {
    getEndpoint: () => "user",
    getDirName: () => "user",
  },
  {
    getEndpoint: () => "workouts",
    getDirName: () => "workouts",
    getParams: () => ({
      page: 1,
      per_page: 50,
    }),
    parseDayFromEntity: (entity: WahooWorkoutEntity) => entity.day,
    transformResponseData: (response: AxiosResponse) => response.data.workouts,
  },
];

const endpointsSecondary: ApiEnrichEndpoint[] = [
];
export {
  authorizeEndpoint,
  tokenEndpoint,
  getApiName,
  getApiBaseUrl,
  getApiAuthHeaders,
  endpointsPrimary,
  endpointsSecondary,
};
