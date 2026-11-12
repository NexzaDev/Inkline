import { render } from "preact";

import { App } from "./app";
import "./styles/tokens.css";
import "./styles/app.css";

const root = document.getElementById("root");

if (root === null) {
  throw new Error("shell root element is missing");
}

render(<App />, root);
