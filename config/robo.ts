import type { Config } from "robo.js";

export default <Config>{
  clientOptions: {
    intents: ["Guilds", "GuildMessages"],
  },
  logger: {
    level: "debug",
  },
  plugins: [],
  type: "robo",
};
