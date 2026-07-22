export const ANALYZER_EXAMPLES: {
  error: string;
  code: string;
}[] = [
  {
    error: "ServerScriptService.Inventory:41: attempt to index nil with 'Value'",
    code:
      "local player = game.Players.LocalPlayer\nlocal leaderstats = player.leaderstats\nlocal coins = leaderstats.Coins\n\nprint(coins.Value)",
  },
];
