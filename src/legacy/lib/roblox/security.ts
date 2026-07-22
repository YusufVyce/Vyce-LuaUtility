export type SecurityIssue = {
  pattern: string;
  title: string;
  severity: "Low" | "Medium" | "High";
  description: string;
};

export const ROBLOX_SECURITY: SecurityIssue[] = [
  {
    pattern: "FireServer(",
    title: "RemoteEvent Validation",
    severity: "High",
    description:
      "Never trust data sent from the client. Always validate arguments on the server."
  },
  {
    pattern: "InvokeServer(",
    title: "RemoteFunction Validation",
    severity: "High",
    description:
      "Server responses should validate all incoming data before processing."
  },
  {
    pattern: "RemoteEvent.OnServerEvent",
    title: "Client Trust",
    severity: "High",
    description:
      "Never assume a client cannot send fake values."
  }
];