import * as index from "./src/index.js";
import * as repl from "repl";

const replServer = repl.start({ prompt: "fol-parser> " });

// Make all exports from index available in the REPL context
Object.assign(replServer.context, index);

console.log("Loaded exports from index.ts");