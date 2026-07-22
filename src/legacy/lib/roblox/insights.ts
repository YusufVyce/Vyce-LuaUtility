export type RobloxInsight = {
  pattern: string;
  title: string;
  description: string;
};

export const ROBLOX_INSIGHTS: RobloxInsight[] = [
  {
    pattern: "FindFirstChild(",
    title: "FindFirstChild() detected",
    description:
      "FindFirstChild() can return nil if the object does not exist. Consider checking the result before accessing its properties."
  },

  {
    pattern: "WaitForChild(",
    title: "WaitForChild() detected",
    description:
      "WaitForChild() prevents nil references but may yield indefinitely if the object never appears. Consider adding a timeout."
  },

  {
    pattern: "Character",
    title: "Character access",
    description:
      "Character may not be loaded immediately after Player joins. Wait for CharacterAdded or check for nil."
  },

  {
    pattern: "GetChildren(",
    title: "GetChildren() detected",
    description:
      "GetChildren() creates a new table every time it is called. Cache the result if used repeatedly."
  },

  {
    pattern: "GetDescendants(",
    title: "GetDescendants() detected",
    description:
      "GetDescendants() can be expensive on large hierarchies. Avoid calling it every frame."
  },

  {
    pattern: ":Clone(",
    title: "Clone() detected",
    description:
      "Remember that cloned Instances are not parented automatically. Set Parent after cloning."
  },

  {
    pattern: ":Destroy(",
    title: "Destroy() detected",
    description:
      "Avoid using destroyed instances later in the script. Clear references after Destroy()."
  },

  {
    pattern: "Instance.new(",
    title: "Instance.new() detected",
    description:
      "Assign the Parent property after configuring the instance to avoid unnecessary replication updates."
  },

  {
    pattern: "RemoteEvent",
    title: "RemoteEvent detected",
    description:
      "Never trust data received from the client. Always validate arguments on the server."
  },

  {
    pattern: "RemoteFunction",
    title: "RemoteFunction detected",
    description:
      "Avoid long operations inside RemoteFunction callbacks. Clients wait until the server responds."
  },

  {
    pattern: "Humanoid",
    title: "Humanoid detected",
    description:
      "Cache the Humanoid reference instead of repeatedly searching for it."
  },

  {
    pattern: "TweenService",
    title: "TweenService detected",
    description:
      "Reuse TweenInfo objects and cancel unused tweens."
  },

  {
    pattern: "Debris",
    title: "Debris detected",
    description:
      "Use Debris:AddItem() for temporary instances."
  },

  {
    pattern: "RunService",
    title: "RunService detected",
    description:
      "Avoid heavy work inside RenderStepped or Heartbeat."
  },

  {
    pattern: "UserInputService",
    title: "UserInputService detected",
    description:
      "Disconnect input connections when they are no longer needed."
  },

  {
    pattern: "DataStoreService",
    title: "DataStoreService detected",
    description:
      "Always wrap DataStore calls with pcall()."
  },

  {
    pattern: "CollectionService",
    title: "CollectionService detected",
    description:
      "Tags are usually easier to maintain than large object lists."
  },

  {
    pattern: ":Raycast(",
    title: "Raycast detected",
    description:
      "Reuse RaycastParams whenever possible."
  }
];