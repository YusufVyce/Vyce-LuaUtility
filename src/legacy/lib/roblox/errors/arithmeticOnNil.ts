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

export const ARITHMETIC_ON_NIL: ErrorEntry = {
  id: "roblox-arithmetic-on-nil",
  title: "Attempt to perform arithmetic on nil",
  pattern:
    /attempt to perform arithmetic.*nil|attempt to (add|subtract|multiply|divide).*nil/i,

  analyze(logText, codeText) {
    const causes: Cause[] = [];
    const fixes: string[] = [];

    let example = "";

    const codeInsights: CodeInsight[] = [];
    const deprecatedApis: DeprecatedApi[] = [];

    const performanceIssues: Analysis["performanceIssues"] = [];
    const securityIssues: Analysis["securityIssues"] = [];

    for (const insight of ROBLOX_INSIGHTS) {
      const matched =
        codeText.includes(insight.pattern) ||
        codeText.includes(insight.pattern.replace(":", "."));

      if (matched) {
        codeInsights.push({
          title: insight.title,
          description: insight.description,
        });
      }
    }

    for (const deprecated of ROBLOX_DEPRECATED) {
      if (codeText.includes(deprecated.pattern)) {
        deprecatedApis.push({
          api: deprecated.api,
          replacement: deprecated.replacement,
          reason: deprecated.reason,
        });
      }
    }

    for (const issue of ROBLOX_PERFORMANCE) {
      if (codeText.includes(issue.pattern)) {
        performanceIssues.push({
          title: issue.title,
          impact: issue.impact,
          description: issue.description,
        });
      }
    }

    for (const issue of ROBLOX_SECURITY) {
      if (codeText.includes(issue.pattern)) {
        securityIssues.push({
          title: issue.title,
          severity: issue.severity,
          description: issue.description,
        });
      }
    }

    if (!codeText) {

      causes.push({
        percent: 90,
        text: "A nil value is being used in an arithmetic operation.",
      });

      fixes.push(
        "Paste the related script so Detector can determine where the nil value originates."
      );

      example =
`local coins = 0

print(coins + 5)`;
    }

    else if (
      codeText.includes("+") ||
      codeText.includes("+=")
    ) {

      causes.push({
        percent: 96,
        text: "A nil value is being added to another value.",
      });

      causes.push({
        percent: 4,
        text: "The variable was never initialized before the addition.",
      });

      fixes.push(
        "Initialize the variable before using the + operator."
      );

      fixes.push(
        "Use 'or 0' when a numeric value may be nil."
      );

      example =
`local coins = playerCoins or 0

print(coins + 5)`;
    }

    else if (
      codeText.includes("-") ||
      codeText.includes("-=")
    ) {

      causes.push({
        percent: 96,
        text: "A subtraction operation is using a nil value.",
      });

      causes.push({
        percent: 4,
        text: "The numeric variable has not been assigned yet.",
      });

      fixes.push(
        "Ensure the variable contains a number before subtracting."
      );

      example =
`local health = currentHealth or 100

health -= 10`;
    }
    else if (
      codeText.includes("*") ||
      codeText.includes("*=")
    ) {

      causes.push({
        percent: 97,
        text: "A multiplication operation is using a nil value.",
      });

      causes.push({
        percent: 3,
        text: "One of the operands was never assigned a numeric value.",
      });

      fixes.push(
        "Initialize every numeric variable before multiplication."
      );

      example =
`local damage = baseDamage or 0

local total = damage * 2`;
    }

    else if (
      codeText.includes("/") ||
      codeText.includes("/=")
    ) {

      causes.push({
        percent: 96,
        text: "A division operation received a nil value.",
      });

      causes.push({
        percent: 4,
        text: "The divisor or dividend is nil.",
      });

      fixes.push(
        "Verify both values are valid numbers before division."
      );

      example =
`local speed = walkSpeed or 16

local value = speed / 2`;
    }

    else if (
      codeText.includes("%")
    ) {

      causes.push({
        percent: 95,
        text: "The modulo operator (%) is being used with a nil value.",
      });

      causes.push({
        percent: 5,
        text: "The variable expected to contain a number is nil.",
      });

      fixes.push(
        "Ensure both operands contain numeric values."
      );

      example =
`local index = currentIndex or 0

print(index % 2)`;
    }

    else if (
      codeText.includes("^")
    ) {

      causes.push({
        percent: 95,
        text: "The exponent operator (^) received a nil operand.",
      });

      causes.push({
        percent: 5,
        text: "One of the exponent values was never initialized.",
      });

      fixes.push(
        "Assign default numeric values before exponent operations."
      );

      example =
`local power = level or 1

print(power ^ 2)`;
    }

    else {

      causes.push({
        percent: 88,
        text: "A nil value is participating in an arithmetic expression.",
      });

      causes.push({
        percent: 12,
        text: "A function returned nil where a number was expected.",
      });

      fixes.push(
        "Trace every variable used in the arithmetic expression."
      );

      fixes.push(
        "Use typeof() and print() to identify which variable is nil."
      );

      example =
`print(typeof(value))

assert(value ~= nil)

local result = value + 1`;
    }
    return {
      explanation:
        "A nil value was used in an arithmetic operation. Roblox only allows arithmetic on numeric values.",

      causes,
      fixes,
      example,

      severity: "High",
      confidence: 95,

      warnings: [
        {
          title: "Nil Arithmetic",
          description:
            "Arithmetic operators cannot be used with nil values. Initialize variables before performing calculations.",
        },
      ],

      relatedErrors: [
        "attempt to index nil with",
        "attempt to call a nil value",
        "invalid argument",
      ],

      preventionTips: [
        "Initialize numeric variables with a default value.",
        "Use 'or 0' when a variable may be nil.",
        "Validate function return values before calculations.",
        "Use assertions for values that should never be nil.",
      ],

      codeInsights,
      deprecatedApis,
      performanceIssues,
      securityIssues,
    };
  },
};