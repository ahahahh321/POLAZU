import { readFile } from "node:fs/promises";
import path from "node:path";
import ButtonPlayground from "./ButtonPlayground";
import "../../(home)/reference-home.css";
import "./playground.css";

export const metadata = { title: "Button Playground · POLAZU" };

export default async function Page() {
  const directory = path.join(process.cwd(), "app", "playground", "button");
  const [source, stylesheet] = await Promise.all([
    readFile(path.join(directory, "PolazuButton.tsx"), "utf8"),
    readFile(path.join(directory, "polazu-button.css"), "utf8"),
  ]);
  return <ButtonPlayground source={source} stylesheet={stylesheet} />;
}
