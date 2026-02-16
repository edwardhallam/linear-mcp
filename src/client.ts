import { LinearClient } from "@linear/sdk";
import { LINEAR_API_KEY } from "./config.js";

export const linearClient = new LinearClient({ apiKey: LINEAR_API_KEY });
