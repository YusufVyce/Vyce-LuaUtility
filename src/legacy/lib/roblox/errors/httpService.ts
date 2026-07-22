import { ROBLOX_INSIGHTS } from "../insights";
import { ROBLOX_DEPRECATED } from "../deprecated";
import { ROBLOX_PERFORMANCE } from "../performance";
import { ROBLOX_SECURITY } from "../security";

import type {
  Analysis,
  Cause,
  CodeInsight,
  DeprecatedApi,
  ErrorEntry,
} from "../../types";

export const HTTP_SERVICE: ErrorEntry = {
  id: "roblox-http-service",
  title: "HTTP service error",

  pattern:
/http 400|http 401|http 403|http 404|http 429|http 500|http 502|http 503|too many requests|jsondecode|jsonencode|http timeout|httprequest failed/i,

  analyze(logText, codeText) {

    const causes: Cause[] = [];
    const fixes: string[] = [];
    let example = "";

    const codeInsights: CodeInsight[] = [];
    const deprecatedApis: DeprecatedApi[] = [];
    const performanceIssues: Analysis["performanceIssues"] = [];
    const securityIssues: Analysis["securityIssues"] = [];

    for (const i of ROBLOX_INSIGHTS) {
      if (
        codeText.includes(i.pattern) ||
        codeText.includes(i.pattern.replace(":", "."))
      ) {
        codeInsights.push({
          title: i.title,
          description: i.description,
        });
      }
    }

    for (const d of ROBLOX_DEPRECATED) {
      if (codeText.includes(d.pattern)) {
        deprecatedApis.push({
          api: d.api,
          replacement: d.replacement,
          reason: d.reason,
        });
      }
    }

    for (const p of ROBLOX_PERFORMANCE) {
      if (codeText.includes(p.pattern)) {
        performanceIssues.push({
          title: p.title,
          impact: p.impact,
          description: p.description,
        });
      }
    }

    for (const s of ROBLOX_SECURITY) {
      if (codeText.includes(s.pattern)) {
        securityIssues.push({
          title: s.title,
          severity: s.severity,
          description: s.description,
        });
      }
    }

    if (/http 429/i.test(logText)) {

      causes.push({
        percent:99,
        text:"The remote API rate limit has been exceeded."
      });

      causes.push({
        percent:1,
        text:"Too many requests were sent in a short period."
      });

      fixes.push(
        "Throttle outgoing requests and retry with exponential backoff."
      );

      example =
`task.wait(2)

local response =
HttpService:GetAsync(url)`;

    }

    else if (/http 500|http 502|http 503/i.test(logText)) {

      causes.push({
        percent:98,
        text:"The remote server returned an internal error."
      });

      causes.push({
        percent:2,
        text:"The service is temporarily unavailable."
      });

      fixes.push(
        "Retry later and wrap the request inside pcall()."
      );

      example =
`local success,result =
pcall(function()

    return HttpService:GetAsync(url)

end)`;

    }

    else if (/http 403|forbidden/i.test(logText)) {

      causes.push({
        percent:99,
        text:"The server rejected the request because access is forbidden."
      });

      fixes.push(
        "Verify authentication headers, API keys and endpoint permissions."
      );

      example =
`headers = {

    ["Authorization"] = token

}`;

    }

    else if (/jsondecode|jsonencode/i.test(logText)) {

      causes.push({
        percent:99,
        text:"Invalid JSON data was supplied."
      });

      fixes.push(
        "Validate JSON before encoding or decoding."
      );

      example =
`local data =
HttpService:JSONDecode(body)`;

    }
    else if (/http timeout|timed out|timeout/i.test(logText)) {

      causes.push({
        percent:99,
        text:"The HTTP request exceeded the allowed response time."
      });

      causes.push({
        percent:1,
        text:"The remote API is responding too slowly."
      });

      fixes.push(
        "Retry the request later and avoid blocking game logic while waiting."
      );

      example =
`local success,response =
pcall(function()

    return HttpService:GetAsync(url)

end)`;

    }

    else if (/http 400|bad request/i.test(logText)) {

      causes.push({
        percent:99,
        text:"The request sent to the API is malformed."
      });

      causes.push({
        percent:1,
        text:"One or more parameters are invalid."
      });

      fixes.push(
        "Verify the request body, URL and query parameters."
      );

      example =
`local body =
HttpService:JSONEncode(data)`;

    }

    else if (/http 401|unauthorized/i.test(logText)) {

      causes.push({
        percent:99,
        text:"Authentication failed."
      });

      causes.push({
        percent:1,
        text:"The API key or authorization token is invalid."
      });

      fixes.push(
        "Check your authentication credentials."
      );

      example =
`headers = {

    ["Authorization"] = apiKey

}`;

    }

    else if (/http 404|not found/i.test(logText)) {

      causes.push({
        percent:99,
        text:"The requested API endpoint does not exist."
      });

      causes.push({
        percent:1,
        text:"The request URL is incorrect."
      });

      fixes.push(
        "Verify the endpoint URL."
      );

      example =
`https://api.example.com/v1/users`;

    }

    else {

      causes.push({
        percent:91,
        text:"The HTTP request failed."
      });

      causes.push({
        percent:9,
        text:"The remote API returned an unexpected response."
      });

      fixes.push(
        "Wrap HTTP requests inside pcall() and handle failures gracefully."
      );

      example =
`local success,response =
pcall(function()

    return HttpService:GetAsync(url)

end)`;

    }

    return {
      explanation:
        "An HTTP request failed because of networking issues, server-side problems, authentication, invalid requests or malformed JSON.",

      causes,
      fixes,
      example,

      severity: "High",
      confidence: 98,

      warnings: [
        {
          title: "External Service",
          description:
            "HTTP requests depend on external services and should always be treated as unreliable.",
        },
      ],

      relatedErrors: [
        "DataStore request was throttled",
        "invalid argument",
        "Script exhausted allowed execution time",
      ],

      preventionTips: [
        "Always wrap HTTP requests with pcall().",
        "Retry temporary failures with exponential backoff.",
        "Validate JSON before sending.",
        "Never hardcode secrets inside client scripts.",
        "Handle every possible HTTP status code.",
      ],

      codeInsights,
      deprecatedApis,
      performanceIssues,
      securityIssues,
    };
  },
};